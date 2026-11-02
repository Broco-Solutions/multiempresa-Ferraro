import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireOwner } from '@/modules/identity/session';
import { companies } from '@/config/companies';
import { PageHeader, EmptyState, styles } from '@/components/patterns/page';
import { PeriodForm, RfnSummaryPanel, InvalidFilters, IncompleteNotice } from '@/components/patterns/rfn-finance';
import { readPeriod, type SearchParams } from '@/modules/integrations/rfn/period';
import { loadRfnSummary } from '@/modules/integrations/rfn/finance.server';
export default async function CompanyPage({ params, searchParams }: { params: Promise<{ empresa: string }>; searchParams: Promise<SearchParams> }) {
  await requireOwner();
  const { empresa } = await params;
  const company = companies.find(value => value.id === empresa);
  if (!company) notFound();
  if (empresa !== 'rfn-argentina') return <div className={styles.page}><PageHeader title={company.name} description="Pendiente de conexión"/><EmptyState/></div>;
  let period;
  try { period = readPeriod(await searchParams); } catch { return <InvalidFilters/>; }
  const result = await loadRfnSummary(period);
  return <div className={styles.page}><Link href="/empresas">← Todas las empresas</Link><PageHeader title={company.name} description="Resumen financiero individual en USD."/><IncompleteNotice/><PeriodForm period={period}/><RfnSummaryPanel period={period} result={result}/></div>;
}
