import { sendTelegramMediaGroup } from '../lib/server/telegram.js';
import { checkRateLimit } from '../lib/server/rate-limit.js';
import { getClientIp } from '../lib/server/http.js';

const ORDER_MESSAGE_MIN_LENGTH = 120;
const ORDER_MESSAGE_MAX_LENGTH = 6000;
const PAYMENT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

function normalizePromoCode(value) {
    return String(value || '').trim().toUpperCase();
}

function addPromoCodes(target, rawCodes, discountPercent) {
    String(rawCodes || '')
        .split(/[\s,]+/)
        .map((item) => normalizePromoCode(item))
        .filter(Boolean)
        .forEach((code) => target.set(code, discountPercent));
}

function getConfiguredPromoCodes() {
    const codes = new Map();
    addPromoCodes(codes, process.env.PROMO_CODES, 10);
    addPromoCodes(codes, process.env.PROMO_CODE, 10);
    addPromoCodes(codes, process.env.PROMO_CODE2, 15);
    return codes;
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

function estimateBase64Bytes(rawBase64) {
    const clean = String(rawBase64 || '').replace(/\s+/g, '');
    if (!clean) return 0;
    const padding = clean.endsWith('==') ? 2 : (clean.endsWith('=') ? 1 : 0);
    return Math.floor(clean.length * 3 / 4) - padding;
}

function isValidOrderMessage(message) {
    const text = String(message || '').trim();
    if (text.length < ORDER_MESSAGE_MIN_LENGTH || text.length > ORDER_MESSAGE_MAX_LENGTH) return false;

    const hasHtmlFormatting = text.includes('<b>') && text.includes('</b>');
    const hasOrderCode = /[A-Z0-9]{7}/.test(text);
    const hasCreatedStatus = /created/i.test(text);
    const hasTotalLine = /TOTAL|СУМА|РЎРЈРњРђ/i.test(text);

    return hasHtmlFormatting && hasOrderCode && hasCreatedStatus && hasTotalLine;
}

function isValidOrderItems(items) {
    return Array.isArray(items) && items.length > 0 && items.length <= 30 && items.every((item) => {
        const line = String(item?.line || '').trim();
        const image = String(item?.image || '').trim();
        return line.length >= 3 && line.length <= 500 && image.length >= 3 && image.length <= 1000;
    });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const ip = getClientIp(req);
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    // Accept either `photo` or `image` from the client payload.
    const { action, code, message, photo, image, orderItems } = req.body || {};
    const imageData = photo || image;

    if (action === 'validatePromo') {
        const rate = checkRateLimit(`promo:${ip}`, 30, 60 * 1000);
        if (!rate.allowed) {
            return res.status(429).json({ valid: false, error: 'Too many requests' });
        }

        const normalizedCode = normalizePromoCode(code);
        if (!normalizedCode) {
            return res.status(400).json({ valid: false, error: 'Promo code is required' });
        }

        const codes = getConfiguredPromoCodes();
        if (!codes.size) {
            return res.status(200).json({ valid: false, configured: false });
        }

        const discountPercent = codes.get(normalizedCode);
        if (!discountPercent) {
            return res.status(200).json({ valid: false, configured: true });
        }

        return res.status(200).json({
            valid: true,
            code: normalizedCode,
            discountPercent
        });
    }

    const orderRate = checkRateLimit(`telegram-order:${ip}`, 5, 10 * 60 * 1000);
    if (!orderRate.allowed) {
        return res.status(429).json({ success: false, error: 'Too many requests' });
    }

    if (!botToken || !chatId) {
        return res.status(500).json({ success: false, error: 'Telegram is not configured' });
    }

    if (!isSameSiteRequest(req)) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    if (!isValidOrderMessage(message) || !isValidOrderItems(orderItems)) {
        return res.status(400).json({ success: false, error: 'Invalid order payload' });
    }

    if (!imageData || !String(imageData).includes('base64')) {
        return res.status(400).json({ success: false, error: 'Payment screenshot is required' });
    }

    try {
        let response;

        function getBaseUrl() {
            const protoHeader = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
            const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
            const protocol = protoHeader || 'https';
            if (!hostHeader) return '';
            return `${protocol}://${hostHeader}`;
        }

        function resolveOrderItems(items) {
            if (!Array.isArray(items)) return [];
            const baseUrl = getBaseUrl();

            return items.map((item) => {
                const line = String(item?.line || '').trim();
                const imageRaw = String(item?.image || '').trim();
                if (!imageRaw) return null;

                let image = imageRaw;
                if (!/^https?:\/\//i.test(imageRaw) && baseUrl) {
                    try {
                        image = new URL(imageRaw, `${baseUrl}/`).toString();
                    } catch (e) {
                        image = imageRaw;
                    }
                }

                return { line, image };
            }).filter(Boolean);
        }

        function parseBase64DataUrl(dataUrl) {
            const match = String(dataUrl || '').match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i);
            if (!match) return null;

            const mimeType = String(match[1] || 'application/octet-stream').toLowerCase();
            const rawBase64 = String(match[2] || '').trim();
            if (!rawBase64) return null;
            if (estimateBase64Bytes(rawBase64) > PAYMENT_IMAGE_MAX_BYTES) return null;

            return {
                mimeType,
                buffer: Buffer.from(rawBase64, 'base64')
            };
        }

        function extensionFromMimeType(mimeType) {
            const map = {
                'image/jpeg': 'jpg',
                'image/jpg': 'jpg',
                'image/png': 'png',
                'image/webp': 'webp',
                'image/gif': 'gif',
                'image/bmp': 'bmp',
                'image/tiff': 'tiff',
                'image/heic': 'heic',
                'image/heif': 'heif'
            };
            return map[mimeType] || 'bin';
        }

        const supportedPhotoMimeTypes = new Set([
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/bmp'
        ]);

        // If image is base64, send it as a file to Telegram.
        if (imageData && imageData.includes('base64')) {
            const parsedImage = parseBase64DataUrl(imageData);
            if (!parsedImage || !parsedImage.buffer.length) {
                return res.status(400).json({ success: false, error: 'Invalid payment screenshot data' });
            }

            const { mimeType, buffer } = parsedImage;
            const ext = extensionFromMimeType(mimeType);
            const isPhotoMime = supportedPhotoMimeTypes.has(mimeType);
            const methodName = isPhotoMime ? 'sendPhoto' : 'sendDocument';
            const fieldName = isPhotoMime ? 'photo' : 'document';

            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('caption', message);
            formData.append('parse_mode', 'HTML');

            const fileBlob = new Blob([buffer], { type: mimeType });
            formData.append(fieldName, fileBlob, `payment.${ext}`);

            response = await fetch(`https://api.telegram.org/bot${botToken}/${methodName}`, {
                method: 'POST',
                body: formData
            });
        } else {
            // Fallback: send plain text message.
            response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                    parse_mode: 'HTML'
                })
            });
        }

        const result = await response.json();

        if (response.ok) {
            const resolvedItems = resolveOrderItems(orderItems);
            if (resolvedItems.length) {
                await sendTelegramMediaGroup(resolvedItems);
            }
            return res.status(200).json({ success: true });
        } else {
            console.error('TG Error:', result);
            return res.status(500).json({ success: false, error: result.description });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ success: false });
    }
}
