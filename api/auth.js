import { checkRateLimit } from '../lib/server/rate-limit.js';
import { json, methodNotAllowed, parseJsonBody, getClientIp } from '../lib/server/http.js';
import { hashPassword, isStrongEnoughPassword, isValidPhone, verifyPassword } from '../lib/server/security.js';
import { clearAllSessions, getAdminSession, getUserSession, setUserSession } from '../lib/server/session.js';
import { requireSupabaseConfig, supabaseRequest } from '../lib/server/supabase.js';

export default async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const action = url.searchParams.get('action') || (req.url.includes('login') ? 'login' : (req.url.includes('register') ? 'register' : (req.url.includes('logout') ? 'logout' : (req.url.includes('me') ? 'me' : ''))));

    // GET /api/auth or /api/auth/me: Check current user session
    if (req.method === 'GET' || action === 'me') {
        const adminSession = getAdminSession(req);
        if (adminSession?.role === 'admin') {
            return json(res, 200, { authenticated: true, role: 'admin' });
        }

        const userSession = getUserSession(req);
        if (!userSession?.sub) {
            return json(res, 200, { authenticated: false });
        }

        return json(res, 200, {
            authenticated: true,
            role: 'user',
            user: {
                id: userSession.sub,
                phone: userSession.phone
            }
        });
    }

    if (req.method !== 'POST') {
        return methodNotAllowed(res, ['GET', 'POST']);
    }

    // POST /api/auth?action=logout: Clear user session
    if (action === 'logout') {
        clearAllSessions(res);
        return json(res, 200, { success: true });
    }

    try {
        requireSupabaseConfig();
    } catch (e) {
        return json(res, 500, { error: 'Server is not configured' });
    }

    const ip = getClientIp(req);
    const body = parseJsonBody(req);
    if (!body) {
        return json(res, 400, { error: 'Invalid JSON body' });
    }

    // POST /api/auth?action=register: Register new user
    if (action === 'register') {
        const rate = checkRateLimit(`auth:register:${ip}`, 10, 15 * 60 * 1000);
        if (!rate.allowed) {
            return json(res, 429, { error: 'Too many requests. Try again later.' });
        }

        const phone = String(body.phone || '').trim();
        const fullName = String(body.full_name || '').trim();
        const password = String(body.password || '');

        if (fullName.length < 2 || fullName.length > 80) {
            return json(res, 400, { error: 'Full name must be 2-80 characters' });
        }

        if (!isValidPhone(phone)) {
            return json(res, 400, { error: 'Phone must be a valid Europe or USA number in +countrycode format' });
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
                full_name: fullName,
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

    // POST /api/auth?action=login: Log in existing user
    const rate = checkRateLimit(`auth:login:${ip}`, 15, 15 * 60 * 1000);
    if (!rate.allowed) {
        return json(res, 429, { error: 'Too many requests. Try again later.' });
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

