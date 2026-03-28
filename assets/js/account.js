const PHONE_COUNTRIES = [
    { code: '380', label: 'Ukraine', example: '0661234567', localMin: 9, localMax: 9, stripLeadingZero: true },
    { code: '1', label: 'USA', example: '2025550123', localMin: 10, localMax: 10, stripLeadingZero: false },
    { code: '43', label: 'Austria', example: '6641234567' },
    { code: '32', label: 'Belgium', example: '470123456' },
    { code: '359', label: 'Bulgaria', example: '881234567' },
    { code: '385', label: 'Croatia', example: '911234567' },
    { code: '357', label: 'Cyprus', example: '96123456' },
    { code: '420', label: 'Czechia', example: '601123456' },
    { code: '45', label: 'Denmark', example: '20123456' },
    { code: '372', label: 'Estonia', example: '51234567' },
    { code: '358', label: 'Finland', example: '401234567' },
    { code: '33', label: 'France', example: '612345678', stripLeadingZero: true },
    { code: '49', label: 'Germany', example: '15123456789', stripLeadingZero: true },
    { code: '30', label: 'Greece', example: '6912345678' },
    { code: '36', label: 'Hungary', example: '201234567', stripLeadingZero: true },
    { code: '354', label: 'Iceland', example: '6112345' },
    { code: '353', label: 'Ireland', example: '851234567', stripLeadingZero: true },
    { code: '39', label: 'Italy', example: '3123456789' },
    { code: '371', label: 'Latvia', example: '21234567' },
    { code: '370', label: 'Lithuania', example: '61234567' },
    { code: '352', label: 'Luxembourg', example: '621234567' },
    { code: '356', label: 'Malta', example: '99123456' },
    { code: '31', label: 'Netherlands', example: '612345678', stripLeadingZero: true },
    { code: '47', label: 'Norway', example: '41234567' },
    { code: '48', label: 'Poland', example: '512345678' },
    { code: '351', label: 'Portugal', example: '912345678' },
    { code: '40', label: 'Romania', example: '712345678', stripLeadingZero: true },
    { code: '421', label: 'Slovakia', example: '901234567', stripLeadingZero: true },
    { code: '386', label: 'Slovenia', example: '31123456' },
    { code: '34', label: 'Spain', example: '612345678' },
    { code: '46', label: 'Sweden', example: '701234567', stripLeadingZero: true },
    { code: '41', label: 'Switzerland', example: '791234567', stripLeadingZero: true },
    { code: '44', label: 'United Kingdom', example: '7123456789', stripLeadingZero: true },
    { code: '355', label: 'Albania', example: '671234567', stripLeadingZero: true },
    { code: '376', label: 'Andorra', example: '312345' },
    { code: '387', label: 'Bosnia & Herzegovina', example: '61123456', stripLeadingZero: true },
    { code: '382', label: 'Montenegro', example: '67123456', stripLeadingZero: true },
    { code: '389', label: 'North Macedonia', example: '70123456', stripLeadingZero: true },
    { code: '373', label: 'Moldova', example: '62123456', stripLeadingZero: true },
    { code: '381', label: 'Serbia', example: '601234567', stripLeadingZero: true },
    { code: '378', label: 'San Marino', example: '66123456' },
    { code: '423', label: 'Liechtenstein', example: '660123456' },
    { code: '377', label: 'Monaco', example: '612345678' },
    { code: '383', label: 'Kosovo', example: '43123456' },
    { code: '994', label: 'Azerbaijan', example: '501234567', stripLeadingZero: true },
    { code: '995', label: 'Georgia', example: '555123456', stripLeadingZero: true }
].map((item) => ({
    localMin: 6,
    localMax: 12,
    stripLeadingZero: true,
    ...item
}));

const COUNTRY_BY_CODE = new Map(PHONE_COUNTRIES.map((item) => [item.code, item]));

const statusesUaToEng = {
    'Пакування': 'Packing',
    'Відправка (Нова Пошта, накладений платіж)': 'Shipping (Nova Poshta, COD)',
    'Завершено': 'Completed'
};

