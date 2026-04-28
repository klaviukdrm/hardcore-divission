export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    // Accept either `photo` or `image` from the client payload.
    const { message, photo, image, orderItems } = req.body;
    const imageData = photo || image;

    try {
        let response;

        async function sendOrderItemsPhotos(items) {
            if (!Array.isArray(items) || !items.length) return;

            for (const item of items) {
                const photoUrl = typeof item?.image === 'string' ? item.image : '';
                const caption = typeof item?.line === 'string' ? item.line : '';
                if (!photoUrl) continue;

                try {
                    const itemResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: chatId,
                            photo: photoUrl,
                            caption: caption.slice(0, 1024)
                        })
                    });

                    if (!itemResponse.ok) {
                        const itemError = await itemResponse.json().catch(() => null);
                        console.error('TG Item Photo Error:', itemError || itemResponse.statusText);
                    }
                } catch (itemErr) {
                    console.error('TG Item Photo Send Error:', itemErr);
                }
            }
        }

        // If image is base64, send it as a file to Telegram.
        if (imageData && imageData.includes('base64')) {
            // 1) Strip the base64 prefix (data:image/png;base64,...).
            const base64Data = imageData.split(',')[1];
            
            // 2) Convert base64 to Buffer.
            const buffer = Buffer.from(base64Data, 'base64');

            const formData = new FormData();
            formData.append('chat_id', chatId);
            formData.append('caption', message);
            formData.append('parse_mode', 'HTML');
            
            // 3) Wrap buffer as Blob for multipart upload.
            const fileBlob = new Blob([buffer], { type: 'image/png' });
            formData.append('photo', fileBlob, 'payment.png');

            response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                method: 'POST',
                body: formData
            });
        } else {
            // Fallback: send plain text message.
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
            await sendOrderItemsPhotos(orderItems);
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
