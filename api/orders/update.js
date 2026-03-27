import { json, methodNotAllowed, parseJsonBody } from '../_lib/http.js';
import { ORDER_STATUSES } from '../_lib/security.js';
import { getAdminSession } from '../_lib/session.js';
import { requireSupabaseConfig, supabaseRequest } from '../_lib/supabase.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

    const body = parseJsonBody(req);
    if (!body) {
        return json(res, 400, { error: 'Invalid JSON body' });
    }

    const orderId = String(body.order_id || '').trim();
    const status = String(body.status || '').trim();

    if (!UUID_REGEX.test(orderId)) {
        return json(res, 400, { error: 'Invalid order_id' });
    }

    if (!ORDER_STATUSES.includes(status)) {
        return json(res, 400, { error: 'Invalid status value' });
    }

    const updated = await supabaseRequest('orders', {
        method: 'PATCH',
        query: {
            id: `eq.${orderId}`
        },
        body: {
            status
        },
        prefer: 'return=representation'
    });

    if (!updated.ok) {
        return json(res, 500, { error: 'Failed to update order' });
    }

    const rows = Array.isArray(updated.data) ? updated.data : [];
    if (!rows.length) {
        return json(res, 404, { error: 'Order not found' });
    }

    return json(res, 200, {
        success: true,
        order: rows[0]
    });
}