const authArea = document.getElementById('authArea');
const accountArea = document.getElementById('accountArea');
const accountPhone = document.getElementById('accountPhone');
const ordersList = document.getElementById('ordersList');
const accountMessage = document.getElementById('accountMessage');
const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');
const showLoginBtn = document.getElementById('showLoginBtn');
const showRegisterBtn = document.getElementById('showRegisterBtn');
const langUaBtn = document.getElementById('lang-ua');
const langEngBtn = document.getElementById('lang-eng');
const logoutBtn = document.getElementById('logoutBtn');
const loginCountry = document.getElementById('loginCountry');
const registerCountry = document.getElementById('registerCountry');
const loginPhoneLocal = document.getElementById('loginPhoneLocal');
const registerPhoneLocal = document.getElementById('registerPhoneLocal');

let currentOrders = [];
let hasActiveSessionUI = false;
const LAST_USER_PHONE_KEY = 'hd_last_user_phone';

const ui = {
    ua: {
        noOrders: 'Замовлень поки немає.',
        status: 'Статус',
        total: 'Сума',
        invalidName: "Введіть коректне ПІБ (мінімум 2 символи).",
        invalidPhone: 'Оберіть країну і введіть коректний номер телефону.',
        weakPassword: 'Пароль має містити щонайменше 8 символів',
        registerOk: 'Реєстрація успішна. Ви увійшли в акаунт.',
        loginOk: 'Вхід виконано успішно.',
        logoutOk: 'Ви вийшли з акаунту.',
        policyDelivery: 'Доставка і оплата'
    },
    eng: {
        noOrders: 'No orders yet.',
        status: 'Status',
        total: 'Total',
        invalidName: 'Enter a valid full name (at least 2 characters).',
        invalidPhone: 'Choose a country and enter a valid phone number.',
        weakPassword: 'Password must contain at least 8 characters',
        registerOk: 'Registration successful. You are now signed in.',
        loginOk: 'Signed in successfully.',
        logoutOk: 'Signed out successfully.',
        policyDelivery: 'Delivery & Payment'
    }
};

function getLang() {
    const saved = localStorage.getItem('preferred_lang');
    return saved === 'eng' ? 'eng' : 'ua';
}

function t(key) {
    const lang = getLang();
    return (ui[lang] && ui[lang][key]) || ui.ua[key] || key;
}

function getCountryConfig(code) {
    return COUNTRY_BY_CODE.get(String(code || '')) || COUNTRY_BY_CODE.get('380');
}

function normalizeLocalDigits(value, countryConfig) {
    let digits = String(value || '').replace(/\D/g, '');
    if (countryConfig.stripLeadingZero && digits.startsWith('0')) {
        digits = digits.slice(1);
    }
    return digits;
}

function buildPhonePayload(countryCode, localPhoneRaw) {
    const country = getCountryConfig(countryCode);
    const localDigits = normalizeLocalDigits(localPhoneRaw, country);

    return {
        country,
        localDigits,
        phone: `+${country.code}${localDigits}`
    };
}

function isValidPhonePayload(payload) {
    if (!payload || !payload.country) return false;
    const len = payload.localDigits.length;
    return len >= payload.country.localMin && len <= payload.country.localMax;
}

function isValidFullName(value) {
    const fullName = String(value || '').trim();
    if (fullName.length < 2 || fullName.length > 80) return false;
    return /[A-Za-zА-Яа-яІіЇїЄєҐґ]/.test(fullName);
}

function setPhoneInputMeta(selectEl, inputEl) {
    if (!selectEl || !inputEl) return;
    const country = getCountryConfig(selectEl.value);
    inputEl.placeholder = country.example || '';
    inputEl.maxLength = Math.max(country.localMax + (country.stripLeadingZero ? 1 : 0), 6);
}

function setupPhoneFields() {
    const controls = [
        { select: loginCountry, input: loginPhoneLocal },
        { select: registerCountry, input: registerPhoneLocal }
    ];

    controls.forEach(({ select, input }) => {
        if (!select || !input) return;

        select.innerHTML = PHONE_COUNTRIES
            .map((item) => `<option value="${item.code}">${item.label} (+${item.code})</option>`)
            .join('');
        select.value = '380';

        setPhoneInputMeta(select, input);

        select.addEventListener('change', () => setPhoneInputMeta(select, input));
        input.addEventListener('input', () => {
            input.value = input.value.replace(/\D/g, '');
        });
    });
}

