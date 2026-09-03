import { json, methodNotAllowed, parseJsonBody } from '../../lib/server/http.js';
import { getAdminSession } from '../../lib/server/session.js';
import { uploadToSupabaseStorage, parseBase64Image } from '../../lib/server/storage.js';
import crypto from 'node:crypto';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '12mb'
        }
    }
};

function sanitizeFileName(name = '') {
    return String(name || '')
        .toLowerCase()
        .replace(/[^a-z0-9_.-]/g, '-')
        .replace(/-+/g, '-');
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return methodNotAllowed(res, ['POST']);
    }

    const adminSession = getAdminSession(req);
    if (!adminSession || adminSession.role !== 'admin') {
        return json(res, 401, { error: 'Потрібна авторизація адміністратора' });
    }

    const body = parseJsonBody(req);
    if (!body) {
        return json(res, 400, { error: 'Некоректне тіло запиту' });
    }

    // Accepts either single image `{ image, fileName, slug }` or array of images `{ images: [{ data, name }] }`
    const { image, images, slug, fileName } = body;

    try {
        if (Array.isArray(images) && images.length > 0) {
            const uploadPromises = images.slice(0, 4).map(async (item, index) => {
                const parsed = parseBase64Image(item.data || item.image || item);
                if (!parsed) return null;

                const ext = parsed.mimeType.split('/')[1] || 'jpg';
                const baseSlug = sanitizeFileName(slug || 'product') || 'product';
                const randomHash = crypto.randomBytes(4).toString('hex');
                const path = `${baseSlug}/${Date.now()}_${index + 1}_${randomHash}.${ext}`;

                return uploadToSupabaseStorage('products', path, parsed.buffer, parsed.mimeType);
            });

            const results = await Promise.all(uploadPromises);
            const urls = results.filter(Boolean);

            return json(res, 200, { success: true, urls });
        }

        if (image) {
            const parsed = parseBase64Image(image);
            if (!parsed) {
                return json(res, 400, { error: 'Некоректний формат зображення (має бути base64 Data URL)' });
            }

            const ext = parsed.mimeType.split('/')[1] || 'jpg';
            const baseSlug = sanitizeFileName(slug || fileName || 'product') || 'product';
            const randomHash = crypto.randomBytes(4).toString('hex');
            const path = `${baseSlug}/${Date.now()}_${randomHash}.${ext}`;

            const url = await uploadToSupabaseStorage('products', path, parsed.buffer, parsed.mimeType);

            return json(res, 200, { success: true, url });
        }

        return json(res, 400, { error: 'Зображення не надано' });
    } catch (error) {
        console.error('Upload Error:', error);
        return json(res, 500, { error: error.message || 'Помилка завантаження фотографії' });
    }
}

