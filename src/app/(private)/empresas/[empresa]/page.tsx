import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, InfoIcon } from 'lucide-react';
import { requireOwner } from '@/modules/identity/session';
import { companies } from '@/config/companies';
import { PageHeader, layout } from '@/components/patterns/page';
import { PeriodForm, InvalidFilters } from '@/components/patterns/rfn-finance';
import { CompanySummary } from '@/components/patterns/company-summary';
import { CompanyLogo } from '@/components/brand/brand';
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
  return <div className={layout.page}>
    <Link href="/empresas" className="-mb-4 inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-highlight"><ArrowLeftIcon className="size-3.5"/>Todas las empresas</Link>
    <div className="relative min-w-0 overflow-hidden rounded-2xl border bg-card p-5 sm:p-7">
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: company.color }}/>
      <span aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full opacity-15 blur-3xl" style={{ background: company.color }}/>
      <PageHeader title={company.name} description="Resumen financiero individual en USD." eyebrow="Empresa" aside={<CompanyLogo id={company.id} size="lg"/>}/>
    </div>
    <PeriodForm period={period}/>
    <div className="max-w-3xl"><CompanySummary summary={summary}/></div>
    <p className={`${layout.footnote} flex gap-2`}><InfoIcon className="mt-0.5 size-3.5 shrink-0 text-highlight"/>{netExplanation}</p>
  </div>;
}
