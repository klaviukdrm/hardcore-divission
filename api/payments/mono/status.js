import { json, methodNotAllowed } from '../../../lib/server/http.js';
import { getMonoInvoiceStatus } from '../../../lib/server/mono.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return methodNotAllowed(res, ['GET']);
    }

    const invoiceId = String(req.query?.invoiceId || '').trim();
    if (!invoiceId) {
        return json(res, 400, { error: 'Missing invoiceId' });
    }

    try {
        const status = await getMonoInvoiceStatus(invoiceId);
        return json(res, 200, {
            success: true,
            invoiceId: status.invoiceId || invoiceId,
            status: status.status || null,
            amount: status.amount ?? null,
            ccy: status.ccy ?? null,
            reference: status.reference || null,
            destination: status.destination || null,
            paymentInfo: status.paymentInfo || null
        });
    } catch (e) {
        return json(res, 500, { error: 'Failed to load mono invoice status', details: e.message });
    }
}
