import { json, methodNotAllowed } from '../_lib/http.js';
import { requireSupabaseConfig, supabaseRequest } from '../_lib/supabase.js';

const DEFAULT_TIMEZONE = 'Europe/Kyiv';
const DEFAULT_LOCAL_HOUR = 21;

function getParts(date, timeZone) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(date);
    const map = {};
    for (const item of parts) {
        if (item.type !== 'literal') {
            map[item.type] = item.value;
        }
    }

    return {
        year: Number(map.year),
        month: Number(map.month),
        day: Number(map.day),
        hour: Number(map.hour),
        minute: Number(map.minute),
        second: Number(map.second)
    };
}

function zonedTimeToUtc(year, month, day, hour, minute, second, timeZone) {
    const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
    const guessedDate = new Date(utcGuess);
    const zonedParts = getParts(guessedDate, timeZone);

    const asIfUtc = Date.UTC(
        zonedParts.year,
        zonedParts.month - 1,
        zonedParts.day,
        zonedParts.hour,
        zonedParts.minute,
        zonedParts.second
    );

    const offsetMs = asIfUtc - utcGuess;
    return new Date(utcGuess - offsetMs);
}

function getLocalDayRange(now, timeZone) {
    const local = getParts(now, timeZone);
    const start = zonedTimeToUtc(local.year, local.month, local.day, 0, 0, 0, timeZone);

    const nextDayUtc = new Date(Date.UTC(local.year, local.month - 1, local.day) + 24 * 60 * 60 * 1000);
    const end = zonedTimeToUtc(
        nextDayUtc.getUTCFullYear(),
        nextDayUtc.getUTCMonth() + 1,
        nextDayUtc.getUTCDate(),
        0,
        0,
        0,
        timeZone
    );

    return {
        local,
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        localDateLabel: `${String(local.day).padStart(2, '0')}.${String(local.month).padStart(2, '0')}.${local.year}`
    };
}

function maskPhone(phone) {
    const raw = String(phone || '');
    if (raw.length < 6) return raw;
    return `${raw.slice(0, 4)}***${raw.slice(-3)}`;
}

async function sendTelegram(text) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        })
    });

    if (!response.ok) {
        const payload = await response.text();
        throw new Error(`Telegram send failed: ${payload}`);
    }
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return methodNotAllowed(res, ['GET']);
    }

    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const auth = req.headers.authorization || '';
        if (auth !== `Bearer ${cronSecret}`) {
            return json(res, 401, { error: 'Unauthorized cron request' });
        }
    }

    try {
        requireSupabaseConfig();
    } catch (e) {
        return json(res, 500, { error: 'Server is not configured' });
    }

    const timezone = process.env.DAILY_REPORT_TIMEZONE || DEFAULT_TIMEZONE;
    const targetHour = Number(process.env.DAILY_REPORT_HOUR_LOCAL || DEFAULT_LOCAL_HOUR);
    const now = new Date();

    const range = getLocalDayRange(now, timezone);
    if (range.local.hour !== targetHour) {
        return json(res, 200, {
            success: true,
            skipped: true,
            reason: 'Outside configured report hour',
            timezone,
            local_hour: range.local.hour,
            target_hour: targetHour
        });
    }

    const usersResp = await supabaseRequest('users', {
        query: {
            select: 'id,phone,created_at',
            and: `(created_at.gte.${range.startIso},created_at.lt.${range.endIso})`,
            order: 'created_at.asc',
            limit: 5000
        }
    });

    if (!usersResp.ok) {
        return json(res, 500, { error: 'Failed to load users for report' });
    }

    const ordersResp = await supabaseRequest('orders', {
        query: {
            select: 'id,total_price,status,created_at',
            and: `(created_at.gte.${range.startIso},created_at.lt.${range.endIso})`,
            order: 'created_at.asc',
            limit: 5000
        }
    });

    if (!ordersResp.ok) {
        return json(res, 500, { error: 'Failed to load orders for report' });
    }

    const users = Array.isArray(usersResp.data) ? usersResp.data : [];
    const orders = Array.isArray(ordersResp.data) ? ordersResp.data : [];

    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
    const statusCount = orders.reduce((acc, order) => {
        const key = String(order.status || 'unknown');
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    const recentPhones = users.slice(-5).map((u) => maskPhone(u.phone)).join(', ');

    const message = [
        '<b>Щоденний звіт Hardcore Division</b>',
        `Дата (${timezone}): <b>${range.localDateLabel}</b>`,
        '',
        `Нові реєстрації: <b>${users.length}</b>`,
        `Нові замовлення: <b>${orders.length}</b>`,
        `Сума замовлень за день: <b>${totalRevenue.toFixed(2)}</b>`,
        '',
        `<b>Статуси:</b>`,
        `Пакування: <b>${statusCount['Пакування'] || 0}</b>`,
        `Відправка (Нова Пошта, накладений платіж): <b>${statusCount['Відправка (Нова Пошта, накладений платіж)'] || 0}</b>`,
        `Завершено: <b>${statusCount['Завершено'] || 0}</b>`,
        '',
        `Останні реєстрації (масковані): ${recentPhones || 'немає'}`
    ].join('\n');

    try {
        await sendTelegram(message);
    } catch (e) {
        return json(res, 500, { error: e.message });
    }

    return json(res, 200, {
        success: true,
        sent: true,
        date: range.localDateLabel,
        timezone,
        users_count: users.length,
        orders_count: orders.length,
        total_revenue: Number(totalRevenue.toFixed(2))
    });
}
