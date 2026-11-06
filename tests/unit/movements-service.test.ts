import { createHmac } from 'node:crypto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/modules/identity/session', () => ({ requireOwner: vi.fn() }));
const mocks = vi.hoisted(() => ({ collections: vi.fn(), expenses: vi.fn(), rfn: vi.fn(), rfnExpenses: vi.fn() }));
vi.mock('@/modules/integrations/customer-receipts/client.server', () => ({ loadCustomerCollections: mocks.collections, loadCustomerExpenses: mocks.expenses }));
vi.mock('@/modules/integrations/rfn/finance.server', () => ({ loadRfnMovements: mocks.rfn, loadRfnExpenses: mocks.rfnExpenses }));
import { requireOwner } from '@/modules/identity/session';
import { loadMovements, readMovementFilters, movementStreams, compareMovements, movementKey, type FinancialMovement } from '@/modules/finance/movements.server';
import { usdToCents } from '@/modules/integrations/rfn/money';
const filters = { desde: '2026-11-01', hasta: '2026-11-30', empresa: 'todas', tipo: 'todos' };
const id = (i: number) => '00000000-0000-4000-8000-' + String(i).padStart(12, '0');
const data = Array.from({ length: 61 }, (_, i) => ({ id: id(100 - i), fecha: `2026-11-${String(29 - Math.floor(i / 3)).padStart(2, '0')}T12:00:00.000Z`, tipo: 'CUSTOMER_PAYMENT', reversion: false, importeUsd: '0.10' }));
function page(page: number, rows = data) {
  return { movimientos: rows.slice((page - 1) * 25, page * 25), paginacion: { pagina: page, porPagina: 25, total: rows.length, totalPaginas: Math.max(1, Math.ceil(rows.length / 25)), hayMas: page * 25 < rows.length } };
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('BETTER_AUTH_SECRET', 'controlled-auth-secret'.repeat(3));
  mocks.collections.mockImplementation(async (_s, _p, n) => ({ ok: true, collections: page(n) }));
  mocks.expenses.mockImplementation(async (_s, _p, n) => ({ ok: true, expenses: page(n, data.map(r => ({ ...r, tipo: 'SALARY_PAYMENT' }))) }));
  mocks.rfn.mockImplementation(async (flow, _p, n) => ({ ok: true, data: page(n, data.map(r => ({ ...r, tipo: flow === 'cobros' ? 'SENIA' : 'COMPRA_RECIBIDA' }))) }));
  mocks.rfnExpenses.mockImplementation(async (_p, options) => {
    const p = page(options.pagina);
    return { ok: true, expenses: { gastos: p.movimientos.map(r => ({ ...r, importe: r.importeUsd, concepto: 'PRIVATE_PERSON', categoria: 'PRIVATE_CATEGORY' })), paginacion: p.paginacion } };
  });
});
afterEach(() => vi.unstubAllEnvs());
it('merges 427 records across seven streams without gaps, duplicates or eager history; reconciles cents', async () => {
  const seen: FinancialMovement[] = []; let cursor: string | undefined;
  do {
    const result = await loadMovements({ ...filters, cursor });
    expect(result.complete).toBe(true); expect(result.movements.length).toBeLessThanOrEqual(25);
    seen.push(...result.movements); cursor = result.nextCursor ?? undefined;
    if (seen.length === 25) {
      expect(mocks.collections.mock.calls.every(c => c[2] === 1)).toBe(true);
      expect(mocks.expenses.mock.calls.every(c => c[2] === 1)).toBe(true);
      expect(mocks.rfn.mock.calls.every(c => c[2] === 1)).toBe(true);
      expect(cursor).not.toContain('0.10'); expect(cursor).not.toContain('PRIVATE');
    }
  } while (cursor);
  expect(seen).toHaveLength(427); expect(new Set(seen.map(movementKey)).size).toBe(427);
  expect(seen).toEqual([...seen].sort(compareMovements));
  expect(JSON.stringify(seen)).not.toContain('PRIVATE');
  for (const stream of movementStreams(readMovementFilters(filters).filters)) {
    const amount = seen.filter(r => `${r.empresaId}:${r.flujo}` === stream.key).reduce((n, r) => n + usdToCents(r.importeUsd), 0n);
    expect(amount).toBe(stream.flujo === 'cobros' ? 610n : -610n);
  }
  expect(mocks.collections.mock.calls.some(c => c[2] === 3)).toBe(true);
});
it('normalizes refunds, both receipt reversals and expense reversals without changing category', async () => {
  const rows = [
    { ...data[0]!, tipo: 'CUSTOMER_PAYMENT', importeUsd: '10.00' },
    { ...data[1]!, tipo: 'CUSTOMER_REFUND', importeUsd: '-2.00' },
    { ...data[2]!, tipo: 'CUSTOMER_PAYMENT', reversion: true, importeUsd: '-3.00' },
    { ...data[3]!, tipo: 'CUSTOMER_REFUND', reversion: true, importeUsd: '1.00' },
  ];
  mocks.collections.mockResolvedValue({ ok: true, collections: page(1, rows) });
  mocks.expenses.mockResolvedValue({ ok: true, expenses: page(1, [{ ...data[4]!, tipo: 'PURCHASE', reversion: true, importeUsd: '-4.00' }]) });
  const r = await loadMovements({ ...filters, empresa: 'ferraro-detail' });
  expect(r.movements.map(r => [r.direccion, r.importeUsd])).toEqual([['entrada', '10.00'], ['salida', '-2.00'], ['salida', '-3.00'], ['entrada', '1.00'], ['entrada', '4.00']]);
  expect(r.movements.at(-1)?.tipo).toBe('PURCHASE');
});
it('queries only permitted streams and preserves other data on failure with no next cursor', async () => {
  mocks.collections.mockResolvedValue({ ok: false });
  const r = await loadMovements({ ...filters, empresa: 'ppf-house' });
  expect(r.complete).toBe(false); expect(r.nextCursor).toBeNull(); expect(r.movements).toHaveLength(25);
  expect(mocks.rfn).not.toHaveBeenCalled(); expect(mocks.rfnExpenses).not.toHaveBeenCalled();
  expect(r.sources.find(s => s.flujo === 'cobros')?.available).toBe(false);
  vi.clearAllMocks();
  await loadMovements({ ...filters, empresa: 'rfn-argentina', tipo: 'cobros' });
  expect(mocks.collections).not.toHaveBeenCalled(); expect(mocks.expenses).not.toHaveBeenCalled(); expect(mocks.rfnExpenses).not.toHaveBeenCalled();
  expect(mocks.rfn).toHaveBeenCalledWith('cobros', expect.anything(), 1);
});
it('stops pagination when a later source page fails and detects cross-page order violations', async () => {
  mocks.collections.mockImplementation(async (_s, _p, n) => n === 1 ? { ok: true, collections: page(n) } : { ok: false });
  const params = { ...filters, empresa: 'ferraro-detail', tipo: 'cobros' };
  const first = await loadMovements(params);
  const second = await loadMovements({ ...params, cursor: first.nextCursor! });
  expect(second.complete).toBe(false); expect(second.nextCursor).toBeNull();
  // Two streams consume partial source pages; duplicated heads on refill fail closed.
  mocks.collections.mockImplementation(async () => ({ ok: true, collections: page(1) }));
  let cursor: string | undefined;
  let complete = true;
  for (let i = 0; i < 4 && complete; i++) {
    const r = await loadMovements({ ...filters, tipo: 'cobros', cursor });
    complete = r.complete; cursor = r.nextCursor ?? undefined;
    if (!complete) expect(r.nextCursor).toBeNull();
  }
  expect(complete).toBe(false);
});
it('rejects tampering, oversized, duplicate and mismatched parameters before querying', async () => {
  const r = await loadMovements(filters); const cursor = r.nextCursor!;
  const invalid = [ { cursor: 'x'.repeat(2049) }, { cursor: cursor.slice(0, -1) + (cursor.endsWith('A') ? 'B' : 'A') }, { cursor, tipo: 'cobros' }, { cursor, hasta: '2026-11-29' }, { empresa: ['todas', 'ppf-house'] }, { tipo: 'ventas' }, { desde: '2026-02-30' }, { pagina: '2' }, { cursor: [cursor] } ];
  for (const bad of invalid) expect(() => readMovementFilters({ ...filters, ...bad })).toThrow();
  expect(readMovementFilters({ ...filters, cursor }).offsets).toBeDefined();
});
it('handles valid empty periods and owner rejection before any financial query', async () => {
  mocks.collections.mockResolvedValue({ ok: true, collections: page(1, []) });
  const r = await loadMovements({ ...filters, empresa: 'ppf-house', tipo: 'cobros' });
  expect(r).toMatchObject({ movements: [], complete: true, nextCursor: null });
  vi.clearAllMocks(); vi.mocked(requireOwner).mockRejectedValueOnce(new Error('LOGIN'));
  await expect(loadMovements(filters)).rejects.toThrow('LOGIN'); expect(mocks.collections).not.toHaveBeenCalled();
});

it('strictly checks signed cursor structure, version, offset keys and ranges', async () => {
  const result = await loadMovements(filters);
  const valid = JSON.parse(Buffer.from(result.nextCursor!.split('.')[0]!, 'base64url').toString('utf8'));
  const sign = (data: unknown) => {
    const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
    return payload + '.' + createHmac('sha256', process.env.BETTER_AUTH_SECRET!).update('multiempresa:movimientos:v1:' + payload).digest('base64url');
  };
  for (const data of [ { ...valid, v: 2 }, { ...valid, extra: true }, { ...valid, offsets: {} },
    { ...valid, offsets: { ...valid.offsets, extra: 1 } },
    ...[-1, 0.5, 25000001, '1'].map(value => ({ ...valid, offsets: { ...valid.offsets, 'ferraro-detail:cobros': value } })),
    { ...valid, offsets: Object.fromEntries(Object.keys(valid.offsets).map(key => [key, 0])) },
  ]) expect(() => readMovementFilters({ ...filters, cursor: sign(data) })).toThrow();
});
