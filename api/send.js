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
            // 1. Убеждаемся, что base64 чистый (убираем префикс, если он есть)
            const base64Data = photo.split(',')[1] || photo;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });

            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('caption', message);
            formData.append('parse_mode', 'HTML');
            formData.append('photo', blob, 'payment.png');

            // 2. При отправке FormData заголовки Content-Type ставить НЕЛЬЗЯ, fetch сделает это сам
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
            return res.status(200).json({ success: true });
        } else {
            console.error('TG Error Detailed:', result); // Это покажет в логах Vercel, что именно не так
            return res.status(500).json({ success: false, error: result.description });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ success: false });
    }
}
