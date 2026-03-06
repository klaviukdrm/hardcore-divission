export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const { message, photo } = req.body;

    try {
        let response;

        if (photo) {
            // Если прислали фото (скриншот оплаты)
            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('caption', message); // Текст заказа идет подписью к фото
            formData.append('parse_mode', 'HTML');
            
            // Превращаем base64 обратно в Blob для отправки в Telegram
            const blob = await fetch(photo).then(r => r.blob());
            formData.append('photo', blob, 'payment.png');

            response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                method: 'POST',
                body: formData
            });
        } else {
            // Обычная текстовая отправка (если скрина нет)
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

        if (response.ok) {
            return res.status(200).json({ success: true });
        } else {
            const errorInfo = await response.json();
            console.error('TG Error:', errorInfo);
            return res.status(500).json({ success: false });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ success: false });
    }
}
