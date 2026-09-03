import { checkRateLimit } from '../../lib/server/rate-limit.js';
import { getClientIp, json, methodNotAllowed, parseJsonBody } from '../../lib/server/http.js';
import { safeStringEqual } from '../../lib/server/security.js';
import { setAdminSession } from '../../lib/server/session.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return methodNotAllowed(res, ['POST']);
    }

    const adminPassword = process.env.ADMIN_PASS || process.env.ADMIN_PANEL_PASSWORD;
    if (!adminPassword) {
        return json(res, 500, { error: 'ADMIN_PASS environment variable is not configured on server' });
    }

    const ip = getClientIp(req);
    const rate = checkRateLimit(`admin:login:${ip}`, 15, 15 * 60 * 1000);
    if (!rate.allowed) {
        return json(res, 429, { error: 'Забагато спроб входу. Спробуйте пізніше.' });
    }

    const body = parseJsonBody(req);
    if (!body || typeof body.password !== 'string') {
        return json(res, 400, { error: 'Вкажіть пароль' });
    }

    if (!safeStringEqual(body.password.trim(), adminPassword.trim())) {
        return json(res, 401, { error: 'Невірний пароль адміністратора' });
    }

    setAdminSession(res);

    return json(res, 200, {
        success: true,
        message: 'Авторизація успішна'
    });
}
