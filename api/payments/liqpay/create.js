import { checkRateLimit } from '../../../lib/server/rate-limit.js';
import { getClientIp, json, methodNotAllowed, parseJsonBody } from '../../../lib/server/http.js';
import { buildLiqPayCheckoutPayload, generateLiqPayOrderCode } from '../../../lib/server/liqpay.js';
import { sendTelegramMessage } from '../../../lib/server/telegram.js';

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

    if (!fio || !phone || !city || !delivery) return null;

    return { fio, phone, city, delivery };
}

function normalizeItems(items) {
    if (!Array.isArray(items) || items.length === 0) return [];

    return items
        .map((item) => {
            const title = String(item?.title || '').trim();
            const size = String(item?.size || '').trim();
            const quantity = Number(item?.quantity || 1);
            const price = Number(item?.price);

            if (!title || !Number.isFinite(price) || price <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
                return null;
            }

            return { title, size, quantity, price };
        })
        .filter(Boolean);
}

function formatAmount(amount, currency) {
    const number = Number(amount);
    const normalized = Number.isFinite(number) ? number : 0;
    const code = String(currency || 'UAH').toUpperCase();
    if (code === 'UAH') return `${normalized}₴`;
    return `${normalized} ${code}`.trim();
}

function formatCreatedMessage({ orderId, amount, currency, customer, items }) {
    const itemsBlock = items
        .map((item, index) => {
            const sizeLabel = item.size ? ` (${escapeHtml(item.size)})` : '';
            const lineTotal = Number(item.price) * Number(item.quantity);
            return `${index + 1}. ${escapeHtml(item.title)}${sizeLabel} x${item.quantity} - ${escapeHtml(formatAmount(lineTotal, currency))}`;
        })
        .join('\n');

    return [
        '<b>💀 НОВЕ ЗАМОВЛЕННЯ 💀</b>',
        '',
        `🆔 <b>Номер:</b> ${escapeHtml(orderId)}`,
        `👤 <b>ПІБ:</b> ${escapeHtml(customer.fio)}`,
        `📞 <b>Тел:</b> ${escapeHtml(customer.phone)}`,
        `🏙️ <b>Місто:</b> ${escapeHtml(customer.city)}`,
        `📦 <b>Доставка:</b> ${escapeHtml(customer.delivery)}`,
        '',
        '🛒 <b>Товари:</b>',
        itemsBlock || '-',
        '💳 <b>Оплата:</b> Google Pay / Apple Pay (LiqPay)',
        '📌 <b>Статус:</b> created',
        `<b>💰 СУМА: ${escapeHtml(formatAmount(amount, currency))}</b>`
    ].join('\n');
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return methodNotAllowed(res, ['POST']);
    }

    const ip = getClientIp(req);
    const rate = checkRateLimit(`liqpay:create:${ip}`, 25, 15 * 60 * 1000);
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

    if (!Number.isFinite(amount) || amount <= 0) {
        return json(res, 400, { error: 'Invalid amount' });
    }

    if (!customer) {
        return json(res, 400, { error: 'Invalid customer payload' });
    }

    if (!items.length) {
        return json(res, 400, { error: 'At least one item is required' });
    }

    const orderId = generateLiqPayOrderCode();

    try {
        const payload = buildLiqPayCheckoutPayload({
            amount,
            currency,
            description,
            orderId
        });

        const createdMessage = formatCreatedMessage({
            orderId,
            amount,
            currency,
            customer,
            items
        });

        try {
            await sendTelegramMessage(createdMessage);
        } catch (notifyError) {
            // Do not block payment flow because of notification transport errors.
            console.error('Telegram create notification failed:', notifyError);
        }

        return json(res, 200, {
            success: true,
            checkout_url: payload.checkoutUrl,
            data: payload.data,
            signature: payload.signature,
            order_id: payload.orderId
        });
    } catch (e) {
        return json(res, 500, { error: 'Failed to create LiqPay payment', details: e.message });
    }
}
