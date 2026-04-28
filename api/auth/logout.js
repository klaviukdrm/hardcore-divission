import { json, methodNotAllowed } from '../../lib/server/http.js';
import { clearAllSessions } from '../../lib/server/session.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return methodNotAllowed(res, ['POST']);
    }

    clearAllSessions(res);
    return json(res, 200, { success: true });
}

