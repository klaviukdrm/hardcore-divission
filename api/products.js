import { json, methodNotAllowed, parseJsonBody } from '../lib/server/http.js';
import { getAdminSession } from '../lib/server/session.js';
import { requireSupabaseConfig, supabaseRequest } from '../lib/server/supabase.js';

function slugify(text) {
    const cyrToLat = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'h', 'ґ': 'g', 'д': 'd', 'е': 'e', 'є': 'ye', 'ж': 'zh',
        'з': 'z', 'и': 'y', 'і': 'i', 'ї': 'yi', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
        'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
        'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ь': '', 'ю': 'yu', 'я': 'ya', 'ъ': '', 'ы': 'y', 'э': 'e'
    };

    const str = String(text || '').toLowerCase().trim();
    let result = '';
    for (const ch of str) {
        result += cyrToLat[ch] !== undefined ? cyrToLat[ch] : ch;
    }

    return result
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || `product-${Date.now()}`;
}

export default async function handler(req, res) {
    try {
        requireSupabaseConfig();
    } catch (e) {
        return json(res, 500, { error: 'Supabase не налаштовано на сервері (перевірте SUPABASE_URL та SUPABASE_SERVICE_ROLE_KEY у Vercel)' });
    }

    const adminSession = getAdminSession(req);
    const isAdmin = adminSession && adminSession.role === 'admin';

    // GET: List all products (public storefront or admin list)
    if (req.method === 'GET') {
        const result = await supabaseRequest('products', {
            method: 'GET',
            query: {
                select: '*',
                order: 'catalog_order.asc,id.desc'
            }
        });

        if (!result.ok) {
            console.error('Supabase products fetch error:', result.data);
            return json(res, 500, { error: 'Помилка завантаження товарів із бази: ' + (result.data?.message || JSON.stringify(result.data)) });
        }

        const rows = Array.isArray(result.data) ? result.data : [];
        const formatted = rows.map((row) => ({
            id: row.id,
            slug: row.slug,
            title: row.title,
            category: row.category,
            priceUah: Number(row.price_uah) || 0,
            priceUsd: Number(row.price_usd) || 0,
            price_uah: Number(row.price_uah) || 0,
            price_usd: Number(row.price_usd) || 0,
            priceUahLabel: `${row.price_uah}₴`,
            priceUsdLabel: `${row.price_usd}€`,
            descUa: row.desc_ua || '',
            descEng: row.desc_eng || '',
            desc_ua: row.desc_ua || '',
            desc_eng: row.desc_eng || '',
            image: row.image || '',
            imageAlt: row.image_alt || row.image || '',
            image_alt: row.image_alt || row.image || '',
            gallery: Array.isArray(row.gallery) && row.gallery.length ? row.gallery : [row.image].filter(Boolean),
            colorVariants: Array.isArray(row.color_variants) && row.color_variants.length ? row.color_variants : (row.colorVariants || []),
            color_variants: Array.isArray(row.color_variants) && row.color_variants.length ? row.color_variants : (row.colorVariants || []),
            isNew: Boolean(row.is_new),
            is_new: Boolean(row.is_new),
            isPreorder: Boolean(row.is_preorder),
            is_preorder: Boolean(row.is_preorder),
            soldOut: Boolean(row.sold_out),
            sold_out: Boolean(row.sold_out),
            catalogOrder: Number(row.catalog_order) || 500,
            catalog_order: Number(row.catalog_order) || 500,
            brand: row.brand || 'hd',
            renderInCatalog: true,
            cartName: row.title
        }));

        return json(res, 200, {
            success: true,
            products: formatted
        });
    }

    // Admin authorization required for POST, PATCH, PUT, DELETE
    if (!isAdmin) {
        return json(res, 401, { error: 'Потрібна авторизація адміністратора (увійдіть заново через пароль)' });
    }

    // POST: Create product or bulk sync
    if (req.method === 'POST') {
        const body = parseJsonBody(req);
        if (!body) {
            return json(res, 400, { error: 'Некоректні дані' });
        }

        // Handle Bulk Sync / Import
        if (body.action === 'sync_all' && Array.isArray(body.products)) {
            const seenSlugs = new Set();
            const uniqueItems = [];

            for (const item of body.products) {
                const slug = String(item.slug || slugify(item.title)).trim();
                const title = String(item.title || '').trim();
                if (!title || !slug || seenSlugs.has(slug)) continue;
                seenSlugs.add(slug);

                uniqueItems.push({
                    slug,
                    title,
                    category: String(item.category || 'футболка').toLowerCase(),
                    price_uah: Number(item.priceUah || item.price_uah) || 0,
                    price_usd: Number(item.priceUsd || item.price_usd) || 0,
                    desc_ua: String(item.descUa || item.desc_ua || ''),
                    desc_eng: String(item.descEng || item.desc_eng || ''),
                    image: String(item.image || ''),
                    image_alt: String(item.imageAlt || item.image_alt || item.image || ''),
                    gallery: Array.isArray(item.gallery) && item.gallery.length ? item.gallery : [item.image].filter(Boolean),
                    is_new: Boolean(item.isNew || item.is_new),
                    is_preorder: Boolean(item.isPreorder || item.is_preorder),
                    sold_out: Boolean(item.soldOut || item.sold_out),
                    catalog_order: Number(item.catalogOrder || item.catalog_order) || 500,
                    brand: String(item.brand || 'hd').toLowerCase(),
                    color_variants: Array.isArray(item.colorVariants) ? item.colorVariants : (item.color_variants || [])
                });
            }

            if (!uniqueItems.length) {
                return json(res, 400, { error: 'Список товарів для імпорту порожній' });
            }

            let insertedTotal = 0;
            const chunkSize = 15;
            for (let i = 0; i < uniqueItems.length; i += chunkSize) {
                const chunk = uniqueItems.slice(i, i + chunkSize);
                const upsertRes = await supabaseRequest('products', {
                    method: 'POST',
                    query: { on_conflict: 'slug' },
                    body: chunk,
                    prefer: 'resolution=merge-duplicates,return=representation'
                });

                if (upsertRes.ok) {
                    insertedTotal += Array.isArray(upsertRes.data) ? upsertRes.data.length : chunk.length;
                } else {
                    // Fallback to one-by-one insert if batch hit any single row issue
                    for (const singleItem of chunk) {
                        const singleRes = await supabaseRequest('products', {
                            method: 'POST',
                            query: { on_conflict: 'slug' },
                            body: singleItem,
                            prefer: 'resolution=merge-duplicates,return=representation'
                        });
                        if (singleRes.ok) {
                            insertedTotal += 1;
                        }
                    }
                }
            }

            return json(res, 200, { success: true, count: insertedTotal });
        }

        const title = String(body.title || '').trim();
        const category = String(body.category || 'футболка').trim().toLowerCase();
        const priceUah = Number(body.price_uah || body.priceUah);
        const priceUsd = Number(body.price_usd || body.priceUsd) || Math.round((priceUah || 0) / 45);
        const descUa = String(body.desc_ua || body.descUa || '').trim();
        const descEng = String(body.desc_eng || body.descEng || '').trim();
        const gallery = Array.isArray(body.gallery) ? body.gallery.filter(Boolean) : [];
        const image = String(body.image || gallery[0] || '').trim();
        const imageAlt = String(body.image_alt || body.imageAlt || gallery[1] || image).trim();
        const isNew = Boolean(body.is_new || body.isNew);
        const isPreorder = Boolean(body.is_preorder || body.isPreorder);
        const soldOut = Boolean(body.sold_out || body.soldOut);
        const catalogOrder = Number(body.catalog_order || body.catalogOrder) || 500;
        const brand = String(body.brand || 'hd').trim().toLowerCase();
        const colorVariants = Array.isArray(body.color_variants || body.colorVariants) ? (body.color_variants || body.colorVariants) : [];

        if (!title) {
            return json(res, 400, { error: 'Вкажіть назву товару' });
        }

        if (!Number.isFinite(priceUah) || priceUah <= 0) {
            return json(res, 400, { error: 'Вкажіть коректну ціну в гривнях' });
        }

        if (!image && !gallery.length) {
            return json(res, 400, { error: 'Додайте хоча б одне фото товару' });
        }

        let slug = String(body.slug || '').trim();
        if (!slug) {
            slug = `${slugify(title)}-${Date.now().toString().slice(-4)}`;
        }

        const payload = {
            slug,
            title,
            category,
            price_uah: priceUah,
            price_usd: priceUsd,
            desc_ua: descUa,
            desc_eng: descEng,
            image,
            image_alt: imageAlt,
            gallery: gallery.length ? gallery : [image],
            is_new: isNew,
            is_preorder: isPreorder,
            sold_out: soldOut,
            catalog_order: catalogOrder,
            brand,
            color_variants: colorVariants
        };

        const result = await supabaseRequest('products', {
            method: 'POST',
            body: payload,
            prefer: 'return=representation'
        });

        if (!result.ok) {
            console.error('Supabase Product Create Error:', result.data);
            return json(res, 500, { error: typeof result.data === 'object' && result.data?.message ? result.data.message : 'Помилка збереження товару в базу' });
        }

        const created = Array.isArray(result.data) ? result.data[0] : payload;
        return json(res, 201, { success: true, product: created });
    }

    // PATCH / PUT: Update product fields
    if (req.method === 'PATCH' || req.method === 'PUT') {
        const body = parseJsonBody(req) || {};
        const id = body.id || req.query?.id;
        const slug = body.slug || req.query?.slug;

        if (!id && !slug) {
            return json(res, 400, { error: 'Вкажіть id або slug товару для оновлення' });
        }

        const updateData = {};
        if (body.catalog_order !== undefined || body.catalogOrder !== undefined) {
            updateData.catalog_order = Number(body.catalog_order !== undefined ? body.catalog_order : body.catalogOrder);
        }
        if (body.sold_out !== undefined || body.soldOut !== undefined) {
            updateData.sold_out = Boolean(body.sold_out !== undefined ? body.sold_out : body.soldOut);
        }
        if (body.is_new !== undefined || body.isNew !== undefined) {
            updateData.is_new = Boolean(body.is_new !== undefined ? body.is_new : body.isNew);
        }
        if (body.is_preorder !== undefined || body.isPreorder !== undefined) {
            updateData.is_preorder = Boolean(body.is_preorder !== undefined ? body.is_preorder : body.isPreorder);
        }
        if (body.price_uah !== undefined || body.priceUah !== undefined) {
            updateData.price_uah = Number(body.price_uah !== undefined ? body.price_uah : body.priceUah);
        }
        if (body.price_usd !== undefined || body.priceUsd !== undefined) {
            updateData.price_usd = Number(body.price_usd !== undefined ? body.price_usd : body.priceUsd);
        }
        if (body.title !== undefined) updateData.title = String(body.title).trim();
        if (body.category !== undefined) updateData.category = String(body.category).trim();
        if (body.brand !== undefined) updateData.brand = String(body.brand).trim();
        if (body.desc_ua !== undefined || body.descUa !== undefined) {
            updateData.desc_ua = String(body.desc_ua !== undefined ? body.desc_ua : body.descUa);
        }
        if (body.desc_eng !== undefined || body.descEng !== undefined) {
            updateData.desc_eng = String(body.desc_eng !== undefined ? body.desc_eng : body.descEng);
        }
        if (body.color_variants !== undefined || body.colorVariants !== undefined) {
            updateData.color_variants = Array.isArray(body.color_variants !== undefined ? body.color_variants : body.colorVariants) ? (body.color_variants || body.colorVariants) : [];
        }

        updateData.updated_at = new Date().toISOString();

        const query = id ? { id: `eq.${id}` } : { slug: `eq.${slug}` };
        const result = await supabaseRequest('products', {
            method: 'PATCH',
            query,
            body: updateData,
            prefer: 'return=representation'
        });

        if (!result.ok) {
            return json(res, 500, { error: 'Не вдалося оновити товар' });
        }

        return json(res, 200, {
            success: true,
            product: Array.isArray(result.data) ? result.data[0] : null
        });
    }

    // DELETE: Delete product
    if (req.method === 'DELETE') {
        const body = parseJsonBody(req) || {};
        const id = body.id || req.query?.id;
        const slug = body.slug || req.query?.slug;

        if (!id && !slug) {
            return json(res, 400, { error: 'Вкажіть id або slug товару для видалення' });
        }

        let query = slug ? { slug: `eq.${slug}` } : { id: `eq.${id}` };
        let result = await supabaseRequest('products', {
            method: 'DELETE',
            query,
            prefer: 'return=representation'
        });

        // Fallback to id if slug did not match
        if (result.ok && Array.isArray(result.data) && result.data.length === 0 && id) {
            result = await supabaseRequest('products', {
                method: 'DELETE',
                query: { id: `eq.${id}` },
                prefer: 'return=representation'
            });
        }

        if (!result.ok) {
            console.error('Delete product error:', result.data);
            return json(res, 500, { error: 'Не вдалося видалити товар із бази' });
        }

        return json(res, 200, { success: true });
    }

    return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']);
}
