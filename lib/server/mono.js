import crypto from 'node:crypto';

const MONO_API_BASE = 'https://api.monobank.ua';
const MONO_CHECKOUT_CREATE_URL = `${MONO_API_BASE}/api/merchant/invoice/create`;
const MONO_CHECKOUT_STATUS_URL = `${MONO_API_BASE}/api/merchant/invoice/status`;
const MONO_PUBLIC_KEY_URL = `${MONO_API_BASE}/api/merchant/pubkey`;
const DEFAULT_MONO_REDIRECT_URL = 'https://hardcoredivision.in.ua/pages/index.html';
const DEFAULT_MONO_WEBHOOK_URL = 'https://hardcoredivision.in.ua/api/payments/mono/webhook';
const DEFAULT_MONO_CURRENCY = 980;
const DEFAULT_MONO_PAYMENT_TYPE = 'debit';

const monoPublicKeyCache = {
    value: null,
    fetchedAt: 0
};

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

export function buildMonoBasketOrder(items) {
    return Array.isArray(items)
        ? items.map((item) => {
            const title = sanitizeText(item?.title);
            const quantity = Number(item?.quantity || 1);
            const price = Number(item?.price || 0);
            const image = sanitizeText(item?.image);
            const productId = sanitizeText(item?.product_id || item?.productSlug || item?.code);
            const size = sanitizeText(item?.size);

            return {
                name: title,
                qty: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
                sum: Number.isFinite(price) && price > 0 ? price : 0,
                total: (Number.isFinite(price) && price > 0 ? price : 0) * (Number.isFinite(quantity) && quantity > 0 ? quantity : 1),
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

    return {
        amount: Math.round(amountNumber),
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

export async function getMonoInvoiceStatus(invoiceId) {
    const config = getMonoConfig();
    const id = sanitizeText(invoiceId);
    if (!id) {
        throw new Error('Missing invoiceId');
    }

    const response = await fetch(`${MONO_CHECKOUT_STATUS_URL}?invoiceId=${encodeURIComponent(id)}`, {
        method: 'GET',
        headers: {
            'X-Token': config.token
        }
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
        const message = data?.message || data?.errorDescription || data?.error || 'Failed to load mono invoice status';
        throw new Error(message);
    }

    return data || {};
}

async function fetchMonoPublicKey(forceRefresh = false) {
    const config = getMonoConfig();
    const now = Date.now();
    if (!forceRefresh && monoPublicKeyCache.value && (now - monoPublicKeyCache.fetchedAt) < 24 * 60 * 60 * 1000) {
        return monoPublicKeyCache.value;
    }

    const response = await fetch(MONO_PUBLIC_KEY_URL, {
        method: 'GET',
        headers: {
            'X-Token': config.token
        }
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.key) {
        const message = data?.message || data?.errorDescription || data?.error || 'Failed to load mono webhook public key';
        throw new Error(message);
    }

    monoPublicKeyCache.value = String(data.key);
    monoPublicKeyCache.fetchedAt = now;
    return monoPublicKeyCache.value;
}

export async function verifyMonoWebhookSignature(rawBody, xSignHeader) {
    if (!xSignHeader) return false;

    const publicKeyBase64 = await fetchMonoPublicKey(false);
    const publicKeyPem = Buffer.from(publicKeyBase64, 'base64').toString('utf8');

    try {
        return sha256Verify(publicKeyPem, rawBody, xSignHeader);
    } catch (firstError) {
        const refreshedKeyBase64 = await fetchMonoPublicKey(true);
        const refreshedKeyPem = Buffer.from(refreshedKeyBase64, 'base64').toString('utf8');
        return sha256Verify(refreshedKeyPem, rawBody, xSignHeader);
    }
}

export async function readRawRequestBody(req) {
    if (typeof req?.body === 'string') return req.body;
    if (Buffer.isBuffer(req?.body)) return req.body;

    const chunks = [];
    for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}
