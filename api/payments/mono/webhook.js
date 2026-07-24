import { json, methodNotAllowed } from '../../../lib/server/http.js';
import { readRawRequestBody, verifyMonoWebhookSignature } from '../../../lib/server/mono.js';
import { sendTelegramMessage } from '../../../lib/server/telegram.js';

export const config = {
    api: {
        bodyParser: false
    },
    maxDuration: 10
};

function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

function formatAmount(amount, currency) {
    const number = Number(amount);
    const value = Number.isFinite(number) ? number : amount;
    if (String(currency || '').toUpperCase() === 'UAH') {
        return `${value}₴`;
    }
    return `${value} ${String(currency || '').toUpperCase()}`.trim();
}

function formatKyivDate(rawValue) {
    const number = Number(rawValue);
    let millis = Date.now();

    if (Number.isFinite(number) && number > 0) {
        millis = number > 1e12 ? number : number * 1000;
    }

    return new Intl.DateTimeFormat('uk-UA', {
        timeZone: 'Europe/Kyiv',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(new Date(millis));
}

function formatWebhookMessage(invoice) {
    const reference = escapeHtml(invoice.reference || invoice.invoiceId || '-');
    const invoiceId = escapeHtml(invoice.invoiceId || '-');
    const status = escapeHtml(invoice.status || '-');
    const amountLabel = escapeHtml(formatAmount(invoice.amount, invoice.ccy));
    const paidAt = escapeHtml(formatKyivDate(invoice.modifiedDate || invoice.createdDate));
    const method = escapeHtml(invoice.paymentInfo?.paymentMethod || '-');
    const system = escapeHtml(invoice.paymentInfo?.paymentSystem || '-');
    const bank = escapeHtml(invoice.paymentInfo?.bank || '-');
    const transactionId = escapeHtml(invoice.paymentInfo?.tranId || invoice.paymentInfo?.rrn || '-');

    return [
        '<b>✅ ОПЛАТУ ПІДТВЕРДЖЕНО</b>',
        '',
        `🆔 <b>Номер:</b> ${reference}`,
        `🧾 <b>Invoice ID:</b> ${invoiceId}`,
        `💰 <b>Сума:</b> ${amountLabel}`,
        `📌 <b>Статус:</b> ${status}`,
        `🕒 <b>Час оплати:</b> ${paidAt}`,
        `<b>Payment Method:</b> ${method}`,
        `<b>Payment System:</b> ${system}`,
        `<b>Bank:</b> ${bank}`,
        `<b>Transaction ID:</b> ${transactionId}`,
        '<b>Order Source:</b> mono checkout'
    ].join('\n');
}

async function parseRawJson(req) {
    const raw = await readRawRequestBody(req);
    const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw || '');
    if (!text.trim()) return null;
    try {
        return { raw, json: JSON.parse(text) };
    } catch (e) {
        return null;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return methodNotAllowed(res, ['POST']);
    }

    const parsed = await parseRawJson(req);
    if (!parsed) {
        return json(res, 400, { error: 'Invalid JSON body' });
    }

    const xSign = String(req.headers['x-sign'] || req.headers['X-Sign'] || '').trim();
    if (!xSign) {
        return json(res, 400, { error: 'Missing X-Sign header' });
    }

    try {
        const valid = await verifyMonoWebhookSignature(parsed.raw, xSign);
        if (!valid) {
            return json(res, 401, { error: 'Invalid signature' });
        }

        const invoice = parsed.json || {};
        if (String(invoice.status || '').toLowerCase() === 'success') {
            await sendTelegramMessage(formatWebhookMessage(invoice));
        }

        return json(res, 200, {
            success: true,
            invoiceId: invoice.invoiceId || null,
            status: invoice.status || null,
            reference: invoice.reference || null
        });
    } catch (e) {
        return json(res, 500, { error: 'Failed to process mono webhook', details: e.message });
    }
}
