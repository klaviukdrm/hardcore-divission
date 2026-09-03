(function () {
    const adminMessage = document.getElementById('adminMessage');
    const adminLoginSection = document.getElementById('adminLoginSection');
    const adminLoginForm = document.getElementById('adminLoginForm');
    const adminPasswordInput = document.getElementById('adminPassword');
    const adminDashboard = document.getElementById('adminDashboard');
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');

    const createProductForm = document.getElementById('createProductForm');
    const submitProductBtn = document.getElementById('submitProductBtn');
    const uploadProgressText = document.getElementById('uploadProgressText');
    const adminProductsContainer = document.getElementById('adminProductsContainer');
    const adminProductsCount = document.getElementById('adminProductsCount');
    const refreshProductsBtn = document.getElementById('refreshProductsBtn');
    const syncDefaultsBtn = document.getElementById('syncDefaultsBtn');
    const adminSearchInput = document.getElementById('adminSearchInput');
    const addColorVariantBtn = document.getElementById('addColorVariantBtn');
    const colorVariantsContainer = document.getElementById('colorVariantsContainer');

    const prodPriceUah = document.getElementById('prodPriceUah');
    const prodPriceUsd = document.getElementById('prodPriceUsd');

    let allLoadedProducts = [];

    // State for dynamic color variants (each has 4 photo slots)
    let colorVariantsState = [
        createColorVariantState(1, 'ОСНОВНИЙ / ЧОРНИЙ', 'BLACK')
    ];

    function createColorVariantState(id, labelUa = '', labelEng = '') {
        return {
            id,
            labelUa,
            labelEng,
            slots: [
                { slot: 1, file: null, dataUrl: null, origSize: 0, compSize: 0 },
                { slot: 2, file: null, dataUrl: null, origSize: 0, compSize: 0 },
                { slot: 3, file: null, dataUrl: null, origSize: 0, compSize: 0 },
                { slot: 4, file: null, dataUrl: null, origSize: 0, compSize: 0 }
            ]
        };
    }

    function showMessage(text, isError = false) {
        if (!adminMessage) return;
        if (!text) {
            adminMessage.style.display = 'none';
            adminMessage.textContent = '';
            adminMessage.className = 'panel-message';
            return;
        }

        adminMessage.textContent = text;
        adminMessage.style.display = 'block';
        adminMessage.className = `panel-message ${isError ? 'error' : 'success'}`;
        adminMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    async function api(url, options = {}) {
        const response = await fetch(url, {
            credentials: 'include',
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });

        let payload = {};
        try {
            payload = await response.json();
        } catch (e) {
            payload = {};
        }

        if (!response.ok) {
            throw new Error(payload.error || `Помилка запиту (${response.status})`);
        }

        return payload;
    }

    function formatBytes(bytes) {
        if (!bytes || bytes <= 0) return '0 B';
        if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return Math.round(bytes / 1024) + ' KB';
    }

    // High-performance client-side image compression (resizes 5-20MB down to ~150-250KB)
    function compressImage(file, maxDimension = 1600, quality = 0.82) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxDimension) {
                            height = Math.round((height * maxDimension) / width);
                            width = maxDimension;
                        }
                    } else {
                        if (height > maxDimension) {
                            width = Math.round((width * maxDimension) / height);
                            height = maxDimension;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    // Fill background with white to avoid black frame artifacts
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);

                    const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                    const head = 'data:image/jpeg;base64,';
                    const compBytes = Math.round(((compressedDataUrl.length - head.length) * 3) / 4);

                    resolve({
                        dataUrl: compressedDataUrl,
                        origSize: file.size,
                        compSize: compBytes
                    });
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    }

    function renderColorVariantsUI() {
        if (!colorVariantsContainer) return;

        colorVariantsContainer.innerHTML = colorVariantsState.map((colorVar, colorIdx) => {
            const isSingle = colorVariantsState.length === 1;
            const colorTitle = isSingle ? 'ФОТОГРАФІЇ ТОВАРУ (ОСНОВНИЙ КОЛІР)' : `КОЛІР #${colorIdx + 1}`;

            const slotsHtml = colorVar.slots.map((s) => {
                const hasImg = Boolean(s.dataUrl);
                const badgeTitle = s.slot === 1 ? '1. СПЕРЕДУ *' : (s.slot === 2 ? '2. СПИНА' : (s.slot === 3 ? '3. ДЕТАЛЬ' : '4. ДОДАТКОВО'));
                
                let statsHtml = '';
                if (hasImg && s.origSize > 0 && s.compSize > 0) {
                    const pct = Math.round((1 - s.compSize / s.origSize) * 100);
                    statsHtml = `<span class="slot-comp-badge" title="Оригінал: ${formatBytes(s.origSize)}, стиснено: ${formatBytes(s.compSize)}">⚡ ${formatBytes(s.origSize)} ➔ ${formatBytes(s.compSize)} (-${pct}%)</span>`;
                }

                return `
                    <div class="image-upload-slot" data-color-idx="${colorIdx}" data-slot="${s.slot}">
                        <span class="slot-badge">${badgeTitle}</span>
                        ${statsHtml}
                        <input type="file" accept="image/*" class="slot-file-input">
                        <div class="slot-preview">
                            ${hasImg ? `<img src="${s.dataUrl}" class="slot-preview-img" alt="Слот ${s.slot}">` : `
                                <div class="slot-placeholder">
                                    <span class="slot-icon">📷</span>
                                    <span class="slot-text">Вибрати фото ${s.slot}</span>
                                </div>
                            `}
                        </div>
                        <button type="button" class="slot-remove-btn" title="Видалити фото" style="${hasImg ? 'display:flex;' : 'display:none;'}">&times;</button>
                    </div>
                `;
            }).join('');

            return `
                <div class="admin-color-card" data-color-idx="${colorIdx}">
                    <div class="admin-color-card-header">
                        <div class="admin-color-card-title">
                            <span class="color-index-circle">${colorIdx + 1}</span>
                            <strong>${colorTitle}</strong>
                        </div>
                        ${!isSingle ? `<button type="button" class="admin-btn-remove-color" data-color-idx="${colorIdx}">❌ Видалити цей колір</button>` : ''}
                    </div>

                    ${!isSingle ? `
                        <div class="admin-color-names-row">
                            <div class="admin-field-group">
                                <label class="field-label">Назва кольору (UA) *</label>
                                <input type="text" class="color-label-ua-input" data-color-idx="${colorIdx}" placeholder="Наприклад: ЧОРНИЙ, БІЛИЙ, ХАКІ" value="${escapeHtml(colorVar.labelUa)}">
                            </div>
                            <div class="admin-field-group">
                                <label class="field-label">Назва кольору (ENG)</label>
                                <input type="text" class="color-label-eng-input" data-color-idx="${colorIdx}" placeholder="Наприклад: BLACK, WHITE, KHAKI" value="${escapeHtml(colorVar.labelEng)}">
                            </div>
                        </div>
                    ` : ''}

                    <div class="admin-images-grid">
                        ${slotsHtml}
                    </div>
                </div>
            `;
        }).join('');

        attachColorSlotListeners();
    }

    function attachColorSlotListeners() {
        // Text inputs for color names
        colorVariantsContainer.querySelectorAll('.color-label-ua-input').forEach((input) => {
            input.addEventListener('input', (e) => {
                const colorIdx = Number(e.target.getAttribute('data-color-idx'));
                if (colorVariantsState[colorIdx]) {
                    colorVariantsState[colorIdx].labelUa = e.target.value.trim();
                }
            });
        });

        colorVariantsContainer.querySelectorAll('.color-label-eng-input').forEach((input) => {
            input.addEventListener('input', (e) => {
                const colorIdx = Number(e.target.getAttribute('data-color-idx'));
                if (colorVariantsState[colorIdx]) {
                    colorVariantsState[colorIdx].labelEng = e.target.value.trim();
                }
            });
        });

        // Remove color variant button
        colorVariantsContainer.querySelectorAll('.admin-btn-remove-color').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const colorIdx = Number(btn.getAttribute('data-color-idx'));
                if (colorVariantsState.length > 1) {
                    colorVariantsState.splice(colorIdx, 1);
                    renderColorVariantsUI();
                }
            });
        });

        // Image upload slots
        colorVariantsContainer.querySelectorAll('.image-upload-slot').forEach((slotEl) => {
            const colorIdx = Number(slotEl.getAttribute('data-color-idx'));
            const slotNum = Number(slotEl.getAttribute('data-slot'));
            const input = slotEl.querySelector('.slot-file-input');
            const removeBtn = slotEl.querySelector('.slot-remove-btn');

            slotEl.addEventListener('click', (e) => {
                if (e.target.closest('.slot-remove-btn')) return;
                input.click();
            });

            slotEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                slotEl.classList.add('drag-over');
            });

            slotEl.addEventListener('dragleave', () => {
                slotEl.classList.remove('drag-over');
            });

            slotEl.addEventListener('drop', async (e) => {
                e.preventDefault();
                slotEl.classList.remove('drag-over');
                const files = e.dataTransfer.files;
                if (files && files[0]) {
                    await handleSlotFile(colorIdx, slotNum, files[0]);
                }
            });

            input.addEventListener('change', async (e) => {
                const files = e.target.files;
                if (files && files[0]) {
                    await handleSlotFile(colorIdx, slotNum, files[0]);
                }
            });

            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                clearSlot(colorIdx, slotNum);
            });
        });
    }

    async function handleSlotFile(colorIdx, slotNum, file) {
        if (!file.type.startsWith('image/')) {
            return showMessage('Будь ласка, виберіть файл зображення (JPG, PNG, WebP).', true);
        }

        try {
            const compressed = await compressImage(file);
            const slotIdx = slotNum - 1;
            const targetColor = colorVariantsState[colorIdx];
            if (!targetColor) return;

            targetColor.slots[slotIdx] = {
                slot: slotNum,
                file: file,
                dataUrl: compressed.dataUrl,
                origSize: compressed.origSize,
                compSize: compressed.compSize
            };

            renderColorVariantsUI();
        } catch (e) {
            console.error(e);
            showMessage(`Не вдалося прочитати та стиснути фото: ${e.message}`, true);
        }
    }

    function clearSlot(colorIdx, slotNum) {
        const slotIdx = slotNum - 1;
        const targetColor = colorVariantsState[colorIdx];
        if (!targetColor) return;

        targetColor.slots[slotIdx] = {
            slot: slotNum,
            file: null,
            dataUrl: null,
            origSize: 0,
            compSize: 0
        };

        renderColorVariantsUI();
    }

    // Add another color variant button
    if (addColorVariantBtn) {
        addColorVariantBtn.addEventListener('click', () => {
            const nextIndex = colorVariantsState.length + 1;
            colorVariantsState.push(createColorVariantState(nextIndex, `КОЛІР ${nextIndex}`, `COLOR ${nextIndex}`));
            renderColorVariantsUI();
        });
    }

    function showDashboard() {
        adminLoginSection.style.display = 'none';
        adminDashboard.style.display = 'block';
        loadProductsList();
    }

    function showLogin() {
        adminLoginSection.style.display = 'block';
        adminDashboard.style.display = 'none';
    }

    // Auto-calculate approximate EUR price from UAH
    if (prodPriceUah && prodPriceUsd) {
        prodPriceUah.addEventListener('input', () => {
            const uah = Number(prodPriceUah.value) || 0;
            if (uah > 0 && (!prodPriceUsd.value || prodPriceUsd.dataset.autoCalc !== 'false')) {
                prodPriceUsd.value = Math.max(1, Math.round(uah / 45));
            }
        });
        prodPriceUsd.addEventListener('input', () => {
            prodPriceUsd.dataset.autoCalc = 'false';
        });
    }

    // Admin Login Handler
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            showMessage('');

            const password = adminPasswordInput ? adminPasswordInput.value.trim() : '';
            if (!password) {
                return showMessage('Введіть пароль адміністратора', true);
            }

            const btn = document.getElementById('adminLoginSubmitBtn');
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'ПЕРЕВІРКА...';
            }

            try {
                await api('/api/admin/login', {
                    method: 'POST',
                    body: JSON.stringify({ password })
                });

                showDashboard();
                showMessage('Вхід виконано успішно! Ласкаво просимо в адмінку.');
                adminLoginForm.reset();
            } catch (err) {
                showMessage(err.message, true);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'УВІЙТИ';
                }
            }
        });
    }

    // Admin Logout Handler
    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', async () => {
            showMessage('');
            try {
                await api('/api/auth/logout', { method: 'POST' });
            } catch (e) {
                // Ignore logout API errors
            }
            showLogin();
            showMessage('Ви вийшли з адмін-панелі.');
        });
    }

    // Refresh products list
    if (refreshProductsBtn) {
        refreshProductsBtn.addEventListener('click', () => {
            loadProductsList();
        });
    }

    // Sync all default products from website to Supabase
    if (syncDefaultsBtn) {
        syncDefaultsBtn.addEventListener('click', async () => {
            if (!Array.isArray(window.PRODUCTS_DATA) || !window.PRODUCTS_DATA.length) {
                return showMessage('Базові товари в коді сайту не знайдено.', true);
            }

            if (!confirm(`Імпортувати всі ${window.PRODUCTS_DATA.length} базових товарів сайту в Supabase? Це додасть їх у базу даних для керування.`)) {
                return;
            }

            syncDefaultsBtn.disabled = true;
            syncDefaultsBtn.textContent = 'Імпорт товарів...';
            showMessage('Імпортуємо всі товари в базу даних Supabase...');

            try {
                const turboskinSlugs = new Set([
                    'turbohardcore-turbohardcore-hoodie',
                    'turbohardcore-red-turbohardcore-t-shirt-red',
                    'turbonasillia-turbonasillia-hoodie',
                    'turbonasillia-turbonasillia-t-shirt',
                    'trbskn-gen1-trbskn-gen1-hoodie',
                    'trbskn-gen1-trbskn-gen1-t-shirt',
                    'nlyl-nlyl-hoodie',
                    'nlyl-nlyl-t-shirt',
                    'protect-your-karma-protect-your-karma-hoodie',
                    'protect-your-karma-protect-your-karma-t-shirt',
                    'trbskn-gen2-trbskn-gen2-hoodie',
                    'trbskn-gen2-trbskn-gen2-t-shirt',
                    'turb8sk1n-httb-gen3-t-shirt',
                    'turb8sk1n-httb-gen3-hoodie'
                ]);

                const designerSlugs = new Set([
                    'handofdust-support-gen1-t-shirt',
                    'handofdust-support-gen2-t-shirt'
                ]);

                const formatted = window.PRODUCTS_DATA.map((item) => {
                    const slug = String(item.slug || '').trim();
                    let brand = 'hd';
                    if (turboskinSlugs.has(slug)) brand = 'turboskin';
                    if (designerSlugs.has(slug)) brand = 'designer';

                    return {
                        slug,
                        title: item.title,
                        category: item.category || 'футболка',
                        price_uah: Number(item.priceUah) || 0,
                        price_usd: Number(item.priceUsd) || 0,
                        desc_ua: item.descUa || '',
                        desc_eng: item.descEng || '',
                        image: item.image || '',
                        image_alt: item.imageAlt || item.image || '',
                        gallery: Array.isArray(item.gallery) ? item.gallery : [item.image].filter(Boolean),
                        is_new: Boolean(item.isNew),
                        is_preorder: Boolean(item.isPreorder),
                        sold_out: Boolean(item.soldOut),
                        catalog_order: Number(item.catalogOrder) || 500,
                        brand,
                        colorVariants: Array.isArray(item.colorVariants) ? item.colorVariants : []
                    };
                });

                const res = await api('/api/products', {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'sync_all',
                        products: formatted
                    })
                });

                showMessage(`Успішно імпортовано/оновлено ${res.count || formatted.length} товарів у Supabase! 🎉`);
                loadProductsList();
            } catch (err) {
                showMessage(`Помилка імпорту: ${err.message}`, true);
            } finally {
                syncDefaultsBtn.disabled = false;
                syncDefaultsBtn.textContent = '📥 Імпортувати всі товари сайту в базу';
            }
        });
    }

    // Search input filtering
    if (adminSearchInput) {
        adminSearchInput.addEventListener('input', () => {
            renderProductsList(adminSearchInput.value);
        });
    }

    // Load Products List from Supabase
    async function loadProductsList() {
        if (!adminProductsContainer) return;
        adminProductsContainer.innerHTML = '<div class="admin-loading-text">Завантаження списку товарів...</div>';

        try {
            const res = await api('/api/products', { method: 'GET' });
            allLoadedProducts = Array.isArray(res.products) ? res.products : [];

            // Sort by catalog_order ascending
            allLoadedProducts.sort((a, b) => (Number(a.catalog_order) || 500) - (Number(b.catalog_order) || 500));

            renderProductsList(adminSearchInput ? adminSearchInput.value : '');
        } catch (err) {
            adminProductsContainer.innerHTML = `<div class="panel-message error">Помилка завантаження товарів: ${escapeHtml(err.message)}</div>`;
        }
    }

    function renderProductsList(searchQuery = '') {
        if (!adminProductsContainer) return;

        const q = String(searchQuery || '').trim().toLowerCase();
        const filtered = allLoadedProducts.filter((p) => {
            if (!q) return true;
            return (
                (p.title && p.title.toLowerCase().includes(q)) ||
                (p.category && p.category.toLowerCase().includes(q)) ||
                (p.brand && p.brand.toLowerCase().includes(q)) ||
                (p.slug && p.slug.toLowerCase().includes(q))
            );
        });

        if (adminProductsCount) {
            adminProductsCount.textContent = `Всього: ${filtered.length} (із ${allLoadedProducts.length})`;
        }

        if (!filtered.length) {
            adminProductsContainer.innerHTML = q
                ? '<div class="admin-empty-text">Товарів за запитом не знайдено.</div>'
                : '<div class="admin-empty-text">У базі даних Supabase поки немає товарів. Натисніть кнопку <strong>"📥 Імпортувати всі товари сайту в базу"</strong> вгорі, щоб завантажити існуючий каталог, або додайте новий товар через форму вище.</div>';
            return;
        }

        adminProductsContainer.innerHTML = filtered.map((prod, index) => {
            const img = prod.image || (Array.isArray(prod.gallery) && prod.gallery[0]) || 'images/placeholder.jpg';
            const brandBadge = prod.brand === 'turboskin' ? '⚡ Turboskin' : (prod.brand === 'designer' ? '🎨 Дизайнер' : '🩸 Hardcore Division');
            const priceText = `${prod.price_uah || 0}₴ / ${prod.price_usd || 0}€`;
            const currentOrder = Number(prod.catalog_order) || 500;
            const isSoldOut = Boolean(prod.sold_out);
            const colorVars = Array.isArray(prod.color_variants) ? prod.color_variants : (Array.isArray(prod.colorVariants) ? prod.colorVariants : []);
            const colorsBadge = colorVars.length > 1 ? `<span class="admin-badge-mini colors">${colorVars.length} КОЛЬОРИ</span>` : '';

            return `
                <article class="admin-product-item${isSoldOut ? ' admin-prod-sold-out' : ''}" data-id="${prod.id}" data-index="${index}">
                    <div class="admin-prod-thumb-wrap">
                        <img src="${img}" alt="${prod.title}" class="admin-prod-thumb" loading="lazy">
                        ${isSoldOut ? '<span class="admin-soldout-ribbon">SOLD OUT</span>' : ''}
                    </div>

                    <div class="admin-prod-info">
                        <div class="admin-prod-top">
                            <h4 class="admin-prod-title">${escapeHtml(prod.title)}</h4>
                            <span class="admin-prod-brand-badge">${brandBadge}</span>
                            ${colorsBadge}
                            ${prod.is_new ? '<span class="admin-badge-mini new">NEW</span>' : ''}
                            ${prod.is_preorder ? '<span class="admin-badge-mini preorder">PREORDER</span>' : ''}
                        </div>
                        <div class="admin-prod-meta">
                            <span>Категорія: <strong>${escapeHtml(prod.category)}</strong></span>
                            <span>Ціна: <strong>${priceText}</strong></span>
                            <label class="admin-brand-select-label" title="Бренд для розрахунку часток у боті">
                                <span>Бренд для бота:</span>
                                <select class="admin-brand-select" data-id="${prod.id}">
                                    <option value="hd" ${prod.brand === 'hd' || !prod.brand ? 'selected' : ''}>🩸 Hardcore Division (ХД)</option>
                                    <option value="turboskin" ${prod.brand === 'turboskin' ? 'selected' : ''}>⚡ Turboskin (Турбо)</option>
                                    <option value="designer" ${prod.brand === 'designer' ? 'selected' : ''}>🎨 Дизайнер (handofdust)</option>
                                </select>
                            </label>
                            <span>Артикул: <code>${escapeHtml(prod.slug)}</code></span>
                        </div>
                    </div>

                    <!-- Order Position Controls (Порядок в каталозі: вище/нижче) -->
                    <div class="admin-order-ctrls">
                        <label class="admin-order-label" title="Чим менше число, тим вище товар у каталозі">
                            <span>Позиція:</span>
                            <input type="number" class="admin-order-input" data-id="${prod.id}" value="${currentOrder}">
                            <button type="button" class="admin-save-order-btn" data-id="${prod.id}" title="Зберегти позицію">💾</button>
                        </label>
                        <div class="admin-arrow-btns">
                            <button type="button" class="admin-btn-arrow admin-up-btn" data-id="${prod.id}" data-idx="${index}" title="Підняти вище в каталозі">⬆️ Вище</button>
                            <button type="button" class="admin-btn-arrow admin-down-btn" data-id="${prod.id}" data-idx="${index}" title="Опустити нижче в каталозі">⬇️ Нижче</button>
                        </div>
                    </div>

                    <div class="admin-prod-actions">
                        <button type="button" class="admin-stock-toggle-btn ${isSoldOut ? 'is-out' : 'is-in'}" data-id="${prod.id}" data-soldout="${isSoldOut}">
                            ${isSoldOut ? '🔴 Розпродано' : '🟢 В наявності'}
                        </button>
                        <button type="button" class="admin-delete-prod-btn" data-id="${prod.id}" data-title="${escapeHtml(prod.title)}">🗑 Видалити</button>
                    </div>
                </article>
            `;
        }).join('');

        attachProductCardListeners();
    }

    function attachProductCardListeners() {
        // Change Brand Selector (HD, Turboskin, Designer)
        adminProductsContainer.querySelectorAll('.admin-brand-select').forEach((select) => {
            select.addEventListener('change', async () => {
                const id = select.getAttribute('data-id');
                const nextBrand = select.value;
                const brandNames = {
                    hd: 'Hardcore Division (ХД)',
                    turboskin: 'Turboskin (Турбо)',
                    designer: 'Дизайнер (handofdust)'
                };

                try {
                    select.disabled = true;
                    await api('/api/products', {
                        method: 'PATCH',
                        body: JSON.stringify({ id, brand: nextBrand })
                    });
                    showMessage(`Бренд товару успішно змінено на "${brandNames[nextBrand] || nextBrand}"! Тепер частка в боті розраховується правильно.`);
                    loadProductsList();
                } catch (err) {
                    showMessage(err.message, true);
                    select.disabled = false;
                }
            });
        });

        // Save Order Number
        adminProductsContainer.querySelectorAll('.admin-save-order-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const input = btn.closest('.admin-order-ctrls').querySelector('.admin-order-input');
                const nextOrder = Number(input?.value);
                if (!Number.isFinite(nextOrder)) return showMessage('Вкажіть числове значення для порядку', true);

                try {
                    btn.disabled = true;
                    await api('/api/products', {
                        method: 'PATCH',
                        body: JSON.stringify({ id, catalog_order: nextOrder })
                    });
                    showMessage('Порядок товару в каталозі збережено!');
                    loadProductsList();
                } catch (err) {
                    showMessage(err.message, true);
                } finally {
                    btn.disabled = false;
                }
            });
        });

        // Move Up in catalog
        adminProductsContainer.querySelectorAll('.admin-up-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const idx = Number(btn.getAttribute('data-idx'));
                if (idx <= 0) return showMessage('Товар уже знаходиться на найвищій позиції.');

                const currentItem = allLoadedProducts[idx];
                const prevItem = allLoadedProducts[idx - 1];
                if (!currentItem || !prevItem) return;

                const newCurrentOrder = Math.max(1, (Number(prevItem.catalog_order) || 500) - 1);

                try {
                    btn.disabled = true;
                    await api('/api/products', {
                        method: 'PATCH',
                        body: JSON.stringify({ id: currentItem.id, catalog_order: newCurrentOrder })
                    });
                    showMessage(`Товар "${currentItem.title}" піднято вище!`);
                    loadProductsList();
                } catch (err) {
                    showMessage(err.message, true);
                    btn.disabled = false;
                }
            });
        });

        // Move Down in catalog
        adminProductsContainer.querySelectorAll('.admin-down-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const idx = Number(btn.getAttribute('data-idx'));
                if (idx >= allLoadedProducts.length - 1) return showMessage('Товар уже знаходиться на найнижчій позиції.');

                const currentItem = allLoadedProducts[idx];
                const nextItem = allLoadedProducts[idx + 1];
                if (!currentItem || !nextItem) return;

                const newCurrentOrder = (Number(nextItem.catalog_order) || 500) + 1;

                try {
                    btn.disabled = true;
                    await api('/api/products', {
                        method: 'PATCH',
                        body: JSON.stringify({ id: currentItem.id, catalog_order: newCurrentOrder })
                    });
                    showMessage(`Товар "${currentItem.title}" опущено нижче!`);
                    loadProductsList();
                } catch (err) {
                    showMessage(err.message, true);
                    btn.disabled = false;
                }
            });
        });

        // Stock Toggle (In stock / Sold out)
        adminProductsContainer.querySelectorAll('.admin-stock-toggle-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const isCurrentlySoldOut = btn.getAttribute('data-soldout') === 'true';
                const nextSoldOut = !isCurrentlySoldOut;

                try {
                    btn.disabled = true;
                    await api('/api/products', {
                        method: 'PATCH',
                        body: JSON.stringify({ id, sold_out: nextSoldOut })
                    });
                    showMessage(nextSoldOut ? 'Статус змінено на: Розпродано' : 'Статус змінено на: В наявності');
                    loadProductsList();
                } catch (err) {
                    showMessage(err.message, true);
                    btn.disabled = false;
                }
            });
        });

        // Delete product
        adminProductsContainer.querySelectorAll('.admin-delete-prod-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const title = btn.getAttribute('data-title');
                if (!confirm(`Ви дійсно хочете видалити товар "${title}"? Він зникне з каталогу сайту.`)) return;

                try {
                    btn.disabled = true;
                    btn.textContent = 'Видалення...';
                    await api('/api/products', {
                        method: 'DELETE',
                        body: JSON.stringify({ id })
                    });
                    showMessage(`Товар "${title}" успішно видалено.`);
                    loadProductsList();
                } catch (err) {
                    showMessage(err.message, true);
                    btn.disabled = false;
                    btn.textContent = '🗑 Видалити';
                }
            });
        });
    }

    // Submit New Product Handler
    if (createProductForm) {
        createProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            showMessage('');

            let title = document.getElementById('prodTitle')?.value.trim();
            const category = document.getElementById('prodCategory')?.value.trim();
            const brand = document.getElementById('prodBrand')?.value.trim();
            const priceUah = Number(document.getElementById('prodPriceUah')?.value);
            const priceUsd = Number(document.getElementById('prodPriceUsd')?.value) || Math.round(priceUah / 45);
            const catalogOrder = Number(document.getElementById('prodOrder')?.value) || 500;

            const isNew = Boolean(document.getElementById('prodIsNew')?.checked);
            const isPreorder = Boolean(document.getElementById('prodIsPreorder')?.checked);
            const soldOut = Boolean(document.getElementById('prodSoldOut')?.checked);

            const descUa = document.getElementById('prodDescUa')?.value.trim();
            const descEng = document.getElementById('prodDescEng')?.value.trim();

            if (!title) {
                return showMessage('Вкажіть назву товару.', true);
            }
            if (!Number.isFinite(priceUah) || priceUah <= 0) {
                return showMessage('Вкажіть коректну ціну в гривнях.', true);
            }

            // Check that at least Color 1 has at least 1 image
            const firstColor = colorVariantsState[0];
            const firstColorHasImg = firstColor && firstColor.slots.some((s) => Boolean(s.dataUrl));
            if (!firstColorHasImg) {
                return showMessage('Будь ласка, завантажте хоча б одне фото для першого кольору (Слот 1: Спереду).', true);
            }

            submitProductBtn.disabled = true;
            uploadProgressText.style.display = 'block';
            uploadProgressText.textContent = 'Завантаження та збереження фотографій у Supabase Storage...';

            try {
                // 1. Upload photos for all color variants in parallel
                const uploadedColorVariants = [];
                let totalPhotosCount = 0;

                for (let cIdx = 0; cIdx < colorVariantsState.length; cIdx++) {
                    const cVar = colorVariantsState[cIdx];
                    const activeSlots = cVar.slots.filter((s) => Boolean(s.dataUrl));

                    if (activeSlots.length > 0) {
                        const imagesToUpload = activeSlots.map((s) => ({
                            data: s.dataUrl,
                            name: s.file?.name || `color-${cIdx + 1}-slot-${s.slot}.jpg`
                        }));

                        uploadProgressText.textContent = `Завантаження фото для кольору "${cVar.labelUa || (cIdx + 1)}" (${imagesToUpload.length} шт.)...`;

                        const uploadRes = await api('/api/admin/upload', {
                            method: 'POST',
                            body: JSON.stringify({
                                slug: `${title}-${cVar.labelEng || cVar.labelUa || cIdx + 1}`,
                                images: imagesToUpload
                            })
                        });

                        const urls = Array.isArray(uploadRes.urls) ? uploadRes.urls : [];
                        totalPhotosCount += urls.length;

                        const val = (cVar.labelEng || cVar.labelUa || `color-${cIdx + 1}`)
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-+|-+$/g, '') || `color-${cIdx + 1}`;

                        uploadedColorVariants.push({
                            value: val,
                            labelUa: cVar.labelUa ? cVar.labelUa.toUpperCase() : `КОЛІР ${cIdx + 1}`,
                            labelEng: cVar.labelEng ? cVar.labelEng.toUpperCase() : `COLOR ${cIdx + 1}`,
                            gallery: urls
                        });
                    }
                }

                if (!uploadedColorVariants.length || !uploadedColorVariants[0].gallery.length) {
                    throw new Error('Не вдалося завантажити фотографії');
                }

                uploadProgressText.textContent = 'Збереження товару в базу даних...';

                // Format title if multiple colors (e.g. "NAME [2 КОЛОРА]" if not added)
                const hasMultipleColors = uploadedColorVariants.length > 1;
                if (hasMultipleColors && !/\[\d+\s+(КОЛОРА|COLORS)\]/i.test(title)) {
                    title = `${title} [${uploadedColorVariants.length} КОЛОРА]`;
                }

                const primaryGallery = uploadedColorVariants[0].gallery;
                const mainImage = primaryGallery[0] || '';
                const altImage = primaryGallery[1] || mainImage;

                // 2. Save product to Supabase DB
                await api('/api/products', {
                    method: 'POST',
                    body: JSON.stringify({
                        title,
                        category,
                        brand,
                        price_uah: priceUah,
                        price_usd: priceUsd,
                        catalog_order: catalogOrder,
                        is_new: isNew,
                        is_preorder: isPreorder,
                        sold_out: soldOut,
                        desc_ua: descUa,
                        desc_eng: descEng,
                        image: mainImage,
                        image_alt: altImage,
                        gallery: primaryGallery,
                        color_variants: hasMultipleColors ? uploadedColorVariants : []
                    })
                });

                showMessage(`Товар "${title}" (${totalPhotosCount} фото) успішно опубліковано і додано в каталог! 🎉`);
                createProductForm.reset();
                colorVariantsState = [createColorVariantState(1, 'ОСНОВНИЙ / ЧОРНИЙ', 'BLACK')];
                renderColorVariantsUI();
                loadProductsList();

            } catch (err) {
                console.error(err);
                showMessage(err.message, true);
            } finally {
                submitProductBtn.disabled = false;
                uploadProgressText.style.display = 'none';
            }
        });
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Startup Session Check
    async function init() {
        renderColorVariantsUI();
        try {
            const check = await api('/api/products', { method: 'GET' });
            if (check.success) {
                showDashboard();
                return;
            }
        } catch (e) {
            // Unauthenticated
        }
        showLogin();
    }

    init();
})();
