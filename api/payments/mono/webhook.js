import { json, methodNotAllowed, parseJsonBody } from '../../../lib/server/http.js';
import { sendTelegramMessage } from '../../../lib/server/telegram.js';

function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

function formatAmount(amount, currency) {
    const number = Number(amount);
    const code = String(currency || '').toUpperCase();
    const value = Number.isFinite(number) ? number : Number(amount) || 0;

    if (code === 'UAH' || code === '980') {
        const normalized = value / 100;
        const display = Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(2);
        return `${display}₴`;
    }

    return `${value} ${code}`.trim();
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

function normalizeInvoice(body) {
    return body?.invoice || body?.data || body?.payment || body || {};
}

function formatWebhookMessage(invoice) {
    const reference = escapeHtml(invoice.reference || invoice.invoiceId || invoice.orderId || '-');
    const invoiceId = escapeHtml(invoice.invoiceId || invoice.id || '-');
    const status = escapeHtml(invoice.status || '-');
    const amountLabel = escapeHtml(formatAmount(invoice.amount, invoice.ccy || invoice.currency));
    const paidAt = escapeHtml(formatKyivDate(invoice.modifiedDate || invoice.createdDate || invoice.date));
    const method = escapeHtml(invoice.paymentInfo?.paymentMethod || invoice.paymentMethod || '-');
    const system = escapeHtml(invoice.paymentInfo?.paymentSystem || invoice.paymentSystem || '-');
    const bank = escapeHtml(invoice.paymentInfo?.bank || invoice.bank || '-');
    const transactionId = escapeHtml(invoice.paymentInfo?.tranId || invoice.paymentInfo?.rrn || invoice.transactionId || '-');

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

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return methodNotAllowed(res, ['POST']);
    }

    const body = parseJsonBody(req);
    if (!body) {
        return json(res, 400, { error: 'Invalid JSON body' });
    }

    try {
        const invoice = normalizeInvoice(body);
        const status = String(invoice.status || '').toLowerCase();

        if (status === 'success') {
            await sendTelegramMessage(formatWebhookMessage(invoice));
        }

        return json(res, 200, {
            success: true,
            invoiceId: invoice.invoiceId || invoice.id || null,
            status: invoice.status || null,
            reference: invoice.reference || invoice.orderId || null
        });
    } catch (e) {
        return json(res, 500, { error: 'Failed to process mono webhook', details: e.message });
    }
}
