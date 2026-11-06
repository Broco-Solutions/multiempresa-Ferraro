import { companies } from '@/config/companies';
import type { FinancialCompanySummary } from './summary.server';
import { centsToUsd, usdToCents } from '@/modules/integrations/rfn/money';

export function formatTenths(value: bigint) {
  const abs = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${abs / 10n},${abs % 10n} %`;
}
export function financialVariation(current: string | null, previous: string | null, equivalent = true) {
  if (current === null || previous === null) return { difference: null, percentage: null, reason: 'No disponible' };
  const base = usdToCents(previous), delta = usdToCents(current) - base;
  const difference = centsToUsd(delta);
  if (!equivalent) return { difference, percentage: null, reason: 'Períodos no equivalentes' };
  if (base <= 0n) return { difference, percentage: null, reason: 'Sin base comparable' };
  // Round absolute tenths half away from zero, then restore the sign.
  const abs = delta < 0n ? -delta : delta;
  const rounded = (abs * 1000n + base / 2n) / base;
  return { difference, percentage: formatTenths(delta < 0n ? -rounded : rounded), reason: null };
}
type ValidatedAmounts = Pick<FinancialCompanySummary, 'empresaId' | 'cobros' | 'egresos' | 'saldoNeto'>;
const metricKeys = ['cobros', 'egresos', 'saldoNeto'] as const;
export function executiveComparison(current: ValidatedAmounts[], previous: ValidatedAmounts[], equivalent = true) {
  const missing = (values: ValidatedAmounts[]) => companies.filter(company => {
    const summary = values.find(value => value.empresaId === company.id);
    return !summary || metricKeys.some(key => summary[key] === null);
  }).map(company => company.name);
  const missingCurrent = missing(current), missingPrevious = missing(previous);
  if (missingCurrent.length || missingPrevious.length) return { complete: false as const, missingCurrent, missingPrevious, metrics: [] };
  const sum = (values: ValidatedAmounts[], key: typeof metricKeys[number]) => centsToUsd(companies.reduce((total, company) => total + usdToCents(values.find(value => value.empresaId === company.id)![key]!), 0n));
  return { complete: true as const, missingCurrent, missingPrevious, metrics: metricKeys.map(key => {
    const actual = sum(current, key), prior = sum(previous, key);
    return { key, current: actual, previous: prior, ...financialVariation(actual, prior, equivalent) };
  }) };
}
export function receiptsParticipation(summaries: Pick<FinancialCompanySummary, 'empresaId' | 'cobros'>[]) {
  const rows = companies.map(company => ({ ...company, receipts: summaries.find(value => value.empresaId === company.id)?.cobros ?? null }));
  const missing = rows.filter(row => row.receipts === null);
  const amounts = rows.map(row => row.receipts === null ? null : usdToCents(row.receipts));
  const total = amounts.reduce<bigint>((sum, value) => sum + (value ?? 0n), 0n);
  const reason = missing.length ? `Faltan cobros validados de: ${missing.map(row => row.name).join(', ')}.`
    : amounts.some(value => value! < 0n) ? 'Existen cobros netos negativos por devoluciones o reversiones.'
    : total <= 0n ? 'El total conjunto es cero o negativo.' : null;
  if (reason) return { reason, rows: rows.map(row => ({ ...row, tenths: null, percentage: null })) };
  // Largest remainder; ties preserve the fixed company order. Exactly 1000 tenths.
  const shares = amounts.map((value, index) => ({ index, tenths: value! * 1000n / total, remainder: value! * 1000n % total }));
  let remaining = 1000n - shares.reduce((sum, share) => sum + share.tenths, 0n);
  for (const share of [...shares].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1)) {
    if (remaining === 0n) break;
    share.tenths += 1n;
    remaining -= 1n;
  }
  return { reason: null, rows: rows.map((row, index) => ({ ...row, tenths: shares[index]!.tenths, percentage: formatTenths(shares[index]!.tenths) })) };
}
