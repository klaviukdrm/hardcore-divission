import { json, methodNotAllowed } from '../_lib/http.js';
import { getAdminSession, getUserSession } from '../_lib/session.js';
import { requireSupabaseConfig, supabaseRequest } from '../_lib/supabase.js';

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

    const select = 'id,user_id,total_price,status,created_at,order_items(id,product_id,title,price,quantity,size),users(phone)';

    if (adminSession?.role === 'admin') {
        const result = await supabaseRequest('orders', {
            query: {
                select,
                order: 'created_at.desc',
                limit: 500
            }
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

    const result = await supabaseRequest('orders', {
        query: {
            select,
            user_id: `eq.${userSession.sub}`,
            order: 'created_at.desc',
            limit: 200
        }
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
