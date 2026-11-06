import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
vi.mock('server-only', () => ({}));
vi.mock('@/modules/identity/session', () => ({ requireOwner: vi.fn() }));
vi.mock('@/modules/integrations/customer-receipts/client.server', () => ({ loadFerraroReceipts: vi.fn(), loadPpfReceipts: vi.fn() }));
vi.mock('@/modules/integrations/rfn/finance.server', () => ({ loadRfnSummary: vi.fn() }));
import IncomePage from '@/app/(private)/ingresos/page';
import { requireOwner } from '@/modules/identity/session';
import { loadFerraroReceipts, loadPpfReceipts } from '@/modules/integrations/customer-receipts/client.server';
import { loadRfnSummary } from '@/modules/integrations/rfn/finance.server';
import { type SearchParams } from '@/modules/integrations/rfn/period';
import styles from '@/components/patterns/page.module.css';
const period = { desde: '2026-11-01', hasta: '2026-11-30' };
const loaders = [loadFerraroReceipts, loadPpfReceipts, loadRfnSummary];
async function render(params: SearchParams = period) {
  return renderToStaticMarkup(await IncomePage({ searchParams: Promise.resolve(params) }));
}
function rfn(cobros: string) {
  // Only the validated receipts field is consumed by this page.
  vi.mocked(loadRfnSummary).mockResolvedValue({ ok: true, summary: { totales: { cobros } } } as Awaited<ReturnType<typeof loadRfnSummary>>);
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadFerraroReceipts).mockResolvedValue({ ok: true, cobros: '-0.10', movimientos: 1 });
  vi.mocked(loadPpfReceipts).mockResolvedValue({ ok: true, cobros: '1000.20', movimientos: 2 });
  rfn('30.30');
});
afterEach(() => { vi.useRealTimers(); });
it('shows three validated sources and the exact sum, with functional GET controls and no type filter', async () => {
  const html = await render();
  expect(html).toContain('USD 1.030,40');
  expect(html.match(/<article/g)).toHaveLength(3);
  expect(html).toContain('method="get"');
  for (const name of ['desde', 'hasta', 'empresa']) expect(html).toContain(`name="${name}"`);
  expect(html).toContain('value="todas" selected');
  expect(html).toContain('type="submit"');
  expect(html).not.toMatch(/disabled|name="tipo"|Consolidado incompleto/);
  for (const loader of loaders) expect(loader).toHaveBeenCalledExactlyOnceWith(period);
  expect(html).toContain('America/Argentina/Buenos_Aires');
});
it.each(['ferraro-detail', 'ppf-house', 'rfn-argentina'])('queries only the selected source: %s', async empresa => {
  const html = await render({ ...period, empresa });
  const selected = ['ferraro-detail', 'ppf-house', 'rfn-argentina'].indexOf(empresa);
  loaders.forEach((loader, index) => expect(loader).toHaveBeenCalledTimes(index === selected ? 1 : 0));
  expect(html.match(/<article/g)).toHaveLength(1);
  expect(html).toContain(`value="${empresa}" selected`);
  expect(html).not.toMatch(/Consolidado|del conjunto|Subtotal|Total de las tres/);
});
it.each([
  { empresa: 'otra' }, { empresa: ['ppf-house', 'rfn-argentina'] },
  { desde: '2026-02-30', hasta: '2026-03-01' }, { desde: '2026-12-01', hasta: '2026-11-01' },
  { desde: '2026-11-01', hasta: undefined }, { desde: ['2026-11-01'], hasta: '2026-11-30' },
])('rejects invalid filters before calling any source: %j', async params => {
  expect(await render({ ...period, ...params })).toContain('role="alert"');
  for (const loader of loaders) expect(loader).not.toHaveBeenCalled();
});
it('uses the current Argentine month across a UTC month boundary and forwards changed dates unchanged', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-12-01T01:30:00Z'));
  const html = await render({});
  expect(html).toContain('value="2026-11-01"'); expect(html).toContain('value="2026-11-30"');
  for (const loader of loaders) expect(loader).toHaveBeenCalledWith(period);
  const changed = { desde: '2024-02-29', hasta: '2024-03-01' };
  await render(changed);
  for (const loader of loaders) expect(loader).toHaveBeenLastCalledWith(changed);
});
it('preserves exact cents beyond safe integer precision', async () => {
  vi.mocked(loadFerraroReceipts).mockResolvedValue({ ok: true, cobros: '9007199254740993.01', movimientos: 1 });
  vi.mocked(loadPpfReceipts).mockResolvedValue({ ok: true, cobros: '0.02', movimientos: 1 }); rfn('-0.01');
  expect(await render()).toContain('USD 9.007.199.254.740.993,02');
});
it('shows partial receipts without treating a failure as zero, and no total when all sources fail', async () => {
  const failure = { ok: false as const, message: 'Conexión fallida.' };
  vi.mocked(loadPpfReceipts).mockResolvedValue(failure);
  let html = await render();
  expect(html).toContain('Consolidado incompleto'); expect(html).toContain('Sin cobros validados de: PPF House');
  expect(html).toContain('Subtotal de empresas disponibles'); expect(html).toContain('USD 30,20');
  expect(html).not.toContain('USD 0,00');
  html = await render({ ...period, empresa: 'ppf-house' });
  expect(html).toContain('No disponible'); expect(html).not.toMatch(/USD 0,00|Consolidado|Subtotal/);
  vi.mocked(loadFerraroReceipts).mockResolvedValue(failure); vi.mocked(loadRfnSummary).mockResolvedValue(failure);
  html = await render(); expect(html).toContain('No disponible'); expect(html).not.toMatch(/USD [\d-]/);
});
it('shows validated empty periods as zero', async () => {
  for (const loader of [loadFerraroReceipts, loadPpfReceipts]) vi.mocked(loader).mockResolvedValue({ ok: true, cobros: '0.00', movimientos: 0 });
  rfn('0.00');
  const html = await render(); expect(html.match(/USD 0,00/g)).toHaveLength(4); expect(html).not.toContain('No disponible');
});
it('requires the owner before querying financial sources', async () => {
  vi.mocked(requireOwner).mockRejectedValueOnce(new Error('REDIRECT'));
  await expect(render()).rejects.toThrow('REDIRECT');
  for (const loader of loaders) expect(loader).not.toHaveBeenCalled();
});
it('submits accessible filters through the browser and stays within 390, 768 and 1440 px', async () => {
  let css = await readFile(new URL('../../src/components/patterns/page.module.css', import.meta.url), 'utf8');
  css = css.replace(/\.([a-zA-Z][\w-]*)/g, (match, name) => styles[name] ? '.' + styles[name] : match);
  const tokens = await readFile(new URL('../../src/design-system/tokens.css', import.meta.url), 'utf8');
  const browser = await chromium.launch({ headless: true });
  try {
    const tab = await browser.newPage();
    tab.setDefaultTimeout(5000);
    await tab.route('http://ingresos.test/**', async route => {
      const params = Object.fromEntries(new URL(route.request().url()).searchParams);
      await route.fulfill({ contentType: 'text/html', body: `<meta charset="utf-8"><style>${tokens}*{box-sizing:border-box}body{margin:0;padding:20px}${css}</style>${await render(params)}` });
    });
    await tab.goto('http://ingresos.test/ingresos');
    for (const width of [390, 768, 1440]) {
      await tab.setViewportSize({ width, height: 1000 });
      expect(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await tab.screenshot({ path: `/tmp/multiempresa-ingresos-${width}.png`, fullPage: true });
    }
    await tab.getByLabel('Desde', { exact: true }).fill('2024-02-29');
    await tab.getByLabel('Hasta', { exact: true }).fill('2024-03-01');
    await tab.getByLabel('Empresa', { exact: true }).selectOption('ppf-house');
    await Promise.all([tab.waitForURL(/empresa=ppf-house/), tab.getByRole('button', { name: 'Consultar' }).click()]);
    const url = new URL(tab.url());
    expect(Object.fromEntries(url.searchParams)).toEqual({ desde: '2024-02-29', hasta: '2024-03-01', empresa: 'ppf-house' });
    expect(await tab.getByLabel('Desde', { exact: true }).inputValue()).toBe('2024-02-29');
    expect(await tab.getByLabel('Hasta', { exact: true }).inputValue()).toBe('2024-03-01');
    expect(await tab.getByLabel('Empresa', { exact: true }).inputValue()).toBe('ppf-house');
    expect(await tab.getByRole('article').count()).toBe(1);
    expect(await tab.getByRole('article').textContent()).toContain('USD 1.000,20');
  } finally { await browser.close(); }
});
