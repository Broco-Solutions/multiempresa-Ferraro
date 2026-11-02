import { requireOwner } from '@/modules/identity/session';
import { PageHeader, CompanyCards, styles } from '@/components/patterns/page';
import { IncompleteNotice, PeriodForm, RfnSummaryPanel, InvalidFilters } from '@/components/patterns/rfn-finance';
import { readPeriod, type SearchParams } from '@/modules/integrations/rfn/period';
import { loadRfnSummary } from '@/modules/integrations/rfn/finance.server';
export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireOwner();
  let period;
  try { period = readPeriod(await searchParams); } catch { return <InvalidFilters/>; }
  const result = await loadRfnSummary(period);
  return <div className={styles.page}><PageHeader title="Resumen financiero" description="Consulta privada en USD. Información individual de las fuentes disponibles."/><IncompleteNotice/><PeriodForm period={period}/><RfnSummaryPanel result={result} period={period}/><section><div className={styles.sectionHead}><h2>Resumen por empresa</h2></div><CompanyCards rfnStatus={result.ok ? 'Conectada' : result.message}/></section></div>;
}
