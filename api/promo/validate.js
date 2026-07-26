import { json, methodNotAllowed, parseJsonBody } from '../../lib/server/http.js';

function normalizePromoCode(value) {
    return String(value || '').trim().toUpperCase();
}

function getConfiguredPromoCodes() {
    const rawCombined = [process.env.PROMO_CODES, process.env.PROMO_CODE]
        .filter(Boolean)
        .join(',');

    return new Set(
        String(rawCombined || '')
            .split(/[\s,]+/)
            .map((item) => normalizePromoCode(item))
            .filter(Boolean)
    );
}

function getDiscountPercent() {
    return 10;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return methodNotAllowed(res, ['POST']);
    }

    const body = parseJsonBody(req);
    if (!body) {
        return json(res, 400, { valid: false, error: 'Invalid JSON body' });
    }

    const code = normalizePromoCode(body.code);
    if (!code) {
        return json(res, 400, { valid: false, error: 'Promo code is required' });
    }

    const codes = getConfiguredPromoCodes();
    if (!codes.size) {
        return json(res, 200, { valid: false, configured: false });
    }

    if (!codes.has(code)) {
        return json(res, 200, { valid: false, configured: true });
    }

    return json(res, 200, {
        valid: true,
        code,
        discountPercent: getDiscountPercent()
    });
}
