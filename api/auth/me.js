import { json, methodNotAllowed } from '../../lib/server/http.js';
import { getAdminSession, getUserSession } from '../../lib/server/session.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return methodNotAllowed(res, ['GET']);
    }

    const adminSession = getAdminSession(req);
    if (adminSession?.role === 'admin') {
        return json(res, 200, { authenticated: true, role: 'admin' });
    }

    const userSession = getUserSession(req);
    if (!userSession?.sub) {
        return json(res, 200, { authenticated: false });
    }

    return json(res, 200, {
        authenticated: true,
        role: 'user',
        user: {
            id: userSession.sub,
            phone: userSession.phone
        }
    });
}