function translateStatus(status) {
    const lang = getLang();
    if (lang === 'ua') return status;
    return statusesUaToEng[status] || status;
}

function setAuthView(view) {
    const isLogin = view === 'login';
    loginForm.hidden = !isLogin;
    registerForm.hidden = isLogin;
    showLoginBtn.classList.toggle('active', isLogin);
    showRegisterBtn.classList.toggle('active', !isLogin);
}

function showMessage(text, isError = false) {
    accountMessage.textContent = text || '';
    accountMessage.classList.toggle('error', Boolean(text) && isError);
    accountMessage.classList.toggle('success', Boolean(text) && !isError);
}

async function api(url, options = {}) {
    const response = await fetch(url, {
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
        throw new Error(payload.error || 'Request failed');
    }

    return payload;
}

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return getLang() === 'ua' ? date.toLocaleString('uk-UA') : date.toLocaleString('en-GB');
}

function renderOrders(orders) {
    currentOrders = Array.isArray(orders) ? orders : [];

    if (!currentOrders.length) {
        ordersList.innerHTML = `<div class="order-card">${t('noOrders')}</div>`;
        return;
    }

    ordersList.innerHTML = currentOrders.map((order) => {
        const items = Array.isArray(order.order_items) ? order.order_items : [];
        const rows = items.map((item) => {
            const sizeText = item.size ? `, size ${item.size}` : '';
            return `<li>${item.quantity} x ${item.title}${sizeText} - ${item.price}</li>`;
        }).join('');

        return `
            <article class="order-card">
                <div class="order-head">
                    <strong>ID: ${order.id}</strong>
                    <span>${formatDate(order.created_at)}</span>
                </div>
                <div class="order-status">${t('status')}: ${translateStatus(order.status)}</div>
                <div class="order-total">${t('total')}: ${order.total_price}</div>
                <ul class="order-items">${rows}</ul>
            </article>
        `;
    }).join('');
}

function syncHeaderAccountState(isAuthenticated) {
    document.querySelectorAll('.account-icon-btn').forEach((button) => {
        button.classList.toggle('account-btn-auth', isAuthenticated);
    });
}

function setAuthenticated(user) {
    authArea.hidden = true;
    accountArea.hidden = false;
    logoutBtn.hidden = false;
    accountPhone.textContent = user.phone;
    hasActiveSessionUI = true;
    localStorage.setItem(LAST_USER_PHONE_KEY, String(user.phone || ''));
    syncHeaderAccountState(true);
}

function setGuest(force = false) {
    if (hasActiveSessionUI && !force) return;
    authArea.hidden = false;
    accountArea.hidden = true;
    logoutBtn.hidden = true;
    setAuthView('login');
    accountPhone.textContent = '-';
    ordersList.innerHTML = '';
    hasActiveSessionUI = false;
    localStorage.removeItem(LAST_USER_PHONE_KEY);
    syncHeaderAccountState(false);
}

async function loadOrders() {
    const data = await api('/api/orders/get', { method: 'GET' });
    renderOrders(Array.isArray(data.orders) ? data.orders : []);
}

function applyLanguage(lang) {
    localStorage.setItem('preferred_lang', lang);
    document.body.classList.toggle('lang-ua', lang === 'ua');
    document.body.classList.toggle('lang-eng', lang === 'eng');

    document.querySelectorAll('[data-ua]').forEach((el) => {
        const value = el.getAttribute(`data-${lang}`);
        if (value != null) {
            el.innerHTML = value;
        }
    });

    langUaBtn.classList.toggle('active', lang === 'ua');
    langEngBtn.classList.toggle('active', lang === 'eng');

    updateContact();
    if (!authArea.hidden) {
        showMessage('');
    }
    renderOrders(currentOrders);
}

