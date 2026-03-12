let cart = [];
    let currentGalleryImages = [];
    let currentImgIndex = 0;
    let paymentScreenshot = null;
    let orderRegion = 'ua';
    let orderStep = 'payment';
    let lastScrollTop = 0;

    window.onscroll = function() {
        let header = document.getElementById("mainHeader");
        if (window.scrollY > 100) {
            header.classList.add("header-hidden");
        } else {
            header.classList.remove("header-hidden");
        }
    };

    function showToast(text) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerText = text;
        container.appendChild(toast);
        setTimeout(() => { toast.remove(); }, 3000);
    }

    function copyVal(val) {
        const lang = localStorage.getItem('preferred_lang') || 'ua';
        const msgOk = lang === 'ua' ? 'СКОПІЙОВАНО! 💀' : 'COPIED! 💀';
        const msgFail = lang === 'ua' ? 'НЕ ВДАЛОСЯ СКОПІЮВАТИ' : 'COPY FAILED';

        function fallbackCopy() {
            const textarea = document.createElement('textarea');
            textarea.value = val;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.top = '-1000px';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                const ok = document.execCommand('copy');
                showToast(ok ? msgOk : msgFail);
            } catch (e) {
                showToast(msgFail);
            }
            document.body.removeChild(textarea);
        }

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(val).then(() => showToast(msgOk)).catch(fallbackCopy);
        } else {
            fallbackCopy();
        }
    }

    function toggleSizePanel() {
        const panel = document.getElementById('sizePanel');
        const isActive = panel.classList.toggle('active');
        panel.setAttribute('aria-hidden', String(!isActive));
    }
    function setSizeType(type) {
    const img = document.getElementById('mainSizeImg');
    const btnT = document.getElementById('size-btn-t');
    const btnH = document.getElementById('size-btn-h');

    if (type === 'tshirt') {
        img.src = 'images/Screenshot_198.png';
        btnT.style.background = 'var(--blood)'; btnT.style.color = 'white';
        btnH.style.background = '#222'; btnH.style.color = '#888';
    } else {
        img.src = 'images/Screenshot_197.png';
        btnH.style.background = 'var(--blood)'; btnH.style.color = 'white';
        btnT.style.background = '#222'; btnT.style.color = '#888';
    }
}
    function openGallery(images) {
        currentGalleryImages = images;
        currentImgIndex = 0;
        document.getElementById('galleryImg').src = currentGalleryImages[0];
        document.getElementById('gallery').style.display = 'flex';
    }
    function closeGallery() { document.getElementById('gallery').style.display = 'none'; }
    function changeImg(dir) {
        currentImgIndex = (currentImgIndex + dir + currentGalleryImages.length) % currentGalleryImages.length;
        document.getElementById('galleryImg').src = currentGalleryImages[currentImgIndex];
    }
    function toggleCart() {
        const modal = document.getElementById('cartModal');
        modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';
        renderCart();
    }
    function addToCart(name, uah, usd, sizeId) {
    const size = document.getElementById(sizeId).value;
    const lang = localStorage.getItem('preferred_lang') || 'ua';
    cart.push({name, uah, usd, size});
    document.getElementById('cart-count').innerText = cart.length;
    
    const msg = lang === 'ua' ? 'ДОДАНО В КОШИК 💀' : 'ADDED TO CART 💀';
    showToast(msg);
}
    function removeFromCart(index) {
        cart.splice(index, 1);
        document.getElementById('cart-count').innerText = cart.length;
        renderCart();
    }
    function renderCart() {
    const list = document.getElementById('cartItemsList');
    const lang = localStorage.getItem('preferred_lang') || 'ua';
    const totalText = lang === 'ua' ? 'Всього' : 'Total';
    const currency = lang === 'ua' ? '₴' : '$';
    let total = 0;
    
    list.innerHTML = cart.map((item, idx) => {
        const itemPrice = lang === 'ua' ? item.uah : item.usd;
        total += itemPrice;
        return `<div class="cart-item"><span>${item.name} (${item.size}) — ${itemPrice}${currency}</span><span class="remove-item" onclick="removeFromCart(${idx})">&#10005;</span></div>`;
    }).join('');

    document.getElementById('cartTotal').innerText = `${totalText}: ${total}${currency}`;
}

    // Новая функция для toggle FAQ
    function toggleFAQ() {
        const faqSection = document.getElementById('faqSection');
        faqSection.classList.toggle('faq-open');
    }

    function renderRegionSwitch(lang) {
        const uaLabel = lang === 'ua' ? 'УКРАЇНА' : 'UKRAINE';
        const worldLabel = 'WORLDWIDE';
        return `
            <div class="region-switch">
                <button class="region-btn ${orderRegion === 'ua' ? 'active' : ''}" onclick="setOrderRegion('ua')">${uaLabel}</button>
                <button class="region-btn ${orderRegion === 'world' ? 'active' : ''}" onclick="setOrderRegion('world')">${worldLabel}</button>
            </div>
        `;
    }

    function setOrderRegion(region) {
        orderRegion = region;
        if (orderStep === 'payment') {
            renderOrderPayment();
        } else if (orderStep === 'delivery') {
            renderDeliveryForm();
        }
    }

    function renderOrderPayment() {
        const lang = localStorage.getItem('preferred_lang') || 'ua';
        orderStep = 'payment';

        const total = cart.reduce((sum, i) => sum + (lang === 'ua' ? i.uah : i.usd), 0);
        const currency = lang === 'ua' ? '₴' : '$';

        const t = {
            title: lang === 'ua' ? 'ПОВНА ОПЛАТА' : 'FULL PAYMENT',
            sum: lang === 'ua' ? 'Сума до сплати' : 'Total Amount',
            screenshot: lang === 'ua' ? "ДОДАТИ СКРІНШОТ ОПЛАТИ (ОБОВ'ЯЗКОВО):" : "ADD PAYMENT SCREENSHOT (REQUIRED):",
            btn: lang === 'ua' ? 'Я ОПЛАТИВ' : 'I PAID'
        };

        const regionSwitch = renderRegionSwitch(lang);

        let paymentBlock = '';
        if (orderRegion === 'ua') {
            const ibanText = lang === 'ua' ? '🪙 ФОП РАХУНОК (IBAN):' : '🪙 FOP ACCOUNT (IBAN):';
            const paypalText = lang === 'ua' ? '💸 PayPal:' : '💸 PayPal:';
            const cardText = lang === 'ua' ? '💳 КАРТА ФОП РАХУНКУ:' : '💳 FOP CARD ACCOUNT:';
            const edrpouText = lang === 'ua' ? '🔢 ЄДРПОУ:' : '🔢 EDRPOU:';
            const fopText = lang === 'ua' ? '👤 <b>ФОП:</b> Тарасов Олег Михайлович' : '👤 <b>FOP:</b> Tarasov Oleg Mykhailovych';

            paymentBlock = `
                <div style="background:#000; padding:15px; border:1px solid #222; font-size:0.85rem; color:#fff; line-height:1.6; text-align:left;">
                    <div style="margin-bottom:10px;">
                        <span style="color:#888;">${ibanText}</span><br>
                        <div class="copy-line"><b>UA783220010000026002320017237</b> <button class="mini-copy-btn" onclick="copyVal('UA783220010000026002320017237')">Copy</button></div>
                    </div>

                    <div style="margin-bottom:10px;">
                        <span style="color:#888;">${paypalText}</span><br>
                        <div class="copy-line"><b>dreamprint777@ukr.net</b> <button class="mini-copy-btn" onclick="copyVal('dreamprint777@ukr.net')">Copy</button></div>
                    </div>

                    <div style="margin-bottom:10px;">
                        <span style="color:#888;">${cardText}</span><br>
                        <div class="copy-line"><b>4035200041301190</b> <button class="mini-copy-btn" onclick="copyVal('4035200041301190')">Copy</button></div>
                    </div>

                    <div style="margin-bottom:10px;">
                        <span style="color:#888;">${edrpouText}</span><br>
                        <div class="copy-line"><b>3215715672</b> <button class="mini-copy-btn" onclick="copyVal('3215715672')">Copy</button></div>
                    </div>

                    <div style="border-top:1px solid #222; padding-top:10px; margin-top:10px;">
                        ${fopText}
                    </div>

                    <div style="margin-top:15px; padding-top:10px; border-top:1px dashed #444;">
                        💰 ${t.sum}: <span style="color:var(--blood); font-weight:bold; font-size:1.1rem;">${total}${currency}</span>
                    </div>
                </div>
            `;
        } else {
            const cardLabel = lang === 'ua' ? 'Номер картки:' : 'Card number:';
            const receiverLabel = lang === 'ua' ? 'Отримувач:' : 'Receiver:';
            const paypalLabel = lang === 'ua' ? '💸 PayPal:' : '💸 PayPal:';
            const ibanLabel = lang === 'ua' ? 'IBAN:' : 'IBAN:';
            const bicLabel = lang === 'ua' ? 'BIC код:' : 'BIC code:';

            paymentBlock = `
                <div style="background:#000; padding:15px; border:1px solid #222; font-size:0.85rem; color:#fff; line-height:1.6; text-align:left;">
                    <div style="margin-bottom:10px;">
                        <span style="color:#888;">${cardLabel}</span><br>
                        <div class="copy-line"><b>4441114495032458</b> <button class="mini-copy-btn" onclick="copyVal('4441114495032458')">Copy</button></div>
                    </div>

                    <div style="margin-bottom:10px;">
                        <span style="color:#888;">${receiverLabel}</span><br>
                        <div class="copy-line"><b>Tarasov Oleh</b> <button class="mini-copy-btn" onclick="copyVal('Tarasov Oleh')">Copy</button></div>
                    </div>

                    <div style="margin-bottom:10px;">
                        <span style="color:#888;">${paypalLabel}</span><br>
                        <div class="copy-line"><b>dreamprint777@ukr.net</b> <button class="mini-copy-btn" onclick="copyVal('dreamprint777@ukr.net')">Copy</button></div>
                    </div>

                    <div style="margin-bottom:10px;">
                        <span style="color:#888;">${ibanLabel}</span><br>
                        <div class="copy-line"><b>GB38CLJU00997181380493</b> <button class="mini-copy-btn" onclick="copyVal('GB38CLJU00997181380493')">Copy</button></div>
                    </div>

                    <div style="margin-bottom:10px;">
                        <span style="color:#888;">${bicLabel}</span><br>
                        <div class="copy-line"><b>CLJUGB21</b> <button class="mini-copy-btn" onclick="copyVal('CLJUGB21')">Copy</button></div>
                    </div>

                    <div style="margin-top:15px; padding-top:10px; border-top:1px dashed #444;">
                        💰 ${t.sum}: <span style="color:var(--blood); font-weight:bold; font-size:1.1rem;">${total}${currency}</span>
                    </div>
                </div>
            `;
        }

        document.getElementById('orderModalContent').innerHTML = `
            <div class="close-btn" onclick="closeOrderForm()">&#10005;</div>
            <h2 style="color: var(--blood); margin-bottom: 15px;">${t.title}</h2>
            ${regionSwitch}
            ${paymentBlock}

            <div style="margin-top:15px;">
                 <label style="display:block; color:var(--blood); font-size:0.75rem; margin-bottom:5px; text-transform:uppercase; letter-spacing:1px;">${t.screenshot}</label>
                 <input type="file" id="orderScreenshot" accept="image/*" style="width:100%; font-size:0.8rem; color:#ccc;" onchange="handleFileSelect(event)">
            </div>
            
            <button class="buy-btn" id="payBtn" style="margin-top:20px; opacity: 0.5;" onclick="showDeliveryInputs()" disabled>${t.btn}</button>
        `;
        document.getElementById('orderModal').style.display = 'flex';

        const payBtn = document.getElementById('payBtn');
        if (paymentScreenshot && payBtn) {
            payBtn.disabled = false;
            payBtn.style.opacity = '1';
            payBtn.style.background = 'var(--blood)';
        }
    }

    function openOrderForm() {
    const lang = localStorage.getItem('preferred_lang') || 'ua';
    if (cart.length === 0) return showToast(lang === 'ua' ? 'КОШИК ПОРОЖНІЙ!' : 'CART IS EMPTY!');
    document.getElementById('cartModal').style.display = 'none';
    orderRegion = 'ua';
    renderOrderPayment();
}

    function compressImageDataUrl(dataUrl, maxSize, quality) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const maxDim = Math.max(img.width, img.height);
                const scale = maxDim > maxSize ? (maxSize / maxDim) : 1;
                const targetW = Math.round(img.width * scale);
                const targetH = Math.round(img.height * scale);

                const canvas = document.createElement('canvas');
                canvas.width = targetW;
                canvas.height = targetH;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, targetW, targetH);

                try {
                    const compressed = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressed);
                } catch (e) {
                    resolve(dataUrl);
                }
            };
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
        });
    }

    function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => { 
            const original = e.target.result;
            paymentScreenshot = await compressImageDataUrl(original, 1280, 0.75);
            // Включаем кнопку и возвращаем ей яркость
            const payBtn = document.getElementById('payBtn');
            if(payBtn) {
                payBtn.disabled = false;
                payBtn.style.opacity = '1';
                payBtn.style.background = 'var(--blood)';
            }
        };
        reader.readAsDataURL(file);
    }
}

    function showDeliveryInputs() {
        const lang = localStorage.getItem('preferred_lang') || 'ua';
        const t = { err: lang === 'ua' ? 'ДОДАЙ СКРІНШОТ!' : 'ADD SCREENSHOT!' };
        if(!paymentScreenshot) return showToast(t.err);
        renderDeliveryForm();
    }

    function renderDeliveryForm() {
        const lang = localStorage.getItem('preferred_lang') || 'ua';
        orderStep = 'delivery';

        const t = {
            title: lang === 'ua' ? 'ДОСТАВКА' : 'DELIVERY',
            fio: lang === 'ua' ? 'ПІБ' : 'Full Name',
            phone: lang === 'ua' ? 'Номер телефону' : 'Phone Number',
            np: lang === 'ua' ? 'Місто та № відділення НП' : 'City & Nova Poshta Dept',
            tg: lang === 'ua' ? "Ваш Telegram (необов'язково)" : "Your Telegram (optional)",
            btn: lang === 'ua' ? 'ПІДТВЕРДИТИ' : 'CONFIRM',

            country: lang === 'ua' ? 'Країна' : 'Country',
            state: lang === 'ua' ? 'Штат/регіон' : 'State/Region',
            postal: lang === 'ua' ? 'Поштовий індекс' : 'Postal Code',
            city: lang === 'ua' ? 'Населений пункт' : 'City',
            phoneLocal: lang === 'ua' ? 'Мобільний номер місцевого оператора' : 'Local mobile number',
            nameLatin: lang === 'ua' ? 'ПІБ латиницею' : 'Full name (Latin)',
            email: lang === 'ua' ? 'Email' : 'Email',
            postOffice: lang === 'ua' ? 'Адреса і номер відділення пошти' : 'Post office address and number',
            residence: lang === 'ua' ? 'Адреса фактичного проживання' : 'Residential address'
        };

        const regionSwitch = renderRegionSwitch(lang);

        const uaFields = `
            <input type="text" id="orderFIO" placeholder="${t.fio}">
            <input type="text" id="orderPhone" placeholder="${t.phone}">
            <input type="text" id="orderNP" placeholder="${t.np}">
            <input type="text" id="orderTG" placeholder="${t.tg}">
        `;

        const worldFields = `
            <input type="text" id="orderCountry" placeholder="${t.country}">
            <input type="text" id="orderState" placeholder="${t.state}">
            <input type="text" id="orderPostal" placeholder="${t.postal}">
            <input type="text" id="orderCity" placeholder="${t.city}">
            <input type="text" id="orderPhoneLocal" placeholder="${t.phoneLocal}">
            <input type="text" id="orderNameLatin" placeholder="${t.nameLatin}">
            <input type="email" id="orderEmail" placeholder="${t.email}">
            <textarea id="orderPostOffice" placeholder="${t.postOffice}"></textarea>
            <textarea id="orderResidence" placeholder="${t.residence}"></textarea>
        `;

        document.getElementById('orderModalContent').innerHTML = `
            <div class="close-btn" onclick="closeOrderForm()">&#10005;</div>
            <h2 style="color: var(--blood); margin-bottom: 15px;">${t.title}</h2>
            ${regionSwitch}
            <div class="order-form">
                ${orderRegion === 'ua' ? uaFields : worldFields}
                <button class="buy-btn" id="confirmBtn" onclick="finalizeOrder()">${t.btn}</button>
            </div>
        `;
    }

    function closeOrderForm() { 
        document.getElementById('orderModal').style.display = 'none'; 
        paymentScreenshot = null; 
        orderRegion = 'ua';
        orderStep = 'payment';
    }

    async function finalizeOrder() {
        const lang = localStorage.getItem('preferred_lang') || 'ua';
        const btn = document.getElementById('confirmBtn');

        const msgErrUa = lang === 'ua' ? 'ПЕРЕВІРТЕ ДАНІ ТА НОМЕР!' : 'CHECK DATA & NUMBER!';
        const msgErrWorld = lang === 'ua' ? 'ЗАПОВНІТЬ УСІ ПОЛЯ (EMAIL)!' : 'FILL ALL FIELDS (EMAIL)!';
        const msgWait = lang === 'ua' ? 'ВІДПРАВКА...' : 'SENDING...';
        const msgSuccess = lang === 'ua' ? 'ЗАМОВЛЕННЯ ПРИЙНЯТО! 🩸' : 'ORDER RECEIVED! 🩸';
        const msgFail = lang === 'ua' ? 'ПОМИЛКА ВІДПРАВКИ!' : 'SENDING ERROR!';

        btn.innerText = msgWait;
        btn.disabled = true;

        const currency = lang === 'ua' ? '₴' : '$';
        let total = cart.reduce((sum, i) => sum + (lang === 'ua' ? i.uah : i.usd), 0);
        let itemsInfo = cart.map((item, idx) => `${idx + 1}. ${item.name} (${item.size}) — ${lang === 'ua' ? item.uah : item.usd}${currency}`).join('\n');
        let messageText = '';

        if (orderRegion === 'ua') {
            const fio = document.getElementById('orderFIO').value;
            const phoneRaw = document.getElementById('orderPhone').value;
            const phone = phoneRaw.replace(/\D/g, '');
            const np = document.getElementById('orderNP').value;
            const tg = document.getElementById('orderTG').value;

            if (!fio || phone.length < 10 || !np) {
                btn.innerText = lang === 'ua' ? 'ПІДТВЕРДИТИ' : 'CONFIRM';
                btn.disabled = false;
                return showToast(msgErrUa);
            }

            let tgText = tg ? `\n✈️ <b>TG:</b> ${tg}` : "";
            messageText = `<b>💀 НОВЕ ЗАМОВЛЕННЯ 💀</b>\n\n👤 <b>ПІБ:</b> ${fio}\n📞 <b>Тел:</b> ${phone}${tgText}\n📦 <b>НП:</b> ${np}\n\n${itemsInfo}\n<b>💰 СУМА: ${total}${currency}</b>`;
        } else {
            const country = document.getElementById('orderCountry').value.trim();
            const state = document.getElementById('orderState').value.trim();
            const postal = document.getElementById('orderPostal').value.trim();
            const city = document.getElementById('orderCity').value.trim();
            const phoneLocalRaw = document.getElementById('orderPhoneLocal').value.trim();
            const phoneLocalDigits = phoneLocalRaw.replace(/\D/g, '');
            const nameLatin = document.getElementById('orderNameLatin').value.trim();
            const email = document.getElementById('orderEmail').value.trim();
            const postOffice = document.getElementById('orderPostOffice').value.trim();
            const residence = document.getElementById('orderResidence').value.trim();

            const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

            if (!country || !state || !postal || !city || !phoneLocalRaw || phoneLocalDigits.length < 6 || !nameLatin || !email || !emailOk || !postOffice || !residence) {
                btn.innerText = lang === 'ua' ? 'ПІДТВЕРДИТИ' : 'CONFIRM';
                btn.disabled = false;
                return showToast(msgErrWorld);
            }

            const labels = {
                order: lang === 'ua' ? 'НОВЕ ЗАМОВЛЕННЯ' : 'NEW ORDER',
                delivery: lang === 'ua' ? 'ДОСТАВКА' : 'DELIVERY',
                region: lang === 'ua' ? 'МІЖНАРОДНА' : 'WORLDWIDE',
                nameLatin: lang === 'ua' ? 'ПІБ (латиницею)' : 'Full name (Latin)',
                phone: lang === 'ua' ? 'Мобільний номер' : 'Mobile number',
                email: lang === 'ua' ? 'Email' : 'Email',
                country: lang === 'ua' ? 'Країна' : 'Country',
                state: lang === 'ua' ? 'Штат/регіон' : 'State/Region',
                postal: lang === 'ua' ? 'Поштовий індекс' : 'Postal Code',
                city: lang === 'ua' ? 'Населений пункт' : 'City',
                postOffice: lang === 'ua' ? 'Адреса та № відділення пошти' : 'Post office address and number',
                residence: lang === 'ua' ? 'Адреса фактичного проживання' : 'Residential address',
                sum: lang === 'ua' ? 'СУМА' : 'TOTAL'
            };

            messageText = `<b>💀 ${labels.order} 💀</b>\n\n🌍 <b>${labels.delivery}:</b> ${labels.region}\n👤 <b>${labels.nameLatin}:</b> ${nameLatin}\n📞 <b>${labels.phone}:</b> ${phoneLocalRaw}\n📧 <b>${labels.email}:</b> ${email}\n🏷️ <b>${labels.country}:</b> ${country}\n🏷️ <b>${labels.state}:</b> ${state}\n🏷️ <b>${labels.postal}:</b> ${postal}\n🏷️ <b>${labels.city}:</b> ${city}\n📮 <b>${labels.postOffice}:</b> ${postOffice}\n🏠 <b>${labels.residence}:</b> ${residence}\n\n${itemsInfo}\n<b>💰 ${labels.sum}: ${total}${currency}</b>`;
        }

        try {
            const response = await fetch('/api/send', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    message: messageText,
                    image: paymentScreenshot
                })
            });
            if (response.ok) {
                showToast(msgSuccess);
                cart = [];
                document.getElementById('cart-count').innerText = 0;
                closeOrderForm();
            } else {
                throw new Error();
            }
        } catch (e) {
            showToast(msgFail);
            btn.innerText = lang === 'ua' ? 'ПІДТВЕРДИТИ' : 'CONFIRM';
            btn.disabled = false;
        }
    }

    function openPrivacy() {
    document.getElementById('privacyModal').style.display = 'flex';
}

