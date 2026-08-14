import crypto from 'node:crypto';

const MONO_API_BASE = 'https://api.monobank.ua';
const MONO_CHECKOUT_CREATE_URL = `${MONO_API_BASE}/api/merchant/invoice/create`;
const DEFAULT_MONO_REDIRECT_URL = 'https://hardcoredivision.in.ua/pages/index.html';
const DEFAULT_MONO_WEBHOOK_URL = 'https://hardcoredivision.in.ua/api/payments/mono/webhook';
const DEFAULT_MONO_CURRENCY = 980;
const DEFAULT_MONO_PAYMENT_TYPE = 'debit';

function requiredEnv(name) {
    const value = process.env[name];
    if (!value || !String(value).trim()) {
        throw new Error(`Missing required env: ${name}`);
    }
    return String(value).trim();
}

function sha256Verify(publicKeyPem, rawBody, signatureBase64) {
    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''), 'utf8');
    const signatureBuffer = Buffer.from(String(signatureBase64 || ''), 'base64');
    const publicKey = crypto.createPublicKey(publicKeyPem);
    return crypto.verify('sha256', bodyBuffer, publicKey, signatureBuffer);
}

function sanitizeText(value) {
    return String(value || '').trim();
}

function toMinorUnits(amount) {
    const number = Number(amount);
    if (!Number.isFinite(number)) return 0;
    return Math.round(number * 100);
}

export function generateMonoOrderCode() {
    return crypto.randomBytes(8).toString('hex').toUpperCase();
}

export function getMonoConfig() {
    return {
        token: requiredEnv('MONO_X_TOKEN'),
        redirectUrl: DEFAULT_MONO_REDIRECT_URL,
        webhookUrl: DEFAULT_MONO_WEBHOOK_URL,
        currency: DEFAULT_MONO_CURRENCY,
        paymentType: DEFAULT_MONO_PAYMENT_TYPE
    };
}

export function getMonoWebhookSecret() {
    const explicitSecret = sanitizeText(process.env.MONO_WEBHOOK_SECRET);
    if (explicitSecret) return explicitSecret;

    const monoToken = sanitizeText(process.env.MONO_X_TOKEN);
    if (!monoToken) return '';

    return crypto
        .createHash('sha256')
        .update(`hardcoredivision:mono-webhook:${monoToken}`)
        .digest('hex');
}

export function appendMonoWebhookSecret(webHookUrl) {
    const target = sanitizeText(webHookUrl);
    const secret = getMonoWebhookSecret();
    if (!target || !secret) return target;

    try {
        const url = new URL(target);
        url.searchParams.set('secret', secret);
        return url.toString();
    } catch (e) {
        return target;
    }
}

export function buildMonoBasketOrder(items) {
    return Array.isArray(items)
        ? items.map((item) => {
            const title = sanitizeText(item?.title);
            const quantity = Number(item?.quantity || 1);
            const price = Number(item?.price || 0);
            const image = sanitizeText(item?.image);
            const productId = sanitizeText(item?.product_id || item?.productSlug || item?.code);
            const size = sanitizeText(item?.size);
            const minorPrice = toMinorUnits(price);

            return {
                name: title,
                qty: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
                sum: minorPrice > 0 ? minorPrice : 0,
                total: minorPrice > 0 ? minorPrice * (Number.isFinite(quantity) && quantity > 0 ? quantity : 1) : 0,
                unit: size || 'шт.',
                code: productId || undefined,
                icon: image || undefined
            };
        }).filter((item) => item.name && item.sum > 0)
        : [];
}

export function buildMonoInvoicePayload({
    amount,
    ccy,
    orderId,
    description,
    redirectUrl,
    webHookUrl,
    items
}) {
    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
        throw new Error('Invalid amount');
    }

    const currencyCode = Number(ccy || 980) || 980;
    const ref = sanitizeText(orderId) || generateMonoOrderCode();
    const basketOrder = buildMonoBasketOrder(items);
    const minorAmount = toMinorUnits(amountNumber);

    return {
        amount: minorAmount,
        ccy: currencyCode,
        merchantPaymInfo: {
            reference: ref,
            destination: sanitizeText(description) || 'Hardcore Division order',
            comment: sanitizeText(description) || 'Hardcore Division order',
            basketOrder
        },
        ...(sanitizeText(redirectUrl) ? { redirectUrl: sanitizeText(redirectUrl) } : {}),
        ...(sanitizeText(webHookUrl) ? { webHookUrl: sanitizeText(webHookUrl) } : {}),
        paymentType: DEFAULT_MONO_PAYMENT_TYPE
    };
}

export async function createMonoInvoice(payload) {
    const config = getMonoConfig();
    const response = await fetch(MONO_CHECKOUT_CREATE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Token': config.token
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
        const message = data?.message || data?.errorDescription || data?.error || 'Mono checkout create failed';
        throw new Error(message);
    }

    return data || {};
}
