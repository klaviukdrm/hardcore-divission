import { json, methodNotAllowed } from '../../../lib/server/http.js';
import { decodeLiqPayData, verifyLiqPaySignature } from '../../../lib/server/liqpay.js';
import { sendTelegramMessage } from '../../../lib/server/telegram.js';

const PAID_STATUSES = new Set(['success', 'sandbox']);

function parseCallbackBody(req) {
    if (req.body && typeof req.body === 'object') {
        return req.body;
    }

    if (typeof req.body === 'string') {
        const trimmed = req.body.trim();
        if (!trimmed) return {};

        try {
            return JSON.parse(trimmed);
        } catch (e) {
            const params = new URLSearchParams(trimmed);
            return {
                data: params.get('data'),
                signature: params.get('signature')
            };
        }
    }

    return {};
}

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

function formatPaidMessage(payment) {
    const orderId = escapeHtml(payment.order_id || '-');
    const status = escapeHtml(payment.status || '-');
    const amountLabel = escapeHtml(formatAmount(payment.amount, payment.currency));
    const paidAt = escapeHtml(formatKyivDate(payment.end_date || payment.create_date));

    const transactionId = escapeHtml(payment.transaction_id || payment.payment_id || '-');
    const paymentId = escapeHtml(payment.payment_id || payment.transaction_id || '-');

    return [
        '<b>✅ ОПЛАТУ ПІДТВЕРДЖЕНО</b>',
        '',
        `🆔 <b>Номер:</b> ${orderId}`,
        `💰 <b>Сума:</b> ${amountLabel}`,
        `📌 <b>Статус:</b> ${status}`,
        `🕒 <b>Час оплати:</b> ${paidAt}`,
        `<b>Transaction ID:</b> ${transactionId}`,
        `<b>Payment ID:</b> ${paymentId}`,
        `<b>Order ID (LiqPay):</b> ${orderId}`
    ].join('\n');
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return methodNotAllowed(res, ['POST']);
    }

    const body = parseCallbackBody(req);
    const data = body?.data;
    const signature = body?.signature;

    if (!data || !signature) {
        return json(res, 400, { error: 'Missing data or signature' });
    }

    try {
        const valid = verifyLiqPaySignature(data, signature);
        if (!valid) {
            return json(res, 401, { error: 'Invalid signature' });
        }

        const payment = decodeLiqPayData(data);
        if (!payment) {
            return json(res, 400, { error: 'Invalid payment payload' });
        }

        if (PAID_STATUSES.has(String(payment.status || '').toLowerCase())) {
            const paidMessage = formatPaidMessage(payment);
            await sendTelegramMessage(paidMessage);
        }

        return json(res, 200, {
            success: true,
            status: payment.status || null,
            order_id: payment.order_id || null
        });
    } catch (e) {
        return json(res, 500, { error: 'Failed to process callback', details: e.message });
    }
}
