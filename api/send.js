export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const { message, photo } = req.body;

    try {
        let response;

        // Проверяем наличие фото и наличие в нем строки base64
        if (photo && photo.includes('base64')) {
            // 1. Извлекаем чистые данные base64
            const base64Data = photo.split(',')[1] || photo;
            
            // 2. Превращаем base64 в Buffer (это стандарт для Node.js)
            const buffer = Buffer.from(base64Data, 'base64');

            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('caption', message);
            formData.append('parse_mode', 'HTML');
            
            // 3. Создаем Blob из буфера (современный fetch в Node.js это понимает)
            const fileBlob = new Blob([buffer], { type: 'image/png' });
            formData.append('photo', fileBlob, 'payment.png');

            response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                method: 'POST',
                body: formData
            });
        } else {
            // Если фото нет, шлем просто текст
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
            console.error('TG Error Detailed:', result);
            return res.status(500).json({ success: false, error: result.description });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ success: false });
    }
}
