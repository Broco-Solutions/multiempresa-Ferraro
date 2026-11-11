import { Suspense } from 'react';
import Link from 'next/link';
import Form from 'next/form';
import { ArrowLeftRightIcon, ArrowUpRightIcon, Building2Icon, LayoutDashboardIcon, ScaleIcon, SearchIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react';
import { requireOwner } from '@/modules/identity/session';
import { KpiCard, Notice, PageHeader, layout } from '@/components/patterns/page';
import { InvalidFilters, formatUsd } from '@/components/patterns/rfn-finance';
import { CompanySummary } from '@/components/patterns/company-summary';
import { ComparisonChart } from '@/components/patterns/comparison-chart';
import { Card } from '@/components/ui/card';
import { Input, fieldLabel } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { CompanyLogoRow } from '@/components/brand/brand';
import { usdToCents } from '@/modules/integrations/rfn/money';
import { type SearchParams } from '@/modules/integrations/rfn/period';
import { loadFinancialSummaries, consolidateSummaries, loadCompanyComparison, netExplanation, type FinancialCompanySummary } from '@/modules/finance/summary.server';

import { ExecutiveFilters, PreviousComparison, CompanyParticipation } from '@/components/patterns/executive-insights';
import { readExecutivePeriod, previousExecutivePeriod } from '@/modules/finance/executive-periods';

async function ExecutivePreviousComparison({ period, summaries, now }: { period: FinancialCompanySummary['periodo']; summaries: FinancialCompanySummary[]; now: Date }) {
  const comparison = previousExecutivePeriod(period, now);
  // Source failures are adapter results; authorization errors must propagate.
  await requireOwner();
  const previous = await loadFinancialSummaries(comparison.period);
  return <PreviousComparison current={summaries} previous={previous} period={period} comparison={comparison}/>;
}
async function MonthlyComparison({ hasta, summaries }: { hasta: string; summaries: FinancialCompanySummary[] }) {
  const months = await loadCompanyComparison(hasta, summaries);
  return <ComparisonChart months={months}/>;
}
function PanelLoading({ label, message, height = 'h-64' }: { label: string; message: string; height?: string }) {
  return <Card as="section" className="grid gap-4 p-5 sm:p-6" aria-label={label} aria-busy="true"><h2 className="text-lg font-semibold tracking-tight">{label}</h2><p role="status" className="text-xs text-muted-foreground">{message}</p><Skeleton className={`${height} w-full`}/></Card>;
}
function FinancialLoading() {
  return <section className={layout.section} aria-label="Resumen consolidado" aria-busy="true"><h2 className="text-lg font-semibold tracking-tight">Resumen consolidado</h2><p role="status" className="text-xs text-muted-foreground">Cargando información financiera…</p>
    <div className={layout.grid3}>{[0, 1, 2].map(index => <Card key={index} className="grid gap-5 p-6"><Skeleton className="h-4 w-24"/><Skeleton className="h-8 w-44"/><Skeleton className="h-3 w-32"/></Card>)}</div>
  </section>;
}

const kpis = [
  { label: 'Cobros', key: 'cobros', icon: TrendingUpIcon, tone: 'positive' },
  { label: 'Egresos', key: 'egresos', icon: TrendingDownIcon, tone: 'negative' },
  { label: 'Saldo neto', key: 'saldoNeto', icon: ScaleIcon, tone: 'brand' },
] as const;

async function FinancialDashboard({ period, now }: { period: FinancialCompanySummary['periodo']; now: Date }) {
  const summaries = await loadFinancialSummaries(period);
  const consolidated = consolidateSummaries(summaries);
  const ratio = consolidated.cobros !== null && consolidated.egresos !== null && usdToCents(consolidated.cobros) > 0n
    ? Math.min(100, Number(usdToCents(consolidated.egresos) * 1000n / usdToCents(consolidated.cobros)) / 10) : null;
  return <>
    <section aria-label="Resumen consolidado" className={layout.section}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-lg font-semibold tracking-tight">{consolidated.completo ? 'Resumen consolidado' : 'Consolidado incompleto'}</h2><p className="mt-1 text-xs text-muted-foreground">{consolidated.completo ? 'Total de las tres empresas' : 'Subtotal de empresas disponibles'}</p></div>
        <CompanyLogoRow/>
      </div>
      {!consolidated.completo ? <Notice title="Cobertura parcial">Faltan datos completos de: {consolidated.faltantes.join(', ')}. Incluye: {consolidated.disponibles.join(', ') || 'ninguna empresa'}. El subtotal no es un consolidado definitivo.</Notice> : null}
      <div className={layout.grid3}>{kpis.map(({ label, key, icon, tone }, index) => {
        const value = consolidated[key];
        const negative = value !== null && usdToCents(value) < 0n;
        return <KpiCard key={key} delay={index * 80} label={`${label} ${consolidated.completo ? 'del conjunto' : '— subtotal'}`} icon={icon} tone={key === 'saldoNeto' && negative ? 'negative' : tone} accent={key === 'saldoNeto' ? 'var(--brand-yellow)' : undefined} className={key === 'saldoNeto' ? 'md:col-span-2 xl:col-span-1' : undefined}
          value={value === null ? <span className="font-sans text-xl text-muted-foreground">No disponible</span> : <span className={key === 'saldoNeto' && negative ? 'text-danger' : undefined}>{formatUsd(value)}</span>}
          caption={key === 'egresos' && ratio !== null ? <span className="grid gap-1.5"><span>Equivalen al {ratio.toLocaleString('es-AR', { maximumFractionDigits: 1 })} % de los cobros</span><span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-danger/80" style={{ width: `${ratio}%` }}/></span></span> : key === 'saldoNeto' ? 'Cobros − egresos registrados' : `${period.desde} al ${period.hasta}`}/>;
      })}</div>
      <p className={layout.footnote}>{netExplanation} Se excluyen ingresos manuales. No se compensan transferencias entre empresas sin identificar.</p>
    </section>
    <Suspense fallback={<PanelLoading label="Comparación mensual" message="Cargando comparación mensual…" height="h-80"/>}><MonthlyComparison hasta={period.hasta} summaries={summaries}/></Suspense>
    <div className="grid min-w-0 gap-8 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] 2xl:items-start">
      <Suspense key={`${period.desde}:${period.hasta}`} fallback={<PanelLoading label="Comparación con el período anterior" message="Calculando comparación anterior…" height="h-40"/>}><ExecutivePreviousComparison period={period} summaries={summaries} now={now}/></Suspense>
      <CompanyParticipation summaries={summaries}/>
    </div>
    <section className={layout.section}><div><h2 className="text-lg font-semibold tracking-tight">Resumen por empresa</h2><p className="mt-1 text-xs text-muted-foreground">Cada fuente con sus propias reglas y estado de conexión.</p></div><div className={layout.grid3}>{summaries.map(summary => <CompanySummary key={summary.empresaId} summary={summary}/>)}</div></section>
    <nav className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Secciones financieras">{([['/empresas', 'Empresas', Building2Icon], ['/ingresos', 'Ingresos', TrendingUpIcon], ['/gastos', 'Gastos', TrendingDownIcon], ['/movimientos', 'Movimientos', ArrowLeftRightIcon]] as const).map(([href, label, Icon]) =>
      <Link key={href} href={href} className="group flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-sm font-semibold transition-colors hover:border-primary/40"><Icon className="size-4 text-highlight"/><span>{label}</span><ArrowUpRightIcon className="ml-auto size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-highlight"/></Link>)}</nav>
  </>;
}

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireOwner();
  const now = new Date();
  let period;
  try { period = readExecutivePeriod(await searchParams, now); previousExecutivePeriod(period, now); } catch { return <InvalidFilters/>; }
  return <div className={layout.page}>
    <PageHeader title="Resumen financiero" description="Ferraro Detail · PPF House · RFN Argentina" icon={LayoutDashboardIcon}/>
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
      <ExecutiveFilters period={period} now={now}/>
      <div key={`${period.desde}:${period.hasta}`} className="min-w-0 max-[1100px]:w-full">
        <Form action="/" prefetch={false} className={layout.filters}>
          <label className={fieldLabel}>Desde<Input name="desde" type="date" defaultValue={period.desde} required/></label>
          <label className={fieldLabel}>Hasta<Input name="hasta" type="date" defaultValue={period.hasta} required/></label>
          <button className={layout.submit} type="submit"><SearchIcon className="size-4"/>Consultar</button>
        </Form>
      </div>
    </div>
    <Suspense key={`${period.desde}:${period.hasta}`} fallback={<FinancialLoading/>}><FinancialDashboard period={period} now={now}/></Suspense>
  </div>;
}
