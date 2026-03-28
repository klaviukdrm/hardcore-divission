import { checkRateLimit } from '../_lib/rate-limit.js';
import { json, methodNotAllowed, parseJsonBody, getClientIp } from '../_lib/http.js';
import { hashPassword, isStrongEnoughPassword, isValidPhone } from '../_lib/security.js';
import { setUserSession } from '../_lib/session.js';
import { requireSupabaseConfig, supabaseRequest } from '../_lib/supabase.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return methodNotAllowed(res, ['POST']);
    }

    try {
        requireSupabaseConfig();
    } catch (e) {
        return json(res, 500, { error: 'Server is not configured' });
    }

    const ip = getClientIp(req);
    const rate = checkRateLimit(`auth:register:${ip}`, 10, 15 * 60 * 1000);
    if (!rate.allowed) {
        return json(res, 429, { error: 'Too many requests. Try again later.' });
    }

    const body = parseJsonBody(req);
    if (!body) {
        return json(res, 400, { error: 'Invalid JSON body' });
    }

    const phone = String(body.phone || '').trim();
    const password = String(body.password || '');

    if (!isValidPhone(phone)) {
        return json(res, 400, { error: 'Phone must match +380XXXXXXXXX' });
    }

    if (!isStrongEnoughPassword(password)) {
        return json(res, 400, { error: 'Password must be 8-72 chars' });
    }

    const existing = await supabaseRequest('users', {
        query: {
            select: 'id,phone',
            phone: `eq.${phone}`,
            limit: 1
        }
    });

    if (!existing.ok) {
        return json(res, 500, { error: 'Cannot check user uniqueness' });
    }

    if (Array.isArray(existing.data) && existing.data.length > 0) {
        return json(res, 409, { error: 'User with this phone already exists' });
    }

    const created = await supabaseRequest('users', {
        method: 'POST',
        body: {
            phone,
            password_hash: hashPassword(password)
        },
        prefer: 'return=representation'
    });

    if (!created.ok || !Array.isArray(created.data) || created.data.length === 0) {
        return json(res, 500, { error: 'Failed to create user' });
    }

    const user = {
        id: created.data[0].id,
        phone: created.data[0].phone
    };

    setUserSession(res, user);

    return json(res, 201, {
        success: true,
        user
    });
}
