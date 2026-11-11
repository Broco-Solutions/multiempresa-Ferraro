import { requireOwner } from '@/modules/identity/session';
import { companies } from '@/config/companies';
import { InfoIcon, SearchIcon, TrendingUpIcon, WalletIcon } from 'lucide-react';
import { Notice, PageHeader, StatusBadge, layout } from '@/components/patterns/page';
import { Donut } from '@/components/patterns/executive-insights';
import { receiptsParticipation } from '@/modules/finance/executive-metrics';
import { CompanyLogo } from '@/components/brand/brand';
import { Card } from '@/components/ui/card';
import { Input, NativeSelect, fieldLabel } from '@/components/ui/field';
import { InvalidFilters, formatUsd } from '@/components/patterns/rfn-finance';
import { readPeriod, argentinaTimeZone, type SearchParams } from '@/modules/integrations/rfn/period';
import { loadFerraroReceipts, loadPpfReceipts } from '@/modules/integrations/customer-receipts/client.server';
import { loadRfnSummary } from '@/modules/integrations/rfn/finance.server';
import { centsToUsd, usdToCents } from '@/modules/integrations/rfn/money';

export default async function IncomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireOwner();
  const params = await searchParams;
  const company = params.empresa ?? 'todas';
  let period: ReturnType<typeof readPeriod>;
  try {
    period = readPeriod(params);
    if (typeof company !== 'string' || (company !== 'todas' && !companies.some(value => value.id === company))) throw new Error('INVALID_FILTER');
  } catch { return <InvalidFilters/>; }

  const sources = await Promise.all(companies.filter(value => company === 'todas' || value.id === company).map(async value => {
    if (value.id === 'rfn-argentina') {
      const result = await loadRfnSummary(period);
      return { ...value, total: result.ok ? result.summary.totales.cobros : null, message: result.ok ? null : result.message };
    }
    const result = await (value.id === 'ferraro-detail' ? loadFerraroReceipts(period) : loadPpfReceipts(period));
    return { ...value, total: result.ok ? result.cobros : null, message: result.ok ? null : result.message };
  }));
  const missing = sources.filter(source => source.total === null);
  const available = sources.filter(source => source.total !== null);
  const total = available.length ? centsToUsd(available.reduce((sum, source) => sum + usdToCents(source.total!), 0n)) : null;
  const allCompanies = company === 'todas';

  const participation = allCompanies ? receiptsParticipation(sources.map(source => ({ empresaId: source.id, cobros: source.total }))) : null;

  return <div className={layout.page}>
    <PageHeader title="Ingresos" description="Consultá los cobros de Ferraro Detail, PPF House y RFN Argentina." icon={TrendingUpIcon}/>
    <form className={layout.filters} method="get" key={`${period.desde}-${period.hasta}-${company}`}>
      <label className={fieldLabel} htmlFor="ingresos-desde">Desde<Input id="ingresos-desde" name="desde" type="date" defaultValue={period.desde} required/></label>
      <label className={fieldLabel} htmlFor="ingresos-hasta">Hasta<Input id="ingresos-hasta" name="hasta" type="date" defaultValue={period.hasta} required/></label>
      <label className={fieldLabel} htmlFor="ingresos-empresa">Empresa<NativeSelect aria-label="Empresa" id="ingresos-empresa" name="empresa" defaultValue={company}><option value="todas">Todas las empresas</option>{companies.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</NativeSelect></label>
      <button className={layout.submit} type="submit"><SearchIcon className="size-4"/>Consultar</button>
    </form>
    <Card as="section" className="relative grid animate-rise gap-5 overflow-hidden p-5 sm:p-7" aria-label="Total de cobros del período">
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-primary"/>
      <span aria-hidden className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-primary/10 blur-3xl"/>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-lg font-semibold tracking-tight">{allCompanies ? 'Cobros del conjunto' : `Cobros de ${sources[0]!.name}`}</h2><p className="num mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">Período consultado: {period.desde} al {period.hasta} · {argentinaTimeZone}</p></div>{!allCompanies ? <CompanyLogo id={sources[0]!.id} size="md"/> : null}</div>
      {missing.length ? <Notice title={allCompanies ? 'Consolidado incompleto' : 'Consulta no disponible'}>Sin cobros validados de: {missing.map(source => source.name).join(', ')}.</Notice> : null}
      <div className={`grid min-w-0 items-center gap-8 ${participation && !participation.reason ? 'md:grid-cols-[minmax(0,1fr)_auto]' : ''}`}>
        <div className="min-w-0"><h3 className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground"><WalletIcon className="size-4 text-highlight"/>{allCompanies ? (missing.length ? 'Subtotal de empresas disponibles' : 'Total de las tres empresas') : 'Total de cobros del período'}</h3><strong className="num mt-3 block text-[clamp(30px,5vw,52px)] leading-none font-semibold tracking-[-0.04em] [overflow-wrap:anywhere]">{total === null ? <span className="font-sans text-2xl text-muted-foreground">No disponible</span> : formatUsd(total)}</strong></div>
        {participation && !participation.reason ? <div className="flex flex-wrap items-center justify-center gap-6"><Donut rows={participation.rows}/><ul className="grid gap-2.5 text-sm">{participation.rows.map(row => <li key={row.id} className="flex items-center gap-2.5"><i aria-hidden className="size-2.5 rounded-sm" style={{ background: row.color }}/><span className="font-medium">{row.short}</span><span className="num ml-auto pl-4 font-semibold">{row.percentage}</span></li>)}</ul></div> : null}
      </div>
      <p className={`${layout.footnote} flex gap-2 border-t pt-4`}><InfoIcon className="mt-0.5 size-3.5 shrink-0 text-highlight"/><span>Ferraro y PPF: cobros netos de clientes, con devoluciones y reversiones; se excluyen ingresos manuales y ventas no cobradas. RFN: cobros informados por su API financiera. {allCompanies ? 'El total incluye únicamente cobros validados. No se compensan transferencias entre empresas sin identificar.' : null}</span></p>
    </Card>
    <section aria-label="Desglose por empresa" className={layout.section}>
      <h2 className="text-lg font-semibold tracking-tight">Desglose por empresa</h2>
      <div className={layout.grid3}>{sources.map((source, index) => <Card as="article" className="group relative flex animate-rise flex-col gap-5 overflow-hidden p-5 sm:p-6" style={{ animationDelay: `${index * 70}ms` }} key={source.id}>
        <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: source.color }}/>
        <div className="flex items-start gap-3.5"><CompanyLogo id={source.id} size="md"/><div className="grid gap-1.5"><h2 className="text-base font-semibold tracking-tight">{source.name}</h2><StatusBadge status={source.total === null ? 'No disponible' : 'Conectada'}/></div></div>
        <dl className="m-0 [&_dd]:m-0 [&_dt]:text-xs [&_dt]:text-muted-foreground"><div className="border-t pt-4"><dt>{source.id === 'rfn-argentina' ? 'Cobros informados por RFN' : 'Cobros netos de clientes'}</dt><dd className="num mt-2 text-[clamp(20px,2vw,26px)] font-semibold [overflow-wrap:anywhere]">{source.total === null ? <span className="font-sans text-base text-muted-foreground">No disponible</span> : formatUsd(source.total)}</dd></div></dl>
        {source.message ? <p role="status" className="rounded-lg bg-warning-surface px-3 py-2 text-xs">{source.message}</p> : null}
      </Card>)}</div>
    </section>
  </div>;
}
