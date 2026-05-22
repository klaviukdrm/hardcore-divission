export async function sendTelegramMessage(text) {
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
            parse_mode: 'HTML'
        })
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.description || 'Telegram sendMessage failed');
    }

    return true;
}

export async function sendTelegramMediaGroup(items) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    }

    const normalized = Array.isArray(items)
        ? items
            .map((item) => {
                const image = String(item?.image || '').trim();
                const caption = String(item?.line || item?.caption || '').trim();
                if (!image) return null;
                return { image, caption };
            })
            .filter(Boolean)
        : [];

    const deduped = [];
    const seen = new Set();
    normalized.forEach((item) => {
        // Ignore list index prefix like "1. " so the same product row is deduped reliably.
        const normalizedCaption = String(item.caption || '')
            .replace(/^\s*\d+\.\s*/, '')
            .trim()
            .toLowerCase();
        const dedupeKey = `${item.image}::${normalizedCaption}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        deduped.push(item);
    });

    if (!deduped.length) {
        return true;
    }

    for (let i = 0; i < deduped.length; i += 10) {
        const chunk = deduped.slice(i, i + 10);
        const media = chunk.map((item) => ({
            type: 'photo',
            media: item.image,
            caption: item.caption ? item.caption.slice(0, 1024) : undefined
        }));

        const response = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                media
            })
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload?.description || 'Telegram sendMediaGroup failed');
        }
    }

    return true;
}
