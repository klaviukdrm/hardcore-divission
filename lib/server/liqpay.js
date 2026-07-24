import crypto from 'node:crypto';

const DEFAULT_CHECKOUT_URL = 'https://www.liqpay.ua/api/3/checkout';

function requiredEnv(name) {
    const value = process.env[name];
    if (!value || !String(value).trim()) {
        throw new Error(`Missing required env: ${name}`);
    }
    return String(value).trim();
}

function sha1Base64(input) {
    return crypto.createHash('sha1').update(input).digest('base64');
}

export function generateLiqPayOrderCode() {
    const digits = '0123456789';
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const chars = [];

    for (let i = 0; i < 3; i += 1) {
        chars.push(digits[Math.floor(Math.random() * digits.length)]);
    }
    for (let i = 0; i < 4; i += 1) {
        chars.push(letters[Math.floor(Math.random() * letters.length)]);
    }

    for (let i = chars.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join('');
}

export function getLiqPayConfig() {
    return {
        publicKey: requiredEnv('LIQPAY_PUBLIC_KEY'),
        privateKey: requiredEnv('LIQPAY_PRIVATE_KEY'),
        serverUrl: requiredEnv('LIQPAY_SERVER_URL'),
        resultUrl: requiredEnv('LIQPAY_RESULT_URL'),
        checkoutUrl: process.env.LIQPAY_CHECKOUT_URL || DEFAULT_CHECKOUT_URL
    };
}

export function buildLiqPayCheckoutPayload({ amount, currency = 'UAH', description, orderId }) {
    const config = getLiqPayConfig();

    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
        throw new Error('Invalid amount');
    }

    const dataObject = {
        public_key: config.publicKey,
        version: '3',
        action: 'pay',
        amount: amountNumber.toFixed(2),
        currency: String(currency || 'UAH').toUpperCase(),
        description: String(description || 'Hardcore Division order'),
        order_id: String(orderId || generateLiqPayOrderCode()),
        server_url: config.serverUrl,
        result_url: config.resultUrl,
        language: 'uk'
    };

    const data = Buffer.from(JSON.stringify(dataObject), 'utf8').toString('base64');
    const signature = sha1Base64(config.privateKey + data + config.privateKey);

    return {
        checkoutUrl: config.checkoutUrl,
        data,
        signature,
        orderId: dataObject.order_id
    };
}

export function verifyLiqPaySignature(data, signature) {
    const config = getLiqPayConfig();
    if (!data || !signature) return false;
    const expected = sha1Base64(config.privateKey + String(data) + config.privateKey);
    return expected === String(signature);
}

export function decodeLiqPayData(data) {
    try {
        const decoded = Buffer.from(String(data), 'base64').toString('utf8');
        return JSON.parse(decoded);
    } catch (e) {
        return null;
    }
}
