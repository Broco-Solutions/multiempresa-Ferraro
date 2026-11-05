import { loadCustomerReceipts } from '@/modules/integrations/customer-receipts/client.server';
import { CustomerReceiptsPanel } from '@/components/patterns/customer-receipts';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireOwner } from '@/modules/identity/session';
import { companies } from '@/config/companies';
import { PageHeader, styles } from '@/components/patterns/page';
import { PeriodForm, RfnSummaryPanel, InvalidFilters, IncompleteNotice } from '@/components/patterns/rfn-finance';
import { readPeriod, type SearchParams } from '@/modules/integrations/rfn/period';
import { loadRfnSummary } from '@/modules/integrations/rfn/finance.server';
export default async function CompanyPage({ params, searchParams }: { params: Promise<{ empresa: string }>; searchParams: Promise<SearchParams> }) {
  await requireOwner();
  const { empresa } = await params;
  const company = companies.find(value => value.id === empresa);
  if (!company) notFound();
  let period;
  try { period = readPeriod(await searchParams); } catch { return <InvalidFilters/>; }
  if (company.id !== 'rfn-argentina') {
    const result = await loadCustomerReceipts(company.id, period);
    return <div className={styles.page}><PageHeader title={company.name} description="Cobros netos de clientes en USD."/><IncompleteNotice/><PeriodForm period={period}/><CustomerReceiptsPanel name={company.name} result={result}/></div>;
  }
  const result = await loadRfnSummary(period);
  return <div className={styles.page}><Link href="/empresas">← Todas las empresas</Link><PageHeader title={company.name} description="Resumen financiero individual en USD."/><IncompleteNotice/><PeriodForm period={period}/><RfnSummaryPanel period={period} result={result}/></div>;
}
