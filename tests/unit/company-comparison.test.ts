import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('server-only', () => ({}));
vi.mock('@/modules/identity/session', () => ({ requireOwner: vi.fn() }));
const loaders = vi.hoisted(() => ({ receipts: vi.fn(), expenses: vi.fn(), rfn: vi.fn() }));
vi.mock('@/modules/integrations/customer-receipts/client.server', () => ({ loadCustomerReceipts: loaders.receipts, loadCustomerExpenses: loaders.expenses }));
vi.mock('@/modules/integrations/rfn/finance.server', () => ({ loadRfnSummary: loaders.rfn }));
import { comparisonPeriods, loadCompanyComparison } from '@/modules/finance/summary.server';
import { ComparisonChart } from '@/components/patterns/comparison-chart';
import { requireOwner } from '@/modules/identity/session';
const receiptValue = { ok: true, cobros: '0.10', movimientos: 1 };
const expenseValue = { ok: true, expenses: { totales: { compras: '0.10', gastosManuales: '0.20', sueldosPagados: '0.00', egresos: '0.30' } } };
beforeEach(() => {
  loaders.receipts.mockResolvedValue(receiptValue); loaders.expenses.mockResolvedValue(expenseValue);
  loaders.rfn.mockResolvedValue({ ok: true, summary: { totales: { cobros: '0.00', gastos: '0.00', compras: '0.00', egresos: '0.00', resultadoNeto: '0.00' } } });
});
afterEach(() => { vi.clearAllMocks(); });
it('uses June–November 2026, across year boundaries and leap years with complete calendar ranges', () => {
  const november = comparisonPeriods('2026-11-15');
  expect(november).toEqual([
    { desde: '2026-06-01', hasta: '2026-06-30' }, { desde: '2026-07-01', hasta: '2026-07-31' },
    { desde: '2026-08-01', hasta: '2026-08-31' }, { desde: '2026-09-01', hasta: '2026-09-30' },
    { desde: '2026-10-01', hasta: '2026-10-31' }, { desde: '2026-11-01', hasta: '2026-11-30' },
  ]);
  expect(comparisonPeriods('2027-01-31').map(period => period.desde)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01']);
  expect(comparisonPeriods('2028-02-29').at(-1)).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' });
  expect(() => comparisonPeriods('2027-02-29')).toThrow();
});
it('queries six real ranges per company and preserves exact values, zero and negative balances', async () => {
  const months = await loadCompanyComparison('2026-11-30');
  expect(months).toHaveLength(6); expect(loaders.receipts).toHaveBeenCalledTimes(12); expect(loaders.expenses).toHaveBeenCalledTimes(12); expect(loaders.rfn).toHaveBeenCalledTimes(6);
  for (const month of months) {
    expect(month.empresas.map(summary => summary.nombre)).toEqual(['Ferraro Detail', 'PPF House', 'RFN Argentina']);
    expect(month.empresas[0]).toMatchObject({ cobros: '0.10', egresos: '0.30', saldoNeto: '-0.20' });
    expect(month.empresas[2]).toMatchObject({ cobros: '0.00', sueldosPagados: null });
  }
  const html = renderToStaticMarkup(createElement(ComparisonChart, { months }));
  expect(html).toContain('value="cobros" selected'); expect(html).toContain('Saldo neto');
  expect(html.match(/scope="row"/g)).toHaveLength(6); expect(html).toContain('USD 0,10'); expect(html).toContain('USD 0,00');
});
it('keeps each company sequential with at most three company workers and parallel receipts/expenses in a month', async () => {
  const active = new Map<string, string>(); let peak = 0;
  const events: string[] = [];
  async function run(company: string, period: { desde: string }, kind: string) {
    const prior = active.get(company); expect(prior === undefined || prior === period.desde).toBe(true);
    active.set(company, period.desde); peak = Math.max(peak, active.size);
    events.push(`${company}:${period.desde}:${kind}:start`);
    await new Promise(resolve => setTimeout(resolve, 2));
    events.push(`${company}:${period.desde}:${kind}:end`);
    if (kind === 'expenses' || kind === 'rfn') active.delete(company);
  }
  loaders.receipts.mockImplementation(async (company, period) => { await run(company, period, 'receipts'); return receiptValue; });
  loaders.expenses.mockImplementation(async (company, period) => { await run(company, period, 'expenses'); return expenseValue; });
  loaders.rfn.mockImplementation(async period => { await run('rfn-argentina', period, 'rfn'); return { ok: false, message: 'No disponible' }; });
  await loadCompanyComparison('2026-11-30'); expect(peak).toBe(3);
  for (const company of ['ferraro-detail', 'ppf-house']) {
    const starts = events.filter(event => event.startsWith(company)).slice(0, 2);
    expect(starts.every(event => event.endsWith(':start'))).toBe(true);
  }
});
it('does not retry failed months or discard validated months and preserves other companies', async () => {
  loaders.receipts.mockImplementation(async (company, period) => company === 'ppf-house' && period.desde === '2026-09-01' ? { ok: false, message: 'Fuente no disponible' } : receiptValue);
  const months = await loadCompanyComparison('2026-11-30');
  expect(months[3]!.empresas[1]).toMatchObject({ estado: 'parcial', cobros: null, egresos: '0.30', saldoNeto: null });
  expect(months[2]!.empresas[1]!.cobros).toBe('0.10'); expect(months[4]!.empresas[1]!.cobros).toBe('0.10');
  expect(loaders.receipts.mock.calls.filter(([company, period]) => company === 'ppf-house' && period.desde === '2026-09-01')).toHaveLength(1);
  const html = renderToStaticMarkup(createElement(ComparisonChart, { months }));
  expect(html).toContain('Cobertura parcial'); expect(html).toContain('No disponible'); expect(html).toContain('USD 0,10');
});
it('reuses matching dashboard ranges including failures instead of immediately retrying', async () => {
  const initial = (await loadCompanyComparison('2026-11-30')).at(-1)!.empresas;
  initial[0] = { ...initial[0]!, estado: 'no_disponible', cobros: null, egresos: null, saldoNeto: null };
  vi.clearAllMocks();
  const months = await loadCompanyComparison('2026-11-30', initial);
  expect(loaders.receipts).toHaveBeenCalledTimes(10); expect(loaders.expenses).toHaveBeenCalledTimes(10); expect(loaders.rfn).toHaveBeenCalledTimes(5);
  expect(months[5]!.empresas[0]).toBe(initial[0]);
});
it('shows an honest empty message instead of an empty chart when all values are missing', async () => {
  const months = await loadCompanyComparison('2026-11-30');
  months.forEach(month => month.empresas.forEach(summary => { summary.cobros = null; }));
  const html = renderToStaticMarkup(createElement(ComparisonChart, { months }));
  expect(html).toContain('No hay datos validados'); expect(html).not.toContain('recharts-responsive-container'); expect(html).not.toContain('USD 0,00');
});
it('requires authentication before monthly queries', async () => {
  vi.mocked(requireOwner).mockRejectedValueOnce(new Error('REDIRECT'));
  await expect(loadCompanyComparison('2026-11-30')).rejects.toThrow('REDIRECT'); expect(loaders.receipts).not.toHaveBeenCalled();
});
