export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    // ВАЖНО: берем 'image', так как во фронтенде написано JSON.stringify({ image: ... })
    const { message, image } = req.body;

    if (!botToken || !chatId) {
        console.error('Ошибка: Не настроены переменные окружения TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
        return res.status(500).json({ success: false, error: 'Server config error' });
    }

    try {
        let response;

        if (image) {
            // Если прислали фото (base64)
            // Убираем префикс (data:image/png;base64,), если он есть
            const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');

            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('caption', message);
            formData.append('parse_mode', 'HTML');
            
            // Создаем файл из буфера для отправки
            const blob = new Blob([buffer], { type: 'image/png' });
            formData.append('photo', blob, 'payment.png');

            response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                method: 'POST',
                body: formData
            });
        } else {
            // Обычная текстовая отправка
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
            return res.status(200).json({ success: true });
        } else {
            console.error('TG API Error:', result);
            return res.status(500).json({ success: false, error: result.description });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ success: false });
    }
}