function closePrivacy() {
    document.getElementById('privacyModal').style.display = 'none';
}

function filterProducts(category) {
    const cards = document.querySelectorAll('.product-card');
    const buttons = document.querySelectorAll('.filter-btn');

    // 1. Керування підсвічуванням кнопок
    buttons.forEach(btn => {
        // Отримуємо текст кнопки та категорію з onclick для точності
        const btnOnClick = btn.getAttribute('onclick');
        
        if (btnOnClick.includes(`'${category}'`)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // 2. Фільтрація карток з анімацією
    cards.forEach(card => {
        const cardCategory = card.getAttribute('data-category');
        
        if (category === 'all' || cardCategory === category) {
            // Показуємо: спочатку display, потім прибираємо клас hidden для анімації
            card.style.display = 'flex';
            setTimeout(() => {
                card.classList.remove('hidden');
            }, 10);
        } else {
            // Ховаємо: спочатку додаємо hidden (opacity 0), потім прибираємо display
            card.classList.add('hidden');
            setTimeout(() => {
                if (card.classList.contains('hidden')) {
                    card.style.display = 'none';
                }
            }, 400); // Час збігається з CSS transition
        }
    });
}

// Функция переключения языка
function setLang(lang) {
    localStorage.setItem('preferred_lang', lang);
    document.body.classList.toggle('lang-ua', lang === 'ua');
    document.body.classList.toggle('lang-eng', lang === 'eng');
    
    document.querySelectorAll('[data-ua]').forEach(el => {
        const translation = el.getAttribute('data-' + lang);
        if (translation) {
            el.innerText = translation;
        }
    });

    // Цей рядок змусить кошик перемалюватися з новою мовою "Total/Всього"
    renderCart();

    const uaBtn = document.getElementById('lang-ua');
    const engBtn = document.getElementById('lang-eng');
    if (uaBtn && engBtn) {
        uaBtn.classList.toggle('active', lang === 'ua');
        engBtn.classList.toggle('active', lang === 'eng');
    }

    updatePrices(lang);
    updateContact();
}

function updatePrices(lang) {
  document.querySelectorAll('.price').forEach(el => {
    el.innerText = lang === 'ua' ? el.getAttribute('data-uah') : el.getAttribute('data-usd');
  });
}

// Запускаем проверку языка сразу при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('preferred_lang') || 'ua';
    setLang(savedLang);
});

function updateContact() {
    const lang = localStorage.getItem('preferred_lang') || 'ua';

    const link = document.getElementById("contact-link");
    const title = document.getElementById("contact-title");

    const t = {
        title: lang === 'ua' ? "Контакт оператора (Telegram)" : "Operator Contact (Telegram)",
        tg: "@Hardcore_Division_bot"
    };

    title.textContent = t.title;
    link.textContent = t.tg;
    link.href = "https://t.me/Hardcore_Division_bot";
    link.target = "_blank";
}

document.addEventListener('DOMContentLoaded', () => {
    updateContact();
});
