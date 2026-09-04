import { checkRateLimit } from '../../../lib/server/rate-limit.js';
import { getClientIp, json, methodNotAllowed, parseJsonBody } from '../../../lib/server/http.js';
import { appendMonoWebhookSecret, buildMonoInvoicePayload, createMonoInvoice, generateMonoOrderCode, getMonoConfig } from '../../../lib/server/mono.js';
import { getUserSession } from '../../../lib/server/session.js';
import { requireSupabaseConfig, supabaseRequest } from '../../../lib/server/supabase.js';
import { sendTelegramMediaGroup, sendTelegramMessage } from '../../../lib/server/telegram.js';

function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

function normalizeCustomer(customer) {
    if (!customer || typeof customer !== 'object') return null;

    const fio = String(customer.fio || '').trim();
    const phone = String(customer.phone || '').trim();
    const city = String(customer.city || '').trim();
    const delivery = String(customer.delivery || '').trim();
    const tg = String(customer.tg || '').trim().slice(0, 100);

    if (!fio || !phone || !city || !delivery) return null;

    return { fio, phone, city, delivery, tg };
}

function normalizeItems(items) {
    if (!Array.isArray(items) || items.length === 0) return [];

    return items
        .map((item) => {
            const title = String(item?.title || '').trim();
            const productId = item?.product_id != null ? String(item.product_id).trim() : null;
            const size = String(item?.size || '').trim();
            const quantity = Number(item?.quantity || 1);
            const price = Number(item?.price);

            if (!title || !Number.isFinite(price) || price <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
                return null;
            }

            return {
                product_id: productId || null,
                title,
                size,
                quantity,
                price,
                image: String(item?.image || '').trim(),
                productSlug: String(item?.productSlug || '').trim()
            };
        })
        .filter(Boolean);
}

function normalizeVisualItems(items) {
    if (!Array.isArray(items) || !items.length) return [];

    return items
        .map((item) => {
            const line = String(item?.line || '').trim();
            const image = String(item?.image || '').trim();
            if (!image) return null;
            return { line, image };
        })
        .filter(Boolean);
}

function normalizePromo(promo) {
    if (!promo || typeof promo !== 'object') return null;

    const code = String(promo.code || '').trim().toUpperCase();
    const discountPercent = Number(promo.discountPercent);
    const discountAmount = Number(promo.discountAmount);

    if (!code || !Number.isFinite(discountPercent) || discountPercent <= 0) {
        return null;
    }

    return {
        code,
        discountPercent,
        discountAmount: Number.isFinite(discountAmount) && discountAmount > 0 ? discountAmount : 0
    };
}

function normalizeFinanceSummary(value) {
    const summary = String(value || '').trim();
    if (!summary || summary.length > 1200) return '';
    return summary;
}

function addOrderIdToFinanceSummary(summary, orderId) {
    const text = normalizeFinanceSummary(summary);
    const code = escapeHtml(orderId);
    if (!text || !code || text.includes('🆔 <b>Номер:</b>')) return text;
    return text.replace('<b>СУММА</b>', `<b>СУММА</b>\n🆔 <b>Номер:</b> ${code}`);
}

async function insertOrderItemsWithFallback(orderId, items) {
    const itemRows = items.map((item) => ({
        order_id: orderId,
        product_id: item.product_id,
        title: item.title,
        price: item.price,
        quantity: item.quantity,
        size: item.size || null
    }));

    const bulkInsert = await supabaseRequest('order_items', {
        method: 'POST',
        body: itemRows,
        prefer: 'return=representation'
    });

    if (bulkInsert.ok) {
        const inserted = Array.isArray(bulkInsert.data) ? bulkInsert.data.length : itemRows.length;
        return { ok: true, inserted };
    }

    let inserted = 0;
    for (const row of itemRows) {
        const singleInsert = await supabaseRequest('order_items', {
            method: 'POST',
            body: row,
            prefer: 'return=representation'
        });
        if (singleInsert.ok) {
            inserted += 1;
        }
    }

    return { ok: inserted > 0, inserted };
}

