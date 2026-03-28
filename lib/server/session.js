import crypto from 'node:crypto';
import { parseCookies, setCookie } from './http.js';

const USER_COOKIE = process.env.USER_COOKIE_NAME || 'hd_user_session';
const ADMIN_COOKIE = process.env.ADMIN_COOKIE_NAME || 'hd_admin_session';

function base64UrlEncode(value) {
    return Buffer.from(value)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function base64UrlDecode(value) {
    const normalized = value
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(value.length / 4) * 4, '=');
    return Buffer.from(normalized, 'base64').toString('utf8');
}

function sign(payload, secret) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const input = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto
        .createHmac('sha256', secret)
        .update(input)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    return `${input}.${signature}`;
}

function verify(token, secret) {
    if (!token || !secret) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, givenSignature] = parts;
    const input = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(input)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    const a = Buffer.from(givenSignature, 'utf8');
    const b = Buffer.from(expectedSignature, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    try {
        const payload = JSON.parse(base64UrlDecode(encodedPayload));
        if (typeof payload.exp === 'number' && Date.now() >= payload.exp * 1000) {
            return null;
        }
        return payload;
    } catch (e) {
        return null;
    }
}

function ttlSeconds(hours) {
    return Math.max(60, Math.floor(hours * 60 * 60));
}

function userSecret() {
    return process.env.USER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || '';
}

function adminSecret() {
    return process.env.ADMIN_SESSION_SECRET || '';
}

function sessionPayload(payload, ttl) {
    const iat = Math.floor(Date.now() / 1000);
    return {
        ...payload,
        iat,
        exp: iat + ttl
    };
}

export function setUserSession(res, user) {
    const secret = userSecret();
    const ttl = ttlSeconds(Number(process.env.USER_SESSION_TTL_HOURS || 24 * 14));
    const token = sign(sessionPayload({ sub: user.id, phone: user.phone, role: 'user' }, ttl), secret);

    setCookie(res, USER_COOKIE, token, {
        maxAge: ttl,
        httpOnly: true,
        sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
    });
}

export function setAdminSession(res) {
    const secret = adminSecret();
    const ttl = ttlSeconds(Number(process.env.ADMIN_SESSION_TTL_HOURS || 8));
    const token = sign(sessionPayload({ role: 'admin' }, ttl), secret);

    setCookie(res, ADMIN_COOKIE, token, {
        maxAge: ttl,
        httpOnly: true,
        sameSite: 'Strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
    });
}

export function clearAllSessions(res) {
    setCookie(res, USER_COOKIE, '', {
        maxAge: 0,
        httpOnly: true,
        sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
    });

    setCookie(res, ADMIN_COOKIE, '', {
        maxAge: 0,
        httpOnly: true,
        sameSite: 'Strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
    });
}

export function getUserSession(req) {
    const cookies = parseCookies(req);
    return verify(cookies[USER_COOKIE], userSecret());
}

export function getAdminSession(req) {
    const cookies = parseCookies(req);
    return verify(cookies[ADMIN_COOKIE], adminSecret());
}
