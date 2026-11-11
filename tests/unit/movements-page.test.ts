import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from '@playwright/test';
import { appCss } from '../fixtures/app-css';
vi.mock('server-only', () => ({}));
vi.mock('@/modules/identity/session', () => ({ requireOwner: vi.fn() }));
const mocks = vi.hoisted(() => ({ summary: vi.fn(), summaries: vi.fn(), movements: vi.fn() }));
vi.mock('@/modules/finance/summary.server', async original => ({ ...await original<typeof import('@/modules/finance/summary.server')>(), loadCompanySummary: mocks.summary, loadFinancialSummaries: mocks.summaries }));
vi.mock('@/modules/finance/movements.server', async original => ({ ...await original<typeof import('@/modules/finance/movements.server')>(), loadMovements: mocks.movements }));
import Page, { MovementSummary, MovementListing } from '@/app/(private)/movimientos/page';
import { requireOwner } from '@/modules/identity/session';
import { companies } from '@/config/companies';
import type { MovementFilters } from '@/modules/finance/movements.server';
import { layout } from '@/components/patterns/page';
const filters: MovementFilters = { desde: '2026-11-01', hasta: '2026-11-30', empresa: 'todas', tipo: 'todos' };
const summaries = companies.map(c => ({ empresaId: c.id, nombre: c.name, estado: 'completo', cobros: '100.10', egresos: '30.05', saldoNeto: '70.05' }));
const result = { complete: true, nextCursor: 'controlled-next', sources: companies.map(c => ({ empresaId: c.id, flujo: 'cobros', key: c.id + ':cobros', available: true })), movements: [
  { empresaId: 'rfn-argentina', flujo: 'cobros', idOrigen: 'id-1', fecha: '2026-11-15T03:15:00Z', tipo: 'SENIA', reversion: false, direccion: 'entrada', importeUsd: '0.10' },
  { empresaId: 'ppf-house', flujo: 'egresos', idOrigen: 'id-1', fecha: '2026-11-14T12:00:00Z', tipo: 'SALARY_PAYMENT', reversion: true, direccion: 'entrada', importeUsd: '2.00' },
  { empresaId: 'rfn-argentina', flujo: 'compras', idOrigen: 'id-1', fecha: '2026-11-13T12:00:00Z', tipo: 'COMPRA_RECIBIDA', reversion: false, direccion: 'salida', importeUsd: '-5.00' },
] };
beforeEach(() => { vi.clearAllMocks(); mocks.summary.mockResolvedValue(summaries[0]); mocks.summaries.mockResolvedValue(summaries); mocks.movements.mockResolvedValue(result); });
afterEach(() => vi.unstubAllEnvs());
it('shows summary totals for the whole period independently of visible rows and type', async () => {
  let html = renderToStaticMarkup(await MovementSummary({ filters }));
  expect(html).toContain('USD 300,30'); expect(html).toContain('USD 90,15'); expect(html).toContain('USD 210,15');
  expect(html).toContain('No equivale a ganancia ni saldo bancario conciliado');
  html = renderToStaticMarkup(await MovementSummary({ filters: { ...filters, empresa: 'ferraro-detail', tipo: 'egresos' } }));
  expect(mocks.summary).toHaveBeenCalledWith('ferraro-detail', expect.anything()); expect(html).toContain('USD 100,10');
  mocks.summaries.mockResolvedValue([summaries[0], { ...summaries[1], estado: 'parcial', egresos: null, saldoNeto: null }, summaries[2]]);
  html = renderToStaticMarkup(await MovementSummary({ filters }));
  expect(html).toContain('Consolidado incompleto'); expect(html).toContain('Subtotal de empresas disponibles'); expect(html).toContain('USD 200,20');
});
it('shows signed exact amounts, local dates, reversals, technical identity and safe pagination', async () => {
  const html = renderToStaticMarkup(await MovementListing({ params: filters, filters }));
  expect(html).toContain('+USD 0,10'); expect(html).toContain('USD -5,00'); expect(html).toContain('00:15:00');
  expect(html).toContain('Reversión de sueldo'); expect(html).toContain('Compra recibida'); expect(html).toContain('data-origen="rfn-argentina:compras:id-1"');
  expect(html).toContain('cursor=controlled-next'); expect(html).toContain('Siguiente'); expect(html).toContain('sin confirmación independiente de pago bancario');
  expect(html).not.toMatch(/cliente|proveedor|empleado|PRIVATE/);
});
it('distinguishes empty results, unavailable sources and incomplete lists without false zeroes', async () => {
  mocks.movements.mockResolvedValue({ ...result, movements: [], nextCursor: null });
  expect(renderToStaticMarkup(await MovementListing({ params: filters, filters }))).toContain('Sin movimientos');
  mocks.movements.mockResolvedValue({ ...result, movements: [], nextCursor: null, complete: false, sources: [{ ...result.sources[0], available: false }] });
  const html = renderToStaticMarkup(await MovementListing({ params: filters, filters }));
  expect(html).toContain('Listado incompleto'); expect(html).toContain('No disponible'); expect(html).not.toMatch(/Sin movimientos|USD 0,00|Siguiente/);
});
it('rejects invalid filters and authorization before financial access', async () => {
  expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ tipo: 'ventas' }) }))).toContain('role="alert"');
  expect(mocks.summaries).not.toHaveBeenCalled(); expect(mocks.movements).not.toHaveBeenCalled();
  vi.mocked(requireOwner).mockRejectedValueOnce(new Error('LOGIN'));
  await expect(Page({ searchParams: Promise.resolve(filters) })).rejects.toThrow('LOGIN');
});
it('renders filters without cursor and responsive rows at 1440, 768 and 390 px', async () => {
  const shell = await Page({ searchParams: Promise.resolve(filters) });
  // Resolve server boundaries explicitly; browser checks use controlled data only.
  const summary = await MovementSummary({ filters });
  const listing = await MovementListing({ params: filters, filters });
  const children = shell.props.children as React.ReactNode[];
  const html = renderToStaticMarkup(createElement('div', { className: layout.page }, children[0], children[1], summary, listing));
  expect(html).not.toContain('name="cursor"');
  for (const name of ['desde', 'hasta', 'empresa', 'tipo']) expect(html).toContain(`name="${name}"`);
  const css = await appCss();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;padding:16px;--surface:white;--border:#ddd;--muted:#555;--accent:#265e48} ${css}</style>${html}`);
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect.poll(() => page.getByRole('table').count()).toBe(1);
      expect(await page.getByLabel('Empresa', { exact: true }).count()).toBe(1);
    }
    await page.getByLabel('Tipo', { exact: true }).selectOption('egresos');
    await page.getByLabel('Empresa', { exact: true }).selectOption('ppf-house');
    expect(await page.locator('select[name=tipo]').inputValue()).toBe('egresos');
  } finally { await browser.close(); }
});
