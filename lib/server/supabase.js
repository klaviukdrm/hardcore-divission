const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function ensureConfig() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
}

function buildUrl(path, query = {}) {
    const cleanPath = String(path || '').replace(/^\/+/, '');
    const url = new URL(`/rest/v1/${cleanPath}`, SUPABASE_URL);

    Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        url.searchParams.set(key, String(value));
    });

    return url.toString();
}

export async function supabaseRequest(path, options = {}) {
    ensureConfig();

    const {
        method = 'GET',
        query,
        body,
        headers = {},
        prefer
    } = options;

    const requestHeaders = {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        ...headers
    };

    if (body !== undefined && !requestHeaders['Content-Type']) {
        requestHeaders['Content-Type'] = 'application/json';
    }

    if (prefer) {
        requestHeaders.Prefer = prefer;
    }

    const response = await fetch(buildUrl(path, query), {
        method,
        headers: requestHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined
    });

    const text = await response.text();
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch (e) {
            data = text;
        }
    }

    return {
        ok: response.ok,
        status: response.status,
        data
    };
}

export function requireSupabaseConfig() {
    ensureConfig();
}
