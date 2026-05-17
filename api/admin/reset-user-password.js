import crypto from 'node:crypto';
import { checkRateLimit } from '../../lib/server/rate-limit.js';
import { getClientIp, json, methodNotAllowed, parseJsonBody } from '../../lib/server/http.js';
import { hashPassword, isValidPhone } from '../../lib/server/security.js';
import { getAdminSession } from '../../lib/server/session.js';
import { requireSupabaseConfig, supabaseRequest } from '../../lib/server/supabase.js';

const TEMP_PASSWORD_LENGTH = 10;
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function generateTemporaryPassword() {
    let value = '';
    for (let i = 0; i < TEMP_PASSWORD_LENGTH; i += 1) {
        const index = crypto.randomInt(0, TEMP_PASSWORD_ALPHABET.length);
        value += TEMP_PASSWORD_ALPHABET[index];
    }
    return value;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return methodNotAllowed(res, ['POST']);
    }

    try {
        requireSupabaseConfig();
    } catch (e) {
        return json(res, 500, { error: 'Server is not configured' });
    }

    const adminSession = getAdminSession(req);
    if (!adminSession || adminSession.role !== 'admin') {
        return json(res, 403, { error: 'Admin access required' });
    }

    const ip = getClientIp(req);
    const rate = checkRateLimit(`admin:reset-password:${ip}`, 40, 15 * 60 * 1000);
    if (!rate.allowed) {
        return json(res, 429, { error: 'Too many requests. Try again later.' });
    }

    const body = parseJsonBody(req);
    if (!body) {
        return json(res, 400, { error: 'Invalid JSON body' });
    }

    const phone = String(body.phone || '').replace(/\s+/g, '').trim();
    if (!isValidPhone(phone)) {
        return json(res, 400, { error: 'Phone must be in +countrycode format' });
    }

    const userResult = await supabaseRequest('users', {
        query: {
            select: 'id,phone',
            phone: `eq.${phone}`,
            limit: 1
        }
    });

    if (!userResult.ok) {
        return json(res, 500, { error: 'Failed to load user' });
    }

    const user = Array.isArray(userResult.data) ? userResult.data[0] : null;
    if (!user) {
        return json(res, 404, { error: 'User not found' });
    }

    const temporaryPassword = generateTemporaryPassword();
    const updated = await supabaseRequest('users', {
        method: 'PATCH',
        query: {
            id: `eq.${user.id}`
        },
        body: {
            password_hash: hashPassword(temporaryPassword)
        },
        prefer: 'return=representation'
    });

    if (!updated.ok) {
        return json(res, 500, { error: 'Failed to reset password' });
    }

    return json(res, 200, {
        success: true,
        phone: user.phone,
        temporary_password: temporaryPassword
    });
}
