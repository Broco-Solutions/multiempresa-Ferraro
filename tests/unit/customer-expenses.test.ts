import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
vi.mock('server-only', () => ({}));
vi.mock('@/modules/identity/session', () => ({ requireOwner: vi.fn() }));
const rfn = vi.hoisted(() => ({ summary: vi.fn(), expenses: vi.fn() }));
vi.mock('@/modules/integrations/rfn/finance.server', () => ({ loadRfnSummary: rfn.summary, loadRfnExpenses: rfn.expenses }));
import { loadCustomerExpenses, loadFerraroExpenses, loadPpfExpenses, type Source } from '@/modules/integrations/customer-receipts/client.server';
import { requireOwner } from '@/modules/identity/session';
import ExpensesPage from '@/app/(private)/gastos/page';
import styles from '@/components/patterns/page.module.css';
const period = { desde: '2026-11-01', hasta: '2026-11-30' };
const responsePeriod = { desde: '2026-11-01T03:00:00.000Z', hasta: '2026-12-01T02:59:59.999Z' };
const id = (index: number) => '00000000-0000-4000-8000-' + String(index).padStart(12, '0');
const movement = (index: number, overrides = {}) => ({ id: id(index), fecha: '2026-11-15T12:00:00.000Z', tipo: 'SALARY_PAYMENT', reversion: false, importeUsd: '500.00', ...overrides });
function payload(source: Source = 'ppf-house', overrides = {}) {
  return { version: 1, empresaId: source, moneda: 'USD', periodo: responsePeriod,
    totales: { compras: '100.00', gastosManuales: '30.00', sueldosPagados: '500.00', egresos: '630.00' },
    movimientos: [movement(3, { tipo: 'PURCHASE', importeUsd: '100.00' }), movement(2, { tipo: 'MANUAL_EXPENSE', importeUsd: '30.00' }), movement(1)], paginacion: { pagina: 1, porPagina: 25, total: 3, totalPaginas: 1, hayMas: false }, ...overrides };
}
const empty = { totales: { compras: '0.00', gastosManuales: '0.00', sueldosPagados: '0.00', egresos: '0.00' }, movimientos: [], paginacion: { pagina: 1, porPagina: 25, total: 0, totalPaginas: 1, hayMas: false } };
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv('FERRARO_API_BASE_URL', 'https://ferraro.test'); vi.stubEnv('FERRARO_API_KEY', 'f'.repeat(32));
  vi.stubEnv('PPF_API_BASE_URL', 'https://ppf.test'); vi.stubEnv('PPF_API_KEY', 'p'.repeat(32));
  fetcher = vi.fn(async (url: URL) => Response.json(payload(url.hostname === 'ferraro.test' ? 'ferraro-detail' : 'ppf-house')));
  vi.stubGlobal('fetch', fetcher);
  rfn.summary.mockResolvedValue({ ok: true, summary: { totales: { gastos: '10.10', compras: '20.20', egresos: '30.30' } } });
  rfn.expenses.mockResolvedValue({ ok: true, expenses: { gastos: [{ id: 'rfn-1', fecha: '2026-11-01T12:00:00Z', categoria: 'Sueldos', medioPago: 'TRANSFERENCIA', importe: '10.10', concepto: 'PERSONAL_NAME_MUST_NOT_LEAK' }], totalDelFiltro: '10.10', paginacion: { pagina: 1, porPagina: 25, total: 26, totalPaginas: 2, hayMas: true } } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
it.each(['ferraro-detail', 'ppf-house'] as const)('validates %s and uses only its private key', async source => {
  const result = await loadCustomerExpenses(source, period, 1);
  expect(result.ok).toBe(true);
  const [url, init] = fetcher.mock.calls[0]!;
  expect(url.pathname).toBe('/api/consolidado/egresos');
  expect(url.searchParams.get('pagina')).toBe('1');
  expect(init).toMatchObject({ method: 'GET', cache: 'no-store', redirect: 'error', headers: { 'x-api-key': (source === 'ferraro-detail' ? 'f' : 'p').repeat(32) } });
  expect(init.signal).toBeInstanceOf(AbortSignal);
  expect(requireOwner).toHaveBeenCalled();
  expect(JSON.stringify(result)).not.toContain('f'.repeat(32));
  expect(JSON.stringify(result)).not.toContain('p'.repeat(32));
});
it('exports company wrappers and keeps empty valid periods distinct from failures', async () => {
  fetcher.mockImplementation(async (url: URL) => Response.json(payload(url.hostname === 'ferraro.test' ? 'ferraro-detail' : 'ppf-house', empty)));
  for (const load of [loadFerraroExpenses, loadPpfExpenses]) {
    expect(await load(period, 1)).toMatchObject({ ok: true, expenses: { totales: empty.totales } });
  }
});
it.each([
  { empresaId: 'ferraro-detail' }, { version: 2 }, { moneda: 'ARS' },
  { totales: { compras: '100.00', gastosManuales: '30.00', sueldosPagados: '500.00', egresos: '1130.00' } },
  { totales: { compras: 100, gastosManuales: '30.00', sueldosPagados: '500.00', egresos: '630.00' } },
  { movimientos: [movement(1, { empleado: 'PERSONAL_NAME_MUST_NOT_LEAK' })] },
  { movimientos: [movement(1, { fecha: '2026-12-01T03:00:00.000Z' })] },
  { movimientos: [movement(1, { reversion: true, importeUsd: '500.00' })] },
  { paginacion: { pagina: 2, porPagina: 25, total: 1, totalPaginas: 1, hayMas: false } },
  { paginacion: { pagina: 1, porPagina: 24, total: 1, totalPaginas: 1, hayMas: false } },
  { paginacion: { pagina: 1, porPagina: 25, total: 1, totalPaginas: 2, hayMas: true } },
  { movimientos: [] },
  { ...empty, totales: { ...empty.totales, egresos: '1.00', compras: '1.00' } },
])('rejects incompatible identity, totals, personal fields or pagination: %j', async overrides => {
  fetcher.mockResolvedValue(Response.json(payload('ppf-house', overrides)));
  const result = await loadPpfExpenses(period, 1);
  expect(result.ok).toBe(false); expect(result).not.toHaveProperty('expenses');
  expect(JSON.stringify(result)).not.toContain('PERSONAL_NAME_MUST_NOT_LEAK');
});
it('rejects incompatible Argentine boundaries with a distinct status', async () => {
  fetcher.mockResolvedValue(Response.json(payload('ppf-house', { periodo: { ...responsePeriod, desde: '2026-11-01T00:00:00.000Z' } })));
  expect(await loadPpfExpenses(period, 1)).toMatchObject({ ok: false, reason: 'PERIOD_MISMATCH' });
});
it('sums cents exactly, including negative reversal totals', async () => {
  const totales = { compras: '0.10', gastosManuales: '0.20', sueldosPagados: '-500.00', egresos: '-499.70' };
  fetcher.mockResolvedValue(Response.json(payload('ppf-house', { totales, movimientos: [movement(1, { reversion: true, importeUsd: '-500.00' })], paginacion: { pagina: 1, porPagina: 25, total: 1, totalPaginas: 1, hayMas: false } })));
  expect(await loadPpfExpenses(period, 1)).toMatchObject({ ok: true, expenses: { totales } });
});
it.each([401, 403, 500])('does not turn HTTP %s into zero', async status => {
  fetcher.mockResolvedValue(new Response('', { status }));
  expect(await loadPpfExpenses(period, 1)).toMatchObject({ ok: false, reason: 'UNAVAILABLE' });
});
it('sanitizes timeouts and network errors', async () => {
  fetcher.mockRejectedValue(new Error('private-key-MUST_NOT_LEAK'));
  const result = await loadPpfExpenses(period, 1);
  expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain('MUST_NOT_LEAK');
});
it('requires the owner before any request', async () => {
  vi.mocked(requireOwner).mockRejectedValueOnce(new Error('REDIRECT_LOGIN'));
  await expect(loadPpfExpenses(period, 1)).rejects.toThrow('REDIRECT_LOGIN'); expect(fetcher).not.toHaveBeenCalled();
});
it.each([0, 1.5, 1000001])('rejects invalid requested page %s before fetching', async page => {
  expect((await loadPpfExpenses(period, page)).ok).toBe(false); expect(fetcher).not.toHaveBeenCalled();
});
it('rejects missing configuration without requesting data', async () => {
  vi.stubEnv('PPF_API_KEY', ''); expect((await loadPpfExpenses(period, 1)).ok).toBe(false); expect(fetcher).not.toHaveBeenCalled();
});
async function page(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await ExpensesPage({ searchParams: Promise.resolve({ ...period, ...params }) }));
}
it('renders the exact three-source total and salary breakdown without a global table', async () => {
  const html = await page();
  expect(html).toContain('Total de las tres empresas'); expect(html).toContain('USD 1.290,30');
  expect(html).toContain('Sueldos pagados'); expect(html).toContain('USD 500,00');
  expect(html).not.toContain('Consolidado incompleto'); expect(html).not.toContain('<table');
  expect(html).toContain('seleccionando una empresa');
});
it('RFN outage retains its card and the exact validated partial subtotal', async () => {
  rfn.summary.mockResolvedValue({ ok: false, message: 'RFN Argentina: el período devuelto no coincide con los límites argentinos solicitados.' });
  const html = await page();
  expect(html).toContain('Consolidado incompleto'); expect(html).toContain('Subtotal de empresas disponibles');
  expect(html).toContain('USD 1.260,00'); expect(html).toContain('Fuentes sin datos válidos: RFN Argentina');
  expect(html).toContain('Período incompatible'); expect(html).not.toContain('Total de las tres empresas');
});

it('withholds the RFN list as well when its summary period is invalid', async () => {
  rfn.summary.mockResolvedValue({ ok: false, message: 'RFN Argentina: el período devuelto no coincide con los límites argentinos solicitados.' });
  const html = await page({ empresa: 'rfn-argentina' });
  expect(html).toContain('Período incompatible'); expect(html).not.toContain('<table');
  expect(html).not.toContain('USD 10,10'); expect(html).not.toContain('Siguiente');
});

it('does not display zero for unavailable sources', async () => {
  fetcher.mockRejectedValue(new Error('private failure')); rfn.summary.mockResolvedValue({ ok: false, message: 'RFN Argentina no disponible.' });
  const html = await page(); expect(html).not.toContain('USD 0,00'); expect(html).not.toContain('Sin datos');
});
it('shows exact zero only for validated empty sources', async () => {
  fetcher.mockImplementation(async (url: URL) => Response.json(payload(url.hostname === 'ferraro.test' ? 'ferraro-detail' : 'ppf-house', empty)));
  const html = await page({ empresa: 'ppf-house' }); expect(html).toContain('USD 0,00'); expect(html).toContain('Sin movimientos');
});
it('paid PPF salary appears in the detail and pagination preserves company and period', async () => {
  fetcher.mockImplementation(async (url: URL) => {
    const source = url.hostname === 'ferraro.test' ? 'ferraro-detail' : 'ppf-house';
    return Response.json(payload(source, source === 'ppf-house' ? { movimientos: Array.from({ length: 25 }, (_, i) => movement(25 - i, { importeUsd: '1.00' })), paginacion: { pagina: 2, porPagina: 25, total: 51, totalPaginas: 3, hayMas: true } } : {}));
  });
  const html = await page({ empresa: 'ppf-house', pagina: '2' });
  expect(html).toContain('Sueldo pagado'); expect(html).toContain('Página 2 de 3');
  expect(html).toContain('empresa=ppf-house&amp;pagina=1'); expect(html).toContain('empresa=ppf-house&amp;pagina=3');
  expect(html).toContain('desde=2026-11-01&amp;hasta=2026-11-30');
});
it('RFN keeps categories and pagination, without exposing free text or adding purchases to the list', async () => {
  const html = await page({ empresa: 'rfn-argentina', categoria: 'Sueldos' });
  expect(rfn.expenses).toHaveBeenCalledWith(period, { pagina: 1, porPagina: 25, categoria: 'Sueldos' });
  expect(html).toContain('Categoría original'); expect(html).toContain('Sueldos'); expect(html).toContain('categoria=Sueldos');
  expect(html).not.toContain('PERSONAL_NAME_MUST_NOT_LEAK'); expect(html).toContain('Este listado no incluye compras');
});
it('has no financial data or keys in invalid filters', async () => {
  const html = await page({ empresa: 'unknown' }); expect(html).toContain('filtros inválidos'); expect(fetcher).not.toHaveBeenCalled();
});
it('keeps filters and the summary responsive at mobile and desktop widths', async () => {
  const html = await page({ empresa: 'ppf-house' });
  let css = await readFile(new URL('../../src/components/patterns/page.module.css', import.meta.url), 'utf8');
  css = css.replace(/\.([a-zA-Z][\w-]*)/g, (match, name) => styles[name] ? '.' + styles[name] : match);
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1280]) {
      const tab = await browser.newPage({ viewport: { width, height: 844 } });
      await tab.setContent(`<style>body{margin:0;padding:16px}*{box-sizing:border-box}h1,h2,h3,p{margin:0}:root{--border:#ddd;--surface:#fff;--text:#222;--muted:#666;--accent:#456}${css}</style>${html}`);
      expect(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await tab.locator('select[name=empresa]').selectOption('ppf-house');
      expect(await tab.getByRole('button', { name: 'Consultar' }).isVisible()).toBe(true);
      await tab.screenshot({ path: `/tmp/multiempresa-egresos-${width}.png`, fullPage: true });
      await tab.close();
    }
  } finally { await browser.close(); }
});
it('validates identity for the movements consumer before expense detail', async () => {
  const guarded = vi.fn(async (url: URL) => Response.json(url.pathname.endsWith('/identidad') ? { version: 1, moneda: 'USD', empresaId: 'wrong' } : payload()));
  vi.stubGlobal('fetch', guarded);
  expect((await loadCustomerExpenses('ppf-house', period, 1, true)).ok).toBe(false);
  expect(guarded).toHaveBeenCalledTimes(1);
});
