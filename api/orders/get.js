import { json, methodNotAllowed } from '../../lib/server/http.js';
import { getAdminSession, getUserSession } from '../../lib/server/session.js';
import { requireSupabaseConfig, supabaseRequest } from '../../lib/server/supabase.js';

function hasMissingTrackingColumnError(payload) {
    const text = JSON.stringify(payload || '').toLowerCase();
    return text.includes('tracking_number') && text.includes('does not exist');
}

async function loadOrders(queryBase) {
    const selectWithTracking = 'id,user_id,total_price,status,tracking_number,created_at,order_items(id,product_id,title,price,quantity,size),users(phone)';
    const withTracking = await supabaseRequest('orders', {
        query: {
            ...queryBase,
            select: selectWithTracking
        }
    });

    if (withTracking.ok || !hasMissingTrackingColumnError(withTracking.data)) {
        return withTracking;
    }

    // Fallback for deployments where SQL migration was not applied yet.
    const fallbackSelect = 'id,user_id,total_price,status,created_at,order_items(id,product_id,title,price,quantity,size),users(phone)';
    return supabaseRequest('orders', {
        query: {
            ...queryBase,
            select: fallbackSelect
        }
    });
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return methodNotAllowed(res, ['GET']);
    }

    try {
        requireSupabaseConfig();
    } catch (e) {
        return json(res, 500, { error: 'Server is not configured' });
    }

    const adminSession = getAdminSession(req);
    const userSession = getUserSession(req);

    if (adminSession?.role === 'admin') {
        const result = await loadOrders({
            order: 'created_at.desc',
            limit: 500
        });

        if (!result.ok) {
            return json(res, 500, { error: 'Failed to load orders' });
        }

        return json(res, 200, {
            success: true,
            role: 'admin',
            orders: Array.isArray(result.data) ? result.data : []
        });
    }

    if (!userSession?.sub) {
        return json(res, 401, { error: 'Authentication required' });
    }

    const result = await loadOrders({
        user_id: `eq.${userSession.sub}`,
        order: 'created_at.desc',
        limit: 200
    });

    if (!result.ok) {
        return json(res, 500, { error: 'Failed to load orders' });
    }

    return json(res, 200, {
        success: true,
        role: 'user',
        user: {
            id: userSession.sub,
            phone: userSession.phone
        },
        orders: Array.isArray(result.data) ? result.data : []
    });
}
