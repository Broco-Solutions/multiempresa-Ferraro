import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireOwner } from '@/modules/identity/session';
import { companies } from '@/config/companies';
import { PageHeader, styles } from '@/components/patterns/page';
import { PeriodForm, InvalidFilters } from '@/components/patterns/rfn-finance';
import { CompanySummary } from '@/components/patterns/company-summary';
import { loadCompanySummary, netExplanation } from '@/modules/finance/summary.server';
import { readPeriod, type SearchParams } from '@/modules/integrations/rfn/period';
export default async function CompanyPage({ params, searchParams }: { params: Promise<{ empresa: string }>; searchParams: Promise<SearchParams> }) {
  await requireOwner();
  const { empresa } = await params;
  const company = companies.find(value => value.id === empresa);
  if (!company) notFound();
  let period;
  try { period = readPeriod(await searchParams); } catch { return <InvalidFilters/>; }
  const summary = await loadCompanySummary(company.id, period);
  return <div className={styles.page}><Link href="/empresas">← Todas las empresas</Link><PageHeader title={company.name} description="Resumen financiero individual en USD."/><PeriodForm period={period}/><CompanySummary summary={summary}/><p className={styles.footnote}>{netExplanation}</p></div>;
}
