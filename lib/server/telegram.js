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

    if (!normalized.length) {
        return true;
    }

    for (let i = 0; i < normalized.length; i += 10) {
        const chunk = normalized.slice(i, i + 10);
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
