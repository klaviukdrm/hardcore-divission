import { json, methodNotAllowed, parseJsonBody } from '../lib/server/http.js';
import { getAdminSession, getUserSession } from '../lib/server/session.js';
import { requireSupabaseConfig, supabaseRequest } from '../lib/server/supabase.js';

function normalizeItems(items) {
    if (!Array.isArray(items) || items.length === 0) return [];

    return items
        .map((item) => {
            const title = String(item?.title || item?.name || '').trim();
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

async function loadOrders(queryBase) {
    // 1. Try relational select with order_items
    let res = await supabaseRequest('orders', {
        query: {
            ...queryBase,
            select: 'id,user_id,user_email,total_price,status,tracking_number,items,created_at,order_items(id,product_id,title,price,quantity,size)'
        }
    });

    if (res.ok && Array.isArray(res.data)) {
        res.data.forEach((order) => {
            if ((!order.order_items || !order.order_items.length) && Array.isArray(order.items)) {
                order.order_items = order.items;
            }
        });
        return res;
    }

    // 2. Select orders directly without relations
    res = await supabaseRequest('orders', {
        query: {
            ...queryBase,
            select: 'id,user_id,user_email,total_price,status,tracking_number,items,created_at'
        }
    });

    if (!res.ok) {
        res = await supabaseRequest('orders', {
            query: {
                ...queryBase,
                select: 'id,user_id,total_price,status,created_at'
            }
        });
    }

    if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        const orderIds = res.data.map((o) => o.id).filter(Boolean);
        if (orderIds.length > 0) {
            const itemsRes = await supabaseRequest('order_items', {
                query: {
                    order_id: `in.(${orderIds.join(',')})`
                }
            });
            const itemsByOrder = {};
            if (itemsRes.ok && Array.isArray(itemsRes.data)) {
                itemsRes.data.forEach((item) => {
                    if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
                    itemsByOrder[item.order_id].push(item);
                });
            }
            res.data.forEach((order) => {
                order.order_items = itemsByOrder[order.id] || (Array.isArray(order.items) ? order.items : []);
            });
        }
    }

    return res;
}

export default async function handler(req, res) {
    try {
        requireSupabaseConfig();
    } catch (e) {
        return json(res, 500, { error: 'База даних не налаштована' });
    }

    // GET: Retrieve order history
    if (req.method === 'GET') {
        const url = new URL(req.url, 'http://localhost');
        const queryEmail = url.searchParams.get('email');
        const userSession = getUserSession(req);
        const adminSession = getAdminSession(req);

        const targetEmail = (userSession?.email || userSession?.phone || (queryEmail ? queryEmail.trim().toLowerCase() : null));
        const targetUserId = userSession?.sub || null;

        if (targetEmail || targetUserId) {
            const orParts = [];
            if (targetUserId) orParts.push(`user_id.eq.${targetUserId}`);
            if (targetEmail) orParts.push(`user_email.eq.${targetEmail}`);

            const queryOpts = {
                order: 'created_at.desc',
                limit: 100
            };

            if (orParts.length > 1) {
                queryOpts.or = `(${orParts.join(',')})`;
            } else if (targetUserId) {
                queryOpts.user_id = `eq.${targetUserId}`;
            } else if (targetEmail) {
                queryOpts.user_email = `eq.${targetEmail}`;
            }

            const result = await loadOrders(queryOpts);

            return json(res, 200, {
                success: true,
                role: 'user',
                user: {
                    id: targetUserId,
                    email: targetEmail || 'User'
                },
                orders: (result.ok && Array.isArray(result.data)) ? result.data : []
            });
        }

        if (adminSession?.role === 'admin') {
            const result = await loadOrders({
                order: 'created_at.desc',
                limit: 500
            });

            return json(res, 200, {
                success: true,
                role: 'admin',
                orders: (result.ok && Array.isArray(result.data)) ? result.data : []
            });
        }

        return json(res, 401, { error: 'Потрібна авторизація' });
    }

    // POST: Create order (called during checkout)
    if (req.method === 'POST') {
        const userSession = getUserSession(req);
        const body = parseJsonBody(req);
        if (!body) {
            return json(res, 400, { error: 'Некоректні дані' });
        }

        const items = normalizeItems(body.items);
        const totalPrice = Number(body.total_price);

        if (!items.length) {
            return json(res, 400, { error: 'Замовлення має містити хоча б один товар' });
        }

        if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
            return json(res, 400, { error: 'Некоректна сума замовлення' });
        }

        const userEmail = (userSession?.email || userSession?.phone || body.user_email || '').trim().toLowerCase() || null;
        const userId = userSession?.sub || body.user_id || null;

        const orderBody = {
            total_price: totalPrice,
            status: 'Пакування',
            items
        };

        if (userId) orderBody.user_id = userId;
        if (userEmail) orderBody.user_email = userEmail;

        const createOrder = await supabaseRequest('orders', {
            method: 'POST',
            body: orderBody,
            prefer: 'return=representation'
        });

        if (!createOrder.ok || !Array.isArray(createOrder.data) || createOrder.data.length === 0) {
            // Fallback: try inserting with user_email if schema differs
            const fallbackCreate = await supabaseRequest('orders', {
                method: 'POST',
                body: {
                    user_email: userEmail,
                    total_price: totalPrice,
                    status: 'Пакування'
                },
                prefer: 'return=representation'
            });

            if (!fallbackCreate.ok || !Array.isArray(fallbackCreate.data) || fallbackCreate.data.length === 0) {
                // Minimum insert
                const minCreate = await supabaseRequest('orders', {
                    method: 'POST',
                    body: {
                        total_price: totalPrice,
                        status: 'Пакування'
                    },
                    prefer: 'return=representation'
                });
                if (minCreate.ok && Array.isArray(minCreate.data) && minCreate.data.length > 0) {
                    createOrder.data = minCreate.data;
                }
            } else {
                createOrder.data = fallbackCreate.data;
            }
        }

        const order = createOrder.data[0];

        // Also insert into order_items if table exists
        try {
            const itemRows = items.map((item) => ({
                order_id: order.id,
                product_id: item.product_id,
                title: item.title,
                price: item.price,
                quantity: item.quantity,
                size: item.size
            }));

            await supabaseRequest('order_items', {
                method: 'POST',
                body: itemRows
            });
        } catch (e) {
            // Graceful fallback
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

