import { checkRateLimit } from '../lib/server/rate-limit.js';
import { json, methodNotAllowed, parseJsonBody, getClientIp } from '../lib/server/http.js';
import { hashPassword, verifyPassword } from '../lib/server/security.js';
import { clearAllSessions, getAdminSession, getUserSession, setUserSession } from '../lib/server/session.js';
import { requireSupabaseConfig, supabaseRequest } from '../lib/server/supabase.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const queryAction = url.searchParams.get('action');
    let action = queryAction;
    if (!action) {
        if (req.url.includes('/login')) action = 'login';
        else if (req.url.includes('/register')) action = 'register';
        else if (req.url.includes('/logout')) action = 'logout';
        else if (req.url.includes('/me')) action = 'me';
    }

    // 1. Logout
    if (action === 'logout') {
        clearAllSessions(res);
        return json(res, 200, { success: true });
    }

    // 2. Check current session (GET or action === 'me')
    if (action === 'me' || req.method === 'GET') {
        const userSession = getUserSession(req);
        if (userSession?.sub) {
            return json(res, 200, {
                authenticated: true,
                role: 'user',
                user: {
                    id: userSession.sub,
                    email: userSession.email || userSession.phone || 'User'
                }
            });
        }

        const adminSession = getAdminSession(req);
        if (adminSession?.role === 'admin') {
            return json(res, 200, { authenticated: true, role: 'admin' });
        }

        return json(res, 200, { authenticated: false });
    }

    if (req.method !== 'POST') {
        return methodNotAllowed(res, ['GET', 'POST']);
    }

    try {
        requireSupabaseConfig();
    } catch (e) {
        return json(res, 500, { error: 'База даних не налаштована' });
    }

    const ip = getClientIp(req);
    const body = parseJsonBody(req);
    if (!body) {
        return json(res, 400, { error: 'Некоректні дані запиту' });
    }

    const email = String(body.email || body.phone || '').trim().toLowerCase();
    const password = String(body.password || '');

    // 3. Register with Email + Password
    if (action === 'register') {
        const rate = checkRateLimit(`auth:register:${ip}`, 15, 15 * 60 * 1000);
        if (!rate.allowed) {
            return json(res, 429, { error: 'Забагато спроб. Спробуйте пізніше.' });
        }

        if (!email || !EMAIL_REGEX.test(email)) {
            return json(res, 400, { error: 'Введіть коректну адресу електронної пошти' });
        }

        if (password.length < 6) {
            return json(res, 400, { error: 'Пароль має містити щонайменше 6 символів' });
        }

        // Check if user already exists
        const existing = await supabaseRequest('users', {
            query: {
                select: 'id,email,phone',
                or: `(email.eq.${email},phone.eq.${email})`,
                limit: 1
            }
        });

        if (existing.ok && Array.isArray(existing.data) && existing.data.length > 0) {
            return json(res, 409, { error: 'Користувач із такою поштою вже існує' });
        }

        // Create new user
        const newUserData = {
            email,
            phone: email, // Fallback for backwards compatibility with previous schema
            full_name: email.split('@')[0],
            password_hash: hashPassword(password)
        };

        const created = await supabaseRequest('users', {
            method: 'POST',
            body: newUserData,
            prefer: 'return=representation'
        });

        if (!created.ok || !Array.isArray(created.data) || created.data.length === 0) {
            // Fallback: try inserting without extra columns if specific columns differ
            const minimalInsert = await supabaseRequest('users', {
                method: 'POST',
                body: {
                    email,
                    password_hash: hashPassword(password)
                },
                prefer: 'return=representation'
            });

            if (!minimalInsert.ok || !Array.isArray(minimalInsert.data) || minimalInsert.data.length === 0) {
                const errMsg = (created.data && (created.data.message || created.data.error)) || 'Не вдалося створити акаунт';
                return json(res, 500, { error: errMsg });
            }
            created.data = minimalInsert.data;
        }

        const user = {
            id: created.data[0].id,
            email: created.data[0].email || email
        };

        setUserSession(res, user);

        return json(res, 201, {
            success: true,
            user
        });
    }

    // 4. Login with Email + Password
    if (action === 'login') {
        const rate = checkRateLimit(`auth:login:${ip}`, 20, 15 * 60 * 1000);
        if (!rate.allowed) {
            return json(res, 429, { error: 'Забагато спроб входу. Спробуйте пізніше.' });
        }

        if (!email || !password) {
            return json(res, 400, { error: 'Введіть пошту та пароль' });
        }

        const found = await supabaseRequest('users', {
            query: {
                select: 'id,email,phone,password_hash',
                or: `(email.eq.${email},phone.eq.${email})`,
                limit: 1
            }
        });

        if (!found.ok || !Array.isArray(found.data) || found.data.length === 0) {
            return json(res, 401, { error: 'Невірна пошта або пароль' });
        }

        const user = found.data[0];
        if (!user || !verifyPassword(password, user.password_hash)) {
            return json(res, 401, { error: 'Невірна пошта або пароль' });
        }

        const userPayload = {
            id: user.id,
            email: user.email || user.phone || email
        };

        setUserSession(res, userPayload);

        return json(res, 200, {
            success: true,
            user: userPayload
        });
    }

    return json(res, 400, { error: 'Невідома дія' });
}

