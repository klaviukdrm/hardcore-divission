import crypto from 'node:crypto';

const PHONE_E164_REGEX = /^\+\d{7,15}$/;
const ALLOWED_PHONE_CODES = [
    '1',   // USA
    '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45', '46', '47', '48', '49',
    '350', '351', '352', '353', '354', '355', '356', '357', '358', '359',
    '370', '371', '372', '373', '376', '377', '378', '380', '381', '382', '383', '385', '386', '387', '389',
    '420', '421', '423',
    '994', '995'
].sort((a, b) => b.length - a.length);

export const ORDER_STATUSES = [
    'Пакування',
    'Відправка (Нова Пошта, накладений платіж)',
    'Завершено'
];

export function isValidPhone(phone) {
    const normalized = String(phone || '').replace(/\s+/g, '');
    if (!PHONE_E164_REGEX.test(normalized)) return false;

    const digits = normalized.slice(1);
    const code = ALLOWED_PHONE_CODES.find((item) => digits.startsWith(item));
    if (!code) return false;

    const localNumber = digits.slice(code.length);
    return localNumber.length >= 6 && localNumber.length <= 12;
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
