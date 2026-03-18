let cart = [];
let currentGalleryImages = [];
let currentImgIndex = 0;
let paymentScreenshot = null;
let orderRegion = 'ua';
let orderStep = 'payment';
let deliveryData = null;

const SUPABASE_URL = 'https://njzrkdsbzbjtxhrwezxl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K-mRHPnT6ZCkjzXHfQIthw_fjrYjFL1';
let supabase = null;

const IS_LOCALHOST = ['localhost', '127.0.0.1'].includes(window.location.hostname);

let currentUser = null;
let authMode = 'login';
let cachedOrders = [];
let authView = 'auth';

function initSupabaseClient() {
    if (supabase || !window.supabase) return false;
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    initAuth();
    return true;
}

function isLocalAuthEnabled() {
    return IS_LOCALHOST;
}

function getLocalSession() {
    const raw = localStorage.getItem('local_auth');
    if (!raw) return null;
    try {
        const data = JSON.parse(raw);
        if (data && data.email) return { email: data.email, local: true };
    } catch (e) {}
    return null;
}

function setLocalSession(email) {
    localStorage.setItem('local_auth', JSON.stringify({ email }));
}

function clearLocalSession() {
    localStorage.removeItem('local_auth');
}

function readLocalOrders() {
    const raw = localStorage.getItem('local_orders');
    if (!raw) return [];
    try {
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch (e) {
        return [];
    }
}

function writeLocalOrders(orders) {
    localStorage.setItem('local_orders', JSON.stringify(orders));
}

function getLocalUsers() {
    const raw = localStorage.getItem('local_users');
    if (!raw) return [];
    try {
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch (e) {
        return [];
    }
}

function saveLocalUsers(users) {
    localStorage.setItem('local_users', JSON.stringify(users));
}

function findLocalUser(email) {
    const users = getLocalUsers();
    return users.find((u) => u.email === email);
}

function upsertLocalUser(user) {
    const users = getLocalUsers();
    const idx = users.findIndex((u) => u.email === user.email);
    if (idx >= 0) {
        users[idx] = user;
    } else {
        users.push(user);
    }
    saveLocalUsers(users);
}

function getLocalProfile(email) {
    const user = findLocalUser(email);
    return user && user.profile ? user.profile : {};
}

function saveLocalProfile(email, profile) {
    const user = findLocalUser(email);
    if (!user) return;
    user.profile = profile;
    upsertLocalUser(user);
}

function getProfileData() {
    if (!currentUser) return {};

    let profile = {};
    if (isLocalAuthEnabled()) {
        profile = getLocalProfile(currentUser.email) || {};
    } else if (currentUser.user_metadata) {
        const meta = currentUser.user_metadata;
        if (meta.profile && typeof meta.profile === 'object') {
            profile = meta.profile;
        }
        if (meta.full_name && !profile.fullName) profile.fullName = meta.full_name;
        if (meta.phone && !profile.phone) profile.phone = meta.phone;
    }

    if (!profile.email && currentUser.email) profile.email = currentUser.email;
    return profile;
}

function getLang() {
    return localStorage.getItem('preferred_lang') || 'ua';
}

function isEmailValid(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeAttr(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function valueAttr(value) {
    return value ? `value="${escapeAttr(value)}"` : '';
}

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

    function toggleAuthModal() {
        const modal = document.getElementById('authModal');
        if (!modal) return;
        const willOpen = modal.style.display !== 'flex';
        modal.style.display = willOpen ? 'flex' : 'none';
        if (willOpen) {
            if (currentUser) {
                if (authView === 'auth') authView = 'orders';
            } else {
                authView = 'auth';
            }
        }
        updateAuthUI();
    }

    function closeAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal) modal.style.display = 'none';
    }

    function setAuthMode(mode) {
        authMode = mode;
        const loginTab = document.getElementById('authTabLogin');
        const signupTab = document.getElementById('authTabSignup');
        const submitBtn = document.getElementById('authSubmitBtn');
        const fullNameInput = document.getElementById('authFullName');
        const phoneInput = document.getElementById('authPhone');
        const lang = getLang();

        if (loginTab && signupTab) {
            loginTab.classList.toggle('active', mode === 'login');
            signupTab.classList.toggle('active', mode === 'signup');
        }
        if (submitBtn) {
            submitBtn.innerText = mode === 'login'
                ? (lang === 'ua' ? 'УВІЙТИ' : 'SIGN IN')
                : (lang === 'ua' ? 'ЗАРЕЄСТРУВАТИСЯ' : 'SIGN UP');
        }
        if (fullNameInput) fullNameInput.style.display = mode === 'signup' ? 'block' : 'none';
        if (phoneInput) phoneInput.style.display = mode === 'signup' ? 'block' : 'none';
    }

    function setAuthView(view) {
        authView = view;
        updateAuthView(true);
    }

    function updateAuthView(fromUserAction) {
        const navAuth = document.getElementById('authNavAuth');
        const navOrders = document.getElementById('authNavOrders');
        const navProfile = document.getElementById('authNavProfile');
        const authSection = document.getElementById('authSection');
        const ordersSection = document.getElementById('ordersSectionModal');
        const profileSection = document.getElementById('profileSection');
        const lang = getLang();

        let view = authView;
        if (!currentUser && (view === 'orders' || view === 'profile')) {
            view = 'auth';
            if (fromUserAction) {
                showToast(lang === 'ua' ? 'СПОЧАТКУ УВІЙДІТЬ' : 'PLEASE SIGN IN FIRST');
            }
        }
        authView = view;

        if (navAuth) navAuth.classList.toggle('active', view === 'auth');
        if (navOrders) navOrders.classList.toggle('active', view === 'orders');
        if (navProfile) navProfile.classList.toggle('active', view === 'profile');

        if (authSection) authSection.classList.toggle('active', view === 'auth');
        if (ordersSection) ordersSection.classList.toggle('active', view === 'orders');
        if (profileSection) profileSection.classList.toggle('active', view === 'profile');

        if (view === 'orders') {
            if (currentUser && cachedOrders.length === 0) {
                loadOrders();
            } else {
                renderOrders(cachedOrders);
            }
        }
        if (view === 'profile') {
            loadProfileForm();
        }
    }

    function loadProfileForm() {
        const profile = getProfileData();
        const isLoggedIn = !!currentUser;
        const emailValue = currentUser ? currentUser.email : (profile.email || '');

        const fields = [
            ['profileFullName', profile.fullName || ''],
            ['profilePhone', profile.phone || ''],
            ['profileEmail', emailValue || ''],
            ['profileTG', profile.tg || ''],
            ['profileNP', profile.np || ''],
            ['profileCountry', profile.country || ''],
            ['profileState', profile.state || ''],
            ['profilePostal', profile.postal || ''],
            ['profileCity', profile.city || ''],
            ['profilePhoneLocal', profile.phoneLocal || ''],
            ['profileNameLatin', profile.nameLatin || ''],
            ['profilePostOffice', profile.postOffice || ''],
            ['profileResidence', profile.residence || '']
        ];

        fields.forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.value = value;
            el.disabled = !isLoggedIn;
        });

        const emailEl = document.getElementById('profileEmail');
        if (emailEl && isLoggedIn) {
            emailEl.disabled = true;
        }
    }

    async function saveProfile() {
        const lang = getLang();
        if (!currentUser) {
            return showToast(lang === 'ua' ? 'СПОЧАТКУ УВІЙДІТЬ' : 'PLEASE SIGN IN FIRST');
        }

        const profile = {
            fullName: (document.getElementById('profileFullName') || {}).value || '',
            phone: (document.getElementById('profilePhone') || {}).value || '',
            email: (document.getElementById('profileEmail') || {}).value || '',
            tg: (document.getElementById('profileTG') || {}).value || '',
            np: (document.getElementById('profileNP') || {}).value || '',
            country: (document.getElementById('profileCountry') || {}).value || '',
            state: (document.getElementById('profileState') || {}).value || '',
            postal: (document.getElementById('profilePostal') || {}).value || '',
            city: (document.getElementById('profileCity') || {}).value || '',
            phoneLocal: (document.getElementById('profilePhoneLocal') || {}).value || '',
            nameLatin: (document.getElementById('profileNameLatin') || {}).value || '',
            postOffice: (document.getElementById('profilePostOffice') || {}).value || '',
            residence: (document.getElementById('profileResidence') || {}).value || ''
        };

        if (profile.email && !isEmailValid(profile.email)) {
            return showToast(lang === 'ua' ? 'НЕВІРНИЙ EMAIL' : 'INVALID EMAIL');
        }

        if (isLocalAuthEnabled()) {
            saveLocalProfile(currentUser.email, profile);
            showToast(lang === 'ua' ? 'ЗБЕРЕЖЕНО' : 'SAVED');
            return;
        }

        if (!supabase) return showToast('AUTH UNAVAILABLE');
        const { data, error } = await supabase.auth.updateUser({
            data: {
                full_name: profile.fullName,
                phone: profile.phone,
                profile: profile
            }
        });

        if (error) {
            return showToast(lang === 'ua' ? 'ПОМИЛКА ЗБЕРЕЖЕННЯ' : 'SAVE ERROR');
        }

        if (data && data.user) {
            currentUser = data.user;
            updateAuthUI();
        }
        showToast(lang === 'ua' ? 'ЗБЕРЕЖЕНО' : 'SAVED');
    }

    async function submitAuth() {
        const emailEl = document.getElementById('authEmail');
        const passEl = document.getElementById('authPassword');
        const fullNameEl = document.getElementById('authFullName');
        const phoneEl = document.getElementById('authPhone');
        const email = emailEl ? emailEl.value.trim() : '';
        const password = passEl ? passEl.value : '';
        const fullName = fullNameEl ? fullNameEl.value.trim() : '';
        const phone = phoneEl ? phoneEl.value.trim() : '';
        const lang = getLang();

        if (!email || !password || !isEmailValid(email)) {
            return showToast(lang === 'ua' ? 'ВКАЖІТЬ EMAIL ТА ПАРОЛЬ' : 'ENTER EMAIL AND PASSWORD');
        }
        if (authMode === 'signup' && (!fullName || !phone)) {
            return showToast(lang === 'ua' ? 'ВКАЖІТЬ ПІБ ТА ТЕЛЕФОН' : 'ENTER NAME AND PHONE');
        }

        if (isLocalAuthEnabled()) {
            if (authMode === 'signup') {
                const existing = findLocalUser(email);
                if (existing) {
                    return showToast(lang === 'ua' ? 'EMAIL ВЖЕ ІСНУЄ' : 'EMAIL ALREADY EXISTS');
                }
                upsertLocalUser({
                    email,
                    password,
                    profile: { fullName, phone, email }
                });
                setLocalSession(email);
                currentUser = { email, local: true };
                updateAuthUI();
                showToast(lang === 'ua' ? 'УСПІШНО' : 'SUCCESS');
                closeAuthModal();
                loadOrders();
            } else {
                const user = findLocalUser(email);
                if (user && user.password === password) {
                    setLocalSession(email);
                    currentUser = { email, local: true };
                    updateAuthUI();
                    showToast(lang === 'ua' ? 'УСПІШНО' : 'SUCCESS');
                    closeAuthModal();
                    loadOrders();
                } else {
                    showToast(lang === 'ua' ? 'НЕВІРНИЙ ЛОКАЛЬНИЙ ЛОГІН' : 'INVALID LOCAL LOGIN');
                }
            }
            return;
        }

        if (!supabase) return showToast('AUTH UNAVAILABLE');

        let result;
        if (authMode === 'login') {
            result = await supabase.auth.signInWithPassword({ email, password });
        } else {
            result = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        phone: phone,
                        profile: {
                            fullName,
                            phone,
                            email
                        }
                    }
                }
            });
        }

        if (result.error) {
            const msg = String(result.error.message || '').toLowerCase();
            const isDup = authMode === 'signup' && (msg.includes('already') || msg.includes('exists') || msg.includes('registered'));
            const isInvalidLogin = authMode === 'login' && msg.includes('invalid');
            if (isDup) {
                return showToast(lang === 'ua' ? 'EMAIL ВЖЕ ІСНУЄ' : 'EMAIL ALREADY EXISTS');
            }
            if (isInvalidLogin) {
                return showToast(lang === 'ua' ? 'НЕВІРНИЙ ЛОГІН АБО ПАРОЛЬ' : 'INVALID LOGIN OR PASSWORD');
            }
            return showToast(lang === 'ua' ? 'ПОМИЛКА АВТОРИЗАЦІЇ' : 'AUTH ERROR');
        }

        showToast(lang === 'ua' ? 'УСПІШНО' : 'SUCCESS');
        closeAuthModal();
    }

    async function logout() {
        if (isLocalAuthEnabled()) {
            clearLocalSession();
            currentUser = null;
            cachedOrders = [];
            updateAuthUI();
            closeAuthModal();
            return;
        }
        if (!supabase) return;
        await supabase.auth.signOut();
        closeAuthModal();
    }

    async function initAuth() {
        if (isLocalAuthEnabled()) {
            currentUser = getLocalSession();
            updateAuthUI();
            if (currentUser) await loadOrders();
            return;
        }
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        currentUser = data.session ? data.session.user : null;
        updateAuthUI();
        if (currentUser) await loadOrders();

        supabase.auth.onAuthStateChange((_event, session) => {
            currentUser = session ? session.user : null;
            updateAuthUI();
            if (currentUser) {
                loadOrders();
            } else {
                cachedOrders = [];
                renderOrders(cachedOrders);
            }
        });
    }

    function updateAuthUI() {
        const statusEl = document.getElementById('authStatus');
        const formEl = document.getElementById('authForm');
        const logoutBtn = document.getElementById('authLogoutBtn');
        const tabsEl = document.getElementById('authTabs');
        const accountBtn = document.getElementById('accountBtn');
        const navWrap = document.getElementById('authNav');
        const navAuth = document.getElementById('authNavAuth');
        const navOrders = document.getElementById('authNavOrders');
        const navProfile = document.getElementById('authNavProfile');
        const lang = getLang();

        if (currentUser) {
            if (statusEl) {
                statusEl.innerText = lang === 'ua'
                    ? `Ви увійшли як ${currentUser.email}`
                    : `Signed in as ${currentUser.email}`;
            }
            if (formEl) formEl.style.display = 'none';
            if (tabsEl) tabsEl.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'block';
            if (accountBtn) accountBtn.classList.add('logged-in');
            if (navWrap) navWrap.style.display = 'flex';
            if (navAuth) navAuth.style.display = 'inline-flex';
            if (navOrders) navOrders.style.display = 'inline-flex';
            if (navProfile) navProfile.style.display = 'inline-flex';
        } else {
            if (statusEl) {
                statusEl.innerText = lang === 'ua'
                    ? 'Ви не увійшли'
                    : 'You are not signed in';
            }
            if (formEl) formEl.style.display = 'block';
            if (tabsEl) tabsEl.style.display = 'flex';
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (accountBtn) accountBtn.classList.remove('logged-in');
            if (navWrap) navWrap.style.display = 'none';
            if (navAuth) navAuth.style.display = 'none';
            if (navOrders) navOrders.style.display = 'none';
            if (navProfile) navProfile.style.display = 'none';
            authView = 'auth';
        }

        setAuthMode(authMode);
        updateAuthView(false);
        renderOrders(cachedOrders);
    }

    async function loadOrders() {
        if (isLocalAuthEnabled()) {
            if (!currentUser) return;
            const all = readLocalOrders();
            cachedOrders = all
                .filter((order) => order && order.email === currentUser.email)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            renderOrders(cachedOrders);
            return;
        }
        if (!supabase || !currentUser) return;
        const lang = getLang();
        const { data, error } = await supabase
            .from('orders')
            .select('id, created_at, total, currency, items, region')
            .order('created_at', { ascending: false });

        if (error) {
            showToast(lang === 'ua' ? 'ПОМИЛКА ЗАВАНТАЖЕННЯ ЗАМОВЛЕНЬ' : 'ORDER LOAD ERROR');
            return;
        }

        cachedOrders = Array.isArray(data) ? data : [];
        renderOrders(cachedOrders);
    }

    function formatOrderDate(iso, lang) {
        try {
            const locale = lang === 'ua' ? 'uk-UA' : 'en-US';
            return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: '2-digit' });
        } catch (e) {
            return iso || '';
        }
    }

    function formatCurrencyLabel(code, lang) {
        if (code === 'UAH') return lang === 'ua' ? ' грн' : ' UAH';
        if (code === 'USD') return ' $';
        return ` ${code || ''}`;
    }

    function renderOrdersList(list, empty, orders, lang, loggedIn) {
        if (!list || !empty) return;

        if (!loggedIn) {
            empty.style.display = 'block';
            empty.innerText = lang === 'ua' ? 'Увійдіть, щоб переглянути історію.' : 'Sign in to view your order history.';
            list.innerHTML = '';
            return;
        }

        if (!orders || orders.length === 0) {
            empty.style.display = 'block';
            empty.innerText = lang === 'ua' ? 'Замовлень поки немає.' : 'No orders yet.';
            list.innerHTML = '';
            return;
        }

        empty.style.display = 'none';
        const t = {
            date: lang === 'ua' ? 'Дата' : 'Date',
            order: lang === 'ua' ? 'Замовлення' : 'Order',
            total: lang === 'ua' ? 'Сума' : 'Total'
        };

        list.innerHTML = orders.map((order) => {
            const currencyLabel = formatCurrencyLabel(order.currency, lang);
            const items = Array.isArray(order.items) ? order.items : [];
            const itemsHtml = items.map((item) => {
                const name = escapeHtml(item.name);
                const size = escapeHtml(item.size);
                const price = item.price != null ? item.price : '';
                return `<div>${name} (${size}) — ${price}${currencyLabel}</div>`;
            }).join('');
            const dateText = formatOrderDate(order.created_at, lang);
            const orderId = order.id ? String(order.id).slice(0, 8).toUpperCase() : '';

            return `
                <div class="order-card">
                    <div class="order-meta">${t.date}: ${dateText} • ${t.order}: ${orderId}</div>
                    <div class="order-items">${itemsHtml}</div>
                    <div class="order-total">${t.total}: ${order.total}${currencyLabel}</div>
                </div>
            `;
        }).join('');
    }

    function renderOrders(orders) {
        const lang = getLang();
        const loggedIn = !!currentUser;

        const section = document.getElementById('ordersSection');
        const list = document.getElementById('ordersList');
        const empty = document.getElementById('ordersEmpty');
        if (section && list && empty) {
            if (!loggedIn) {
                section.style.display = 'none';
            } else {
                section.style.display = 'block';
                renderOrdersList(list, empty, orders, lang, true);
            }
        }

        const modalList = document.getElementById('ordersListModal');
        const modalEmpty = document.getElementById('ordersEmptyModal');
        if (modalList && modalEmpty) {
            renderOrdersList(modalList, modalEmpty, orders, lang, loggedIn);
        }
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
        const userEmail = currentUser ? currentUser.email : '';
        const emailAttr = userEmail ? `value="${userEmail}" disabled` : '';

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
            
            <button class="buy-btn" id="payBtn" style="margin-top:20px; opacity: 0.5;" onclick="finalizeOrder()" disabled>${t.btn}</button>
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
        const profile = getProfileData();

        const t = {
            title: lang === 'ua' ? 'ДОСТАВКА' : 'DELIVERY',
            fio: lang === 'ua' ? 'ПІБ' : 'Full Name',
            phone: lang === 'ua' ? 'Номер телефону' : 'Phone Number',
            np: lang === 'ua' ? 'Місто та № відділення НП' : 'City & Nova Poshta Dept',
            tg: lang === 'ua' ? "Ваш Telegram (необов'язково)" : "Your Telegram (optional)",
            btn: lang === 'ua' ? 'ДАЛІ ДО ОПЛАТИ' : 'NEXT: PAYMENT',

            country: lang === 'ua' ? 'Країна' : 'Country',
            state: lang === 'ua' ? 'Штат/регіон' : 'State/Region',
            postal: lang === 'ua' ? 'Поштовий індекс' : 'Postal Code',
            city: lang === 'ua' ? 'Населений пункт' : 'City',
            phoneLocal: lang === 'ua' ? 'Мобільний номер місцевого оператора' : 'Local mobile number',
            nameLatin: lang === 'ua' ? 'ПІБ латиницею' : 'Full name (Latin)',
            emailOptional: lang === 'ua' ? 'Email (необов\'язково)' : 'Email (optional)',
            emailRequired: lang === 'ua' ? 'Email' : 'Email',
            postOffice: lang === 'ua' ? 'Адреса і номер відділення пошти' : 'Post office address and number',
            residence: lang === 'ua' ? 'Адреса фактичного проживання' : 'Residential address'
        };

        const regionSwitch = renderRegionSwitch(lang);
        const userEmail = currentUser ? currentUser.email : '';
        const emailValue = userEmail || profile.email || '';
        const emailAttr = emailValue ? `value="${escapeAttr(emailValue)}"${currentUser ? ' disabled' : ''}` : '';

        const uaFields = `
            <input type="text" id="orderFIO" placeholder="${t.fio}" ${valueAttr(profile.fullName)}>
            <input type="text" id="orderPhone" placeholder="${t.phone}" ${valueAttr(profile.phone)}>
            <input type="text" id="orderNP" placeholder="${t.np}" ${valueAttr(profile.np)}>
            <input type="email" id="orderEmailUa" placeholder="${t.emailOptional}" ${emailAttr}>
            <input type="text" id="orderTG" placeholder="${t.tg}" ${valueAttr(profile.tg)}>
        `;

        const worldFields = `
            <input type="text" id="orderCountry" placeholder="${t.country}" ${valueAttr(profile.country)}>
            <input type="text" id="orderState" placeholder="${t.state}" ${valueAttr(profile.state)}>
            <input type="text" id="orderPostal" placeholder="${t.postal}" ${valueAttr(profile.postal)}>
            <input type="text" id="orderCity" placeholder="${t.city}" ${valueAttr(profile.city)}>
            <input type="text" id="orderPhoneLocal" placeholder="${t.phoneLocal}" ${valueAttr(profile.phoneLocal)}>
            <input type="text" id="orderNameLatin" placeholder="${t.nameLatin}" ${valueAttr(profile.nameLatin)}>
            <input type="email" id="orderEmail" placeholder="${t.emailRequired}" ${emailAttr}>
            <textarea id="orderPostOffice" placeholder="${t.postOffice}">${escapeHtml(profile.postOffice || '')}</textarea>
            <textarea id="orderResidence" placeholder="${t.residence}">${escapeHtml(profile.residence || '')}</textarea>
        `;

        document.getElementById('orderModalContent').innerHTML = `
            <div class="close-btn" onclick="closeOrderForm()">&#10005;</div>
            <h2 style="color: var(--blood); margin-bottom: 15px;">${t.title}</h2>
            ${regionSwitch}
            <div class="order-form">
                ${orderRegion === 'ua' ? uaFields : worldFields}
                <button class="buy-btn" id="confirmBtn" onclick="proceedToPayment()">${t.btn}</button>
            </div>
        `;
        document.getElementById('orderModal').style.display = 'flex';
    }

    function proceedToPayment() {
        const lang = localStorage.getItem('preferred_lang') || 'ua';
        const msgErrUa = lang === 'ua' ? 'ПЕРЕВІРТЕ ДАНІ ТА НОМЕР!' : 'CHECK DATA & NUMBER!';
        const msgErrWorld = lang === 'ua' ? 'ЗАПОВНІТЬ УСІ ПОЛЯ (EMAIL)!' : 'FILL ALL FIELDS (EMAIL)!';
        const msgBadEmail = lang === 'ua' ? 'НЕВІРНИЙ EMAIL' : 'INVALID EMAIL';

        if (orderRegion === 'ua') {
            const fio = document.getElementById('orderFIO').value;
            const phoneRaw = document.getElementById('orderPhone').value;
            const phone = phoneRaw.replace(/\\D/g, '');
            const np = document.getElementById('orderNP').value;
            const email = document.getElementById('orderEmailUa').value.trim();
            const tg = document.getElementById('orderTG').value;

            if (!fio || phone.length < 10 || !np) return showToast(msgErrUa);
            if (email && !isEmailValid(email)) return showToast(msgBadEmail);

            deliveryData = {
                region: 'ua',
                data: { fio, phone, np, email, tg }
            };
        } else {
            const country = document.getElementById('orderCountry').value.trim();
            const state = document.getElementById('orderState').value.trim();
            const postal = document.getElementById('orderPostal').value.trim();
            const city = document.getElementById('orderCity').value.trim();
            const phoneLocalRaw = document.getElementById('orderPhoneLocal').value.trim();
            const phoneLocalDigits = phoneLocalRaw.replace(/\\D/g, '');
            const nameLatin = document.getElementById('orderNameLatin').value.trim();
            const email = document.getElementById('orderEmail').value.trim();
            const postOffice = document.getElementById('orderPostOffice').value.trim();
            const residence = document.getElementById('orderResidence').value.trim();

            const emailOk = isEmailValid(email);

            if (!country || !state || !postal || !city || !phoneLocalRaw || phoneLocalDigits.length < 6 || !nameLatin || !email || !emailOk || !postOffice || !residence) {
                return showToast(msgErrWorld);
            }
            if (!emailOk) return showToast(msgBadEmail);

            deliveryData = {
                region: 'world',
                data: {
                    country,
                    state,
                    postal,
                    city,
                    phoneLocal: phoneLocalRaw,
                    nameLatin,
                    email,
                    postOffice,
                    residence
                }
            };
        }

        renderOrderPayment();
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
                <p>${t.questions} <a href="https://t.me/Hardcore_Division_bot" target="_blank" rel="noopener noreferrer" style="color: var(--blood); text-decoration: none;">@Hardcore_Division_bot</a></p>
            </div>
            <button class="buy-btn" style="margin-top:20px;" onclick="closeOrderForm()">${t.btn}</button>
        `;
        document.getElementById('orderModal').style.display = 'flex';
    }

    async function finalizeOrder() {
        const lang = getLang();
        const btn = document.getElementById('payBtn');

        const msgErrUa = lang === 'ua' ? 'ПЕРЕВІРТЕ ДАНІ ТА НОМЕР!' : 'CHECK DATA & NUMBER!';
        const msgErrWorld = lang === 'ua' ? 'ЗАПОВНІТЬ УСІ ПОЛЯ (EMAIL)!' : 'FILL ALL FIELDS (EMAIL)!';
        const msgBadEmail = lang === 'ua' ? 'НЕВІРНИЙ EMAIL' : 'INVALID EMAIL';
        const msgNeedScreenshot = lang === 'ua' ? 'ДОДАЙ СКРІНШОТ!' : 'ADD SCREENSHOT!';
        const msgNeedDelivery = lang === 'ua' ? 'СПОЧАТКУ ЗАПОВНІТЬ ДОСТАВКУ!' : 'FILL DELIVERY FIRST!';
        const msgWait = lang === 'ua' ? 'ВІДПРАВКА...' : 'SENDING...';
        const msgSuccess = lang === 'ua' ? 'ЗАМОВЛЕННЯ ПРИЙНЯТО! 🩸' : 'ORDER RECEIVED! 🩸';
        const msgFail = lang === 'ua' ? 'ПОМИЛКА ВІДПРАВКИ!' : 'SENDING ERROR!';
        const msgDbWarn = lang === 'ua' ? 'ЗАМОВЛЕННЯ ПРИЙНЯТО, АЛЕ ІСТОРІЯ МОЖЕ НЕ ОНОВИТИСЬ' : 'ORDER RECEIVED, BUT HISTORY MAY NOT UPDATE';
        const payLabel = lang === 'ua' ? 'Я ОПЛАТИВ' : 'I PAID';

        if (!paymentScreenshot) return showToast(msgNeedScreenshot);
        if (!deliveryData || deliveryData.region !== orderRegion) {
            showToast(msgNeedDelivery);
            renderDeliveryForm();
            return;
        }

        btn.innerText = msgWait;
        btn.disabled = true;

        const currencySymbol = lang === 'ua' ? '₴' : '$';
        const currencyCode = lang === 'ua' ? 'UAH' : 'USD';
        let total = cart.reduce((sum, i) => sum + (lang === 'ua' ? i.uah : i.usd), 0);
        let itemsInfo = cart.map((item, idx) => {
            const price = lang === 'ua' ? item.uah : item.usd;
            return `${idx + 1}. ${escapeHtml(item.name)} (${escapeHtml(item.size)}) — ${price}${currencySymbol}`;
        }).join('\n');
        let itemsPayload = cart.map((item) => ({
            name: item.name,
            size: item.size,
            price: lang === 'ua' ? item.uah : item.usd,
            currency: currencyCode
        }));
        let messageText = '';
        let orderEmail = '';
        let orderPhone = '';

        if (orderRegion === 'ua') {
            const fio = deliveryData.data.fio;
            const phone = deliveryData.data.phone;
            const np = deliveryData.data.np;
            const email = deliveryData.data.email;
            const tg = deliveryData.data.tg;

            if (!fio || !phone || phone.length < 10 || !np) {
                btn.innerText = payLabel;
                btn.disabled = false;
                return showToast(msgErrUa);
            }
            if (email && !isEmailValid(email)) {
                btn.innerText = payLabel;
                btn.disabled = false;
                return showToast(msgBadEmail);
            }

            const fioSafe = escapeHtml(fio);
            const phoneSafe = escapeHtml(phone);
            const npSafe = escapeHtml(np);
            const emailSafe = escapeHtml(email);
            const tgSafe = tg ? escapeHtml(tg) : '';

            const emailText = email ? `\n📧 <b>Email:</b> ${emailSafe}` : '';
            const tgText = tg ? `\n✈️ <b>TG:</b> ${tgSafe}` : '';

            messageText = `<b>💀 НОВЕ ЗАМОВЛЕННЯ 💀</b>\n\n👤 <b>ПІБ:</b> ${fioSafe}\n📞 <b>Тел:</b> ${phoneSafe}${emailText}${tgText}\n📦 <b>НП:</b> ${npSafe}\n\n${itemsInfo}\n<b>💰 СУМА: ${total}${currencySymbol}</b>`;
            orderEmail = email;
            orderPhone = phone;
        } else {
            const country = deliveryData.data.country;
            const state = deliveryData.data.state;
            const postal = deliveryData.data.postal;
            const city = deliveryData.data.city;
            const phoneLocalRaw = deliveryData.data.phoneLocal;
            const phoneLocalDigits = phoneLocalRaw.replace(/\D/g, '');
            const nameLatin = deliveryData.data.nameLatin;
            const email = deliveryData.data.email;
            const postOffice = deliveryData.data.postOffice;
            const residence = deliveryData.data.residence;

            const emailOk = isEmailValid(email);

            if (!country || !state || !postal || !city || !phoneLocalRaw || phoneLocalDigits.length < 6 || !nameLatin || !email || !emailOk || !postOffice || !residence) {
                btn.innerText = payLabel;
                btn.disabled = false;
                return showToast(msgErrWorld);
            }
            if (!emailOk) {
                btn.innerText = payLabel;
                btn.disabled = false;
                return showToast(msgBadEmail);
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

            const emailLine = email ? `\n📧 <b>${labels.email}:</b> ${escapeHtml(email)}` : '';
            messageText = `<b>💀 ${labels.order} 💀</b>\n\n🌍 <b>${labels.delivery}:</b> ${escapeHtml(labels.region)}\n👤 <b>${labels.nameLatin}:</b> ${escapeHtml(nameLatin)}\n📞 <b>${labels.phone}:</b> ${escapeHtml(phoneLocalRaw)}${emailLine}\n🏷️ <b>${labels.country}:</b> ${escapeHtml(country)}\n🏷️ <b>${labels.state}:</b> ${escapeHtml(state)}\n🏷️ <b>${labels.postal}:</b> ${escapeHtml(postal)}\n🏷️ <b>${labels.city}:</b> ${escapeHtml(city)}\n📮 <b>${labels.postOffice}:</b> ${escapeHtml(postOffice)}\n🏠 <b>${labels.residence}:</b> ${escapeHtml(residence)}\n\n${itemsInfo}\n<b>💰 ${labels.sum}: ${total}${currencySymbol}</b>`;
            orderEmail = email;
            orderPhone = phoneLocalRaw;
        }

        const orderPayload = {
            email: orderEmail,
            phone: orderPhone,
            region: orderRegion,
            currency: currencyCode,
            total: total,
            items: itemsPayload,
            delivery: deliveryData
        };

        if (isLocalAuthEnabled()) {
            const orders = readLocalOrders();
            const orderId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            orders.push({
                id: orderId,
                created_at: new Date().toISOString(),
                email: orderPayload.email,
                phone: orderPayload.phone,
                region: orderPayload.region,
                currency: orderPayload.currency,
                total: orderPayload.total,
                items: orderPayload.items
            });
            writeLocalOrders(orders);
            showToast(msgSuccess);
            cart = [];
            document.getElementById('cart-count').innerText = 0;
            paymentScreenshot = null;
            deliveryData = null;
            orderRegion = 'ua';
            renderOrderSuccess();
            loadOrders();
            return;
        }

        let authToken = null;
        if (supabase) {
            const sessionData = await supabase.auth.getSession();
            authToken = sessionData.data.session ? sessionData.data.session.access_token : null;
        }

        try {
            const response = await fetch('/api/send', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    message: messageText,
                    image: paymentScreenshot,
                    order: orderPayload,
                    authToken
                })
            });
            const result = await response.json().catch(() => ({}));
            if (response.ok) {
                showToast(msgSuccess);
                if (result && result.dbStored === false) {
                    showToast(msgDbWarn);
                }
                cart = [];
                document.getElementById('cart-count').innerText = 0;
                paymentScreenshot = null;
                deliveryData = null;
                orderRegion = 'ua';
                renderOrderSuccess();
                if (currentUser) loadOrders();
            } else {
                throw new Error();
            }
        } catch (e) {
            showToast(msgFail);
            btn.innerText = payLabel;
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
    updateAuthUI();
}

function updatePrices(lang) {
  document.querySelectorAll('.price').forEach(el => {
    el.innerText = lang === 'ua' ? el.getAttribute('data-uah') : el.getAttribute('data-usd');
  });
}

// Запускаем проверку языка сразу при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const savedLang = getLang();
    setLang(savedLang);
    if (isLocalAuthEnabled()) {
        initAuth();
    }
    initSupabaseClient();
    setTimeout(initSupabaseClient, 300);
    setTimeout(initSupabaseClient, 1200);
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
    link.rel = "noopener noreferrer";
}

function exposeGlobals() {
    Object.assign(window, {
        toggleSizePanel,
        setSizeType,
        openGallery,
        closeGallery,
        changeImg,
        toggleCart,
        addToCart,
        removeFromCart,
        toggleFAQ,
        openOrderForm,
        handleFileSelect,
        setOrderRegion,
        renderOrderPayment,
        proceedToPayment,
        closeOrderForm,
        finalizeOrder,
        openPrivacy,
        closePrivacy,
        filterProducts,
        setLang,
        toggleAuthModal,
        setAuthView,
        setAuthMode,
        submitAuth,
        logout,
        saveProfile,
        copyVal
    });
}

exposeGlobals();

 




