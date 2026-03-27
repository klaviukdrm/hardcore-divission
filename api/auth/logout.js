import { json, methodNotAllowed } from '../_lib/http.js';
import { clearAllSessions } from '../_lib/session.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return methodNotAllowed(res, ['POST']);
    }

    clearAllSessions(res);
    return json(res, 200, { success: true });
}
