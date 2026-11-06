import { Suspense } from 'react';
import Link from 'next/link';
import { requireOwner } from '@/modules/identity/session';
import { PageHeader, styles } from '@/components/patterns/page';
import { PeriodForm, InvalidFilters, formatUsd } from '@/components/patterns/rfn-finance';
import { CompanySummary } from '@/components/patterns/company-summary';
import { ComparisonChart } from '@/components/patterns/comparison-chart';
import { readPeriod, type SearchParams } from '@/modules/integrations/rfn/period';
import { loadFinancialSummaries, consolidateSummaries, loadCompanyComparison, netExplanation, type FinancialCompanySummary } from '@/modules/finance/summary.server';

async function MonthlyComparison({ hasta, summaries }: { hasta: string; summaries: FinancialCompanySummary[] }) {
  const months = await loadCompanyComparison(hasta, summaries);
  return <ComparisonChart months={months}/>;
}
export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireOwner();
  let period;
  try { period = readPeriod(await searchParams); } catch { return <InvalidFilters/>; }
  const summaries = await loadFinancialSummaries(period);
  const consolidated = consolidateSummaries(summaries);
  return <div className={styles.page}>
    <PageHeader title="Resumen financiero" description="Ferraro Detail · PPF House · RFN Argentina"/>
    <PeriodForm period={period}/>
    <section aria-label="Resumen consolidado">
      <div className={styles.sectionHead}><h2>{consolidated.completo ? 'Resumen consolidado' : 'Consolidado incompleto'}</h2></div>
      <p>{consolidated.completo ? 'Total de las tres empresas' : 'Subtotal de empresas disponibles'}</p>
      {!consolidated.completo ? <p role="status">Faltan datos completos de: {consolidated.faltantes.join(', ')}. Incluye: {consolidated.disponibles.join(', ') || 'ninguna empresa'}. El subtotal no es un consolidado definitivo.</p> : null}
      <div className={styles.metrics}>{([['Cobros', 'cobros'], ['Egresos', 'egresos'], ['Saldo neto', 'saldoNeto']] as const).map(([label, key]) => <div className={styles.metric} key={key}><h3>{label} {consolidated.completo ? 'del conjunto' : '— subtotal'}</h3><strong>{consolidated[key] === null ? 'No disponible' : formatUsd(consolidated[key])}</strong></div>)}</div>
      <p className={styles.footnote}>{netExplanation} Se excluyen ingresos manuales. No se compensan transferencias entre empresas sin identificar.</p>
    </section>
    <Suspense fallback={<section className={styles.panel} aria-label="Comparación mensual" aria-busy="true"><h2>Comparación mensual</h2><p role="status">Cargando comparación mensual…</p></section>}><MonthlyComparison hasta={period.hasta} summaries={summaries}/></Suspense>
    <section><div className={styles.sectionHead}><h2>Resumen por empresa</h2></div><div className={styles.companyGrid}>{summaries.map(summary => <CompanySummary key={summary.empresaId} summary={summary}/>)}</div></section>
    <nav className={styles.summaryLinks} aria-label="Secciones financieras"><Link href="/empresas">Empresas</Link><Link href="/ingresos">Ingresos</Link><Link href="/gastos">Gastos</Link><Link href="/movimientos">Movimientos</Link></nav>
  </div>;
}
