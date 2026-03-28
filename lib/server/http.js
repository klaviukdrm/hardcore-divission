export function json(res, status, payload) {
    return res.status(status).json(payload);
}

export function methodNotAllowed(res, allowed) {
    res.setHeader('Allow', allowed.join(', '));
    return json(res, 405, { error: 'Method not allowed' });
}

export function parseJsonBody(req) {
    if (req.body == null) return {};
    if (typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        } catch (e) {
            return null;
        }
    }
    if (typeof req.body === 'object') {
        return req.body;
    }
    return null;
}

export function parseCookies(req) {
    const header = req.headers.cookie;
    if (!header) return {};

    return header.split(';').reduce((acc, part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return acc;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        acc[key] = decodeURIComponent(value);
        return acc;
    }, {});
}

export function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length) {
        return forwarded.split(',')[0].trim();
    }
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp.length) {
        return realIp.trim();
    }
    return req.socket?.remoteAddress || '0.0.0.0';
}

function buildCookie(name, value, options = {}) {
    const {
        maxAge,
        httpOnly = true,
        secure = process.env.NODE_ENV === 'production',
        sameSite = 'Lax',
        path = '/'
    } = options;

    const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `SameSite=${sameSite}`];

    if (typeof maxAge === 'number') {
        parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
    }
    if (httpOnly) parts.push('HttpOnly');
    if (secure) parts.push('Secure');

    return parts.join('; ');
}

function appendSetCookie(res, cookieValue) {
    const existing = res.getHeader('Set-Cookie');
    if (!existing) {
        res.setHeader('Set-Cookie', [cookieValue]);
        return;
    }

    if (Array.isArray(existing)) {
        res.setHeader('Set-Cookie', [...existing, cookieValue]);
        return;
    }

    res.setHeader('Set-Cookie', [existing, cookieValue]);
}

export function setCookie(res, name, value, options) {
    appendSetCookie(res, buildCookie(name, value, options));
}

export function clearCookie(res, name, options = {}) {
    setCookie(res, name, '', {
        ...options,
        maxAge: 0
    });
}
