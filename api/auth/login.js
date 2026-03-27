import { checkRateLimit } from '../_lib/rate-limit.js';
import { json, methodNotAllowed, parseJsonBody, getClientIp } from '../_lib/http.js';
import { isValidPhone, verifyPassword } from '../_lib/security.js';
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
    const rate = checkRateLimit(`auth:login:${ip}`, 15, 15 * 60 * 1000);
    if (!rate.allowed) {
        return json(res, 429, { error: 'Too many requests. Try again later.' });
    }

    const body = parseJsonBody(req);
    if (!body) {
        return json(res, 400, { error: 'Invalid JSON body' });
    }

    const phone = String(body.phone || '').trim();
    const password = String(body.password || '');

    if (!isValidPhone(phone) || !password) {
        return json(res, 400, { error: 'Invalid credentials format' });
    }

    const found = await supabaseRequest('users', {
        query: {
            select: 'id,phone,password_hash',
            phone: `eq.${phone}`,
            limit: 1
        }
    });

    if (!found.ok) {
        return json(res, 500, { error: 'Failed to load user' });
    }

    const user = Array.isArray(found.data) ? found.data[0] : null;
    if (!user || !verifyPassword(password, user.password_hash)) {
        return json(res, 401, { error: 'Invalid phone or password' });
    }

    setUserSession(res, { id: user.id, phone: user.phone });

    return json(res, 200, {
        success: true,
        user: {
            id: user.id,
            phone: user.phone
        }
    });
}