function updateContact() {
    const lang = getLang();
    const title = document.getElementById('contact-title');
    const link = document.getElementById('contact-link');
    if (!title || !link) return;

    title.textContent = lang === 'ua' ? 'Контакт оператора (Telegram)' : 'Operator Contact (Telegram)';

    const handleEl = link.querySelector('.operator-handle');
    if (handleEl) {
        handleEl.textContent = '@Hardcore_Division_bot';
    }

    link.href = 'https://t.me/Hardcore_Division_bot';
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

    const lang = getLang();
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
                    '• Повернення можливе лише у разі помилки з боку магазину (не той товар, виробничий дефект або неправильна комплектація).',
                    '• Якщо не підійшов розмір або товар просто не сподобався, повернення не здійснюється.',
                    '• Для розв’язання спірних ситуацій звертайтесь в підтримку магазину.'
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

    if (type === 'privacy') {
        openPrivacy();
        return;
    }

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

async function init() {
    setupPhoneFields();

    try {
        const me = await api('/api/auth/me', { method: 'GET', cache: 'no-store' });
        if (me.authenticated && me.role === 'user' && me.user) {
            setAuthenticated(me.user);
            await loadOrders();
        } else {
            setGuest(true);
        }
    } catch (e) {
        const knownPhone = localStorage.getItem(LAST_USER_PHONE_KEY);
        if (knownPhone) {
            setAuthenticated({ phone: knownPhone });
            try {
                await loadOrders();
            } catch (loadErr) {
                if ((loadErr && loadErr.message) === 'Authentication required') {
                    setGuest(true);
                }
            }
        } else {
            setGuest(true);
        }
    }

    applyLanguage(getLang());
}

registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage('');

    const fullName = document.getElementById('registerFullName').value.trim();
    const phonePayload = buildPhonePayload(registerCountry.value, registerPhoneLocal.value);
    const phone = phonePayload.phone;
    const password = document.getElementById('registerPassword').value;

    if (!isValidFullName(fullName)) {
        showMessage(t('invalidName'), true);
        return;
    }

    if (!isValidPhonePayload(phonePayload)) {
        showMessage(t('invalidPhone'), true);
        return;
    }

    if (password.length < 8) {
        showMessage(t('weakPassword'), true);
        return;
    }

    try {
        const data = await api('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ full_name: fullName, phone, password })
        });

        setAuthenticated(data.user);
        await loadOrders();
        showMessage(t('registerOk'));
        event.target.reset();
    } catch (e) {
        showMessage(e.message, true);
    }
});

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage('');

    const phonePayload = buildPhonePayload(loginCountry.value, loginPhoneLocal.value);
    const phone = phonePayload.phone;
    const password = document.getElementById('loginPassword').value;

    if (!isValidPhonePayload(phonePayload)) {
        showMessage(t('invalidPhone'), true);
        return;
    }

    try {
        const data = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ phone, password })
        });

        setAuthenticated(data.user);
        await loadOrders();
        showMessage(t('loginOk'));
        event.target.reset();
    } catch (e) {
        showMessage(e.message, true);
    }
});

logoutBtn.addEventListener('click', async () => {
    showMessage('');
    try {
        await api('/api/auth/logout', { method: 'POST' });
        setGuest(true);
        showMessage(t('logoutOk'));
    } catch (e) {
        showMessage(e.message, true);
    }
});

showLoginBtn.addEventListener('click', () => {
    showMessage('');
    setAuthView('login');
});

showRegisterBtn.addEventListener('click', () => {
    showMessage('');
    setAuthView('register');
});

langUaBtn.addEventListener('click', () => applyLanguage('ua'));
langEngBtn.addEventListener('click', () => applyLanguage('eng'));

document.querySelectorAll('[data-policy]').forEach((btn) => {
    btn.addEventListener('click', () => openPolicy(btn.getAttribute('data-policy')));
});

document.getElementById('privacyCloseBtn').addEventListener('click', closePrivacy);
document.getElementById('policyCloseBtn').addEventListener('click', closePolicy);

window.addEventListener('click', (event) => {
    const privacyModal = document.getElementById('privacyModal');
    const policyModal = document.getElementById('policyModal');

    if (event.target === privacyModal) closePrivacy();
    if (event.target === policyModal) closePolicy();
});

init();


