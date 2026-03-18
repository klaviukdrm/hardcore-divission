export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { message, photo, image, order, authToken } = body;
    const imageData = photo || image;

    let dbStored = false;
    let dbError = null;

    async function getUserFromToken(token) {
        if (!token || !supabaseUrl || !supabaseAnonKey) return null;
        try {
            const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
                headers: {
                    apikey: supabaseAnonKey,
                    Authorization: `Bearer ${token}`
                }
            });
            if (!userRes.ok) return null;
            return await userRes.json();
        } catch {
            return null;
        }
    }

    async function storeOrder() {
        if (!order) return;
        if (!supabaseUrl || !supabaseServiceRoleKey) {
            dbError = 'missing_supabase_env';
            return;
        }

        const user = await getUserFromToken(authToken);
        const payload = {
            user_id: user && user.id ? user.id : null,
            email: order.email,
            phone: order.phone || null,
            region: order.region,
            currency: order.currency,
            total: order.total,
            items: order.items,
            delivery: order.delivery,
            payment_screenshot_present: Boolean(imageData),
            tg_status: 'sent'
        };

        try {
            const resp = await fetch(`${supabaseUrl}/rest/v1/orders`, {
                method: 'POST',
                headers: {
                    apikey: supabaseServiceRoleKey,
                    Authorization: `Bearer ${supabaseServiceRoleKey}`,
                    'Content-Type': 'application/json',
                    Prefer: 'return=representation'
                },
                body: JSON.stringify(payload)
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                dbError = err?.message || err?.error || 'db_insert_failed';
                return;
            }
            dbStored = true;
        } catch (e) {
            dbError = 'db_insert_failed';
        }
    }

    try {
        let response;

        if (imageData && imageData.includes('base64')) {
            const base64Data = imageData.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');

            let mimeType = 'image/png';
            let fileExt = 'png';
            const match = imageData.match(/^data:(image\/[^;]+);base64,/);
            if (match && match[1]) {
                mimeType = match[1];
                fileExt = mimeType.split('/')[1] || 'png';
                if (fileExt === 'jpeg') fileExt = 'jpg';
            }

            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('caption', message);
            formData.append('parse_mode', 'HTML');

            const fileBlob = new Blob([buffer], { type: mimeType });
            formData.append('photo', fileBlob, `payment.${fileExt}`);

            response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                method: 'POST',
                body: formData
            });
        } else {
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
            await storeOrder();
            return res.status(200).json({ success: true, dbStored, dbError });
        } else {
            console.error('TG Error:', result);
            return res.status(500).json({ success: false, error: result.description });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ success: false });
    }
}