function getBaseUrl(req) {
    const protoHeader = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    const protocol = protoHeader || 'https';
    if (!hostHeader) return '';
    return `${protocol}://${hostHeader}`;
}

function getRequestHost(req) {
    return String(req.headers['x-forwarded-host'] || req.headers.host || '')
        .split(',')[0]
        .trim()
        .toLowerCase();
}

function isSameSiteRequest(req) {
    const host = getRequestHost(req);
    if (!host) return false;

    const candidates = [req.headers.origin, req.headers.referer]
        .map((value) => String(value || '').trim())
        .filter(Boolean);

    if (!candidates.length) return false;

    return candidates.some((value) => {
        try {
            return new URL(value).host.toLowerCase() === host;
        } catch (e) {
            return false;
        }
    });
}

function resolveVisualItemsUrls(req, items) {
    const baseUrl = getBaseUrl(req);
    if (!baseUrl) return items;

    return items.map((item) => {
        if (/^https?:\/\//i.test(item.image)) return item;
        try {
            return {
                ...item,
                image: new URL(item.image, `${baseUrl}/`).toString()
            };
        } catch (e) {
            return item;
        }
    });
}

function buildRedirectUrl(baseRedirectUrl, reference, fallbackUrl) {
    const target = String(baseRedirectUrl || fallbackUrl || '').trim();
    if (!target) return '';

    try {
        const url = new URL(target);
        url.searchParams.set('mono_payment', 'success');
        url.searchParams.set('mono_reference', reference);
        return url.toString();
    } catch (e) {
        return target;
    }
}

function formatAmount(amount, currency) {
    const number = Number(amount);
    const normalized = Number.isFinite(number) ? number : 0;
    const code = String(currency || 'UAH').toUpperCase();
    if (code === 'UAH') return `${normalized}₴`;
    return `${normalized} ${code}`.trim();
}

function formatCreatedMessage({ orderId, amount, currency, customer, items, promo }) {
    const itemsBlock = items
        .map((item, index) => {
            const sizeLabel = item.size ? ` (${escapeHtml(item.size)})` : '';
            const lineTotal = Number(item.price) * Number(item.quantity);
            return `${index + 1}. ${escapeHtml(item.title)}${sizeLabel} x${item.quantity} - ${escapeHtml(formatAmount(lineTotal, currency))}`;
        })
        .join('\n');
    const delivery = String(customer.delivery || '').trim();
    const tgLine = customer.tg
        ? `💬 <b>TG / Коментар:</b> ${escapeHtml(customer.tg)}`
        : null;
    const promoHeaderLine = promo ? '<b>ЗАСТОСОВАНО ПРОМОКОД</b>' : null;
    const promoCodeLine = promo
        ? `🏷 <b>Промокод:</b> ${escapeHtml(promo.code)} (-${escapeHtml(String(promo.discountPercent))}%)`
        : null;
    const promoDiscountLine = promo && promo.discountAmount > 0
        ? `💸 <b>Знижка:</b> -${escapeHtml(formatAmount(promo.discountAmount, currency))}`
        : null;

    return [
        '<b>💀 НОВЕ ЗАМОВЛЕННЯ 💀</b>',
        promoHeaderLine,
        '',
        `🆔 <b>Номер:</b> ${escapeHtml(orderId)}`,
        `👤 <b>ПІБ:</b> ${escapeHtml(customer.fio)}`,
        `📞 <b>Тел:</b> ${escapeHtml(customer.phone)}`,
        `📦 <b>Доставка:</b> ${escapeHtml(delivery)}`,
        tgLine,
        '',
        '🛒 <b>Товари:</b>',
        itemsBlock || '-',
        promoCodeLine,
        promoDiscountLine,
        '',
        '💳 <b>Оплата:</b> mono checkout',
        '📌 <b>Статус:</b> created',
        `<b>💰 СУМА: ${escapeHtml(formatAmount(amount, currency))}</b>`
    ].filter((line) => line !== null && line !== undefined).join('\n');
}

async function saveOrderForAuthenticatedUser(req, amount, items) {
    const userSession = getUserSession(req);
    if (!userSession?.sub) {
        return null;
    }

    try {
        requireSupabaseConfig();

        const createOrder = await supabaseRequest('orders', {
            method: 'POST',
            body: {
                user_id: userSession.sub,
                total_price: amount,
                status: 'Пакування'
            },
            prefer: 'return=representation'
        });

        if (!createOrder.ok || !Array.isArray(createOrder.data) || createOrder.data.length === 0) {
            return null;
        }

        const order = createOrder.data[0];
        await insertOrderItemsWithFallback(order.id, items);
        return order.id;
    } catch (e) {
        return null;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return methodNotAllowed(res, ['POST']);
    }

    if (!isSameSiteRequest(req)) {
        return json(res, 403, { error: 'Forbidden request origin' });
    }

    const ip = getClientIp(req);
    const rate = checkRateLimit(`mono:create:${ip}`, 5, 10 * 60 * 1000);
    if (!rate.allowed) {
        return json(res, 429, { error: 'Too many requests. Try again later.' });
    }

    const body = parseJsonBody(req);
    if (!body) {
        return json(res, 400, { error: 'Invalid JSON body' });
    }

    const amount = Number(body.amount);
    const currency = String(body.currency || 'UAH').toUpperCase();
    const description = String(body.description || 'Hardcore Division order').trim();
    const customer = normalizeCustomer(body.customer);
    const items = normalizeItems(body.items);
    const visualItems = resolveVisualItemsUrls(req, normalizeVisualItems(body.orderItems));
    const promo = normalizePromo(body.promo);
    const financeSummary = normalizeFinanceSummary(body.financeSummary);
    const config = getMonoConfig();
    const baseUrl = getBaseUrl(req);
    const redirectUrl = String(body.redirectUrl || config.redirectUrl || '').trim() || (baseUrl ? `${baseUrl}/pages/index.html` : '');
    const webHookUrl = appendMonoWebhookSecret(
        String(config.webhookUrl || (baseUrl ? `${baseUrl}/api/payments/mono/webhook` : '')).trim()
    );

    if (!Number.isFinite(amount) || amount <= 0) {
        return json(res, 400, { error: 'Invalid amount' });
    }

    if (!customer) {
        return json(res, 400, { error: 'Invalid customer payload' });
    }

    if (!items.length) {
        return json(res, 400, { error: 'At least one item is required' });
    }

    const orderId = generateMonoOrderCode();
    const finalRedirectUrl = buildRedirectUrl(redirectUrl, orderId, config.redirectUrl);

    try {
        await saveOrderForAuthenticatedUser(req, amount, items);

        const payload = buildMonoInvoicePayload({
            amount,
            ccy: config.currency,
            orderId,
            description,
            redirectUrl: finalRedirectUrl,
            webHookUrl,
            items
        });

        const invoice = await createMonoInvoice(payload);

        const createdMessage = formatCreatedMessage({
            orderId,
            amount,
            currency,
            customer,
            items,
            promo
        });

        try {
            await sendTelegramMessage(createdMessage);
            const financeSummaryWithOrderId = addOrderIdToFinanceSummary(financeSummary, orderId);
            if (financeSummaryWithOrderId) {
                await sendTelegramMessage(financeSummaryWithOrderId);
            }
            if (visualItems.length) {
                await sendTelegramMediaGroup(visualItems);
            }
        } catch (notifyError) {
            console.error('Telegram create notification failed:', notifyError);
        }

        return json(res, 200, {
            success: true,
            invoiceId: invoice.invoiceId || null,
            pageUrl: invoice.pageUrl || invoice.appUrl || null,
            appUrl: invoice.appUrl || null,
            order_id: orderId
        });
    } catch (e) {
        return json(res, 500, { error: 'Failed to create mono payment', details: e.message });
    }
}
