import { checkRateLimit } from '../../lib/server/rate-limit.js';
import { getClientIp, json, methodNotAllowed, parseJsonBody } from '../../lib/server/http.js';
import { safeStringEqual } from '../../lib/server/security.js';
import { setAdminSession } from '../../lib/server/session.js';
import { requireSupabaseConfig, supabaseRequest } from '../../lib/server/supabase.js';

const ADMIN_BLOCK_HOURS = Number(process.env.ADMIN_BLOCK_HOURS || 2);
const ADMIN_MAX_ATTEMPTS = Number(process.env.ADMIN_MAX_ATTEMPTS || 3);

async function upsertAttempt(ip, attempts, blockedUntilIso) {
    const nowIso = new Date().toISOString();
    return supabaseRequest('admin_login_attempts', {
        method: 'POST',
        query: {
            on_conflict: 'ip'
        },
        body: {
            ip,
            attempts,
            last_attempt: nowIso,
            blocked_until: blockedUntilIso || null
        },
        prefer: 'resolution=merge-duplicates,return=representation'
    });
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

    const adminPassword = process.env.ADMIN_PANEL_PASSWORD;
    if (!adminPassword) {
        return json(res, 500, { error: 'Missing ADMIN_PANEL_PASSWORD' });
    }

    const ip = getClientIp(req);
    const rate = checkRateLimit(`admin:login:${ip}`, 20, 15 * 60 * 1000);
    if (!rate.allowed) {
        return json(res, 429, { error: 'Too many requests. Try again later.' });
    }

    const body = parseJsonBody(req);
    if (!body || typeof body.password !== 'string') {
        return json(res, 400, { error: 'Invalid request body' });
    }

    const current = await supabaseRequest('admin_login_attempts', {
        query: {
            select: 'id,attempts,blocked_until',
            ip: `eq.${ip}`,
            limit: 1
        }
    });

    if (!current.ok) {
        return json(res, 500, { error: 'Failed to validate admin access' });
    }

    const row = Array.isArray(current.data) ? current.data[0] : null;
    const now = new Date();
    const blockedUntil = row?.blocked_until ? new Date(row.blocked_until) : null;

    if (blockedUntil && blockedUntil > now) {
        return json(res, 429, {
            error: `Too many failed attempts. Admin login is blocked for ${ADMIN_BLOCK_HOURS} hour(s).`,
            blocked_until: blockedUntil.toISOString()
        });
    }

    if (!safeStringEqual(body.password, adminPassword)) {
        const attempts = (row?.attempts || 0) + 1;
        let nextAttempts = attempts;
        let blockUntilIso = null;

        if (attempts >= ADMIN_MAX_ATTEMPTS) {
            const blockedDate = new Date(now.getTime() + ADMIN_BLOCK_HOURS * 60 * 60 * 1000);
            blockUntilIso = blockedDate.toISOString();
            nextAttempts = 0;
        }

        const write = await upsertAttempt(ip, nextAttempts, blockUntilIso);
        if (!write.ok) {
            return json(res, 500, { error: 'Failed to persist login attempts' });
        }

        if (blockUntilIso) {
            return json(res, 429, {
                error: `Too many failed attempts. Admin login is blocked for ${ADMIN_BLOCK_HOURS} hour(s).`,
                blocked_until: blockUntilIso
            });
        }

        return json(res, 401, {
            error: 'Invalid admin password',
            attempts_left: Math.max(0, ADMIN_MAX_ATTEMPTS - attempts)
        });
    }

    const reset = await upsertAttempt(ip, 0, null);
    if (!reset.ok) {
        return json(res, 500, { error: 'Failed to persist admin session state' });
    }

    setAdminSession(res);

    return json(res, 200, { success: true });
}

