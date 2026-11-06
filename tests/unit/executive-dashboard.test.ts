import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, isValidElement, type ReactNode, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
vi.mock('server-only', () => ({}));
vi.mock('@/modules/identity/session', () => ({ requireOwner: vi.fn() }));
vi.mock('@/modules/finance/summary.server', async importOriginal => ({
  ...await importOriginal<typeof import('@/modules/finance/summary.server')>(),
  loadFinancialSummaries: vi.fn(), loadCompanyComparison: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/components/patterns/comparison-chart', () => ({ ComparisonChart: () => createElement('section', { 'aria-label': 'Comparación mensual' }, 'Gráfico mensual existente') }));
import { executivePresets, readExecutivePeriod, previousExecutivePeriod, activeExecutivePreset } from '@/modules/finance/executive-periods';
import { financialVariation, executiveComparison, receiptsParticipation } from '@/modules/finance/executive-metrics';
import { readPeriod } from '@/modules/integrations/rfn/period';
import { companies } from '@/config/companies';
import { centsToUsd, usdToCents } from '@/modules/integrations/rfn/money';
import { loadFinancialSummaries, type FinancialCompanySummary } from '@/modules/finance/summary.server';
import { requireOwner } from '@/modules/identity/session';
import Home from '@/app/(private)/page';
import { CompanyParticipation, PreviousComparison } from '@/components/patterns/executive-insights';
import styles from '@/components/patterns/page.module.css';
const now = new Date('2026-11-06T15:00:00Z');
const period = { desde: '2026-11-01', hasta: '2026-11-06' };
function summaries(receipts: (string | null)[] = ['50.00', '30.00', '20.00'], range = period): FinancialCompanySummary[] {
  return companies.map((company, index) => ({ empresaId: company.id, nombre: company.name, periodo: range, estado: receipts[index] === null ? 'parcial' : 'completo', cobros: receipts[index]!, egresos: '10.01', saldoNeto: receipts[index] === null ? null : centsToUsd(usdToCents(receipts[index]!) - 1001n), compras: '0.00', sueldosPagados: null, otrosGastos: '10.01', detalleOtrosGastos: 'Gastos', mensaje: null }));
}
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now); vi.mocked(loadFinancialSummaries).mockResolvedValue(summaries()); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
describe('calendario argentino y comparación inclusiva', () => {
  it('genera los cuatro rangos solicitados y el predeterminado exclusivo de Inicio', () => {
    expect(executivePresets(now).map(value => value.period)).toEqual([
      period, { desde: '2026-10-01', hasta: '2026-10-31' }, { desde: '2026-09-01', hasta: '2026-11-06' }, { desde: '2026-06-01', hasta: '2026-11-06' },
    ]);
    expect(readExecutivePeriod({}, now)).toEqual(period);
    expect(readPeriod({})).toEqual({ desde: '2026-11-01', hasta: '2026-11-30' });
  });
  it('respeta medianoche argentina, años bisiestos, cambios de año y TZ del servidor', () => {
    for (const tz of ['UTC', 'Asia/Tokyo', 'America/Los_Angeles']) {
      vi.stubEnv('TZ', tz);
      const presets = executivePresets(new Date('2024-03-01T02:59:59Z'));
      expect(presets[0].period).toEqual({ desde: '2024-02-01', hasta: '2024-02-29' });
      expect(presets[1].period).toEqual({ desde: '2024-01-01', hasta: '2024-01-31' });
      expect(executivePresets(new Date('2026-01-06T15:00:00Z'))[3].period).toEqual({ desde: '2025-08-01', hasta: '2026-01-06' });
      expect(executivePresets(new Date('2024-03-01T03:00:00Z'))[1].period.hasta).toBe('2024-02-29');
    }
  });
  it('compara Este mes por tramo y Mes anterior por calendario completo', () => {
    expect(previousExecutivePeriod(period, now)).toEqual({ period: { desde: '2026-10-01', hasta: '2026-10-06' }, equivalent: true });
    expect(previousExecutivePeriod(executivePresets(now)[1].period, now)).toEqual({ period: { desde: '2026-09-01', hasta: '2026-09-30' }, equivalent: true });
    const march = new Date('2026-03-31T15:00:00Z');
    expect(previousExecutivePeriod(executivePresets(march)[0].period, march)).toEqual({ period: { desde: '2026-02-01', hasta: '2026-02-28' }, equivalent: false });
  });
  it.each([2, 3])('calcula duración exacta sin huecos ni superposición: preset %i', index => {
    const range = executivePresets(now)[index]!.period;
    const previous = previousExecutivePeriod(range, now).period;
    const ms = (value: string) => Date.parse(value + 'T00:00:00Z');
    expect(ms(range.desde) - ms(previous.hasta)).toBe(86400000);
    expect(ms(range.hasta) - ms(range.desde)).toBe(ms(previous.hasta) - ms(previous.desde));
  });
  it('conserva rangos personalizados y calcula su anterior a través del día bisiesto', () => {
    const custom = { desde: '2024-03-01', hasta: '2024-03-02' };
    expect(readExecutivePeriod(custom, now)).toEqual(custom);
    expect(activeExecutivePreset(custom, now)).toBeUndefined();
    expect(previousExecutivePeriod(custom, now).period).toEqual({ desde: '2024-02-28', hasta: '2024-02-29' });
  });
});
describe('precisión de variaciones y cobertura', () => {
  it.each([
    ['100.11', '80.03', '20.08', '25,1 %'], ['0.00', '3.00', '-3.00', '-100,0 %'],
    ['-1.01', '2.00', '-3.01', '-150,5 %'], ['1.01', '1.00', '0.01', '1,0 %'],
    ['0.99', '1.00', '-0.01', '-1,0 %'], ['1.00', '1.00', '0.00', '0,0 %'],
    ['2.01', '2.00', '0.01', '0,5 %'], ['1.99', '2.00', '-0.01', '-0,5 %'],
    ['20.01', '20.00', '0.01', '0,1 %'], ['19.99', '20.00', '-0.01', '-0,1 %'],
    ['9007199254740993.02', '9007199254740993.01', '0.01', '0,0 %'],
  ])('resta y redondea exactamente %s contra %s', (actual, prior, difference, percentage) => {
    expect(financialVariation(actual, prior)).toEqual({ difference, percentage, reason: null });
  });
  it.each(['0.00', '-1.00'])('no calcula crecimiento con base %s', previous => {
    expect(financialVariation('10.00', previous)).toMatchObject({ percentage: null, reason: 'Sin base comparable' });
  });
  it('distingue ausencia y períodos no equivalentes, conservando diferencia exacta', () => {
    expect(financialVariation(null, '1.00')).toEqual({ difference: null, percentage: null, reason: 'No disponible' });
    expect(financialVariation('1.00', null).reason).toBe('No disponible');
    expect(financialVariation('2.00', '1.01', false)).toEqual({ difference: '0.99', percentage: null, reason: 'Períodos no equivalentes' });
  });
  it('suma cobertura completa y respeta devoluciones, sin publicar variaciones de cobertura parcial', () => {
    const current = summaries(['-0.10', '1000.20', '30.30']);
    const prior = summaries(['1.00', '2.00', '3.00']);
    expect(executiveComparison(current, prior).metrics[0]).toMatchObject({ current: '1030.40', previous: '6.00', difference: '1024.40' });
    prior[1]!.egresos = null;
    expect(executiveComparison(current, prior)).toMatchObject({ complete: false, missingPrevious: ['PPF House'], metrics: [] });
    current[0]!.saldoNeto = null;
    expect(executiveComparison(current, prior).missingCurrent).toEqual(['Ferraro Detail']);
    expect(executiveComparison([], []).metrics).toEqual([]);
  });
});
describe('participación exacta', () => {
  it.each([
    [['50.00', '30.00', '20.00'], ['50,0 %', '30,0 %', '20,0 %']],
    [['0.01', '0.01', '0.01'], ['33,4 %', '33,3 %', '33,3 %']],
    [['0.00', '0.01', '0.02'], ['0,0 %', '33,3 %', '66,7 %']],
    [['9007199254740993.01', '9007199254740993.01', '9007199254740993.01'], ['33,4 %', '33,3 %', '33,3 %']],
  ])('distribuye %j con suma de 1000 décimas', (values, expected) => {
    const result = receiptsParticipation(summaries(values));
    expect(result.reason).toBeNull();
    expect(result.rows.map(row => row.percentage)).toEqual(expected);
    expect(result.rows.reduce((sum, row) => sum + row.tenths!, 0n)).toBe(1000n);
  });
  it.each([
    [['0.00', '0.00', '0.00'], 'cero o negativo'], [['-1.00', '-2.00', '-3.00'], 'negativos'],
    [['-0.01', '1.00', '2.00'], 'negativos'], [[null, '1.00', '2.00'], 'Ferraro Detail'],
  ])('retiene importes y suprime porcentajes inválidos: %j', (values, reason) => {
    const result = receiptsParticipation(summaries(values));
    expect(result.reason).toContain(reason);
    expect(result.rows.map(row => row.receipts)).toEqual(values);
    expect(result.rows.every(row => row.tenths === null && row.percentage === null)).toBe(true);
  });
});
// Resolve async Server Components explicitly for isolated browser rendering.
async function resolve(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(resolve));
  if (!isValidElement<{ children?: ReactNode }>(node)) return node;
  if (typeof node.type === 'function') return resolve(await (node.type as (props: unknown) => ReactNode)(node.props));
  return createElement(node.type, { ...node.props, key: node.key }, await resolve(node.props.children));
}
function findComponent(node: ReactNode, name: string): ReactElement | undefined {
  if (Array.isArray(node)) return node.map(child => findComponent(child, name)).find(Boolean);
  if (!isValidElement<{ children?: ReactNode }>(node)) return;
  if (typeof node.type === 'function' && node.type.name === name) return node;
  return findComponent(node.props.children, name);
}
it('rejects invalid periods before API calls and maintains the owner boundary', async () => {
  for (const params of [{ desde: '2026-02-30', hasta: '2026-03-01' }, { desde: '2026-12-01', hasta: '2026-11-01' }, { desde: ['2026-11-01'], hasta: '2026-11-06' }, { desde: '2026-11-01' }]) {
    expect(renderToStaticMarkup(await Home({ searchParams: Promise.resolve(params) }))).toContain('role="alert"');
  }
  expect(loadFinancialSummaries).not.toHaveBeenCalled();
  vi.mocked(requireOwner).mockRejectedValueOnce(new Error('REDIRECT'));
  await expect(Home({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT');
  expect(loadFinancialSummaries).not.toHaveBeenCalled();
});
it('loads current once, defers previous to Suspense, and recovers comparison failure with current KPIs intact', async () => {
  const home = await Home({ searchParams: Promise.resolve({}) });
  expect(loadFinancialSummaries).toHaveBeenCalledExactlyOnceWith(period);
  const component = findComponent(home, 'ExecutivePreviousComparison')!;
  vi.mocked(loadFinancialSummaries).mockResolvedValueOnce(summaries(['10.00', '20.00', '30.00']));
  const comparison = renderToStaticMarkup(await resolve(component));
  expect(loadFinancialSummaries).toHaveBeenCalledTimes(2);
  expect(loadFinancialSummaries).toHaveBeenLastCalledWith({ desde: '2026-10-01', hasta: '2026-10-06' });
  expect(comparison).toContain('USD 40,00'); expect(comparison).toContain('66,7 %');
  vi.mocked(loadFinancialSummaries).mockRejectedValueOnce(new Error('PRIVATE_DIAGNOSTIC'));
  const failure = renderToStaticMarkup(await resolve(component));
  expect(failure).toContain('Comparación consolidada incompleta'); expect(failure).not.toContain('PRIVATE_DIAGNOSTIC');
  expect(failure).not.toContain('USD 0,00');
  const html = renderToStaticMarkup(home);
  expect(html).toContain('USD 100,00'); expect(html).toContain('Calculando comparación anterior…');
});
it('renders accessible filters, proportional CSS bars and exact comparisons at 1440, 768 and 390 px', async () => {
  vi.useRealTimers();
  let css = await readFile(new URL('../../src/components/patterns/page.module.css', import.meta.url), 'utf8');
  css = css.replace(/\.([a-zA-Z][\w-]*)/g, (match, name) => styles[name] ? '.' + styles[name] : match);
  const tokens = await readFile(new URL('../../src/design-system/tokens.css', import.meta.url), 'utf8');
  const browser = await chromium.launch({ headless: true });
  try {
    const tab = await browser.newPage();
    await tab.route('http://executive.test/**', async route => {
      const params = Object.fromEntries(new URL(route.request().url()).searchParams);
      const body = renderToStaticMarkup(await resolve(await Home({ searchParams: Promise.resolve(params) })));
      await route.fulfill({ contentType: 'text/html', body: `<meta charset="utf-8"><style>${tokens}*{box-sizing:border-box}body{margin:0;padding:20px}h1,h2,p{margin:0}${css}</style>${body}` });
    });
    await tab.goto('http://executive.test/');
    for (const width of [1440, 768, 390]) {
      await tab.setViewportSize({ width, height: 1000 });
      expect(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const section = tab.getByRole('region', { name: 'Participación de las empresas', exact: true });
      const tracks = section.locator(`.${styles.participationTrack}`);
      expect(await tracks.count()).toBe(3);
      for (const [index, expected] of [0.5, 0.3, 0.2].entries()) {
        const ratio = await tracks.nth(index).evaluate(element => element.firstElementChild!.getBoundingClientRect().width / element.getBoundingClientRect().width);
        expect(ratio).toBeCloseTo(expected, 2);
      }
      await tab.screenshot({ path: `/tmp/multiempresa-executive-${width}.png`, fullPage: true });
    }
    const presets = tab.getByRole('navigation', { name: 'Filtros rápidos' });
    for (const preset of executivePresets()) {
      await presets.getByRole('link', { name: preset.label, exact: true }).click();
      expect(Object.fromEntries(new URL(tab.url()).searchParams)).toEqual(preset.period);
      expect(await presets.getByRole('link', { name: preset.label, exact: true }).getAttribute('aria-current')).toBe('true');
      expect(await tab.getByLabel('Desde', { exact: true }).inputValue()).toBe(preset.period.desde);
      expect(await tab.getByLabel('Hasta', { exact: true }).inputValue()).toBe(preset.period.hasta);
    }
    await tab.getByLabel('Desde', { exact: true }).fill('2024-02-29');
    await tab.getByLabel('Hasta', { exact: true }).fill('2024-03-02');
    await tab.getByRole('button', { name: 'Consultar' }).click();
    expect(Object.fromEntries(new URL(tab.url()).searchParams)).toEqual({ desde: '2024-02-29', hasta: '2024-03-02' });
    expect(await presets.locator('[aria-current]').count()).toBe(0);
    expect(await tab.getByText(/Rango personalizado/).count()).toBe(1);
    const invalidHtml = renderToStaticMarkup(createElement(CompanyParticipation, { summaries: summaries([null, '1.00', '2.00']) }));
    expect(invalidHtml).toContain('Participación no disponible'); expect(invalidHtml).not.toContain('aria-hidden');
    for (const width of [1440, 768, 390]) {
      await tab.setViewportSize({ width, height: 1000 });
      const comparison = renderToStaticMarkup(createElement(PreviousComparison, { current: summaries(['-0.01', '30.00', '20.00']), previous: [], period, comparison: previousExecutivePeriod(period, now) }));
      await tab.setContent(`<style>${tokens}*{box-sizing:border-box}body{margin:0;padding:20px}${css}</style>${invalidHtml}${comparison}`);
      expect(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  } finally { await browser.close(); }
});
