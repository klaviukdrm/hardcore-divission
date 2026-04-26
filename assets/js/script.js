let cart = [];
    let currentGalleryImages = [];
    let currentImgIndex = 0;
    let galleryZoomed = false;
    let galleryDragActive = false;
    let galleryDragStartX = 0;
    let galleryDragStartY = 0;
    let galleryPanX = 0;
    let galleryPanY = 0;
    let galleryPanStartX = 0;
    let galleryPanStartY = 0;
    let galleryMovedWhileDragging = false;
    let galleryZoomScale = 1;
    const galleryZoomMin = 1;
    const galleryZoomMax = 3;
    const galleryZoomStep = 0.2;
    let paymentScreenshot = null;
    let orderRegion = 'ua';
    let orderStep = 'payment';
    let deliveryData = null;
    let lastScrollTop = 0;
    const pulseCycleMs = 3000;
    const tshirt3xlSurchargeUah = 200;
    const liqpayPaymentsEnabled = true; // Switch to false to temporarily hide LiqPay/Google Pay/Apple Pay

    function isTshirtItem(name) {
        return /t-?shirt/i.test(String(name || ''));
    }

    function extractNumericPrice(priceText) {
        const normalized = String(priceText || '').replace(',', '.');
        const match = normalized.match(/[\d.]+/);
        return match ? Number(match[0]) : 0;
    }

    function refreshCatalogPricePreview() {
        const lang = localStorage.getItem('preferred_lang') || 'ua';
        const cards = document.querySelectorAll('.shop-grid .product-card');

        cards.forEach((card) => {
            const priceEl = card.querySelector('.price');
            const sizeSelect = card.querySelector('select');
            const buyBtn = card.querySelector('.buy-btn');
            if (!priceEl || !sizeSelect || !buyBtn) return;

            const baseUahLabel = priceEl.getAttribute('data-uah') || '';
            const baseUsdLabel = priceEl.getAttribute('data-usd') || '';
            const onclickText = buyBtn.getAttribute('onclick') || '';

            const isTshirt = isTshirtItem(onclickText);
            const is3xl = String(sizeSelect.value || '').toUpperCase() === '3XL';
            const surchargeUah = isTshirt && is3xl ? tshirt3xlSurchargeUah : 0;

            if (lang === 'ua') {
                const baseUah = extractNumericPrice(baseUahLabel);
                priceEl.innerText = `${baseUah + surchargeUah}₴`;
            } else {
                priceEl.innerText = baseUsdLabel;
            }
        });
    }

    function generatePublicOrderCode() {
        const digits = '0123456789';
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const chars = [];

        for (let i = 0; i < 3; i += 1) {
            chars.push(digits[Math.floor(Math.random() * digits.length)]);
        }
        for (let i = 0; i < 4; i += 1) {
            chars.push(letters[Math.floor(Math.random() * letters.length)]);
        }

        for (let i = chars.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [chars[i], chars[j]] = [chars[j], chars[i]];
        }

        return chars.join('');
    }

    function syncPulsePhase() {
        const offset = -(Date.now() % pulseCycleMs);
        document.documentElement.style.setProperty('--pulse-sync-delay', `${offset}ms`);
    }

    syncPulsePhase();

    window.onscroll = null;

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
    function getGalleryPoint(event) {
        if (event.touches && event.touches.length) {
            return { x: event.touches[0].clientX, y: event.touches[0].clientY };
        }
        if (event.changedTouches && event.changedTouches.length) {
            return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
        }
        return { x: event.clientX, y: event.clientY };
    }

    function updateGalleryNavVisibility() {
        const galleryEl = document.getElementById('gallery');
        if (!galleryEl) return;
        const showNav = currentGalleryImages.length > 1 && !galleryZoomed;
        galleryEl.querySelectorAll('.gallery-nav').forEach((btn) => {
            btn.style.display = showNav ? '' : 'none';
        });
    }

    function applyGalleryZoomState() {
        const galleryImgEl = document.getElementById('galleryImg');
        if (!galleryImgEl) return;

        if (!galleryZoomed) {
            galleryImgEl.classList.remove('gallery-img-focus', 'gallery-img-zoomed', 'gallery-img-dragging');
            galleryImgEl.style.transform = '';
            galleryImgEl.style.cursor = '';
            galleryPanX = 0;
            galleryPanY = 0;
            galleryDragActive = false;
            galleryZoomScale = galleryZoomMin;
            updateGalleryNavVisibility();
            return;
        }

        if (galleryZoomScale <= galleryZoomMin) {
            galleryPanX = 0;
            galleryPanY = 0;
            galleryDragActive = false;
        }

        const isRealZoom = galleryZoomScale > galleryZoomMin;
        galleryImgEl.classList.add('gallery-img-focus');
        galleryImgEl.classList.toggle('gallery-img-zoomed', isRealZoom);
        galleryImgEl.classList.toggle('gallery-img-dragging', galleryDragActive && isRealZoom);
        galleryImgEl.style.transform = isRealZoom
            ? `translate(${galleryPanX}px, ${galleryPanY}px) scale(${galleryZoomScale})`
            : '';
        if (isRealZoom) {
            galleryImgEl.style.cursor = galleryDragActive ? 'grabbing' : 'grab';
        } else {
            galleryImgEl.style.cursor = 'zoom-out';
        }
        updateGalleryNavVisibility();
    }

    function toggleGalleryZoom() {
        if (galleryMovedWhileDragging) {
            galleryMovedWhileDragging = false;
            return;
        }
        galleryZoomed = !galleryZoomed;
        galleryZoomScale = galleryZoomMin;
        galleryPanX = 0;
        galleryPanY = 0;
        galleryDragActive = false;
        applyGalleryZoomState();
    }

    function startGalleryDrag(event) {
        if (!galleryZoomed || galleryZoomScale <= galleryZoomMin) return;
        const point = getGalleryPoint(event);
        galleryDragActive = true;
        galleryPanStartX = galleryPanX;
        galleryPanStartY = galleryPanY;
        galleryDragStartX = point.x;
        galleryDragStartY = point.y;
        galleryMovedWhileDragging = false;
        applyGalleryZoomState();
        if (event.type === 'mousedown') {
            event.preventDefault();
        }
    }

    function onGalleryWheel(event) {
        if (!galleryZoomed) return;
        event.preventDefault();
        const delta = event.deltaY < 0 ? galleryZoomStep : -galleryZoomStep;
        galleryZoomScale = Math.min(galleryZoomMax, Math.max(galleryZoomMin, galleryZoomScale + delta));
        if (galleryZoomScale <= galleryZoomMin) {
            galleryPanX = 0;
            galleryPanY = 0;
            galleryDragActive = false;
        }
        applyGalleryZoomState();
    }

    function moveGalleryDrag(event) {
        if (!galleryZoomed || !galleryDragActive) return;
        const point = getGalleryPoint(event);
        const deltaX = point.x - galleryDragStartX;
        const deltaY = point.y - galleryDragStartY;
        if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
            galleryMovedWhileDragging = true;
        }
        galleryPanX = galleryPanStartX + deltaX;
        galleryPanY = galleryPanStartY + deltaY;
        const galleryImgEl = document.getElementById('galleryImg');
        if (galleryImgEl) {
            galleryImgEl.style.transform = `translate(${galleryPanX}px, ${galleryPanY}px) scale(${galleryZoomScale})`;
        }
        event.preventDefault();
    }

    function stopGalleryDrag() {
        if (!galleryDragActive) return;
        galleryDragActive = false;
        applyGalleryZoomState();
    }

    window.addEventListener('mousemove', moveGalleryDrag);
    window.addEventListener('mouseup', stopGalleryDrag);
    window.addEventListener('touchmove', moveGalleryDrag, { passive: false });
    window.addEventListener('touchend', stopGalleryDrag);
    window.addEventListener('touchcancel', stopGalleryDrag);

    function openGallery(images) {
        currentGalleryImages = Array.isArray(images) ? images : [];
        if (!currentGalleryImages.length) return;
        currentImgIndex = 0;
        galleryZoomed = false;
        galleryDragActive = false;
        galleryMovedWhileDragging = false;
        galleryPanX = 0;
        galleryPanY = 0;

        const galleryEl = document.getElementById('gallery');
        const galleryImgEl = document.getElementById('galleryImg');
        if (!galleryEl || !galleryImgEl) return;

        galleryImgEl.src = currentGalleryImages[0];
        galleryImgEl.onclick = toggleGalleryZoom;
        galleryImgEl.onmousedown = startGalleryDrag;
        galleryImgEl.ontouchstart = startGalleryDrag;
        galleryImgEl.onwheel = onGalleryWheel;
        galleryImgEl.ondragstart = () => false;

        updateGalleryNavVisibility();
        applyGalleryZoomState();
        galleryEl.style.display = 'flex';
    }
    function closeGallery() {
        const galleryEl = document.getElementById('gallery');
        if (galleryEl) galleryEl.style.display = 'none';
        galleryZoomed = false;
        galleryDragActive = false;
        galleryMovedWhileDragging = false;
        galleryZoomScale = galleryZoomMin;
        galleryPanX = 0;
        galleryPanY = 0;
        applyGalleryZoomState();
    }
    function changeImg(dir) {
        if (!currentGalleryImages.length || currentGalleryImages.length === 1 || galleryZoomed) return;
        currentImgIndex = (currentImgIndex + dir + currentGalleryImages.length) % currentGalleryImages.length;
        const galleryImgEl = document.getElementById('galleryImg');
        if (!galleryImgEl) return;
        galleryImgEl.src = currentGalleryImages[currentImgIndex];
        galleryPanX = 0;
        galleryPanY = 0;
        applyGalleryZoomState();
    }
    function toggleCart() {
        const modal = document.getElementById('cartModal');
        modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';
        renderCart();
    }
    function addToCart(name, uah, usd, sizeId) {
    const size = document.getElementById(sizeId).value;
    const lang = localStorage.getItem('preferred_lang') || 'ua';
    const sizeSurchargeUah = isTshirtItem(name) && size === '3XL' ? tshirt3xlSurchargeUah : 0;
    cart.push({name, uah: uah + sizeSurchargeUah, usd, size});
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

    function renderRegionSwitch(lang, mode = 'payment') {
        const isDelivery = mode === 'delivery';
        const uaLabel = isDelivery
            ? (lang === 'ua' ? 'УКРАЇНА' : 'UKRAINE')
            : (lang === 'ua' ? 'ОПЛАТА ПО РЕКВІЗИТАМ' : 'BANK DETAILS');

        if (!liqpayPaymentsEnabled && !isDelivery) {
            return `
                <div class="region-switch">
                    <button class="region-btn active">${uaLabel}</button>
                </div>
            `;
        }

        const worldLabel = isDelivery ? 'WORLDWIDE' : 'GOOGLE PAY / APPLE PAY';
        return `
            <div class="region-switch">
                <button class="region-btn ${orderRegion === 'ua' ? 'active' : ''}" onclick="setOrderRegion('ua')">${uaLabel}</button>
                <button class="region-btn ${orderRegion === 'world' ? 'active' : ''}" onclick="setOrderRegion('world')">${worldLabel}</button>
            </div>
        `;
    }

    function setOrderRegion(region) {
        orderRegion = (!liqpayPaymentsEnabled && orderStep === 'payment') ? 'ua' : region;
        if (orderStep === 'payment') {
            renderOrderPayment();
        } else if (orderStep === 'delivery') {
            renderDeliveryForm();
        }
    }

    function renderOrderPayment() {
        const lang = localStorage.getItem('preferred_lang') || 'ua';
        orderStep = 'payment';
        if (!liqpayPaymentsEnabled) {
            orderRegion = 'ua';
        }

        const total = cart.reduce((sum, i) => sum + (lang === 'ua' ? i.uah : i.usd), 0);
        const currency = lang === 'ua' ? '₴' : '$';

        const t = {
            title: lang === 'ua' ? 'ПОВНА ОПЛАТА' : 'FULL PAYMENT',
            sum: lang === 'ua' ? 'Сума до сплати' : 'Total Amount',
            screenshot: lang === 'ua' ? "ДОДАТИ СКРІНШОТ ОПЛАТИ (ОБОВ'ЯЗКОВО):" : "ADD PAYMENT SCREENSHOT (REQUIRED):",
            btn: lang === 'ua' ? 'Я ОПЛАТИВ' : 'I PAID',
            liqpayHint: lang === 'ua'
                ? 'Оплата карткою через LiqPay (Google Pay / Apple Pay).'
                : 'Card payment via LiqPay (Google Pay / Apple Pay).',
            liqpayBtn: lang === 'ua' ? 'ПЕРЕЙТИ ДО ОПЛАТИ' : 'GO TO PAYMENT',
            liqpayBtnLoading: lang === 'ua' ? 'ФОРМУЮ ПЛАТІЖ...' : 'PREPARING PAYMENT...'
        };

        const regionSwitch = renderRegionSwitch(lang, 'payment');

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
            paymentBlock = `
                <div style="background:#000; padding:15px; border:1px solid #222; font-size:0.9rem; color:#fff; line-height:1.6; text-align:left;">
                    <p style="margin:0 0 12px; color:#c9c9c9;">${t.liqpayHint}</p>
                    <button class="buy-btn" id="liqpayCheckoutBtn" style="margin:0 0 12px;" onclick="startLiqPayCheckout()">${t.liqpayBtn}</button>
                    <div style="margin-top:6px; padding-top:10px; border-top:1px dashed #444;">
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

            ${orderRegion === 'ua' ? `
                <div style="margin-top:15px;">
                     <label style="display:block; color:var(--blood); font-size:0.75rem; margin-bottom:5px; text-transform:uppercase; letter-spacing:1px;">${t.screenshot}</label>
                     <input type="file" id="orderScreenshot" accept="image/*" style="width:100%; font-size:0.8rem; color:#ccc;" onchange="handleFileSelect(event)">
                </div>
                <button class="buy-btn" id="payBtn" style="margin-top:20px; opacity: 0.5;" onclick="finalizeOrder()" disabled>${t.btn}</button>
            ` : ''}
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
    deliveryData = null;
    renderDeliveryForm();
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

    function renderDeliveryForm() {
        const lang = localStorage.getItem('preferred_lang') || 'ua';
        orderStep = 'delivery';

        const t = {
            title: lang === 'ua' ? 'ДОСТАВКА' : 'DELIVERY',
            fio: lang === 'ua' ? 'ПІБ' : 'Full Name',
            phone: lang === 'ua' ? 'Номер телефону' : 'Phone Number',
            np: lang === 'ua' ? 'Місто та № відділення НП' : 'City & Nova Poshta Dept',
            tg: lang === 'ua' ? "Ваш Telegram (необов'язково)" : "Your Telegram (optional)",
            btn: lang === 'ua' ? 'ДАЛІ ДО ОПЛАТИ' : 'NEXT: PAYMENT',
            worldInfo: lang === 'ua'
                ? 'Для замовлення в іншу країну зверніться в Telegram-бот для уточнення замовлення:'
                : 'For orders to another country, contact our Telegram bot to clarify order details:',
            worldBtn: lang === 'ua' ? 'НАПИСАТИ В TELEGRAM' : 'CONTACT IN TELEGRAM'
        };

        const regionSwitch = renderRegionSwitch(lang, 'delivery');

        const uaFields = `
            <input type="text" id="orderFIO" placeholder="${t.fio}">
            <input type="text" id="orderPhone" placeholder="${t.phone}">
            <input type="text" id="orderNP" placeholder="${t.np}">
            <input type="text" id="orderTG" placeholder="${t.tg}">
        `;

        const worldFields = `
            <p style="color:#c8c8c8; font-size:0.95rem; line-height:1.5; margin:10px 0 14px;">
                ${t.worldInfo}
                <b style="color:#fff;">@Hardcore_Division_bot</b>
            </p>
            <a
                class="buy-btn"
                href="https://t.me/Hardcore_Division_bot"
                target="_blank"
                rel="noopener noreferrer"
                style="display:inline-block; text-decoration:none; text-align:center;"
            >
                ${t.worldBtn}
            </a>
        `;

        document.getElementById('orderModalContent').innerHTML = `
            <div class="close-btn" onclick="closeOrderForm()">&#10005;</div>
            <h2 style="color: var(--blood); margin-bottom: 15px;">${t.title}</h2>
            ${regionSwitch}
            <div class="order-form">
                ${orderRegion === 'ua' ? uaFields : worldFields}
                ${orderRegion === 'ua' ? `<button class="buy-btn" id="confirmBtn" onclick="proceedToPayment()">${t.btn}</button>` : ''}
            </div>
        `;
        document.getElementById('orderModal').style.display = 'flex';
    }

    function proceedToPayment() {
        const lang = localStorage.getItem('preferred_lang') || 'ua';
        const msgErrUa = lang === 'ua' ? 'ПЕРЕВІРТЕ ДАНІ ТА НОМЕР!' : 'CHECK DATA & NUMBER!';

        const fio = document.getElementById('orderFIO').value;
        const phoneRaw = document.getElementById('orderPhone').value;
        const phone = phoneRaw.replace(/\D/g, '');
        const np = document.getElementById('orderNP').value;
        const tg = document.getElementById('orderTG').value;

        if (!fio || phone.length < 10 || !np) return showToast(msgErrUa);

        deliveryData = {
            region: orderRegion,
            data: { fio, phone, np, tg }
        };

        renderOrderPayment();
    }

    async function startLiqPayCheckout() {
        const lang = localStorage.getItem('preferred_lang') || 'ua';
        const btn = document.getElementById('liqpayCheckoutBtn');

        const msgNeedDelivery = lang === 'ua' ? 'СПОЧАТКУ ЗАПОВНІТЬ ДОСТАВКУ!' : 'FILL DELIVERY FIRST!';
        const msgPreparing = lang === 'ua' ? 'ФОРМУЮ ПЛАТІЖ...' : 'PREPARING PAYMENT...';
        const msgAction = lang === 'ua' ? 'ПЕРЕЙТИ ДО ОПЛАТИ' : 'GO TO PAYMENT';
        const msgFail = lang === 'ua' ? 'НЕ ВДАЛОСЯ ВІДКРИТИ LIQPAY' : 'FAILED TO OPEN LIQPAY';

        const hasDeliveryData = Boolean(
            deliveryData &&
            deliveryData.data &&
            String(deliveryData.data.fio || '').trim() &&
            String(deliveryData.data.phone || '').trim() &&
            String(deliveryData.data.np || '').trim()
        );

        if (!hasDeliveryData) {
            showToast(msgNeedDelivery);
            renderDeliveryForm();
            return;
        }

        const total = cart.reduce((sum, i) => sum + i.uah, 0);
        if (!Number.isFinite(total) || total <= 0) {
            return showToast(lang === 'ua' ? 'КОШИК ПОРОЖНІЙ!' : 'CART IS EMPTY!');
        }

        if (btn) {
            btn.disabled = true;
            btn.innerText = msgPreparing;
        }

        try {
            const shippingRaw = String(deliveryData?.data?.np || '').trim();
            const city = shippingRaw.split(',')[0].split('№')[0].trim() || '-';
            const items = buildOrderItemsPayload('ua');

            const response = await fetch('/api/payments/liqpay/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    amount: total,
                    currency: 'UAH',
                    description: `Hardcore Division order (${cart.length} items)`,
                    customer: {
                        fio: String(deliveryData?.data?.fio || '').trim(),
                        phone: String(deliveryData?.data?.phone || '').trim(),
                        city,
                        delivery: shippingRaw || '-'
                    },
                    items
                })
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload?.data || !payload?.signature || !payload?.checkout_url) {
                throw new Error(payload?.error || 'LiqPay create error');
            }

            const form = document.createElement('form');
            form.method = 'POST';
            form.action = payload.checkout_url;
            form.acceptCharset = 'utf-8';

            const dataInput = document.createElement('input');
            dataInput.type = 'hidden';
            dataInput.name = 'data';
            dataInput.value = payload.data;

            const signatureInput = document.createElement('input');
            signatureInput.type = 'hidden';
            signatureInput.name = 'signature';
            signatureInput.value = payload.signature;

            form.appendChild(dataInput);
            form.appendChild(signatureInput);
            document.body.appendChild(form);
            form.submit();
            form.remove();
        } catch (e) {
            showToast(msgFail);
            if (btn) {
                btn.disabled = false;
                btn.innerText = msgAction;
            }
        }
    }

    function closeOrderForm() { 
        document.getElementById('orderModal').style.display = 'none'; 
        paymentScreenshot = null; 
        orderRegion = 'ua';
        orderStep = 'payment';
        deliveryData = null;
    }

    function renderOrderSuccess() {
        const lang = localStorage.getItem('preferred_lang') || 'ua';
        orderStep = 'success';

        const t = {
            title: lang === 'ua' ? 'ЗАМОВЛЕННЯ УСПІШНЕ' : 'ORDER SUCCESS',
            text: lang === 'ua'
                ? 'Замовлення успішно оформлено. Очікуйте відправку протягом 3–5 робочих днів.'
                : 'Order successfully placed. Please expect shipping within 3–5 business days.',
            questions: lang === 'ua' ? 'З усіх питань:' : 'For any questions:',
            btn: lang === 'ua' ? 'ЗАКРИТИ' : 'CLOSE'
        };

        document.getElementById('orderModalContent').innerHTML = `
            <div class="close-btn" onclick="closeOrderForm()">&#10005;</div>
            <h2 style="color: var(--blood); margin-bottom: 15px;">${t.title}</h2>
            <div style="background:#000; padding:15px; border:1px solid #222; font-size:0.9rem; color:#ddd; line-height:1.6; text-align:left;">
                <p style="margin-bottom:10px;">${t.text}</p>
                <p>${t.questions} <a href="https://t.me/Hardcore_Division_bot" target="_blank" style="color: var(--blood); text-decoration: none;">@Hardcore_Division_bot</a></p>
            </div>
            <button class="buy-btn" style="margin-top:20px;" onclick="closeOrderForm()">${t.btn}</button>
        `;
        document.getElementById('orderModal').style.display = 'flex';
    }

    async function finalizeOrder() {
        const lang = localStorage.getItem('preferred_lang') || 'ua';
        const btn = document.getElementById('payBtn');

        const msgErrUa = lang === 'ua' ? 'ПЕРЕВІРТЕ ДАНІ ТА НОМЕР!' : 'CHECK DATA & NUMBER!';
        const msgNeedScreenshot = lang === 'ua' ? 'ДОДАЙ СКРІНШОТ!' : 'ADD SCREENSHOT!';
        const msgNeedDelivery = lang === 'ua' ? 'СПОЧАТКУ ЗАПОВНІТЬ ДОСТАВКУ!' : 'FILL DELIVERY FIRST!';
        const msgWait = lang === 'ua' ? 'ВІДПРАВКА...' : 'SENDING...';
        const msgSuccess = lang === 'ua' ? 'ЗАМОВЛЕННЯ ПРИЙНЯТО! 🩸' : 'ORDER RECEIVED! 🩸';
        const msgFail = lang === 'ua' ? 'ПОМИЛКА ВІДПРАВКИ!' : 'SENDING ERROR!';
        const payLabel = lang === 'ua' ? 'Я ОПЛАТИВ' : 'I PAID';
        const msgHistoryFail = lang === 'ua'
            ? 'Не вдалося зберегти замовлення в історії. Спробуйте ще раз.'
            : 'Failed to save order history. Please try again.';
        const msgTelegramWarn = lang === 'ua'
            ? 'Замовлення збережено в історії, але повідомлення оператору не надіслано.'
            : 'Order was saved to history, but operator notification failed.';

        if (orderRegion !== 'ua') {
            return showToast(lang === 'ua'
                ? 'Для цього методу використовуйте Google Pay / Apple Pay.'
                : 'Use Google Pay / Apple Pay for this method.');
        }

        if (!paymentScreenshot) return showToast(msgNeedScreenshot);
        if (!deliveryData || deliveryData.region !== orderRegion) {
            showToast(msgNeedDelivery);
            renderDeliveryForm();
            return;
        }

        btn.innerText = msgWait;
        btn.disabled = true;

        const currency = lang === 'ua' ? '₴' : '$';
        let total = cart.reduce((sum, i) => sum + (lang === 'ua' ? i.uah : i.usd), 0);
        let itemsInfo = cart.map((item, idx) => `${idx + 1}. ${item.name} (${item.size}) — ${lang === 'ua' ? item.uah : item.usd}${currency}`).join('\n');
        let messageText = '';
        const publicOrderCode = generatePublicOrderCode();

        if (orderRegion === 'ua') {
            const fio = deliveryData.data.fio;
            const phone = deliveryData.data.phone;
            const np = deliveryData.data.np;
            const tg = deliveryData.data.tg;

            if (!fio || !phone || phone.length < 10 || !np) {
                btn.innerText = payLabel;
                btn.disabled = false;
                return showToast(msgErrUa);
            }

            let tgText = tg ? `\n✈️ <b>TG:</b> ${tg}` : "";
            messageText = `<b>💀 НОВЕ ЗАМОВЛЕННЯ 💀</b>\n\n🆔 <b>Номер:</b> ${publicOrderCode}\n👤 <b>ПІБ:</b> ${fio}\n📞 <b>Тел:</b> ${phone}${tgText}\n📦 <b>НП:</b> ${np}\n\n${itemsInfo}\n💳 <b>Оплата:</b> Оплата по реквізитам\n📌 <b>Статус:</b> created\n<b>💰 СУМА: ${total}${currency}</b>`;
        }

        try {
            await saveOrderForAccountHistory(lang, total);
        } catch (orderError) {
            showToast(msgHistoryFail);
            btn.innerText = payLabel;
            btn.disabled = false;
            return;
        }

        let telegramSent = false;
        try {
            const response = await fetch('/api/send', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    message: messageText,
                    image: paymentScreenshot
                })
            });
            telegramSent = response.ok;
        } catch (e) {
            telegramSent = false;
        }

        try {
            showToast(msgSuccess);
            if (!telegramSent) {
                showToast(msgTelegramWarn);
            }
            cart = [];
            document.getElementById('cart-count').innerText = 0;
            paymentScreenshot = null;
            deliveryData = null;
            orderRegion = 'ua';
            renderOrderSuccess();
        } catch (e) {
            showToast(msgFail);
            btn.innerText = payLabel;
            btn.disabled = false;
        }
    }

    function buildOrderItemsPayload(lang) {
        const grouped = new Map();

        cart.forEach((item) => {
            const unitPrice = lang === 'ua' ? item.uah : item.usd;
            const key = `${item.name}::${item.size}::${unitPrice}`;
            const existing = grouped.get(key);

            if (existing) {
                existing.quantity += 1;
                return;
            }

            grouped.set(key, {
                title: item.name,
                size: item.size,
                price: unitPrice,
                quantity: 1,
                product_id: null
            });
        });

        return Array.from(grouped.values());
    }

    async function saveOrderForAccountHistory(lang, totalPrice) {
        const payload = {
            total_price: totalPrice,
            items: buildOrderItemsPayload(lang)
        };

        const response = await fetch('/api/orders/create', {
            method: 'POST',
            credentials: 'include',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        if (response.status === 401) {
            return false;
        }

        if (!response.ok) {
            throw new Error('Failed to save order in account history');
        }

        return true;
    }

    function openPrivacy() {
    const modal = document.getElementById('privacyModal');
    if (modal) modal.style.display = 'flex';
}

function closePrivacy() {
    const modal = document.getElementById('privacyModal');
    if (modal) modal.style.display = 'none';
}

function openPolicy(type) {
    const modal = document.getElementById('policyModal');
    const titleEl = document.getElementById('policyModalTitle');
    const bodyEl = document.getElementById('policyModalBody');
    if (!modal || !titleEl || !bodyEl) return;

    const lang = localStorage.getItem('preferred_lang') || 'ua';
    const content = {
        ua: {
            delivery: {
                title: 'Доставка і оплата',
                paragraphs: [
                    '• Відправка замовлень: 3-5 робочих днів після підтвердження.',
                    '• Оплата: повна передплата.',
                    '• Доставка виконується по Україні та за кордон через доступні логістичні служби.'
                ]
            },
            agreement: {
                title: 'Угода користувача',
                paragraphs: [
                    '• Оформлюючи замовлення, ви підтверджуєте коректність введених даних.',
                    '• Покупець погоджується з умовами оплати, доставки та повернення.',
                    '• Магазин має право уточнювати деталі замовлення перед відправкою.'
                ]
            },
            returns: {
                title: 'Умови повернення',
                paragraphs: [
                    '• Повернення можливе тільки у разі помилки з боку магазину (не той товар, виробничий дефект або неправильна комплектація).',
                    '• Якщо не підійшов розмір або товар просто не сподобався, повернення не здійснюється.',
                    '• Для розвʼязання спірних ситуацій звертайтесь в підтримку магазину.'
                ]
            }
        },
        eng: {
            delivery: {
                title: 'Delivery & Payment',
                paragraphs: [
                    '• Shipping time: 3-5 business days after order confirmation.',
                    '• Payment method: full prepayment.',
                    '• Delivery is available in Ukraine and worldwide via available logistics services.'
                ]
            },
            agreement: {
                title: 'User Agreement',
                paragraphs: [
                    '• By placing an order, you confirm that the entered data is correct.',
                    '• The customer agrees to payment, delivery, and return terms.',
                    '• The store may clarify order details before shipment.'
                ]
            },
            returns: {
                title: 'Return Policy',
                paragraphs: [
                    '• Returns are possible only if the store made a mistake (wrong item, production defect, or incorrect order composition).',
                    '• If the size does not fit or you simply changed your mind, returns are not available.',
                    '• Contact support for dispute resolution.'
                ]
            }
        }
    };

    const langPack = content[lang] || content.ua;
    const policy = langPack[type] || langPack.delivery;

    titleEl.textContent = policy.title;
    bodyEl.innerHTML = policy.paragraphs.map((p) => `<p>${p}</p>`).join('');
    modal.style.display = 'flex';
}

function closePolicy() {
    const modal = document.getElementById('policyModal');
    if (modal) modal.style.display = 'none';
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
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
}

function updatePrices(lang) {
  document.querySelectorAll('.price').forEach(el => {
    el.innerText = lang === 'ua' ? el.getAttribute('data-uah') : el.getAttribute('data-usd');
  });
  refreshCatalogPricePreview();
}

// Запускаем проверку языка сразу при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('preferred_lang') || 'ua';
    setLang(savedLang);
});

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.querySelector('.shop-grid');
    if (!grid) return;

    grid.addEventListener('change', (event) => {
        if (event.target && event.target.tagName === 'SELECT') {
            refreshCatalogPricePreview();
        }
    });

    refreshCatalogPricePreview();
});

function updateContact() {
    const lang = localStorage.getItem('preferred_lang') || 'ua';

    const link = document.getElementById("contact-link");
    const title = document.getElementById("contact-title");
    if (!link || !title) return;

    const t = {
        title: lang === 'ua' ? "Контакт оператора (Telegram)" : "Operator Contact (Telegram)",
        tg: "@Hardcore_Division_bot"
    };

    title.textContent = t.title;
    const handleEl = link.querySelector('.operator-handle');

    if (handleEl) {
        handleEl.textContent = t.tg;
    } else {
        link.textContent = t.tg;
    }

    link.href = "https://t.me/Hardcore_Division_bot";
    link.target = "_blank";
}

async function syncAccountButtonState() {
    const accountButtons = document.querySelectorAll('.account-icon-btn[data-account-link="true"]');
    if (!accountButtons.length) return;

    let isUserAuthenticated = false;
    try {
        const response = await fetch('/api/auth/me', {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store'
        });

        if (response.ok) {
            const payload = await response.json();
            isUserAuthenticated = Boolean(payload && payload.authenticated && payload.role === 'user');
        }
    } catch (e) {
        isUserAuthenticated = false;
    }

    accountButtons.forEach((button) => {
        button.classList.toggle('account-btn-auth', isUserAuthenticated);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    updateContact();
    syncAccountButtonState();
});

window.addEventListener('pageshow', () => {
    syncAccountButtonState();
});
