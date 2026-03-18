const KYIV_TZ = 'Europe/Kyiv';

function getKyivParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: KYIV_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(date);
    const map = {};
    for (const part of parts) {
        if (part.type !== 'literal') {
            map[part.type] = part.value;
        }
    }
    return map;
}

function getKyivDateKey(date = new Date()) {
    const parts = getKyivParts(date);
    return `${parts.year}-${parts.month}-${parts.day}`;
}

async function listAllUsers(supabaseUrl, serviceKey) {
    const users = [];
    const perPage = 1000;
    let page = 1;

    while (page <= 50) {
        const resp = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`
            }
        });

        if (!resp.ok) {
            const err = await resp.text().catch(() => '');
            throw new Error(`Supabase admin users error: ${resp.status} ${err}`);
        }

        const data = await resp.json().catch(() => ({}));
        const batch = Array.isArray(data.users) ? data.users : (Array.isArray(data) ? data : []);
        users.push(...batch);

        if (batch.length < perPage) break;
        page += 1;
    }

    return users;
}

export default async function handler(req, res) {
    if (!['GET', 'POST'].includes(req.method)) {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const authHeader = req.headers.authorization || '';
        if (authHeader !== `Bearer ${cronSecret}`) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
    }

    const now = new Date();
    const kyivParts = getKyivParts(now);

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!supabaseUrl || !serviceKey || !botToken || !chatId) {
        return res.status(500).json({ message: 'Missing environment variables' });
    }

    const todayKey = `${kyivParts.year}-${kyivParts.month}-${kyivParts.day}`;

    let users;
    try {
        users = await listAllUsers(supabaseUrl, serviceKey);
    } catch (e) {
        return res.status(500).json({ message: 'Failed to list users' });
    }

    const todayUsers = users.filter((user) => {
        if (!user || !user.created_at) return false;
        const created = new Date(user.created_at);
        if (Number.isNaN(created.getTime())) return false;
        return getKyivDateKey(created) === todayKey;
    });

    const count = todayUsers.length;
    const lines = [
        `Реєстрації за ${todayKey} (Kyiv): ${count}`
    ];

    if (todayUsers.length) {
        lines.push('');
        lines.push('Логіни (email) / ПІБ / телефон:');

        const maxList = 100;
        for (const user of todayUsers.slice(0, maxList)) {
            const meta = user.user_metadata || {};
            const profile = meta.profile || {};
            const fullName = meta.full_name || profile.fullName || profile.full_name || '';
            const phone = meta.phone || profile.phone || '';
            const email = user.email || '';

            let row = email || 'no-email';
            if (fullName) row += ` | ${fullName}`;
            if (phone) row += ` | ${phone}`;
            lines.push(row);
        }

        if (todayUsers.length > maxList) {
            lines.push(`...і ще ${todayUsers.length - maxList}`);
        }
    }

    try {
        const tgResp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: lines.join('\n')
            })
        });

        if (!tgResp.ok) {
            const err = await tgResp.text().catch(() => '');
            return res.status(500).json({ message: 'Telegram send failed', error: err });
        }
    } catch (e) {
        return res.status(500).json({ message: 'Telegram send failed' });
    }

    return res.status(200).json({ sent: true, count });
}
