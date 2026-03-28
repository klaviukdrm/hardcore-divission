const statuses = [
    'Пакування',
    'Відправка (Нова Пошта, накладений платіж)',
    'Завершено'
];

const adminLoginForm = document.getElementById('adminLoginForm');
const adminArea = document.getElementById('adminArea');
const adminOrdersList = document.getElementById('adminOrdersList');
const adminMessage = document.getElementById('adminMessage');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');

function showMessage(text, isError = false) {
    adminMessage.textContent = text || '';
    adminMessage.classList.toggle('error', Boolean(text) && isError);
    adminMessage.classList.toggle('success', Boolean(text) && !isError);
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
        throw new Error(payload.error || 'Request failed');
    }

    return payload;
}

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('uk-UA');
}

function getPhone(order) {
    if (!order) return '-';
    if (Array.isArray(order.users) && order.users.length) {
        return order.users[0].phone || '-';
    }
    if (order.users && typeof order.users === 'object') {
        return order.users.phone || '-';
    }
    return '-';
}

async function updateOrderStatus(orderId, nextStatus) {
    await api('/api/orders/update', {
        method: 'POST',
        body: JSON.stringify({
            order_id: orderId,
            status: nextStatus
        })
    });
}

function renderOrders(orders) {
    if (!orders.length) {
        adminOrdersList.innerHTML = '<div class="order-card">Замовлень поки немає.</div>';
        return;
    }

    adminOrdersList.innerHTML = orders.map((order) => {
        const items = Array.isArray(order.order_items) ? order.order_items : [];
        const rows = items.map((item) => {
            const sizeText = item.size ? `, size ${item.size}` : '';
            return `<li>${item.quantity} x ${item.title}${sizeText} — ${item.price}</li>`;
        }).join('');

        const statusOptions = statuses.map((value) => (
            `<option value="${value}" ${value === order.status ? 'selected' : ''}>${value}</option>`
        )).join('');

        return `
            <article class="order-card" data-order-id="${order.id}">
                <div class="order-head">
                    <strong>ID: ${order.id}</strong>
                    <span>${formatDate(order.created_at)}</span>
                </div>
                <div class="order-total">Клієнт: ${getPhone(order)}</div>
                <div class="order-total">Сума: ${order.total_price}</div>
                <ul class="order-items">${rows}</ul>
                <div class="admin-order-actions">
                    <select class="admin-status-select">${statusOptions}</select>
                    <button class="buy-btn admin-save-btn" type="button">Зберегти статус</button>
                </div>
            </article>
        `;
    }).join('');

    adminOrdersList.querySelectorAll('.admin-save-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const card = button.closest('.order-card');
            const orderId = card.getAttribute('data-order-id');
            const select = card.querySelector('.admin-status-select');
            const status = select.value;

            try {
                button.disabled = true;
                await updateOrderStatus(orderId, status);
                showMessage('Статус оновлено.');
            } catch (e) {
                showMessage(e.message, true);
            } finally {
                button.disabled = false;
            }
        });
    });
}

async function loadOrders() {
    const data = await api('/api/orders/get', { method: 'GET' });
    renderOrders(Array.isArray(data.orders) ? data.orders : []);
}

function showAdminArea() {
    adminLoginForm.hidden = true;
    adminArea.hidden = false;
}

function showLoginArea() {
    adminLoginForm.hidden = false;
    adminArea.hidden = true;
    adminOrdersList.innerHTML = '';
}

adminLoginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage('');

    const password = document.getElementById('adminPassword').value;

    try {
        await api('/api/admin/login', {
            method: 'POST',
            body: JSON.stringify({ password })
        });

        showAdminArea();
        await loadOrders();
        showMessage('Вхід виконано успішно.');
        event.target.reset();
    } catch (e) {
        showMessage(e.message, true);
    }
});

adminLogoutBtn.addEventListener('click', async () => {
    showMessage('');
    try {
        await api('/api/auth/logout', { method: 'POST' });
        showLoginArea();
        showMessage('Сесію адміністратора завершено.');
    } catch (e) {
        showMessage(e.message, true);
    }
});

async function init() {
    try {
        const me = await api('/api/auth/me', { method: 'GET' });
        if (me.authenticated && me.role === 'admin') {
            showAdminArea();
            await loadOrders();
            return;
        }
    } catch (e) {
        // Ignore startup checks.
    }

    showLoginArea();
}

init();
