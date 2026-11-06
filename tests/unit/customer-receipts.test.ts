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

it.each(['ferraro-detail', 'ppf-house'] as const)('validates individual collections and financial signs for %s', async source => {
  const { loadCustomerCollections } = await import('@/modules/integrations/customer-receipts/client.server');
  setup(source);
  const identity = { version: 1, empresaId: source, moneda: 'USD' };
  const rows = ['10.00', '-2.00', '-3.00', '1.00'].map((importeUsd, i) => ({
    id: '00000000-0000-4000-8000-' + String(4-i).padStart(12,'0'), fecha: '2026-10-15T12:00:00.000Z',
    tipo: i % 2 ? 'CUSTOMER_REFUND' : 'CUSTOMER_PAYMENT', reversion: i > 1, importeUsd,
  }));
  const payload = { ...identity, periodo: { desde: '2026-10-01T03:00:00.000Z', hasta: '2026-11-01T02:59:59.999Z' }, movimientos: rows,
    paginacion: { pagina: 1, porPagina: 25, total: 4, totalPaginas: 1, hayMas: false } };
  const f = vi.fn(async (url: URL) => Response.json(url.pathname.endsWith('/identidad') ? identity : payload));
  vi.stubGlobal('fetch', f);
  expect(await loadCustomerCollections(source, period)).toMatchObject({ ok: true, collections: { movimientos: rows } });
  expect(f.mock.calls.at(-1)![0].pathname).toBe('/api/consolidado/cobros');
  for (const change of [ { moneda: 'ARS' }, { version: 2 }, { empresaId: 'wrong' }, { movimientos: [...rows].reverse() },
    { movimientos: [{ ...rows[0], importeUsd: '-10.00' }, ...rows.slice(1)] },
    { movimientos: [{ ...rows[0], cliente: 'PRIVATE' }, ...rows.slice(1)] },
    { paginacion: { ...payload.paginacion, total: 25 } },
    { periodo: { ...payload.periodo, desde: '2026-10-01T00:00:00.000Z' } } ]) {
    f.mockImplementation(async url => Response.json(url.pathname.endsWith('/identidad') ? identity : { ...payload, ...change }));
    const result = await loadCustomerCollections(source, period);
    expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain('PRIVATE');
  }
  f.mockClear();
  expect((await loadCustomerCollections(source, period, 0)).ok).toBe(false); expect(f).not.toHaveBeenCalled();
  vi.mocked(requireOwner).mockRejectedValueOnce(new Error('LOGIN'));
  await expect(loadCustomerCollections(source, period)).rejects.toThrow('LOGIN'); expect(f).not.toHaveBeenCalled();
});

it.each(['ferraro-detail', 'ppf-house'] as const)('reconciles every controlled %s collection page with its existing summary', async source => {
  const { loadCustomerCollections } = await import('@/modules/integrations/customer-receipts/client.server');
  const { usdToCents } = await import('@/modules/integrations/rfn/money');
  setup(source);
  const identity = { version: 1, empresaId: source, moneda: 'USD' };
  const periodo = { desde: '2026-10-01T03:00:00.000Z', hasta: '2026-11-01T02:59:59.999Z' };
  const rows = Array.from({ length: 60 }, (_, i) => ({
    id: '00000000-0000-4000-8000-' + String(100-i).padStart(12,'0'), fecha: '2026-10-15T12:00:00.000Z',
    tipo: i === 57 || i === 59 ? 'CUSTOMER_REFUND' : 'CUSTOMER_PAYMENT', reversion: i >= 58,
    importeUsd: i === 57 ? '-0.20' : i === 58 ? '-0.30' : i === 59 ? '0.40' : '0.10',
  }));
  vi.stubGlobal('fetch', vi.fn(async (url: URL) => {
    if (url.pathname.endsWith('/identidad')) return Response.json(identity);
    if (url.pathname.endsWith('/resumen')) return Response.json({ ...identity, periodo, cobros: '5.60', movimientos: 60 });
    const n = Number(url.searchParams.get('pagina'));
    return Response.json({ ...identity, periodo, movimientos: rows.slice((n-1)*25,n*25), paginacion: { pagina: n, porPagina: 25, total: 60, totalPaginas: 3, hayMas: n < 3 } });
  }));
  const summary = await loadCustomerReceipts(source, period);
  expect(summary.ok).toBe(true);
  let total = 0n;
  for (let n = 1; n <= 3; n++) {
    const r = await loadCustomerCollections(source, period, n);
    expect(r.ok).toBe(true);
    if (r.ok) total += r.collections.movimientos.reduce((sum, row) => sum + usdToCents(row.importeUsd), 0n);
  }
  if (summary.ok) expect(total).toBe(usdToCents(summary.cobros));
});
