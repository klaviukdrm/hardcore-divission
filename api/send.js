import { sendTelegramMediaGroup } from '../lib/server/telegram.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    // Accept either `photo` or `image` from the client payload.
    const { message, photo, image, orderItems } = req.body;
    const imageData = photo || image;

    try {
        let response;

        function getBaseUrl() {
            const protoHeader = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
            const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
            const protocol = protoHeader || 'https';
            if (!hostHeader) return '';
            return `${protocol}://${hostHeader}`;
        }

        function resolveOrderItems(items) {
            if (!Array.isArray(items)) return [];
            const baseUrl = getBaseUrl();

            return items.map((item) => {
                const line = String(item?.line || '').trim();
                const imageRaw = String(item?.image || '').trim();
                if (!imageRaw) return null;

                let image = imageRaw;
                if (!/^https?:\/\//i.test(imageRaw) && baseUrl) {
                    try {
                        image = new URL(imageRaw, `${baseUrl}/`).toString();
                    } catch (e) {
                        image = imageRaw;
                    }
                }

                return { line, image };
            }).filter(Boolean);
        }

        function parseBase64DataUrl(dataUrl) {
            const match = String(dataUrl || '').match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i);
            if (!match) return null;

            const mimeType = String(match[1] || 'application/octet-stream').toLowerCase();
            const rawBase64 = String(match[2] || '').trim();
            if (!rawBase64) return null;

            return {
                mimeType,
                buffer: Buffer.from(rawBase64, 'base64')
            };
        }

        function extensionFromMimeType(mimeType) {
            const map = {
                'image/jpeg': 'jpg',
                'image/jpg': 'jpg',
                'image/png': 'png',
                'image/webp': 'webp',
                'image/gif': 'gif',
                'image/bmp': 'bmp',
                'image/tiff': 'tiff',
                'image/heic': 'heic',
                'image/heif': 'heif'
            };
            return map[mimeType] || 'bin';
        }

        const supportedPhotoMimeTypes = new Set([
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/bmp'
        ]);

        // If image is base64, send it as a file to Telegram.
        if (imageData && imageData.includes('base64')) {
            const parsedImage = parseBase64DataUrl(imageData);
            if (!parsedImage || !parsedImage.buffer.length) {
                return res.status(400).json({ success: false, error: 'Invalid payment screenshot data' });
            }

            const { mimeType, buffer } = parsedImage;
            const ext = extensionFromMimeType(mimeType);
            const isPhotoMime = supportedPhotoMimeTypes.has(mimeType);
            const methodName = isPhotoMime ? 'sendPhoto' : 'sendDocument';
            const fieldName = isPhotoMime ? 'photo' : 'document';

            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('caption', message);
            formData.append('parse_mode', 'HTML');

            const fileBlob = new Blob([buffer], { type: mimeType });
            formData.append(fieldName, fileBlob, `payment.${ext}`);

            response = await fetch(`https://api.telegram.org/bot${botToken}/${methodName}`, {
                method: 'POST',
                body: formData
            });
        } else {
            // Fallback: send plain text message.
            response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                    parse_mode: 'HTML'
                })
            });
        }

        const result = await response.json();

        if (response.ok) {
            const resolvedItems = resolveOrderItems(orderItems);
            if (resolvedItems.length) {
                await sendTelegramMediaGroup(resolvedItems);
            }
            return res.status(200).json({ success: true });
        } else {
            console.error('TG Error:', result);
            return res.status(500).json({ success: false, error: result.description });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ success: false });
    }
}
