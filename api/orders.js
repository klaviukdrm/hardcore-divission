import { json, methodNotAllowed, parseJsonBody } from '../lib/server/http.js';
import { getAdminSession, getUserSession } from '../lib/server/session.js';
import { requireSupabaseConfig, supabaseRequest } from '../lib/server/supabase.js';

function normalizeItems(items) {
    if (!Array.isArray(items) || items.length === 0) return [];

    return items
        .map((item) => {
            const title = String(item?.title || '').trim();
            const productId = item?.product_id != null ? String(item.product_id).trim() : null;
            const size = item?.size != null ? String(item.size).trim() : null;
            const quantity = Number(item?.quantity || 1);
            const price = Number(item?.price);

            if (!title || !Number.isFinite(price) || price <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
                return null;
            }

            return {
                product_id: productId || null,
                title,
                price,
                quantity,
                size: size || null
            };
        })
        .filter(Boolean);
}

async function insertOrderItemsWithFallback(orderId, items) {
    const itemRows = items.map((item) => ({
        order_id: orderId,
        product_id: item.product_id,
        title: item.title,
        price: item.price,
        quantity: item.quantity,
        size: item.size
    }));

    const bulkInsert = await supabaseRequest('order_items', {
        method: 'POST',
        body: itemRows,
        prefer: 'return=representation'
    });

    if (bulkInsert.ok) {
        const inserted = Array.isArray(bulkInsert.data) ? bulkInsert.data.length : itemRows.length;
        return { ok: true, inserted };
    }

    let inserted = 0;
    for (const row of itemRows) {
        const singleInsert = await supabaseRequest('order_items', {
            method: 'POST',
            body: row,
            prefer: 'return=representation'
        });
        if (singleInsert.ok) {
            inserted += 1;
        }
    }

    return { ok: inserted > 0, inserted };
}

async function loadOrders(queryBase) {
    const selectWithTracking = 'id,user_id,total_price,status,tracking_number,created_at,order_items(id,product_id,title,price,quantity,size),users(phone)';
    const withTracking = await supabaseRequest('orders', {
        query: {
            ...queryBase,
            select: selectWithTracking
        }
    });

    if (withTracking.ok || !JSON.stringify(withTracking.data || '').toLowerCase().includes('tracking_number')) {
        return withTracking;
    }

    const fallbackSelect = 'id,user_id,total_price,status,created_at,order_items(id,product_id,title,price,quantity,size),users(phone)';
    return supabaseRequest('orders', {
        query: {
            ...queryBase,
            select: fallbackSelect
        }
    });
}

export default async function handler(req, res) {
    try {
        requireSupabaseConfig();
    } catch (e) {
        return json(res, 500, { error: 'Server is not configured' });
    }

    // GET: Retrieve order history
    if (req.method === 'GET') {
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

    // POST: Create order
    if (req.method === 'POST') {
        const userSession = getUserSession(req);
        if (!userSession?.sub) {
            return json(res, 401, { error: 'Authentication required' });
        }

        const body = parseJsonBody(req);
        if (!body) {
            return json(res, 400, { error: 'Invalid JSON body' });
        }

        const items = normalizeItems(body.items);
        const totalPrice = Number(body.total_price);

        if (!items.length) {
            return json(res, 400, { error: 'Order must include at least one item' });
        }

        if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
            return json(res, 400, { error: 'Invalid total_price' });
        }

        const createOrder = await supabaseRequest('orders', {
            method: 'POST',
            body: {
                user_id: userSession.sub,
                total_price: totalPrice,
                status: 'Пакування'
            },
            prefer: 'return=representation'
        });

        if (!createOrder.ok || !Array.isArray(createOrder.data) || createOrder.data.length === 0) {
            return json(res, 500, { error: 'Failed to create order' });
        }

        const order = createOrder.data[0];
        const itemsResult = await insertOrderItemsWithFallback(order.id, items);
        if (!itemsResult.ok) {
            return json(res, 201, {
                success: true,
                warning: 'Order was created, but items were not saved',
                order: {
                    id: order.id,
                    total_price: order.total_price,
                    status: order.status
                }
            });
        }

        return json(res, 201, {
            success: true,
            order: {
                id: order.id,
                total_price: order.total_price,
                status: order.status
            }
        });
    }

    return methodNotAllowed(res, ['GET', 'POST']);
}

