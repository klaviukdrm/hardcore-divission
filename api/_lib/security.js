import crypto from 'node:crypto';

const PHONE_REGEX = /^\+380\d{9}$/;

export const ORDER_STATUSES = [
    'Пакування',
    'Відправка (Нова Пошта, накладений платіж)',
    'Завершено'
];

export function isValidPhone(phone) {
    return PHONE_REGEX.test(String(phone || ''));
}

export function isStrongEnoughPassword(password) {
    if (typeof password !== 'string') return false;
    return password.length >= 8 && password.length <= 72;
}

export function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, encoded) {
    if (typeof encoded !== 'string') return false;
    const parts = encoded.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;

    const salt = parts[1];
    const expectedHex = parts[2];
    const actualHex = crypto.scryptSync(password, salt, 64).toString('hex');

    const expected = Buffer.from(expectedHex, 'hex');
    const actual = Buffer.from(actualHex, 'hex');
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
}

export function safeStringEqual(left, right) {
    const a = Buffer.from(String(left || ''), 'utf8');
    const b = Buffer.from(String(right || ''), 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}
