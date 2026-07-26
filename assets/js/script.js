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
    let deliveryRegion = 'ua';
    let paymentRegion = 'ua';
    let orderStep = 'payment';
    let deliveryData = null;
    let lastScrollTop = 0;
    const pulseCycleMs = 3000;
    const tshirt3xlSurchargeUah = 200;
    const monoPaymentsEnabled = true; // Temporary kill-switch for the mono checkout block
    const cartStorageKey = 'hd_cart_v1';
    const orderDraftStorageKey = 'hd_order_draft_v1';
    let activeCatalogCategory = 'all';
    let catalogSearchQuery = '';

    function normalizeCartItem(item) {
        if (!item || typeof item !== 'object') return null;
        const name = String(item.name || '').trim();
        const size = String(item.size || '').trim();
        const uah = Number(item.uah);
        const usd = Number(item.usd);
        if (!name || !size || !Number.isFinite(uah) || !Number.isFinite(usd)) return null;
        const image = String(item.image || '').trim();
        const productSlug = String(item.productSlug || '').trim();
        const color = String(item.color || '').trim();
        return { name, uah, usd, size, image, productSlug, color };
    }

    function loadCartFromStorage() {
        try {
            const raw = localStorage.getItem(cartStorageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return;
            cart = parsed.map(normalizeCartItem).filter(Boolean);
            syncCartPricesFromCatalog();
        } catch (e) {
            cart = [];
        }
    }

    function readOrderDraft() {
        try {
            const raw = localStorage.getItem(orderDraftStorageKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;

            const region = String(parsed.region || 'ua').trim() === 'world' ? 'world' : 'ua';
            const step = String(parsed.step || 'delivery').trim() === 'payment' ? 'payment' : 'delivery';
            const delivery = parsed.delivery && typeof parsed.delivery === 'object' ? parsed.delivery : {};

            return {
                region,
                step,
                delivery: {
                    fio: String(delivery.fio || '').trim(),
                    phone: String(delivery.phone || '').trim(),
                    uaFio: String(delivery.uaFio || (String(parsed.region || 'ua').trim() === 'ua' ? delivery.fio || '' : '')).trim(),
                    uaPhone: String(delivery.uaPhone || (String(parsed.region || 'ua').trim() === 'ua' ? delivery.phone || '' : '')).trim(),
                    worldFio: String(delivery.worldFio || (String(parsed.region || 'ua').trim() === 'world' ? delivery.fio || '' : '')).trim(),
                    worldPhone: String(delivery.worldPhone || (String(parsed.region || 'ua').trim() === 'world' ? delivery.phone || '' : '')).trim(),
                    np: String(delivery.np || '').trim(),
                    tg: String(delivery.tg || '').trim().slice(0, 100),
                    worldTg: String(delivery.worldTg || '').trim().slice(0, 100),
                    country: String(delivery.country || '').trim(),
                    regionName: String(delivery.regionName || '').trim(),
                    city: String(delivery.city || '').trim(),
                    address: String(delivery.address || '').trim(),
                    postalCode: String(delivery.postalCode || '').trim(),
                    email: String(delivery.email || '').trim(),
                    postOfficeAddress: String(delivery.postOfficeAddress || '').trim(),
                    residenceAddress: String(delivery.residenceAddress || '').trim()
                }
            };
        } catch (e) {
            return null;
        }
    }

    function writeOrderDraft(draft) {
        try {
            localStorage.setItem(orderDraftStorageKey, JSON.stringify(draft));
        } catch (e) {
            // Ignore storage errors.
        }
    }

    function clearOrderDraft() {
        try {
            localStorage.removeItem(orderDraftStorageKey);
        } catch (e) {
            // Ignore storage errors.
        }
    }

    function clearPaymentScreenshot() {
        paymentScreenshot = null;
        const screenshotInput = document.getElementById('orderScreenshot');
        if (screenshotInput) {
            screenshotInput.value = '';
        }
    }

    function getCheckoutFormValues() {
        const uaFioInput = document.getElementById('orderFIO');
        const uaPhoneInput = document.getElementById('orderPhone');
        const worldFioInput = document.getElementById('orderWorldName');
        const worldPhoneInput = document.getElementById('orderWorldPhone');
        const npInput = document.getElementById('orderNP');
        const tgInput = document.getElementById('orderTG');
        const worldTgInput = document.getElementById('orderWorldTelegram');
        const countryInput = document.getElementById('orderWorldCountry');
        const regionInput = document.getElementById('orderWorldRegion');
        const cityInput = document.getElementById('orderWorldCity');
        const postalInput = document.getElementById('orderWorldPostal');
        const emailInput = document.getElementById('orderWorldEmail');
        const postOfficeInput = document.getElementById('orderWorldPostOffice');
        const residenceInput = document.getElementById('orderWorldResidence');

        return {
            uaFio: String(uaFioInput?.value || '').trim(),
            uaPhone: String(uaPhoneInput?.value || '').trim(),
            worldFio: String(worldFioInput?.value || '').trim(),
            worldPhone: String(worldPhoneInput?.value || '').trim(),
            np: String(npInput?.value || '').trim(),
            tg: String(tgInput?.value || '').trim().slice(0, 100),
            worldTg: String(worldTgInput?.value || '').trim().slice(0, 100),
            country: String(countryInput?.value || '').trim(),
            regionName: String(regionInput?.value || '').trim(),
            city: String(cityInput?.value || '').trim(),
            address: '',
            postalCode: String(postalInput?.value || '').trim(),
            email: String(emailInput?.value || '').trim(),
            postOfficeAddress: String(postOfficeInput?.value || '').trim(),
            residenceAddress: String(residenceInput?.value || '').trim()
        };
    }

    function persistOrderDraft(step = 'delivery') {
        const formValues = getCheckoutFormValues();
        const delivery = deliveryData?.data || {};
        const storedDraft = readOrderDraft();
        const storedDelivery = storedDraft?.delivery || {};
        const hasUaInputs = Boolean(
            document.getElementById('orderFIO') ||
            document.getElementById('orderPhone') ||
            document.getElementById('orderNP') ||
            document.getElementById('orderTG')
        );
        const hasWorldInputs = Boolean(
            document.getElementById('orderWorldCountry') ||
            document.getElementById('orderWorldRegion') ||
            document.getElementById('orderWorldPostal') ||
            document.getElementById('orderWorldCity') ||
            document.getElementById('orderWorldPhone') ||
            document.getElementById('orderWorldName') ||
            document.getElementById('orderWorldEmail') ||
            document.getElementById('orderWorldPostOffice') ||
            document.getElementById('orderWorldResidence')
        );

        let mergedDelivery;
        if (hasUaInputs) {
            mergedDelivery = {
                fio: '',
                phone: '',
                uaFio: formValues.uaFio,
                uaPhone: formValues.uaPhone,
                worldFio: String(storedDelivery.worldFio || (deliveryRegion === 'world' ? delivery.fio || '' : '')).trim(),
                worldPhone: String(storedDelivery.worldPhone || (deliveryRegion === 'world' ? delivery.phone || '' : '')).trim(),
                np: formValues.np,
                tg: formValues.tg,
                worldTg: String(storedDelivery.worldTg || '').trim().slice(0, 100),
                country: '',
                regionName: '',
                city: '',
                address: '',
                postalCode: '',
                email: '',
                postOfficeAddress: '',
                residenceAddress: ''
            };
        } else if (hasWorldInputs) {
            mergedDelivery = {
                fio: '',
                phone: '',
                uaFio: String(storedDelivery.uaFio || (deliveryRegion === 'ua' ? delivery.fio || '' : '')).trim(),
                uaPhone: String(storedDelivery.uaPhone || (deliveryRegion === 'ua' ? delivery.phone || '' : '')).trim(),
                worldFio: formValues.worldFio,
                worldPhone: formValues.worldPhone,
                np: '',
                tg: String(storedDelivery.tg || '').trim().slice(0, 100),
                worldTg: formValues.worldTg,
                country: formValues.country,
                regionName: formValues.regionName,
                city: formValues.city,
                address: '',
                postalCode: formValues.postalCode,
                email: formValues.email,
                postOfficeAddress: formValues.postOfficeAddress,
                residenceAddress: formValues.residenceAddress
            };
        } else {
            mergedDelivery = {
                fio: '',
                phone: '',
                uaFio: String(storedDelivery.uaFio || (deliveryRegion === 'ua' ? delivery.fio || '' : '')).trim(),
                uaPhone: String(storedDelivery.uaPhone || (deliveryRegion === 'ua' ? delivery.phone || '' : '')).trim(),
                worldFio: String(storedDelivery.worldFio || (deliveryRegion === 'world' ? delivery.fio || '' : '')).trim(),
                worldPhone: String(storedDelivery.worldPhone || (deliveryRegion === 'world' ? delivery.phone || '' : '')).trim(),
                np: String(delivery.np || '').trim(),
                tg: String(delivery.tg || '').trim().slice(0, 100),
                worldTg: String(delivery.worldTg || '').trim().slice(0, 100),
                country: String(delivery.country || '').trim(),
                regionName: String(delivery.regionName || '').trim(),
                city: String(delivery.city || '').trim(),
                address: String(delivery.address || '').trim(),
                postalCode: String(delivery.postalCode || '').trim(),
                email: String(delivery.email || '').trim(),
                postOfficeAddress: String(delivery.postOfficeAddress || '').trim(),
                residenceAddress: String(delivery.residenceAddress || '').trim()
            };
        }

        const hasContent = Boolean(
            mergedDelivery.fio ||
            mergedDelivery.phone ||
            mergedDelivery.uaFio ||
            mergedDelivery.uaPhone ||
            mergedDelivery.worldFio ||
            mergedDelivery.worldPhone ||
            mergedDelivery.np ||
            mergedDelivery.tg ||
            mergedDelivery.worldTg ||
            mergedDelivery.country ||
            mergedDelivery.regionName ||
            mergedDelivery.city ||
            mergedDelivery.address ||
            mergedDelivery.postalCode ||
            mergedDelivery.email ||
            mergedDelivery.postOfficeAddress ||
            mergedDelivery.residenceAddress ||
            deliveryData
        );
        if (!hasContent) {
            clearOrderDraft();
            return;
        }

        writeOrderDraft({
            region: deliveryRegion === 'world' ? 'world' : 'ua',
            step: step === 'payment' ? 'payment' : 'delivery',
            delivery: mergedDelivery
        });
    }

    function restoreOrderDraft() {
        const draft = readOrderDraft();
        if (!draft) return null;

        deliveryRegion = draft.region;
        paymentRegion = draft.step === 'payment' ? draft.region : 'ua';
        orderStep = draft.step;
        const branchDelivery = draft.region === 'world'
            ? {
                fio: String(draft.delivery.worldFio || '').trim(),
                phone: String(draft.delivery.worldPhone || '').trim(),
                tg: String(draft.delivery.worldTg || '').trim().slice(0, 100),
                country: String(draft.delivery.country || '').trim(),
                regionName: String(draft.delivery.regionName || '').trim(),
                city: String(draft.delivery.city || '').trim(),
                address: String(draft.delivery.address || draft.delivery.residenceAddress || '').trim(),
                postalCode: String(draft.delivery.postalCode || '').trim(),
                email: String(draft.delivery.email || '').trim(),
                postOfficeAddress: String(draft.delivery.postOfficeAddress || '').trim(),
                residenceAddress: String(draft.delivery.residenceAddress || '').trim()
            }
            : {
                fio: String(draft.delivery.uaFio || '').trim(),
                phone: String(draft.delivery.uaPhone || '').trim(),
                np: String(draft.delivery.np || '').trim(),
                tg: String(draft.delivery.tg || '').trim().slice(0, 100)
            };
        deliveryData = Object.values(branchDelivery).some(Boolean)
            ? { region: draft.region, data: branchDelivery }
            : null;

        return draft;
    }

    function getCatalogProducts() {
        return Array.isArray(window.PRODUCTS_DATA) ? window.PRODUCTS_DATA : [];
    }

    function findCatalogProductForCartItem(item) {
        const products = getCatalogProducts();
        if (!products.length || !item) return null;

        const normalize = (value) => String(value || '').trim().toLowerCase();
        const itemSlug = normalize(item.productSlug);
        const itemName = normalize(item.name);

        return products.find((product) => {
            if (!product) return false;

            const productSlug = normalize(product.slug);
            const productCartName = normalize(product.cartName || product.title);
            const productTitle = normalize(product.title);

            return Boolean(
                (itemSlug && itemSlug === productSlug) ||
                (itemName && (itemName === productCartName || itemName === productTitle))
            );
        }) || null;
    }

    function syncCartPricesFromCatalog() {
        if (!Array.isArray(cart) || !cart.length) return;

        cart = cart.map((item) => {
            const product = findCatalogProductForCartItem(item);
            if (!product) return item;

            const size = String(item.size || '').trim().toUpperCase();
            const sizeSurchargeUah = size === '3XL' ? tshirt3xlSurchargeUah : 0;

            return {
                ...item,
                uah: (Number(product.priceUah) || 0) + sizeSurchargeUah,
                usd: Number(product.priceUsd) || 0
            };
        });

        saveCartToStorage();
    }

    function saveCartToStorage() {
        try {
            localStorage.setItem(cartStorageKey, JSON.stringify(cart));
        } catch (e) {
            // Ignore storage errors (private mode/quota).
        }
    }

    function updateCartCount() {
        const cartCountEl = document.getElementById('cart-count');
        if (!cartCountEl) return;
        cartCountEl.innerText = String(cart.length);
    }

    loadCartFromStorage();

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

            const is3xl = String(sizeSelect.value || '').toUpperCase() === '3XL';
            const surchargeUah = is3xl ? tshirt3xlSurchargeUah : 0;

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

    function clearMonoReturnFlag() {
        try {
            const url = new URL(window.location.href);
            url.searchParams.delete('mono_payment');
            url.searchParams.delete('mono_reference');
            window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
        } catch (e) {
            // Ignore URL cleanup failures.
        }
    }

    function handleMonoReturnFromUrl() {
        try {
            const url = new URL(window.location.href);
            if (url.searchParams.get('mono_payment') !== 'success') return false;

            cart = [];
            saveCartToStorage();
            updateCartCount();
            clearPaymentScreenshot();
            deliveryData = null;
            deliveryRegion = 'ua';
            paymentRegion = 'ua';
            clearOrderDraft();
            renderOrderSuccess('mono');
            clearMonoReturnFlag();
            return true;
        } catch (e) {
            return false;
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
    const btnS = document.getElementById('size-btn-s');
    const btnH = document.getElementById('size-btn-h');
    const buttons = [btnT, btnS, btnH].filter(Boolean);

    buttons.forEach((btn) => {
        btn.style.background = '#222';
        btn.style.color = '#888';
        btn.style.border = '1px solid #333';
    });

    if (type === 'tshirt') {
        img.src = 'images/Screenshot_198.png';
        if (btnT) {
            btnT.style.background = '#39ff14';
            btnT.style.color = '#ff1493';
            btnT.style.border = 'none';
        }
    } else if (type === 'sweatshirt') {
        img.src = 'images/ChatGPT Image.png';
        if (btnS) {
            btnS.style.background = '#39ff14';
            btnS.style.color = '#ff1493';
            btnS.style.border = 'none';
        }
    } else {
        img.src = 'images/Screenshot_197.png';
        if (btnH) {
            btnH.style.background = '#39ff14';
            btnH.style.color = '#ff1493';
            btnH.style.border = 'none';
        }
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

    function openGallery(images, startIndex = 0) {
        currentGalleryImages = Array.isArray(images) ? images : [];
        if (!currentGalleryImages.length) return;
        currentImgIndex = Number.isInteger(startIndex) && startIndex >= 0 ? startIndex : 0;
        if (currentImgIndex >= currentGalleryImages.length) {
            currentImgIndex = 0;
        }
        galleryZoomed = false;
        galleryDragActive = false;
        galleryMovedWhileDragging = false;
        galleryPanX = 0;
        galleryPanY = 0;

        const galleryEl = document.getElementById('gallery');
        const galleryImgEl = document.getElementById('galleryImg');
        if (!galleryEl || !galleryImgEl) return;

        galleryImgEl.src = currentGalleryImages[currentImgIndex] || currentGalleryImages[0];
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
    function initGalleryBackdropClose() {
        const galleryEl = document.getElementById('gallery');
        if (!galleryEl) return;

        galleryEl.addEventListener('click', (event) => {
            if (event.target === galleryEl) {
                closeGallery();
            }
        });
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
    function addToCart(name, uah, usd, sizeId, meta) {
    const size = document.getElementById(sizeId).value;
    const lang = localStorage.getItem('preferred_lang') || 'ua';
    const sizeSurchargeUah = size === '3XL' ? tshirt3xlSurchargeUah : 0;
    const options = meta && typeof meta === 'object' ? meta : {};
    cart.push({
        name,
        uah: uah + sizeSurchargeUah,
        usd,
        size,
        image: String(options.image || '').trim(),
        productSlug: String(options.productSlug || '').trim(),
        color: String(options.color || '').trim()
    });
    saveCartToStorage();
    updateCartCount();
    
    const msg = lang === 'ua' ? 'ДОДАНО В КОШИК 💀' : 'ADDED TO CART 💀';
    showToast(msg);
}
    function removeFromCart(index) {
        cart.splice(index, 1);
        saveCartToStorage();
        updateCartCount();
        renderCart();
    }
    function renderCart() {
    syncCartPricesFromCatalog();
    updateCartCount();
    const list = document.getElementById('cartItemsList');
    const totalEl = document.getElementById('cartTotal');
    const suggestionEl = document.getElementById('cartSuggestion');
    if (!list || !totalEl) return;
    const lang = localStorage.getItem('preferred_lang') || 'ua';
    const totalText = lang === 'ua' ? 'Всього' : 'Total';
    const currency = lang === 'ua' ? '₴' : '€';
    let total = 0;
    
    list.innerHTML = cart.map((item, idx) => {
        const itemPrice = lang === 'ua' ? item.uah : item.usd;
        total += itemPrice;
        return `<div class="cart-item"><span>${item.name} (${item.size}) — ${itemPrice}${currency}</span><span class="remove-item" onclick="removeFromCart(${idx})">&#10005;</span></div>`;
    }).join('');

    totalEl.innerText = `${totalText}: ${total}${currency}`;

    if (!suggestionEl) return;
    const products = Array.isArray(window.PRODUCTS_DATA) ? window.PRODUCTS_DATA : [];
    const preorderProduct = products.find((p) => Boolean(p && p.isPreorder));
    if (!preorderProduct) {
        suggestionEl.innerHTML = '';
        return;
    }
    const normalize = (value) => String(value || '').trim().toLowerCase();
    const preorderNameNorm = normalize(preorderProduct.cartName || preorderProduct.title);
    const alreadyInCart = cart.some((item) => {
        const itemNorm = normalize(item && item.name);
        return itemNorm === preorderNameNorm || itemNorm === normalize(preorderProduct.title);
    });
    if (alreadyInCart) {
        suggestionEl.innerHTML = '';
        return;
    }

    const recommendationTitle = lang === 'ua' ? 'Рекомендуємо додати' : 'Recommended to add';
    const addBtnLabel = lang === 'ua' ? 'Додати' : 'Add';
    const preorderPrice = lang === 'ua'
        ? `${preorderProduct.priceUah}₴`
        : `${preorderProduct.priceUsd}€`;
    const preorderImage = preorderProduct.image || (Array.isArray(preorderProduct.gallery) ? preorderProduct.gallery[0] : '');
    const preorderLink = `/pages/product.html?product=${encodeURIComponent(String(preorderProduct.slug || ''))}`;

    suggestionEl.innerHTML = `
        <div class="cart-suggestion">
            <p class="cart-suggestion-label">${recommendationTitle}</p>
            <div class="cart-suggestion-card">
                <a class="cart-suggestion-link" href="${preorderLink}">
                    <img class="cart-suggestion-thumb" src="${preorderImage}" alt="${preorderProduct.title}">
                    <div>
                        <p class="cart-suggestion-title">${preorderProduct.title}</p>
                        <p class="cart-suggestion-price">${preorderPrice}</p>
                    </div>
                </a>
                <button class="buy-btn cart-suggestion-add-btn" onclick="addPreorderToCart('${String(preorderProduct.slug || '')}')">${addBtnLabel}</button>
            </div>
        </div>
    `;
}

    function addPreorderToCart(slug) {
    const products = Array.isArray(window.PRODUCTS_DATA) ? window.PRODUCTS_DATA : [];
    const product = products.find((p) => String(p && p.slug ? p.slug : '') === String(slug || ''));
    if (!product) return;

    const normalize = (value) => String(value || '').trim().toLowerCase();
    const productName = String(product.cartName || product.title || '').trim();
    const alreadyInCart = cart.some((item) => normalize(item && item.name) === normalize(productName));
    if (alreadyInCart) {
        renderCart();
        return;
    }

    const sizeSelect = product.sizeId ? document.getElementById(product.sizeId) : null;
    const size = sizeSelect ? String(sizeSelect.value || '').trim() : 'ONE SIZE';
    cart.push({
        name: productName,
        uah: Number(product.priceUah) || 0,
        usd: Number(product.priceUsd) || 0,
        size: size || 'ONE SIZE'
    });
    saveCartToStorage();
    updateCartCount();
    renderCart();

    const lang = localStorage.getItem('preferred_lang') || 'ua';
    const msg = lang === 'ua' ? 'ДОДАНО В КОШИК 💀' : 'ADDED TO CART 💀';
    showToast(msg);
}

    // Новая функция для toggle FAQ
    function toggleFAQ() {
        const faqSection = document.getElementById('faqSection');
        faqSection.classList.toggle('faq-open');
    }

    function renderRegionSwitch(lang, mode = 'payment') {
        const isDelivery = mode === 'delivery';
        const activeRegion = isDelivery ? deliveryRegion : paymentRegion;
        const uaLabel = isDelivery
            ? (lang === 'ua' ? 'УКРАЇНА' : 'UKRAINE')
            : (lang === 'ua' ? 'ОПЛАТА ПО РЕКВІЗИТАМ' : 'BANK DETAILS');

        if (!monoPaymentsEnabled && !isDelivery && deliveryData?.region !== 'world') {
            return `
                <div class="region-switch">
                    <button class="region-btn active">${uaLabel}</button>
                </div>
            `;
        }

        const worldLabel = isDelivery ? 'WORLDWIDE' : (lang === 'ua' ? 'ШВИДКА ОПЛАТА' : 'QUICK PAYMENT');
        return `
            <div class="region-switch">
                <button class="region-btn ${activeRegion === 'ua' ? 'active' : ''}" onclick="setOrderRegion('ua', '${mode}')">${uaLabel}</button>
                <button class="region-btn ${activeRegion === 'world' ? 'active' : ''}" onclick="setOrderRegion('world', '${mode}')">${worldLabel}</button>
            </div>
        `;
    }

    function setOrderRegion(region, mode = orderStep) {
        if (mode === 'payment') {
            if (paymentRegion !== region) {
                clearPaymentScreenshot();
            }
            paymentRegion = monoPaymentsEnabled ? region : 'ua';
            renderOrderPayment();
        } else if (mode === 'delivery') {
            deliveryRegion = region;
            renderDeliveryForm();
        }
    }

    function renderOrderPayment() {
        const lang = localStorage.getItem('preferred_lang') || 'ua';
        const isWorldOrder = deliveryData?.region === 'world';
        const isWorldPayment = isWorldOrder && paymentRegion === 'world';
        orderStep = 'payment';
        if (!monoPaymentsEnabled && !isWorldOrder) {
            paymentRegion = 'ua';
        }

        const itemTotal = cart.reduce((sum, i) => sum + (isWorldOrder ? i.usd : (lang === 'ua' ? i.uah : i.usd)), 0);
        const normalizedWorldCountry = String(deliveryData?.data?.country || '').trim().toLowerCase();
        const specialWorldCountries = new Set(['slovakia', 'slovak republic', 'словаччина', 'germany', 'німеччина', 'poland', 'польща']);
        const shippingBase = specialWorldCountries.has(normalizedWorldCountry) ? 20 : 25;
        const shippingStep = Math.max(0, Math.ceil(cart.length / 3) - 1) * 5;
        const shippingTotal = isWorldPayment ? shippingBase + shippingStep : 0;
        const total = isWorldPayment ? itemTotal + shippingTotal : itemTotal;
        const currency = isWorldOrder ? '€' : (lang === 'ua' ? '₴' : '€');

        const t = {
            title: lang === 'ua' ? 'ПОВНА ОПЛАТА' : 'FULL PAYMENT',
            sum: lang === 'ua' ? 'Сума до сплати' : 'Total Amount',
            screenshot: lang === 'ua' ? "ДОДАТИ СКРІНШОТ ОПЛАТИ (ОБОВ'ЯЗКОВО):" : "ADD PAYMENT SCREENSHOT (REQUIRED):",
            btn: lang === 'ua' ? 'Я ОПЛАТИВ' : 'I PAID',
            monoHint: lang === 'ua'
                ? 'Оплата карткою через mono (Google Pay / Apple Pay).'
                : 'Card payment via mono (Google Pay / Apple Pay).',
            monoBtn: lang === 'ua' ? 'ШВИДКА ОПЛАТА' : 'QUICK PAYMENT',
            monoBtnLoading: lang === 'ua' ? 'ФОРМУЮ MONO ПЛАТІЖ...' : 'PREPARING MONO CHECKOUT...'
        };

        if (isWorldPayment) {
            t.title = 'WORLDWIDE PAYMENT';
            t.screenshot = lang === 'ua' ? 'ДОДАТИ СКРІНШОТ ОПЛАТИ:' : 'ADD PAYMENT SCREENSHOT:';
            t.btn = lang === 'ua' ? 'Я ОПЛАТИВ' : 'I PAID';
            t.worldReference = 'PAYMENT REFERENCE';
            t.goodsPrice = lang === 'ua' ? 'Ціна за товар' : 'Product Price';
            t.shippingPrice = lang === 'ua' ? 'Ціна за доставку' : 'Shipping Price';
        }

        const regionSwitch = isWorldOrder ? '' : renderRegionSwitch(lang, 'payment');

        let paymentBlock = '';
        if (paymentRegion === 'ua') {
            const ibanText = lang === 'ua' ? '🪙 ФОП РАХУНОК (IBAN):' : '🪙 FOP ACCOUNT (IBAN):';
            const paypalText = lang === 'ua' ? '💸 PayPal:' : '💸 PayPal:';
            const edrpouText = lang === 'ua' ? '🔢 ЄДРПОУ:' : '🔢 EDRPOU:';
            const fopText = lang === 'ua' ? '👤 <b>ФОП:</b> Максимова Анна Олегівна' : '👤 <b>FOP:</b> Maksimova Anna Olegivna';

            paymentBlock = `
                <div style="background:#000; padding:15px; border:1px solid #222; font-size:0.85rem; color:#fff; line-height:1.6; text-align:left;">
                    <div style="margin-bottom:10px;">
                        <span style="color:#888;">${ibanText}</span><br>
                        <div class="copy-line"><b>UA623220010000026000380041193</b> <button class="mini-copy-btn" onclick="copyVal('UA623220010000026000380041193')">Copy</button></div>
                    </div>

                    <div style="margin-bottom:10px;">
                        <span style="color:#888;">${paypalText}</span><br>
                        <div class="copy-line"><b>trbskn91@gmail.com (Serhii Danko)</b> <button class="mini-copy-btn" onclick="copyVal('trbskn91@gmail.com')">Copy</button></div>
                    </div>

                    <div style="margin-bottom:10px;">
                        <span style="color:#888;">${edrpouText}</span><br>
                        <div class="copy-line"><b>3952509287</b> <button class="mini-copy-btn" onclick="copyVal('3952509287')">Copy</button></div>
                    </div>

                    <div style="border-top:1px solid #222; padding-top:10px; margin-top:10px;">
                        ${fopText}
                        <div style="margin-top:8px; color:#cfcfcf;">
                            У описі платежу вкажіть: сплата за товар.
                        </div>
                    </div>

                    <div style="margin-top:15px; padding-top:10px; border-top:1px dashed #444;">
                        💰 ${t.sum}: <span style="color:var(--blood); font-weight:bold; font-size:1.1rem;">${total}${currency}</span>
                    </div>
                </div>
            `;
        } else {
            if (isWorldPayment) {
                const worldName = String(deliveryData?.data?.fio || '').trim() || 'WORLDWIDE CLIENT';
                const worldCountry = String(deliveryData?.data?.country || '').trim() || 'COUNTRY';
                const worldReference = `${worldName} / ${worldCountry}`;

                paymentBlock = `
                    <div style="background:#000; padding:15px; border:1px solid #222; font-size:0.9rem; color:#fff; line-height:1.6; text-align:left;">
                        <div style="margin-bottom:10px;">
                            <span style="color:#888;">🏦 IBAN:</span><br>
                            <div class="copy-line"><b>GB91CLJU00997192141301</b> <button class="mini-copy-btn" onclick="copyVal('GB91CLJU00997192141301')">Copy</button></div>
                        </div>
                        <div style="margin-bottom:10px;">
                            <span style="color:#888;">🔐 BIC code:</span><br>
                            <div class="copy-line"><b>CLJUGB21</b> <button class="mini-copy-btn" onclick="copyVal('CLJUGB21')">Copy</button></div>
                        </div>
                        <div style="margin-bottom:10px;">
                            <span style="color:#888;">👤 Receiver:</span><br>
                            <div class="copy-line"><b>MAKSYMOVA ANNA</b> <button class="mini-copy-btn" onclick="copyVal('MAKSYMOVA ANNA')">Copy</button></div>
                        </div>
                        <div style="margin-bottom:10px;">
                            <span style="color:#888;">💸 PayPal:</span><br>
                            <div class="copy-line"><b>trbskn91@gmail.com (Serhii Danko)</b> <button class="mini-copy-btn" onclick="copyVal('trbskn91@gmail.com (Serhii Danko)')">Copy</button></div>
                        </div>
                        <div style="margin-bottom:8px;">
                            🛒 ${t.goodsPrice}: <span style="color:#fff; font-weight:bold;">${itemTotal}${currency}</span>
                        </div>
                        <div style="margin-bottom:8px;">
                            🚚 ${t.shippingPrice}: <span style="color:#fff; font-weight:bold;">${shippingTotal}${currency}</span>
                        </div>
                        <div style="margin-top:6px; padding-top:10px; border-top:1px dashed #444;">
                            💰 ${t.sum}: <span style="color:var(--blood); font-weight:bold; font-size:1.1rem;">${total}${currency}</span>
                        </div>
                        <p style="margin:8px 0 0; color:#9a9a9a; font-size:0.78rem; line-height:1.4;">
                            ${lang === 'ua'
                                ? 'Якщо хочете уточнити або не згодні з вартістю доставки, напишіть у підтримку.'
                                : 'If you want to clarify the shipping cost or disagree with it, contact support.'}
                        </p>
                    </div>
                `;
            } else {
            paymentBlock = `
                <div style="background:#000; padding:15px; border:1px solid #222; font-size:0.9rem; color:#fff; line-height:1.6; text-align:left;">
                    <p style="margin:0 0 12px; color:#c9c9c9;">${t.monoHint}</p>
                    <button class="buy-btn" id="monoCheckoutBtn" style="margin:0 0 12px;" onclick="startMonoCheckout()">${t.monoBtn}</button>
                    <div style="margin-top:6px; padding-top:10px; border-top:1px dashed #444;">
                        💰 ${t.sum}: <span style="color:var(--blood); font-weight:bold; font-size:1.1rem;">${total}${currency}</span>
                    </div>
                </div>
            `;
            }
        }

        document.getElementById('orderModalContent').innerHTML = `
            <div class="close-btn" onclick="closeOrderForm()">&#10005;</div>
            <h2 style="color: var(--blood); margin-bottom: 15px;">${t.title}</h2>
            ${regionSwitch}
            ${paymentBlock}

            ${(paymentRegion === 'ua' || isWorldPayment) ? `
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
            payBtn.style.background = '#39ff14';
        }
    }

    function openOrderForm() {
        const lang = localStorage.getItem('preferred_lang') || 'ua';
        if (cart.length === 0) return showToast(lang === 'ua' ? 'КОШИК ПОРОЖНІЙ!' : 'CART IS EMPTY!');
        clearPaymentScreenshot();
        document.getElementById('cartModal').style.display = 'none';

        const draft = restoreOrderDraft();
        if (draft && draft.step === 'payment') {
            renderOrderPayment();
            return;
        }

        if (draft && draft.region === 'world') {
            renderDeliveryForm();
            return;
        }

        deliveryRegion = 'ua';
        paymentRegion = 'ua';
        deliveryData = draft && draft.delivery && (draft.delivery.uaFio || draft.delivery.uaPhone || draft.delivery.np || draft.delivery.tg)
            ? {
                region: 'ua',
                data: {
                    fio: String(draft.delivery.uaFio || '').trim(),
                    phone: String(draft.delivery.uaPhone || '').trim(),
                    np: String(draft.delivery.np || '').trim(),
                    tg: String(draft.delivery.tg || '').trim().slice(0, 100)
                }
            }
            : null;
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
                if (!ctx) return resolve(dataUrl);

                try {
                    // JPEG does not support transparency; fill background to avoid black frames.
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, targetW, targetH);
                    ctx.drawImage(img, 0, 0, targetW, targetH);

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
            phone: '+38 (0__) ___-__-__',
            np: lang === 'ua' ? 'Місто та № відділення НП' : 'City & Nova Poshta Dept',
            tg: lang === 'ua' ? "Ваш Telegram / коментар (необов'язково)" : "Your Telegram / comment (optional)",
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
            <input type="text" id="orderTG" placeholder="${t.tg}" maxlength="100">
        `;

        const worldCountries = [
            { ua: 'Австрія', eng: 'Austria' },
            { ua: 'Бельгія', eng: 'Belgium' },
            { ua: 'Болгарія', eng: 'Bulgaria' },
            { ua: 'Хорватія', eng: 'Croatia' },
            { ua: 'Кіпр', eng: 'Cyprus' },
            { ua: 'Чехія', eng: 'Czech Republic' },
            { ua: 'Данія', eng: 'Denmark' },
            { ua: 'Естонія', eng: 'Estonia' },
            { ua: 'Фінляндія', eng: 'Finland' },
            { ua: 'Франція', eng: 'France' },
            { ua: 'Німеччина', eng: 'Germany' },
            { ua: 'Греція', eng: 'Greece' },
            { ua: 'Угорщина', eng: 'Hungary' },
            { ua: 'Ірландія', eng: 'Ireland' },
            { ua: 'Італія', eng: 'Italy' },
            { ua: 'Латвія', eng: 'Latvia' },
            { ua: 'Литва', eng: 'Lithuania' },
            { ua: 'Люксембург', eng: 'Luxembourg' },
            { ua: 'Мальта', eng: 'Malta' },
            { ua: 'Нідерланди', eng: 'Netherlands' },
            { ua: 'Польща', eng: 'Poland' },
            { ua: 'Португалія', eng: 'Portugal' },
            { ua: 'Румунія', eng: 'Romania' },
            { ua: 'Словаччина', eng: 'Slovakia' },
            { ua: 'Словенія', eng: 'Slovenia' },
            { ua: 'Іспанія', eng: 'Spain' },
            { ua: 'Швеція', eng: 'Sweden' },
            { ua: 'США', eng: 'United States' },
            { ua: 'Канада', eng: 'Canada' }
        ];
        const worldCountryOptions = worldCountries.map((country) => {
            const label = lang === 'ua' ? country.ua : country.eng;
            return `<option value="${label}">${label}</option>`;
        }).join('');

        const worldFields = `
            <select id="orderWorldCountry">
                <option value="" disabled selected hidden>${lang === 'ua' ? 'Країна' : 'Country'}</option>
                ${worldCountryOptions}
            </select>
            <input type="text" id="orderWorldRegion" placeholder="${lang === 'ua' ? 'Штат/регіон' : 'State / Region'}">
            <input type="text" id="orderWorldPostal" placeholder="${lang === 'ua' ? 'Поштовий індекс' : 'Postal Code'}">
            <input type="text" id="orderWorldCity" placeholder="${lang === 'ua' ? 'Населений пункт' : 'Locality'}">
            <input type="text" id="orderWorldPhone" placeholder="${lang === 'ua' ? 'Мобільний номер місцевого оператора' : 'Local Mobile Number'}">
            <input type="text" id="orderWorldName" placeholder="${lang === 'ua' ? 'ПІБ латиницею' : 'Full Name (Latin)'}">
            <input type="email" id="orderWorldEmail" placeholder="${lang === 'ua' ? 'Email на Gmail' : 'Gmail Address'}">
            <input type="text" id="orderWorldTelegram" placeholder="${lang === 'ua' ? 'Ваш @Telegram юзер' : 'Your @Telegram username'}" maxlength="100">
            <input type="text" id="orderWorldPostOffice" placeholder="${lang === 'ua' ? 'Адреса і номер відділення пошти' : 'Post Office Address and Branch Number'}">
            <input type="text" id="orderWorldResidence" placeholder="${lang === 'ua' ? 'Адреса фактичного проживання' : 'Residential Address'}">
            <button class="buy-btn" id="confirmWorldBtn" onclick="proceedToPayment()">${lang === 'ua' ? 'ДАЛІ ДО ОПЛАТИ' : 'NEXT: PAYMENT'}</button>
        `;

        document.getElementById('orderModalContent').innerHTML = `
            <div class="close-btn" onclick="closeOrderForm()">&#10005;</div>
            <h2 style="color: var(--blood); margin-bottom: 15px;">${t.title}</h2>
            ${regionSwitch}
            <div class="order-form">
                ${deliveryRegion === 'ua' ? uaFields : worldFields}
                ${deliveryRegion === 'ua' ? `<button class="buy-btn" id="confirmBtn" onclick="proceedToPayment()">${t.btn}</button>` : ''}
            </div>
        `;
        document.getElementById('orderModal').style.display = 'flex';

        // Добавляем маску для номера телефона
        const phoneInput = document.getElementById('orderPhone');
        if (phoneInput && deliveryRegion === 'ua') {
            phoneInput.addEventListener('input', function(e) {
                let el = e.target;
                if (!el.value) return;

                let digits = el.value.replace(/\D/g, '');
                
                if (digits.startsWith('380')) digits = digits.substring(3);
                else if (digits.startsWith('38')) digits = digits.substring(2);
                else if (digits.startsWith('0')) digits = digits.substring(1);
                
                if (digits.length === 0) {
                    if (!el.value.startsWith('+')) {
                        el.value = '+38 (0';
                        return;
                    }
                    if (el.value.length < 6) {
                        el.value = '';
                        return;
                    }
                }
                
                let match = digits.match(/^(\d{0,2})(\d{0,3})(\d{0,2})(\d{0,2})/);
                if (!match) {
                    el.value = '';
                    return;
                }
                
                
                let out = '+38 (0';
                if (match[1]) out += match[1];
                if (match[2]) out += ') ' + match[2];
                if (match[3]) out += '-' + match[3];
                if (match[4]) out += '-' + match[4];
                
                el.value = out;
                persistOrderDraft('delivery');
            });
        }

        const draft = readOrderDraft();
        if (draft && deliveryRegion === 'ua') {
            const fioInput = document.getElementById('orderFIO');
            const npInput = document.getElementById('orderNP');
            const tgInput = document.getElementById('orderTG');
            if (fioInput && draft.delivery.uaFio) fioInput.value = draft.delivery.uaFio;
            if (phoneInput && draft.delivery.uaPhone) phoneInput.value = draft.delivery.uaPhone;
            if (npInput && draft.delivery.np) npInput.value = draft.delivery.np;
            if (tgInput && draft.delivery.tg) tgInput.value = draft.delivery.tg;
        }

        if (draft && deliveryRegion === 'world') {
            const worldCountryInput = document.getElementById('orderWorldCountry');
            const worldRegionInput = document.getElementById('orderWorldRegion');
            const worldPostalInput = document.getElementById('orderWorldPostal');
            const worldCityInput = document.getElementById('orderWorldCity');
            const worldPhoneInput = document.getElementById('orderWorldPhone');
            const worldNameInput = document.getElementById('orderWorldName');
            const worldEmailInput = document.getElementById('orderWorldEmail');
            const worldTelegramInput = document.getElementById('orderWorldTelegram');
            const worldPostOfficeInput = document.getElementById('orderWorldPostOffice');
            const worldResidenceInput = document.getElementById('orderWorldResidence');

            if (worldCountryInput && draft.delivery.country) worldCountryInput.value = draft.delivery.country;
            if (worldRegionInput && draft.delivery.regionName) worldRegionInput.value = draft.delivery.regionName;
            if (worldPostalInput && draft.delivery.postalCode) worldPostalInput.value = draft.delivery.postalCode;
            if (worldCityInput && draft.delivery.city) worldCityInput.value = draft.delivery.city;
            if (worldPhoneInput && draft.delivery.worldPhone) worldPhoneInput.value = draft.delivery.worldPhone;
            if (worldNameInput && draft.delivery.worldFio) worldNameInput.value = draft.delivery.worldFio;
            if (worldEmailInput && draft.delivery.email) worldEmailInput.value = draft.delivery.email;
            if (worldTelegramInput && draft.delivery.worldTg) worldTelegramInput.value = draft.delivery.worldTg;
            if (worldPostOfficeInput && draft.delivery.postOfficeAddress) worldPostOfficeInput.value = draft.delivery.postOfficeAddress;
            if (worldResidenceInput && draft.delivery.residenceAddress) worldResidenceInput.value = draft.delivery.residenceAddress;
        }

        ['orderFIO', 'orderNP', 'orderTG'].forEach((fieldId) => {
            const field = document.getElementById(fieldId);
            if (!field) return;
            field.addEventListener('input', () => persistOrderDraft('delivery'));
        });

        ['orderWorldCountry', 'orderWorldRegion', 'orderWorldPostal', 'orderWorldCity', 'orderWorldPhone', 'orderWorldName', 'orderWorldEmail', 'orderWorldTelegram', 'orderWorldPostOffice', 'orderWorldResidence'].forEach((fieldId) => {
            const field = document.getElementById(fieldId);
            if (!field) return;
            field.addEventListener('input', () => persistOrderDraft('delivery'));
        });

        if (phoneInput) {
            phoneInput.addEventListener('change', () => persistOrderDraft('delivery'));
        }

        persistOrderDraft('delivery');
    }

    function proceedToPayment() {
        const lang = localStorage.getItem('preferred_lang') || 'ua';
        const msgErrUa = lang === 'ua' ? 'ПЕРЕВІРТЕ ДАНІ ТА НОМЕР!' : 'CHECK DATA & NUMBER!';

        if (deliveryRegion === 'world') {
            const country = String(document.getElementById('orderWorldCountry')?.value || '').trim();
            const regionName = String(document.getElementById('orderWorldRegion')?.value || '').trim();
            const postalCode = String(document.getElementById('orderWorldPostal')?.value || '').trim();
            const city = String(document.getElementById('orderWorldCity')?.value || '').trim();
            const phone = String(document.getElementById('orderWorldPhone')?.value || '').trim();
            const fio = String(document.getElementById('orderWorldName')?.value || '').trim();
            const email = String(document.getElementById('orderWorldEmail')?.value || '').trim();
            const worldTg = String(document.getElementById('orderWorldTelegram')?.value || '').trim().slice(0, 100);
            const postOfficeAddress = String(document.getElementById('orderWorldPostOffice')?.value || '').trim();
            const residenceAddress = String(document.getElementById('orderWorldResidence')?.value || '').trim();
            const isGmail = /@gmail\.com$/i.test(email);

            if (!country || !regionName || !postalCode || !city || !phone || !fio || !email || !worldTg || !postOfficeAddress || !residenceAddress) {
                return showToast(lang === 'ua' ? 'ЗАПОВНІТЬ УСІ ПОЛЯ WORLDWIDE ДОСТАВКИ!' : 'FILL IN WORLDWIDE DELIVERY DETAILS!');
            }

            if (!isGmail) {
                return showToast(lang === 'ua' ? 'ВИКОРИСТОВУЙТЕ GMAIL-АДРЕСУ!' : 'USE A GMAIL ADDRESS!');
            }

            deliveryData = {
                region: 'world',
                data: {
                    fio,
                    phone,
                    tg: worldTg,
                    worldTg,
                    country,
                    regionName,
                    city,
                    address: residenceAddress,
                    postalCode,
                    email,
                    postOfficeAddress,
                    residenceAddress
                }
            };

            paymentRegion = 'world';
            persistOrderDraft('payment');
            renderOrderPayment();
            return;
        }

        const fio = document.getElementById('orderFIO').value;
        const phoneRaw = document.getElementById('orderPhone').value;
        const phoneDigits = phoneRaw.replace(/\D/g, '');
        const np = document.getElementById('orderNP').value;
        const tg = String(document.getElementById('orderTG').value || '').trim().slice(0, 100);

        if (!fio || phoneDigits.length < 10 || !np) return showToast(msgErrUa);

        deliveryData = {
            region: deliveryRegion,
            data: { fio, phone: '+' + phoneDigits, np, tg }
        };

        paymentRegion = 'ua';
        persistOrderDraft('payment');

        renderOrderPayment();
    }

    async function startMonoCheckout() {
        const lang = localStorage.getItem('preferred_lang') || 'ua';
        const btn = document.getElementById('monoCheckoutBtn');

        const msgNeedDelivery = lang === 'ua' ? 'СПОЧАТКУ ЗАПОВНІТЬ ДОСТАВКУ!' : 'FILL DELIVERY FIRST!';
        const msgPreparing = lang === 'ua' ? 'ФОРМУЮ MONO ПЛАТІЖ...' : 'PREPARING MONO CHECKOUT...';
        const msgAction = lang === 'ua' ? 'ШВИДКА ОПЛАТА' : 'QUICK PAYMENT';
        const msgFail = lang === 'ua' ? 'НЕ ВДАЛОСЯ ВІДКРИТИ MONO' : 'FAILED TO OPEN MONO';

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
            const city = shippingRaw.split(',')[0].split('в„–')[0].trim() || '-';
            const items = buildOrderItemsPayload('ua');
            const orderVisualItems = buildOrderTelegramVisualItems('ua');

        const response = await fetch('/api/payments/mono/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    amount: total,
                    currency: 'UAH',
                    description: `Hardcore Division order (${cart.length} items)`,
                    redirectUrl: window.location.href.split('#')[0],
                    customer: {
                        fio: String(deliveryData?.data?.fio || '').trim(),
                        phone: String(deliveryData?.data?.phone || '').trim(),
                        city,
                        delivery: shippingRaw || '-',
                        tg: String(deliveryData?.data?.tg || '').trim()
                    },
                    items,
                    orderItems: orderVisualItems
                })
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok || (!payload?.pageUrl && !payload?.appUrl)) {
                throw new Error(payload?.error || 'Mono create error');
            }

            window.location.href = payload.pageUrl || payload.appUrl;
        } catch (e) {
            showToast(msgFail);
            if (btn) {
                btn.disabled = false;
                btn.innerText = msgAction;
            }
        }
    }

    function closeOrderForm() { 
        clearPaymentScreenshot();
        document.getElementById('orderModal').style.display = 'none'; 
        persistOrderDraft();
    }

    function renderOrderSuccess(source = 'order') {
        const lang = localStorage.getItem('preferred_lang') || 'ua';
        orderStep = 'success';

        const t = {
            title: lang === 'ua' ? 'ОПЛАТА УСПІШНА' : 'PAYMENT SUCCESS',
            text: lang === 'ua'
                ? (source === 'mono'
                    ? 'Оплату успішно підтверджено через mono. Очікуйте відправку протягом 3–5 робочих днів.'
                    : 'Замовлення успішно оформлено. Очікуйте відправку протягом 3–5 робочих днів.')
                : (source === 'mono'
                    ? 'Payment has been successfully confirmed via mono. Please expect shipping within 3–5 business days.'
                    : 'Order successfully placed. Please expect shipping within 3–5 business days.'),
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
        persistOrderDraft('payment');
    }

    async function finalizeOrder() {
        const lang = localStorage.getItem('preferred_lang') || 'ua';
        const btn = document.getElementById('payBtn');
        const isWorldwideOrder = paymentRegion === 'world' && deliveryData?.region === 'world';

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

        if (paymentRegion !== 'ua' && !isWorldwideOrder) {
            return showToast(lang === 'ua'
                ? 'Для цього методу використовуйте mono checkout.'
                : 'Use mono checkout for this method.');
        }

        if (!paymentScreenshot) return showToast(msgNeedScreenshot);
        if (!deliveryData || (isWorldwideOrder ? deliveryData.region !== 'world' : deliveryData.region !== 'ua')) {
            showToast(msgNeedDelivery);
            renderDeliveryForm();
            return;
        }

        btn.innerText = msgWait;
        btn.disabled = true;

        const orderLang = isWorldwideOrder ? 'eng' : lang;
        const currency = isWorldwideOrder ? '€' : (lang === 'ua' ? '₴' : '€');
        let total = cart.reduce((sum, i) => sum + (isWorldwideOrder ? i.usd : (lang === 'ua' ? i.uah : i.usd)), 0);
        let itemsInfo = cart.map((item, idx) => `${idx + 1}. ${item.name} (${item.size}) — ${isWorldwideOrder ? item.usd : (lang === 'ua' ? item.uah : item.usd)}${currency}`).join('\n');
        const orderVisualItems = buildOrderTelegramVisualItems(orderLang);
        let messageText = '';
        const publicOrderCode = generatePublicOrderCode();

        if (isWorldwideOrder) {
            const fio = String(deliveryData?.data?.fio || '').trim();
            const phone = String(deliveryData?.data?.phone || '').trim();
            const worldTg = String(deliveryData?.data?.worldTg || deliveryData?.data?.tg || '').trim();
            const country = String(deliveryData?.data?.country || '').trim();
            const regionName = String(deliveryData?.data?.regionName || '').trim();
            const postalCode = String(deliveryData?.data?.postalCode || '').trim();
            const city = String(deliveryData?.data?.city || '').trim();
            const email = String(deliveryData?.data?.email || '').trim();
            const postOfficeAddress = String(deliveryData?.data?.postOfficeAddress || '').trim();
            const residenceAddress = String(deliveryData?.data?.residenceAddress || deliveryData?.data?.address || '').trim();
            const normalizedWorldCountry = country.toLowerCase();
            const specialWorldCountries = new Set(['slovakia', 'slovak republic', 'словаччина', 'germany', 'німеччина', 'poland', 'польща']);
            const shippingBase = specialWorldCountries.has(normalizedWorldCountry) ? 20 : 25;
            const shippingStep = Math.max(0, Math.ceil(cart.length / 3) - 1) * 5;
            const shippingTotal = shippingBase + shippingStep;
            const goodsTotal = total;
            total = goodsTotal + shippingTotal;

            if (!fio || !phone || !worldTg || !country || !regionName || !postalCode || !city || !email || !postOfficeAddress || !residenceAddress) {
                btn.innerText = payLabel;
                btn.disabled = false;
                return showToast(lang === 'ua' ? 'ЗАПОВНІТЬ УСІ ПОЛЯ WORLDWIDE ДОСТАВКИ!' : 'FILL IN WORLDWIDE DELIVERY DETAILS!');
            }

            messageText = `<b>🌎 NEW WORLDWIDE ORDER 🌎</b>\n\n🆔 <b>Order:</b> ${publicOrderCode}\n👤 <b>Full Name:</b> ${fio}\n📞 <b>Phone:</b> ${phone}\n💬 <b>Telegram:</b> ${worldTg}\n📧 <b>Email:</b> ${email}\n🌍 <b>Country:</b> ${country}\n🗺 <b>State / Region:</b> ${regionName}\n📮 <b>Postal Code:</b> ${postalCode}\n🏙 <b>City:</b> ${city}\n📦 <b>Post Office:</b> ${postOfficeAddress}\n🏠 <b>Residence Address:</b> ${residenceAddress}\n\n🛒 <b>Items:</b>\n${itemsInfo}\n\n💳 <b>Payment:</b> Worldwide payment details\n🧾 <b>Goods Total:</b> ${goodsTotal}€\n🚚 <b>Shipping:</b> ${shippingTotal}€\n📌 <b>Status:</b> created\n<b>💰 TOTAL: ${total}€</b>`;
        } else if (paymentRegion === 'ua') {
            const fio = deliveryData.data.fio;
            const phone = deliveryData.data.phone;
            const np = deliveryData.data.np;
            const tg = deliveryData.data.tg;

            if (!fio || !phone || phone.length < 10 || !np) {
                btn.innerText = payLabel;
                btn.disabled = false;
                return showToast(msgErrUa);
            }

            let tgText = tg ? `\n💬 <b>TG / Коментар:</b> ${tg}` : "";
            messageText = `<b>💀 НОВЕ ЗАМОВЛЕННЯ 💀</b>\n\n🆔 <b>Номер:</b> ${publicOrderCode}\n👤 <b>ПІБ:</b> ${fio}\n📞 <b>Тел:</b> ${phone}${tgText}\n📦 <b>НП:</b> ${np}\n\n🛒 <b>Товари:</b>\n${itemsInfo}\n\n💳 <b>Оплата:</b> Оплата по реквізитам\n📌 <b>Статус:</b> created\n<b>💰 СУМА: ${total}${currency}</b>`;
        }

        try {
            await saveOrderForAccountHistory(orderLang, total);
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
                    image: paymentScreenshot,
                    orderItems: orderVisualItems
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
            saveCartToStorage();
            updateCartCount();
            clearPaymentScreenshot();
            deliveryData = null;
            deliveryRegion = 'ua';
            paymentRegion = 'ua';
            clearOrderDraft();
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
                product_id: null,
                image: String(item.image || '').trim(),
                productSlug: String(item.productSlug || '').trim(),
                color: String(item.color || '').trim()
            });
        });

        return Array.from(grouped.values());
    }

    function buildOrderTelegramVisualItems(lang) {
        const products = Array.isArray(window.PRODUCTS_DATA) ? window.PRODUCTS_DATA : [];
        const currency = lang === 'ua' ? '₴' : '€';
        const grouped = buildOrderItemsPayload(lang);
        const normalize = (value) => String(value || '').trim().toLowerCase();

        return grouped.map((item, idx) => {
            const itemTitleNorm = normalize(item.title);
            const product = products.find((p) => {
                const slugNorm = normalize(item.productSlug);
                if (slugNorm && normalize(p?.slug) === slugNorm) {
                    return true;
                }
                const cartNameNorm = normalize(p?.cartName);
                const titleNorm = normalize(p?.title);
                return cartNameNorm === itemTitleNorm || titleNorm === itemTitleNorm;
            });
            const imagePath = String(item.image || '').trim() || product?.image || (product?.gallery && product.gallery[0]) || '';

            const line = `${idx + 1}. ${item.title} (${item.size}) x${item.quantity} - ${item.price}${currency}`;
            return {
                line,
                image: imagePath
            };
        }).filter((entry) => Boolean(entry.image));
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
                    '• Відправка замовлень: 2-3 робочих днів після підтвердження.',
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

function setFilterButtonState(category) {
    const buttons = document.querySelectorAll('.filter-btn');

    buttons.forEach(btn => {
        const btnOnClick = String(btn.getAttribute('onclick') || '');
        if (btnOnClick.includes(`'${category}'`)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function updateSearchPlaceholder() {
    const input = document.getElementById('catalogSearchInput');
    if (!input) return;

    const lang = localStorage.getItem('preferred_lang') || 'ua';
    input.placeholder = lang === 'ua'
        ? 'Пошук товару за назвою...'
        : 'Search products by name...';
}

function setCardVisibility(card, isVisible) {
    if (isVisible) {
        card.style.display = 'flex';
        setTimeout(() => {
            card.classList.remove('hidden');
        }, 10);
        return;
    }

    card.classList.add('hidden');
    setTimeout(() => {
        if (card.classList.contains('hidden')) {
            card.style.display = 'none';
        }
    }, 400);
}

function setCatalogEmptyState(isEmpty) {
    const emptyState = document.getElementById('catalogEmptyState');
    if (!emptyState) return;
    emptyState.hidden = !isEmpty;
}

function applyCatalogFilters() {
    const cards = document.querySelectorAll('.product-card');
    const search = String(catalogSearchQuery || '').trim().toLowerCase();
    let visibleCount = 0;

    cards.forEach(card => {
        const cardCategory = String(card.getAttribute('data-category') || '');
        const titleEl = card.querySelector('.product-title');
        const titleText = String(titleEl ? titleEl.textContent : '').trim().toLowerCase();

        const categoryMatch = activeCatalogCategory === 'all' || cardCategory === activeCatalogCategory;
        const searchMatch = !search || titleText.includes(search);
        const isVisible = categoryMatch && searchMatch;
        setCardVisibility(card, isVisible);
        if (isVisible) {
            visibleCount += 1;
        }
    });

    const shouldShowEmpty = visibleCount === 0 && (search.length > 0 || activeCatalogCategory !== 'all' || cards.length === 0);
    setCatalogEmptyState(shouldShowEmpty);
}

function filterProducts(category) {
    activeCatalogCategory = category;
    setFilterButtonState(category);
    applyCatalogFilters();
}

function initCatalogSearch() {
    const input = document.getElementById('catalogSearchInput');
    if (!input) return;

    input.addEventListener('input', (event) => {
        catalogSearchQuery = String(event.target.value || '');
        applyCatalogFilters();
    });

    updateSearchPlaceholder();
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
    updateSearchPlaceholder();
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
    initCatalogSearch();
    setFilterButtonState(activeCatalogCategory);
    const savedLang = localStorage.getItem('preferred_lang') || 'ua';
    setLang(savedLang);
    applyCatalogFilters();
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

// Логіка для перевертання стрілочки в select
document.addEventListener('click', (event) => {
    if (event.target && event.target.tagName === 'SELECT') {
        event.target.classList.toggle('is-open');
    } else {
        document.querySelectorAll('select.is-open').forEach(sel => sel.classList.remove('is-open'));
    }
});
document.addEventListener('change', (event) => {
    if (event.target && event.target.tagName === 'SELECT') {
        event.target.classList.remove('is-open');
    }
});
document.addEventListener('focusout', (event) => {
    if (event.target && event.target.tagName === 'SELECT') {
        event.target.classList.remove('is-open');
    }
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
    initGalleryBackdropClose();
    handleMonoReturnFromUrl();
});

window.addEventListener('pageshow', () => {
    syncAccountButtonState();
    handleMonoReturnFromUrl();
});
