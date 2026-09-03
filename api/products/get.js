import { json, methodNotAllowed } from '../../lib/server/http.js';
import { requireSupabaseConfig, supabaseRequest } from '../../lib/server/supabase.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return methodNotAllowed(res, ['GET']);
    }

    try {
        requireSupabaseConfig();
    } catch (e) {
        return json(res, 200, { success: true, products: [] });
    }

    try {
        const result = await supabaseRequest('products', {
            method: 'GET',
            query: {
                select: '*',
                order: 'catalog_order.asc,id.desc'
            }
        });

        if (!result.ok) {
            return json(res, 200, { success: true, products: [] });
        }

        const rows = Array.isArray(result.data) ? result.data : [];
        const formatted = rows.map((row) => ({
            id: row.id,
            slug: row.slug,
            title: row.title,
            category: row.category,
            priceUah: Number(row.price_uah) || 0,
            priceUsd: Number(row.price_usd) || 0,
            priceUahLabel: `${row.price_uah}₴`,
            priceUsdLabel: `${row.price_usd}€`,
            descUa: row.desc_ua || '',
            descEng: row.desc_eng || '',
            image: row.image || '',
            imageAlt: row.image_alt || row.image || '',
            gallery: Array.isArray(row.gallery) && row.gallery.length ? row.gallery : [row.image].filter(Boolean),
            isNew: Boolean(row.is_new),
            isPreorder: Boolean(row.is_preorder),
            soldOut: Boolean(row.sold_out),
            catalogOrder: Number(row.catalog_order) || 500,
            brand: row.brand || 'hd',
            colorVariants: Array.isArray(row.color_variants) && row.color_variants.length ? row.color_variants : (row.colorVariants || []),
            renderInCatalog: true,
            cartName: row.title
        }));

        return json(res, 200, {
            success: true,
            products: formatted
        });
    } catch (e) {
        return json(res, 200, { success: true, products: [] });
    }
}

