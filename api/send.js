export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    // Берем или photo, или image (чтобы точно сработало)
    const { message, photo, image } = req.body;
    const imageData = photo || image;

    try {
        let response;

        // Проверяем, пришла ли картинка в формате base64
        if (imageData && imageData.includes('base64')) {
            // 1. Убираем "шапку" base64 (data:image/png;base64,...)
            const base64Data = imageData.split(',')[1];
            
            // 2. Делаем из строки файл (Buffer) — это стандарт для Node.js
            const buffer = Buffer.from(base64Data, 'base64');

            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('caption', message);
            formData.append('parse_mode', 'HTML');
            
            // 3. Создаем Blob из буфера для отправки
            const fileBlob = new Blob([buffer], { type: 'image/png' });
            formData.append('photo', fileBlob, 'payment.png');

            response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                method: 'POST',
                body: formData
            });
        } else {
            // Если фото не пришло, шлем просто текст
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
            console.error('TG Error:', result);
            return res.status(500).json({ success: false, error: result.description });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ success: false });
    }
}
