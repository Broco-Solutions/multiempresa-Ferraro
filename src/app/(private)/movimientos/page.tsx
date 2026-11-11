import { Suspense } from 'react';
import Form from 'next/form';
import Link from 'next/link';
import { requireOwner } from '@/modules/identity/session';
import { companies } from '@/config/companies';
import { ArrowDownLeftIcon, ArrowLeftRightIcon, ArrowUpRightIcon, ChevronRightIcon, DatabaseIcon, ScaleIcon, SearchIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react';
import { KpiCard, Notice, PageHeader, StatusBadge, layout } from '@/components/patterns/page';
import { CompanyLogo } from '@/components/brand/brand';
import { Card } from '@/components/ui/card';
import { Input, NativeSelect, fieldLabel } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { usdToCents } from '@/modules/integrations/rfn/money';
import { InvalidFilters, formatUsd } from '@/components/patterns/rfn-finance';
import { argentinaTimeZone, type SearchParams } from '@/modules/integrations/rfn/period';
import { consolidateSummaries, loadCompanySummary, loadFinancialSummaries } from '@/modules/finance/summary.server';
import { loadMovements, movementKey, readMovementFilters, type MovementFilters } from '@/modules/finance/movements.server';

export default async function MovementsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireOwner();
  const params = await searchParams;
  let filters: MovementFilters;
  try { filters = readMovementFilters(params).filters; } catch { return <InvalidFilters/>; }
  return <div className={layout.page}>
    <PageHeader title="Movimientos" description="Entradas y egresos individuales de las tres empresas, en USD." icon={ArrowLeftRightIcon}/>
    <Form action="/movimientos" prefetch={false} className={layout.filters} key={JSON.stringify(filters)}>
      <label className={fieldLabel}>Desde<Input name="desde" type="date" defaultValue={filters.desde} required/></label>
      <label className={fieldLabel}>Hasta<Input name="hasta" type="date" defaultValue={filters.hasta} required/></label>
      <label className={fieldLabel}>Empresa<NativeSelect aria-label="Empresa" name="empresa" defaultValue={filters.empresa}><option value="todas">Todas las empresas</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></label>
      <label className={fieldLabel}>Tipo<NativeSelect aria-label="Tipo" name="tipo" defaultValue={filters.tipo}><option value="todos">Todos</option><option value="cobros">Cobros</option><option value="egresos">Egresos</option></NativeSelect></label>
      <button className={layout.submit} type="submit"><SearchIcon className="size-4"/>Consultar</button>
    </Form>
    <Suspense key={`resumen:${JSON.stringify(filters)}`} fallback={<Loading/>}><MovementSummary filters={filters}/></Suspense>
    <Suspense key={`listado:${JSON.stringify(params)}`} fallback={<Loading/>}><MovementListing params={{ ...filters, cursor: params.cursor }} filters={filters}/></Suspense>
  </div>;
}
function Loading() { return <Card className="grid gap-4 p-6" aria-busy="true"><p role="status" className="text-xs text-muted-foreground">Cargando información financiera…</p><Skeleton className="h-6 w-1/3"/><Skeleton className="h-24 w-full"/></Card>; }
export async function MovementSummary({ filters }: { filters: MovementFilters }) {
  const all = filters.empresa === 'todas';
  const summaries = all ? await loadFinancialSummaries(filters) : [await loadCompanySummary(filters.empresa as Exclude<MovementFilters['empresa'], 'todas'>, filters)];
  const totals = all ? consolidateSummaries(summaries) : summaries[0]!;
  const missing = summaries.filter(s => s.estado !== 'completo');
  const kpis = [['Cobros', 'cobros', TrendingUpIcon, 'positive'], ['Egresos', 'egresos', TrendingDownIcon, 'negative'], ['Saldo neto', 'saldoNeto', ScaleIcon, 'brand']] as const;
  return <section className={layout.section} aria-label="Resumen financiero del período">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold tracking-tight">Resumen financiero del período</h2><p className="num mt-1 text-xs text-muted-foreground">{filters.desde} al {filters.hasta} · {argentinaTimeZone}</p></div>{!all ? <CompanyLogo id={filters.empresa} size="md"/> : null}</div>
    {missing.length ? <Notice title={all ? 'Consolidado incompleto' : 'Resumen incompleto'}>{missing.map(s => s.nombre).join(', ')}.{all ? ' Subtotal de empresas disponibles' : null}</Notice> : null}
    <div className={layout.grid3}>{kpis.map(([label, key, icon, tone], index) => {
      const value = totals[key];
      const negative = value !== null && usdToCents(value) < 0n;
      return <KpiCard key={key} delay={index * 70} label={label} icon={icon} tone={key === 'saldoNeto' && negative ? 'negative' : tone} accent={key === 'saldoNeto' ? 'var(--brand-yellow)' : undefined} className={key === 'saldoNeto' ? 'md:col-span-2 xl:col-span-1' : undefined} value={value === null ? <span className="font-sans text-xl text-muted-foreground">No disponible</span> : <span className={negative ? 'text-danger' : undefined}>{formatUsd(value)}</span>}/>;
    })}</div>
    <p className={layout.footnote}>El saldo neto representa cobros menos egresos registrados. No equivale a ganancia ni saldo bancario conciliado. Los indicadores abarcan todo el período y la empresa seleccionados, independientemente del tipo y las filas visibles. No se compensan transferencias entre empresas sin identificar.</p>
  </section>;
}
const types: Record<string, string> = { CUSTOMER_PAYMENT: 'Cobro', CUSTOMER_REFUND: 'Devolución', PURCHASE: 'Compra', MANUAL_EXPENSE: 'Gasto', SALARY_PAYMENT: 'Sueldo', SENIA: 'Seña', COBRO: 'Cobro', COMPRA_RECIBIDA: 'Compra recibida', GASTO_OPERATIVO: 'Gasto operativo (incluye sueldos)' };
const dateFormat = new Intl.DateTimeFormat('es-AR', { timeZone: argentinaTimeZone, dateStyle: 'short', timeStyle: 'medium', hourCycle: 'h23' });
export async function MovementListing({ params, filters }: { params: SearchParams; filters: MovementFilters }) {
  const result = await loadMovements(params);
  const query = new URLSearchParams({ ...filters, ...(result.nextCursor ? { cursor: result.nextCursor } : {}) });
  return <>
    <Card as="section" className="grid gap-4 p-5 sm:p-6" aria-label="Estado de las fuentes">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight"><DatabaseIcon className="size-4 text-highlight"/>Estado de las fuentes</h2>
      {!result.complete ? <Notice title="Listado incompleto">No se puede continuar la paginación global sin cobertura de todas las fuentes requeridas.</Notice> : null}
      <ul className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">{result.sources.map(s => <li key={s.key} className="flex min-w-0 items-center gap-3 rounded-xl border bg-muted/25 px-3 py-2.5"><CompanyLogo id={s.empresaId} size="sm"/><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{companies.find(c => c.id === s.empresaId)!.name}</span><span className="block text-[11px] text-muted-foreground capitalize">{s.flujo}</span></span><StatusBadge status={s.available ? 'Disponible' : 'No disponible'}/></li>)}</ul>
    </Card>
    <Card as="section" className="grid gap-4 p-5 sm:p-6" aria-label="Listado de movimientos">
      <div><h2 className="text-lg font-semibold tracking-tight">Movimientos del período</h2><p className="mt-1 text-xs text-muted-foreground">Compras recibidas de RFN: egresos registrados, sin confirmación independiente de pago bancario. Sus sueldos ya están incluidos en gastos operativos.</p></div>
      {result.movements.length ? <table className="w-full border-collapse text-left text-[13px] max-[800px]:block max-[800px]:[&_tbody]:block max-[800px]:[&_td]:grid max-[800px]:[&_td]:grid-cols-[84px_minmax(0,1fr)] max-[800px]:[&_td]:gap-3 max-[800px]:[&_td]:border-0 max-[800px]:[&_td]:px-0 max-[800px]:[&_td]:py-1.5 max-[800px]:[&_td]:before:text-muted-foreground max-[800px]:[&_td]:before:content-[attr(data-label)] max-[800px]:[&_td:last-child]:text-left max-[800px]:[&_thead]:absolute max-[800px]:[&_thead]:size-px max-[800px]:[&_thead]:overflow-hidden max-[800px]:[&_thead]:[clip-path:inset(50%)] max-[800px]:[&_tr]:block max-[800px]:[&_tr]:border-b max-[800px]:[&_tr]:py-3 [&_td]:border-t [&_td]:px-3 [&_td]:py-3 [&_td]:[overflow-wrap:anywhere] [&_th]:px-3 [&_th]:pb-3 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:tracking-[0.06em] [&_th]:text-muted-foreground [&_th]:uppercase [&_th:last-child]:text-right [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-muted/40">
        <caption className="pb-3 text-left text-xs text-muted-foreground">Hasta 25 movimientos · Fecha y hora argentina</caption>
        <thead><tr>{['Fecha', 'Empresa', 'Tipo', 'Dirección', 'Importe'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{result.movements.map(row => <tr key={movementKey(row)} data-origen={movementKey(row)}>
          <td data-label="Fecha" className="num text-xs text-muted-foreground"><time dateTime={row.fecha}>{dateFormat.format(new Date(row.fecha))}</time></td>
          <td data-label="Empresa"><span className="inline-flex min-w-0 items-center gap-2"><CompanyLogo id={row.empresaId} size="xs"/>{companies.find(c => c.id === row.empresaId)!.name}</span></td>
          <td data-label="Tipo"><span className={row.reversion ? 'rounded-md bg-warning-surface px-2 py-1 text-xs font-medium text-warning' : 'rounded-md bg-muted px-2 py-1 text-xs font-medium'}>{row.reversion ? `Reversión de ${(types[row.tipo] ?? row.tipo).toLowerCase()}` : types[row.tipo] ?? row.tipo}</span></td>
          <td data-label="Dirección"><span className={row.direccion === 'entrada' ? 'inline-flex items-center gap-1.5 font-semibold text-success' : 'inline-flex items-center gap-1.5 font-semibold text-danger'}>{row.direccion === 'entrada' ? <ArrowDownLeftIcon className="size-3.5"/> : <ArrowUpRightIcon className="size-3.5"/>}{row.direccion === 'entrada' ? 'Entrada' : 'Salida'}</span></td>
          <td data-label="Importe" className={`num text-right font-semibold whitespace-nowrap ${row.direccion === 'entrada' ? 'text-success' : ''}`}>{row.direccion === 'entrada' ? '+' : ''}{formatUsd(row.importeUsd)}</td>
        </tr>)}</tbody>
      </table> : <p role="status" className="grid min-h-[140px] place-items-center rounded-xl border border-dashed px-4 text-center text-sm text-muted-foreground">{result.complete ? 'Sin movimientos para los filtros seleccionados.' : 'No hay movimientos validados disponibles. Listado incompleto.'}</p>}
    </Card>
    <nav className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground" aria-label="Paginación de movimientos">{result.nextCursor ? <Link className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground" href={`/movimientos?${query}`} prefetch={false}>Siguiente<ChevronRightIcon className="size-3.5"/></Link> : null}<span>Podés volver con el botón Atrás del navegador.</span></nav>
    <p className={layout.footnote}>Los registros y sus reversiones pueden cambiar entre solicitudes. No existe un snapshot global entre las bases independientes.</p>
  </>;
}
