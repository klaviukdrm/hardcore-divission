import { getClientIp, json, methodNotAllowed, parseJsonBody } from '../../lib/server/http.js';
import { safeStringEqual } from '../../lib/server/security.js';
import { setAdminSession } from '../../lib/server/session.js';
import { supabaseRequest } from '../../lib/server/supabase.js';

const MAX_ATTEMPTS = 3;
const BLOCK_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

// In-memory fallback in case of database glitches
const memoryAttempts = new Map();

function formatRemainingTime(ms) {
    const totalMinutes = Math.max(1, Math.ceil(ms / (1000 * 60)));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
        return `${hours} год. ${minutes > 0 ? minutes + ' хв.' : ''}`.trim();
    }
    return `${totalMinutes} хв.`;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return methodNotAllowed(res, ['POST']);
    }

    const adminPassword = process.env.ADMIN_PASS || process.env.ADMIN_PANEL_PASSWORD;
    if (!adminPassword) {
        return json(res, 500, { error: 'Змінна ADMIN_PASS не налаштована на сервері Vercel' });
    }

    const ip = getClientIp(req) || 'unknown';
    const now = Date.now();

    // 1. Check IP lock in database & memory
    let attemptRecord = null;
    try {
        const dbCheck = await supabaseRequest('admin_login_attempts', {
            method: 'GET',
            query: {
                ip: `eq.${ip}`,
                limit: 1
            }
        });

        if (dbCheck.ok && Array.isArray(dbCheck.data) && dbCheck.data.length > 0) {
            attemptRecord = dbCheck.data[0];
        }
    } catch (e) {
        // Fallback to memory if DB query fails
    }

    const memRec = memoryAttempts.get(ip) || { count: 0, blockedUntil: 0 };
    const blockedUntilTime = attemptRecord?.blocked_until ? new Date(attemptRecord.blocked_until).getTime() : memRec.blockedUntil;

    if (blockedUntilTime && blockedUntilTime > now) {
        const remaining = blockedUntilTime - now;
        return json(res, 429, {
            error: `Забагато невірних спроб! Доступ заблоковано на 3 години. Спробуйте через ${formatRemainingTime(remaining)}.`
        });
    }

    const body = parseJsonBody(req);
    if (!body || typeof body.password !== 'string') {
        return json(res, 400, { error: 'Вкажіть пароль' });
    }

    const inputPassword = body.password.trim();
    const isCorrect = safeStringEqual(inputPassword, adminPassword.trim());

    if (!isCorrect) {
        // Increment attempts
        const currentCount = (attemptRecord?.attempts && (!blockedUntilTime || blockedUntilTime <= now))
            ? (Number(attemptRecord.attempts) || 0) + 1
            : (memRec.count + 1);

        const isNowBlocked = currentCount >= MAX_ATTEMPTS;
        const newBlockedUntil = isNowBlocked ? new Date(now + BLOCK_DURATION_MS).toISOString() : null;

        // Update memory
        memoryAttempts.set(ip, {
            count: isNowBlocked ? MAX_ATTEMPTS : currentCount,
            blockedUntil: isNowBlocked ? (now + BLOCK_DURATION_MS) : 0
        });

        // Update Supabase admin_login_attempts
        try {
            await supabaseRequest('admin_login_attempts', {
                method: 'POST',
                query: { on_conflict: 'ip' },
                body: [{
                    ip,
                    attempts: isNowBlocked ? MAX_ATTEMPTS : currentCount,
                    last_attempt: new Date(now).toISOString(),
                    blocked_until: newBlockedUntil
                }],
                prefer: 'resolution=merge-duplicates'
            });
        } catch (e) {
            // Memory handles rate limiting if DB fails
        }

        if (isNowBlocked) {
            return json(res, 429, {
                error: `Невірний пароль! Ви ввели невірний пароль ${MAX_ATTEMPTS} рази поспіль. Доступ заблоковано на 3 години.`
            });
        }

        const remainingAttempts = MAX_ATTEMPTS - currentCount;
        return json(res, 401, {
            error: `Невірний пароль адміністратора! Залишилося спроб: ${remainingAttempts}`
        });
    }

    // 2. Successful Login: Reset attempts and set 3-day session
    memoryAttempts.delete(ip);
    try {
        await supabaseRequest('admin_login_attempts', {
            method: 'POST',
            query: { on_conflict: 'ip' },
            body: [{
                ip,
                attempts: 0,
                last_attempt: new Date(now).toISOString(),
                blocked_until: null
            }],
            prefer: 'resolution=merge-duplicates'
        });
    } catch (e) {
        // Ignore reset DB error
    }

    setAdminSession(res);

    return json(res, 200, {
        success: true,
        message: 'Авторизація успішна'
    });
}
