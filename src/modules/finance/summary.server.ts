import 'server-only';
import { companies } from '@/config/companies';
import { requireOwner } from '@/modules/identity/session';
import { loadCustomerReceipts, loadCustomerExpenses, type Period } from '@/modules/integrations/customer-receipts/client.server';
import { loadRfnSummary } from '@/modules/integrations/rfn/finance.server';
import { centsToUsd, usdToCents } from '@/modules/integrations/rfn/money';
import { readPeriod } from '@/modules/integrations/rfn/period';

export type CompanyId = (typeof companies)[number]['id'];
export type FinancialCompanySummary = {
  empresaId: CompanyId;
  nombre: string;
  periodo: Period;
  estado: 'completo' | 'parcial' | 'no_disponible';
  cobros: string | null;
  egresos: string | null;
  saldoNeto: string | null;
  compras: string | null;
  sueldosPagados: string | null;
  otrosGastos: string | null;
  detalleOtrosGastos: string;
  mensaje: string | null;
};
export const netExplanation = 'Saldo neto = cobros netos de clientes − egresos registrados. No representa ganancia ni saldo bancario conciliado.';

/** Adapters are the validation boundary; no raw HTTP payload reaches presentation. */
export async function loadCompanySummary(empresaId: CompanyId, periodo: Period): Promise<FinancialCompanySummary> {
  await requireOwner();
  readPeriod(periodo);
  const base: FinancialCompanySummary = {
    empresaId, nombre: companies.find(company => company.id === empresaId)!.name, periodo,
    estado: 'no_disponible', cobros: null, egresos: null, saldoNeto: null,
    compras: null, sueldosPagados: null, otrosGastos: null,
    detalleOtrosGastos: empresaId === 'rfn-argentina' ? 'Gastos operativos (incluyen sueldos)' : 'Gastos manuales', mensaje: null,
  };
  if (empresaId === 'rfn-argentina') {
    const result = await loadRfnSummary(periodo);
    if (!result.ok) return { ...base, mensaje: result.message };
    const totals = result.summary.totales;
    return { ...base, estado: 'completo', cobros: totals.cobros, egresos: totals.egresos,
      saldoNeto: totals.resultadoNeto, compras: totals.compras, otrosGastos: totals.gastos };
  }
  const [receipts, expenses] = await Promise.all([
    loadCustomerReceipts(empresaId, periodo), loadCustomerExpenses(empresaId, periodo),
  ]);
  return { ...base,
    estado: receipts.ok && expenses.ok ? 'completo' : receipts.ok || expenses.ok ? 'parcial' : 'no_disponible',
    cobros: receipts.ok ? receipts.cobros : null,
    egresos: expenses.ok ? expenses.expenses.totales.egresos : null,
    saldoNeto: receipts.ok && expenses.ok ? centsToUsd(usdToCents(receipts.cobros) - usdToCents(expenses.expenses.totales.egresos)) : null,
    compras: expenses.ok ? expenses.expenses.totales.compras : null,
    sueldosPagados: expenses.ok ? expenses.expenses.totales.sueldosPagados : null,
    otrosGastos: expenses.ok ? expenses.expenses.totales.gastosManuales : null,
    mensaje: [!receipts.ok ? `Cobros: ${receipts.message}` : null, !expenses.ok ? `Egresos: ${expenses.message}` : null].filter(Boolean).join(' ') || null,
  };
}
export async function loadFinancialSummaries(period: Period) {
  await requireOwner();
  return Promise.all(companies.map(company => loadCompanySummary(company.id, period)));
}
export function consolidateSummaries(summaries: FinancialCompanySummary[]) {
  // Never include a company with only one side validated in any subtotal.
  const available = companies.flatMap(company => {
    const summary = summaries.find(value => value.empresaId === company.id);
    return summary && summary.cobros !== null && summary.egresos !== null && summary.saldoNeto !== null ? [summary] : [];
  });
  const missing = companies.filter(company => !available.some(value => value.empresaId === company.id)).map(company => company.name);
  const sum = (key: 'cobros' | 'egresos' | 'saldoNeto') => available.length ? centsToUsd(available.reduce((total, value) => total + usdToCents(value[key]!), 0n)) : null;
  return { completo: missing.length === 0, faltantes: missing, disponibles: available.map(value => value.nombre), cobros: sum('cobros'), egresos: sum('egresos'), saldoNeto: sum('saldoNeto') };
}

export type ComparisonMonth = { periodo: Period; etiqueta: string; empresas: FinancialCompanySummary[] };
export function comparisonPeriods(hasta: string): Period[] {
  readPeriod({ desde: hasta, hasta });
  const [year, month] = hasta.split('-').map(Number);
  return Array.from({ length: 6 }, (_, index) => {
    const first = new Date(Date.UTC(year!, month! - 6 + index, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
    return { desde: first.toISOString().slice(0, 10), hasta: last.toISOString().slice(0, 10) };
  });
}
export async function loadCompanyComparison(hasta: string, existing: FinancialCompanySummary[] = []): Promise<ComparisonMonth[]> {
  await requireOwner();
  const periods = comparisonPeriods(hasta);
  // Three company workers, each processing its six months strictly sequentially.
  // A failed month is not retried and cannot erase previously validated months.
  const series = await Promise.all(companies.map(async company => {
    const months: FinancialCompanySummary[] = [];
    for (const period of periods) {
      const reused = existing.find(summary => summary.empresaId === company.id && summary.periodo.desde === period.desde && summary.periodo.hasta === period.hasta);
      months.push(reused ?? await loadCompanySummary(company.id, period));
    }
    return months;
  }));
  const labels = new Intl.DateTimeFormat('es-AR', { month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });
  return periods.map((periodo, index) => ({ periodo, etiqueta: labels.format(new Date(periodo.desde + 'T12:00:00-03:00')), empresas: series.map(months => months[index]!) }));
}
