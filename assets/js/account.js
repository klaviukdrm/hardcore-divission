const phoneRegex = /^\+380\d{9}$/;
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

let currentOrders = [];

const ui = {
    ua: {
        noOrders: 'Замовлень поки немає.',
        status: 'Статус',
        total: 'Сума',
        invalidPhone: 'Телефон повинен бути у форматі +380XXXXXXXXX',
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
        invalidPhone: 'Phone must match +380XXXXXXXXX',
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

function setAuthenticated(user) {
    authArea.hidden = true;
    accountArea.hidden = false;
    logoutBtn.hidden = false;
    accountPhone.textContent = user.phone;
}

function setGuest() {
    authArea.hidden = false;
    accountArea.hidden = true;
    logoutBtn.hidden = true;
    setAuthView('login');
    accountPhone.textContent = '-';
    ordersList.innerHTML = '';
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
    try {
        const me = await api('/api/auth/me', { method: 'GET' });
        if (me.authenticated && me.role === 'user' && me.user) {
            setAuthenticated(me.user);
            await loadOrders();
        } else {
            setGuest();
        }
    } catch (e) {
        setGuest();
    }

    applyLanguage(getLang());
}

registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage('');

    const phone = document.getElementById('registerPhone').value.trim();
    const password = document.getElementById('registerPassword').value;

    if (!phoneRegex.test(phone)) {
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
            body: JSON.stringify({ phone, password })
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

    const phone = document.getElementById('loginPhone').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!phoneRegex.test(phone)) {
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
        setGuest();
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
