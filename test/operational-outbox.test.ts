import { describe, it, expect } from 'vitest';
import { validateReceipt, inputDigest } from '@/lib/signals/operational-outbox';
const event = { specversion: '1.0', id: 'event-a', source: 'urn:servicev8:app:supportv8', type: 'com.servicev8.business.support.ticket-created.v1', subject: 'ticket:issue-a', time: '2026-10-18T12:00:00.000Z', datacontenttype: 'application/json', data: { ticketId: 'issue-a' } };
const pin = { accountId: 'account-a', tenantId: 'registry-a' };
const ack = { ok: true, duplicate: false, receiptId: 'receipt-a', inputDigest: inputDigest(event), tenantId: 'registry-a', accountId: 'account-a', sourceBinding: event.source, sourceEventId: event.id, eventType: event.type, subject: event.subject, receivedAt: '2026-10-18T12:00:01.000Z', status: 'accepted' };
describe('Support exact durable receipt', () => {
    it('accepts the two exact HTTP/ACK pairs', () => { expect(validateReceipt(202, ack, event, pin)).toEqual(ack); expect(validateReceipt(200, { ...ack, duplicate: true, status: 'duplicate' }, event, pin).receiptId).toBe('receipt-a'); });
    it.each(Object.keys(ack))('rejects missing %s', key => { const partial = { ...ack } as Record<string, unknown>; delete partial[key]; expect(() => validateReceipt(202, partial, event, pin)).toThrow('signals_invalid_receipt'); });
    it.each(['tenantId', 'accountId', 'sourceBinding', 'sourceEventId', 'eventType', 'subject', 'inputDigest', 'receivedAt'])('rejects invalid/foreign %s', key => expect(() => validateReceipt(202, { ...ack, [key]: 'foreign' }, event, pin)).toThrow());
    it('rejects false ok, status mismatch, extra keys and HTTP pairing', () => { for (const a of [{ ...ack, ok: false }, { ...ack, duplicate: true }, { ...ack, status: 'duplicate' }, { ...ack, extra: 1 }, { ...ack, receiptId: '' }])
        expect(() => validateReceipt(202, a, event, pin)).toThrow(); expect(() => validateReceipt(200, ack, event, pin)).toThrow(); });
});
