import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/modules/identity/session', () => ({ requireOwner: vi.fn() }));
import { requireOwner } from '@/modules/identity/session';
import { loadCustomerReceipts } from '@/modules/integrations/customer-receipts/client.server';
const period = { desde:'2026-10-01', hasta:'2026-10-31' };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function setup(source = 'ferraro-detail', overrides = {}) {
 vi.stubEnv('FERRARO_API_BASE_URL','https://ferraro.test'); vi.stubEnv('FERRARO_API_KEY','f'.repeat(32));
 vi.stubEnv('PPF_API_BASE_URL','https://ppf.test'); vi.stubEnv('PPF_API_KEY','p'.repeat(32));
 const identity = { version:1, empresaId:source, moneda:'USD' };
 const fetcher = vi.fn().mockResolvedValueOnce(Response.json(identity)).mockResolvedValueOnce(Response.json({ ...identity, periodo:{desde:'2026-10-01T03:00:00.000Z',hasta:'2026-11-01T02:59:59.999Z'},cobros:'0.00',movimientos:0,...overrides }));
 vi.stubGlobal('fetch',fetcher); return fetcher;
}
it('distinguishes valid empty periods and keeps company credentials separate', async () => {
 const f=setup(); expect(await loadCustomerReceipts('ferraro-detail',period)).toEqual({ok:true,cobros:'0.00',movimientos:0});
 expect(f.mock.calls[0]![1]).toMatchObject({headers:{'x-api-key':'f'.repeat(32)},cache:'no-store',redirect:'error'});
 const p=setup('ppf-house'); expect((await loadCustomerReceipts('ppf-house',period)).ok).toBe(true); expect(p.mock.calls[0]![1].headers['x-api-key']).toBe('p'.repeat(32));
});
it.each([{moneda:'ARS'},{empresaId:'ppf-house'},{cobros:1},{periodo:{desde:'2026-10-01T00:00:00Z',hasta:'2026-11-01T02:59:59.999Z'}},{cobros:'1.00',movimientos:0}])('rejects incompatible data %j', async override => { setup('ferraro-detail',override); expect((await loadCustomerReceipts('ferraro-detail',period)).ok).toBe(false); });
it.each([401,403,500])('does not turn HTTP %s into zero', async status => { setup(); vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('',{status}))); expect((await loadCustomerReceipts('ferraro-detail',period)).ok).toBe(false); });
it('handles network failures without exposing details', async () => { setup(); vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('secret'))); expect(JSON.stringify(await loadCustomerReceipts('ferraro-detail',period))).not.toContain('secret'); });

it('does not fetch when credentials are absent', async () => { const f=setup(); vi.stubEnv('FERRARO_API_KEY',''); expect((await loadCustomerReceipts('ferraro-detail',period)).ok).toBe(false); expect(f).not.toHaveBeenCalled(); });
it('handles timeouts as unavailable', async () => { setup(); vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new DOMException('timeout','TimeoutError'))); expect((await loadCustomerReceipts('ferraro-detail',period)).ok).toBe(false); });

it('propagates owner authorization failures before consulting identity or financial data', async () => {
 const f = setup();
 vi.mocked(requireOwner).mockRejectedValueOnce(new Error('REDIRECT'));
 await expect(loadCustomerReceipts('ferraro-detail', period)).rejects.toThrow('REDIRECT');
 expect(f).not.toHaveBeenCalled();
});
it('rejects an incompatible identity before requesting a financial response', async () => {
 const f = setup('ppf-house');
 expect((await loadCustomerReceipts('ferraro-detail', period)).ok).toBe(false);
 expect(f).toHaveBeenCalledTimes(1);
});
