import { json, methodNotAllowed, parseJsonBody } from '../../lib/server/http.js';
import { getUserSession } from '../../lib/server/session.js';
import { requireSupabaseConfig, supabaseRequest } from '../../lib/server/supabase.js';

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

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return methodNotAllowed(res, ['POST']);
    }

    try {
        requireSupabaseConfig();
    } catch (e) {
        return json(res, 500, { error: 'Server is not configured' });
    }

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
        // Keep parent order even if item rows failed: user should still see the order in history.
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

