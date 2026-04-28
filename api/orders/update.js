import { json, methodNotAllowed, parseJsonBody } from '../../lib/server/http.js';
import { ORDER_STATUSES } from '../../lib/server/security.js';
import { getAdminSession } from '../../lib/server/session.js';
import { requireSupabaseConfig, supabaseRequest } from '../../lib/server/supabase.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHIPPING_STATUS = 'Відправка (Нова Пошта, накладений платіж)';
const TTN_REGEX = /^\d{8,20}$/;

function hasMissingTrackingColumnError(payload) {
    const text = JSON.stringify(payload || '').toLowerCase();
    return text.includes('tracking_number') && text.includes('does not exist');
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

    const body = parseJsonBody(req);
    if (!body) {
        return json(res, 400, { error: 'Invalid JSON body' });
    }

    const orderId = String(body.order_id || '').trim();
    const status = String(body.status || '').trim();
    const trackingRaw = body.tracking_number == null ? '' : String(body.tracking_number).trim();
    const trackingNumber = trackingRaw.replace(/\s+/g, '');

    if (!UUID_REGEX.test(orderId)) {
        return json(res, 400, { error: 'Invalid order_id' });
    }

    if (!ORDER_STATUSES.includes(status)) {
        return json(res, 400, { error: 'Invalid status value' });
    }

    if (status === SHIPPING_STATUS && !TTN_REGEX.test(trackingNumber)) {
        return json(res, 400, { error: 'Tracking number must contain 8-20 digits' });
    }

    const updated = await supabaseRequest('orders', {
        method: 'PATCH',
        query: {
            id: `eq.${orderId}`
        },
        body: {
            status,
            tracking_number: status === SHIPPING_STATUS ? trackingNumber : null
        },
        prefer: 'return=representation'
    });

    if (!updated.ok) {
        if (hasMissingTrackingColumnError(updated.data)) {
            return json(res, 500, { error: 'Database is missing orders.tracking_number. Run SQL migration first.' });
        }
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
