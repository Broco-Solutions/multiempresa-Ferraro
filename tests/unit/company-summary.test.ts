import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('server-only', () => ({}));
vi.mock('@/modules/identity/session', () => ({ requireOwner: vi.fn() }));
import { loadFinancialSummaries, loadCompanySummary, consolidateSummaries } from '@/modules/finance/summary.server';
import { CompanySummary } from '@/components/patterns/company-summary';
import { requireOwner } from '@/modules/identity/session';
const period = { desde: '2026-11-01', hasta: '2026-11-30' };
let failed: string[];
let zero: boolean;
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  failed = []; zero = false;
  for (const prefix of ['FERRARO', 'PPF', 'RFN']) {
    vi.stubEnv(prefix + '_API_BASE_URL', `https://${prefix.toLowerCase()}.test`);
    vi.stubEnv(prefix + '_API_KEY', prefix.toLowerCase().repeat(32));
  }
  fetcher = vi.fn(async (url: URL) => {
    const source = url.hostname.split('.')[0]!;
    const resource = url.pathname.split('/').at(-1)!;
    if (failed.includes(source + '/' + resource)) return new Response('', { status: 503 });
    const empresaId = source === 'ferraro' ? 'ferraro-detail' : source === 'ppf' ? 'ppf-house' : 'rfn-argentina';
    const identity = { empresaId, version: 1, moneda: 'USD', ...(source === 'rfn' ? { empresaNombre: 'RFN Argentina' } : {}) };
    if (resource === 'identidad') return Response.json({ ...identity, ...(source === 'rfn' ? { endpoints: [] } : {}) });
    const desde = url.searchParams.get('desde')!, hasta = url.searchParams.get('hasta')!;
    const periodo = { desde: new Date(desde + 'T00:00:00-03:00').toISOString(), hasta: new Date(hasta + 'T23:59:59.999-03:00').toISOString() };
    const cobros = zero ? '0.00' : source === 'ferraro' ? '-0.10' : source === 'ppf' ? '1000.20' : '30.30';
    if (resource === 'resumen' && source !== 'rfn') return Response.json({ ...identity, periodo, cobros, movimientos: zero ? 0 : 2 });
    if (source === 'rfn') return Response.json({ ...identity, periodo, totales: {
      cobros, gastos: zero ? '0.00' : '10.10', compras: zero ? '0.00' : '20.20', egresos: zero ? '0.00' : '30.30', resultadoNeto: '0.00',
      ventasConfirmadas: { cantidad: 0, monto: '0' }, reservasActivas: { cantidad: 0, monto: '0', nota: '' },
    }, gastosPorCategoria: [], alertasStock: { stockBajo: 0, sinStock: 0 } });
    return Response.json({ ...identity, periodo, totales: zero ? { compras: '0.00', gastosManuales: '0.00', sueldosPagados: '0.00', egresos: '0.00' } : {
      compras: '10.10', gastosManuales: '-0.20', sueldosPagados: '500.30', egresos: '510.20',
    }, movimientos: zero ? [] : [{ id: '00000000-0000-4000-8000-000000000001', fecha: periodo.desde, tipo: 'MANUAL_EXPENSE', reversion: true, importeUsd: '-0.20' }],
      paginacion: { pagina: 1, porPagina: 25, total: zero ? 0 : 1, totalPaginas: 1, hayMas: false } });
  });
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
it('normalizes real adapter responses, salaries, reversals and exact consolidation without double counting', async () => {
  const summaries = await loadFinancialSummaries(period);
  expect(summaries.map(s => s.empresaId)).toEqual(['ferraro-detail', 'ppf-house', 'rfn-argentina']);
  expect(summaries[0]).toMatchObject({ estado: 'completo', cobros: '-0.10', egresos: '510.20', saldoNeto: '-510.30', compras: '10.10', sueldosPagados: '500.30', otrosGastos: '-0.20' });
  expect(summaries[1]).toMatchObject({ cobros: '1000.20', saldoNeto: '490.00', sueldosPagados: '500.30' });
  expect(summaries[2]).toMatchObject({ cobros: '30.30', egresos: '30.30', saldoNeto: '0.00', sueldosPagados: null, otrosGastos: '10.10' });
  expect(consolidateSummaries(summaries)).toMatchObject({ completo: true, cobros: '1030.40', egresos: '1050.70', saldoNeto: '-20.30', faltantes: [] });
  for (const summary of summaries) {
    const html = renderToStaticMarkup(createElement(CompanySummary, { summary }));
    const labels = [...html.matchAll(/<dt>(.*?)<\/dt>/g)].map(match => match[1]);
    expect(labels).toEqual(['Cobros', 'Egresos totales', 'Saldo neto', 'Compras', 'Sueldos pagados', 'Otros gastos']);
    expect(html).toContain('Ver empresa'); expect(html).toContain('empresa=' + summary.empresaId);
    if (summary.empresaId === 'rfn-argentina') expect(html).toContain('Incluidos en gastos operativos');
  }
  const expenseUrls = fetcher.mock.calls.map(call => call[0] as URL).filter(url => url.pathname.endsWith('egresos'));
  expect(expenseUrls).toHaveLength(2); expect(expenseUrls.every(url => url.searchParams.get('pagina') === '1')).toBe(true);
});
it('retains receipts on expense failure and includes only fully validated companies in subtotal', async () => {
  failed = ['ferraro/egresos'];
  const summaries = await loadFinancialSummaries(period);
  expect(summaries[0]).toMatchObject({ estado: 'parcial', cobros: '-0.10', egresos: null, saldoNeto: null });
  expect(consolidateSummaries(summaries)).toMatchObject({ completo: false, faltantes: ['Ferraro Detail'], cobros: '1030.50', egresos: '540.50', saldoNeto: '490.00' });
});
it('retains expenses when receipts fail; withholds all RFN amounts when totals are not validated', async () => {
  failed = ['ppf/resumen', 'rfn/resumen'];
  const summaries = await loadFinancialSummaries(period);
  expect(summaries[1]).toMatchObject({ estado: 'parcial', cobros: null, egresos: '510.20', saldoNeto: null });
  expect(summaries[2]).toMatchObject({ estado: 'no_disponible', cobros: null, egresos: null, compras: null });
});
it('distinguishes validated empty periods from outages, with no fabricated zero subtotal', async () => {
  zero = true;
  const summaries = await loadFinancialSummaries(period);
  expect(consolidateSummaries(summaries)).toMatchObject({ completo: true, cobros: '0.00', egresos: '0.00', saldoNeto: '0.00' });
  const html = renderToStaticMarkup(createElement(CompanySummary, { summary: summaries[0]! }));
  expect(html).toContain('USD 0,00'); expect(html).toContain('Sin movimientos en el período');
  failed = ['ferraro/identidad', 'ferraro/egresos', 'ppf/identidad', 'ppf/egresos', 'rfn/identidad'];
  const unavailable = await loadFinancialSummaries(period);
  expect(consolidateSummaries(unavailable)).toMatchObject({ completo: false, cobros: null, egresos: null, saldoNeto: null });
  for (const summary of unavailable) expect(renderToStaticMarkup(createElement(CompanySummary, { summary }))).not.toContain('USD 0,00');
});
it('requires owner before any financial request', async () => {
  vi.mocked(requireOwner).mockRejectedValueOnce(new Error('REDIRECT'));
  await expect(loadCompanySummary('ferraro-detail', period)).rejects.toThrow('REDIRECT');
  expect(fetcher).not.toHaveBeenCalled();
});
it('ignores manual income and preserves refunds in the API period without regrouping', async () => {
  const summary = await loadCompanySummary('ferraro-detail', period);
  expect(summary.cobros).toBe('-0.10');
  expect(JSON.stringify(summary)).not.toContain('99999');
  for (const [url] of fetcher.mock.calls) if ((url as URL).pathname.endsWith('resumen') || (url as URL).pathname.endsWith('egresos')) {
    expect((url as URL).searchParams.get('desde')).toBe(period.desde); expect((url as URL).searchParams.get('hasta')).toBe(period.hasta);
  }
});
it('consolidates amounts beyond safe integer precision using cents', async () => {
  const summaries = (await loadFinancialSummaries(period)).map(s => ({ ...s, cobros: '9007199254740993.01', egresos: '0.02', saldoNeto: '9007199254740992.99' }));
  expect(consolidateSummaries(summaries)).toMatchObject({ cobros: '27021597764222979.03', egresos: '0.06', saldoNeto: '27021597764222978.97' });
});
it('keeps company pages, real connection states and expense breakdowns consistent at all requested widths', async () => {
  const [{ default: CompanyPage }, { default: CompaniesPage }, { default: ExpensesPage }, { readFile }, { chromium }, { default: styles }] = await Promise.all([
    import('@/app/(private)/empresas/[empresa]/page'), import('@/app/(private)/empresas/page'), import('@/app/(private)/gastos/page'),
    import('node:fs/promises'), import('@playwright/test'), import('@/components/patterns/page.module.css'),
  ]);
  const companyPages = await Promise.all(['ferraro-detail', 'ppf-house', 'rfn-argentina'].map(async empresa => renderToStaticMarkup(await CompanyPage({ params: Promise.resolve({ empresa }), searchParams: Promise.resolve(period) }))));
  for (const html of companyPages) expect([...html.matchAll(/<dt>(.*?)<\/dt>/g)].map(match => match[1])).toEqual(['Cobros', 'Egresos totales', 'Saldo neto', 'Compras', 'Sueldos pagados', 'Otros gastos']);
  const listing = renderToStaticMarkup(await CompaniesPage());
  expect(listing.match(/Conectada/g)).toHaveLength(3); expect(listing).not.toContain('Pendiente de conexión');
  failed = ['ppf/egresos'];
  const partialListing = renderToStaticMarkup(await CompaniesPage());
  expect(partialListing.match(/Conectada/g)).toHaveLength(2); expect(partialListing).toContain('Datos parciales');
  failed = [];
  const expenses = renderToStaticMarkup(await ExpensesPage({ searchParams: Promise.resolve(period) }));
  const expenseLabels = [...expenses.matchAll(/<dt>(.*?)<\/dt>/g)].map(match => match[1]);
  expect(expenseLabels).toEqual([
    'Compras', 'Sueldos pagados', 'Otros gastos · Gastos manuales', 'Egresos totales',
    'Compras', 'Sueldos pagados', 'Otros gastos · Gastos manuales', 'Egresos totales',
    'Compras', 'Sueldos pagados', 'Otros gastos · Gastos operativos', 'Egresos totales',
  ]);
  let css = await readFile(new URL('../../src/components/patterns/page.module.css', import.meta.url), 'utf8');
  css = css.replace(/\.([a-zA-Z][\w-]*)/g, (match, name) => styles[name] ? '.' + styles[name] : match);
  const tokens = await readFile(new URL('../../src/design-system/tokens.css', import.meta.url), 'utf8');
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1440, 768, 390]) {
      const tab = await browser.newPage({ viewport: { width, height: 1000 } });
      for (const [index, html] of [...companyPages, listing, expenses].entries()) {
        await tab.setContent(`<style>${tokens}*{box-sizing:border-box}body{margin:0;padding:20px}h1,h2,p{margin:0}${css}</style>${html}`);
        expect(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await tab.screenshot({ path: `/tmp/multiempresa-pages-${index}-${width}.png`, fullPage: true });
      }
      await tab.close();
    }
  } finally { await browser.close(); }
});

it('validates equivalent period objects and rejects invalid ranges before querying sources', async () => {
  await expect(loadCompanySummary('ferraro-detail', { desde: '2026-02-30', hasta: '2026-03-01' })).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  const first = await loadCompanySummary('ferraro-detail', period);
  const second = await loadCompanySummary('ferraro-detail', { ...period });
  expect(second).toEqual(first);
  // This isolated call does not assert cache behavior; dashboard-performance uses RSC.
});
