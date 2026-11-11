import Link from 'next/link';
import { requireOwner } from '@/modules/identity/session';
import { ChevronLeftIcon, ChevronRightIcon, InfoIcon, ReceiptTextIcon, RotateCcwIcon, SearchIcon, TrendingDownIcon } from 'lucide-react';
import { KpiCard, Notice, PageHeader, StatusBadge, layout } from '@/components/patterns/page';
import { CompositionBar, expenseComposition } from '@/components/patterns/company-summary';
import { CompanyLogo } from '@/components/brand/brand';
import { Card } from '@/components/ui/card';
import { Input, NativeSelect, fieldLabel } from '@/components/ui/field';
import { InvalidFilters, formatUsd } from '@/components/patterns/rfn-finance';
import { readPeriod, readExpensesOptions, argentinaTimeZone, type SearchParams } from '@/modules/integrations/rfn/period';
import { loadRfnExpenses, loadRfnSummary } from '@/modules/integrations/rfn/finance.server';
import { loadFerraroExpenses, loadPpfExpenses, type ExpensesResult } from '@/modules/integrations/customer-receipts/client.server';
import { centsToUsd, usdToCents } from '@/modules/integrations/rfn/money';

const companies = { 'ferraro-detail': 'Ferraro Detail', 'ppf-house': 'PPF House', 'rfn-argentina': 'RFN Argentina' } as const;
const types = { PURCHASE: 'Compra', MANUAL_EXPENSE: 'Gasto manual', SALARY_PAYMENT: 'Sueldo pagado' } as const;
function expenseStatus(result: ExpensesResult) {
  return result.ok ? (result.expenses.paginacion.total === 0 ? 'Sin movimientos' : 'Conectada') : result.reason === 'PERIOD_MISMATCH' ? 'Período incompatible' : 'No disponible';
}
function rfnErrorStatus(message: string) {
  return message.includes('límites argentinos') ? 'Período incompatible' : 'No disponible';
}
export default async function ExpensesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireOwner();
  const params = await searchParams;
  let period: ReturnType<typeof readPeriod>, options: ReturnType<typeof readExpensesOptions>;
  const company = params.empresa ?? 'todas';
  try {
    period = readPeriod(params); options = readExpensesOptions(params);
    if (typeof company !== 'string' || !['todas', ...Object.keys(companies)].includes(company)) throw new Error('INVALID_FILTER');
  } catch { return <InvalidFilters/>; }
  const [ferraro, ppf, rfn, rfnList] = await Promise.all([
    loadFerraroExpenses(period, company === 'ferraro-detail' ? options.pagina : 1),
    loadPpfExpenses(period, company === 'ppf-house' ? options.pagina : 1),
    loadRfnSummary(period),
    company === 'rfn-argentina' ? loadRfnExpenses(period, options) : Promise.resolve(null),
  ]);
  const sources = [
    { name: companies['ferraro-detail'], total: ferraro.ok ? ferraro.expenses.totales.egresos : null, status: expenseStatus(ferraro), message: ferraro.ok ? null : ferraro.message },
    { name: companies['ppf-house'], total: ppf.ok ? ppf.expenses.totales.egresos : null, status: expenseStatus(ppf), message: ppf.ok ? null : ppf.message },
    { name: companies['rfn-argentina'], total: rfn.ok ? rfn.summary.totales.egresos : null, status: rfn.ok ? (rfnList?.ok && rfnList.expenses.paginacion.total === 0 ? 'Sin movimientos' : 'Conectada') : rfnErrorStatus(rfn.message), message: rfn.ok ? null : rfn.message },
  ];
  const missing = sources.filter(source => source.total === null);
  const valid = sources.filter(source => source.total !== null);
  const total = valid.length ? centsToUsd(valid.reduce((sum, source) => sum + usdToCents(source.total!), 0n)) : null;
  const selected = company === 'ferraro-detail' ? ferraro : company === 'ppf-house' ? ppf : null;
  const pagination = selected?.ok ? selected.expenses.paginacion : rfn.ok && rfnList?.ok ? rfnList.expenses.paginacion : null;
  function pageUrl(page: number) {
    return '?' + new URLSearchParams({ ...period, empresa: company as string, pagina: String(page), ...(company === 'rfn-argentina' && options.categoria ? { categoria: options.categoria } : {}) });
  }
  const dates = new Intl.DateTimeFormat('es-AR', { timeZone: argentinaTimeZone, dateStyle: 'short', timeStyle: 'short' });
  const ids = ['ferraro-detail', 'ppf-house', 'rfn-argentina'] as const;
  const table = 'w-full border-collapse text-left text-[13px] whitespace-nowrap [&_td]:border-t [&_td]:px-3 [&_td]:py-3 [&_td:last-child]:num [&_td:last-child]:text-right [&_td:last-child]:font-semibold [&_th]:px-3 [&_th]:pb-3 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:tracking-[0.06em] [&_th]:text-muted-foreground [&_th]:uppercase [&_th:last-child]:text-right [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-muted/40';
  const totals = 'm-0 grid min-w-0 grid-cols-2 gap-4 lg:grid-cols-4 [&_dd]:num [&_dd]:m-0 [&_dd]:mt-1.5 [&_dd]:font-semibold [&_dd]:[overflow-wrap:anywhere] [&_dt]:text-xs [&_dt]:text-muted-foreground [&>div]:min-w-0 [&>div]:rounded-xl [&>div]:border [&>div]:bg-muted/25 [&>div]:p-3.5 max-[550px]:grid-cols-1';
  return <div className={layout.page}>
    <PageHeader title="Gastos y egresos" description="Consulta financiera de Ferraro Detail, PPF House y RFN Argentina" icon={TrendingDownIcon}/>
    <p className="num -mt-4 text-xs text-muted-foreground">Moneda USD · Zona horaria: {argentinaTimeZone}</p>
    <form className={layout.filters} method="get">
      <label className={fieldLabel}>Fecha desde<Input name="desde" type="date" defaultValue={period.desde} required/></label>
      <label className={fieldLabel}>Fecha hasta<Input name="hasta" type="date" defaultValue={period.hasta} required/></label>
      <label className={fieldLabel}>Empresa<NativeSelect name="empresa" defaultValue={company}><option value="todas">Todas las empresas</option>{Object.entries(companies).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</NativeSelect></label>
      {company === 'rfn-argentina' ? <label className={fieldLabel}>Categoría original<Input name="categoria" defaultValue={options.categoria ?? ''} maxLength={100} placeholder="Todas"/></label> : null}
      <button className={layout.submit} type="submit"><SearchIcon className="size-4"/>Consultar</button>
    </form>
    <section aria-label="Resumen de egresos" className={layout.section}>
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard as="h2" label="Egresos registrados del conjunto" icon={TrendingDownIcon} tone="brand" accent="var(--brand-yellow)" value={total !== null ? formatUsd(total) : <span className="font-sans text-xl text-muted-foreground">No disponible</span>} caption={missing.length ? 'Subtotal de empresas disponibles' : 'Total de las tres empresas'}/>
        {sources.map((source, index) => <KpiCard as="h2" key={source.name} delay={(index + 1) * 70} label={source.name} accent={`var(--company-${['ferraro', 'ppf', 'rfn'][index]})`} value={source.total !== null ? formatUsd(source.total) : <span className="font-sans text-xl text-muted-foreground">No disponible</span>} caption={<span className="grid gap-2"><StatusBadge status={source.status}/>{source.total === null ? <span role="status">{source.message}</span> : null}</span>} media={<CompanyLogo id={ids[index]!} size="sm"/>}/>)}
      </div>
      {missing.length ? <Notice title="Consolidado incompleto">Fuentes sin datos válidos: {missing.map(source => source.name).join(', ')}. {valid.length ? 'El subtotal incluye únicamente las empresas disponibles; no es un consolidado definitivo.' : 'No hay importes validados para calcular un subtotal.'}</Notice> : null}
    </section>
    <Card as="section" className="grid gap-2 p-5 sm:p-6" aria-label="Desglose por empresa">
      <h2 className="text-lg font-semibold tracking-tight">Desglose por empresa</h2>
      {([['Ferraro Detail', ferraro, 'ferraro-detail'], ['PPF House', ppf, 'ppf-house']] as const).map(([name, result, id]) => <div className="grid gap-4 border-b py-5 last-of-type:border-b-0" key={name}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><CompanyLogo id={id} size="sm"/><h3 className="font-semibold">{name}</h3></div><StatusBadge status={expenseStatus(result)}/></div>
        {result.ok ? <><dl className={totals}>{([['Compras', 'compras'], ['Sueldos pagados', 'sueldosPagados'], ['Otros gastos · Gastos manuales', 'gastosManuales'], ['Egresos totales', 'egresos']] as const).map(([label, key]) => <div key={key}><dt>{label}</dt><dd>{formatUsd(result.expenses.totales[key])}</dd></div>)}</dl><Composition summary={{ empresaId: id, compras: result.expenses.totales.compras, sueldosPagados: result.expenses.totales.sueldosPagados, otrosGastos: result.expenses.totales.gastosManuales }}/></> : <p role="status" className="text-xs text-muted-foreground">{result.message}</p>}
      </div>)}
      <div className="grid gap-4 py-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><CompanyLogo id="rfn-argentina" size="sm"/><h3 className="font-semibold">RFN Argentina</h3></div><StatusBadge status={sources[2]!.status}/></div>
        {rfn.ok ? <><dl className={totals}>{([['Compras', 'compras'], ['Sueldos pagados', null], ['Otros gastos · Gastos operativos', 'gastos'], ['Egresos totales', 'egresos']] as const).map(([label, key]) => <div key={label}><dt>{label}</dt><dd>{key === null ? <span className="font-sans text-xs font-normal text-muted-foreground">Incluidos en gastos operativos</span> : formatUsd(rfn.summary.totales[key])}</dd></div>)}</dl><Composition summary={{ empresaId: 'rfn-argentina', compras: rfn.summary.totales.compras, sueldosPagados: null, otrosGastos: rfn.summary.totales.gastos }}/></> : <p role="status" className="text-xs text-muted-foreground">{rfn.message}</p>}
      </div>
      <p className={`${layout.footnote} flex gap-2 border-t pt-4`}><InfoIcon className="mt-0.5 size-3.5 shrink-0 text-highlight"/><span>Los sueldos pagados ya están incluidos en los totales de Ferraro y PPF. En RFN, los sueldos forman parte de los gastos operativos. Las compras de RFN corresponden a mercadería recibida según la regla de RFN; no necesariamente equivalen a pagos bancarios confirmados. El conjunto representa egresos registrados según las reglas de cada fuente, no ganancia ni caja bancaria conciliada. No se compensan transferencias entre empresas sin identificar.</span></p>
    </Card>
    {company === 'todas' ? <p className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-xs text-muted-foreground"><ReceiptTextIcon className="size-4 text-highlight"/>El detalle de movimientos se consulta seleccionando una empresa.</p> : <Card as="section" className="grid gap-4 p-5 sm:p-6" aria-label="Listado de movimientos">
      <div className="flex items-center gap-3"><CompanyLogo id={company} size="sm"/><h2 className="text-lg font-semibold tracking-tight">Movimientos de {companies[company as keyof typeof companies]}</h2></div>
      {selected ? !selected.ok ? <p role="status" className="text-xs text-muted-foreground">{expenseStatus(selected)}: {selected.message}</p> : <div className="max-w-full overflow-x-auto"><table className={table}><thead><tr><th>Fecha</th><th>Empresa</th><th>Tipo</th><th>Movimiento/reversión</th><th>Importe USD</th></tr></thead><tbody>{selected.expenses.movimientos.map(row => <tr key={row.id}><td className="num text-muted-foreground">{dates.format(new Date(row.fecha))}</td><td>{companies[company as keyof typeof companies]}</td><td><span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">{types[row.tipo]}</span></td><td>{row.reversion ? <span className="inline-flex items-center gap-1.5 text-warning"><RotateCcwIcon className="size-3.5"/>Reversión</span> : 'Movimiento'}</td><td>{formatUsd(row.importeUsd)}</td></tr>)}</tbody></table>{selected.expenses.movimientos.length === 0 ? <p className="py-6 text-center text-xs text-muted-foreground">Sin movimientos en esta página.</p> : null}</div> : null}
      {company === 'rfn-argentina' && !rfn.ok ? <p role="status" className="text-xs text-muted-foreground">{rfnErrorStatus(rfn.message)}: {rfn.message}</p> : null}
      {rfn.ok && rfnList ? !rfnList.ok ? <p role="status" className="text-xs text-muted-foreground">{rfnErrorStatus(rfnList.message)}: {rfnList.message}</p> : <>
        <p className="text-xs text-muted-foreground">Gastos operativos de RFN. Este listado no incluye compras. Total del filtro: <strong className="num text-foreground">{formatUsd(rfnList.expenses.totalDelFiltro)}</strong></p>
        <div className="max-w-full overflow-x-auto"><table className={table}><thead><tr><th>Fecha</th><th>Categoría original</th><th>Medio de pago</th><th>Importe USD</th></tr></thead><tbody>{rfnList.expenses.gastos.map(row => <tr key={row.id}><td className="num text-muted-foreground">{dates.format(new Date(row.fecha))}</td><td><span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">{row.categoria}</span></td><td>{row.medioPago}</td><td>{formatUsd(row.importe)}</td></tr>)}</tbody></table>{rfnList.expenses.gastos.length === 0 ? <p className="py-6 text-center text-xs text-muted-foreground">Sin movimientos en esta página.</p> : null}</div>
      </> : null}
      {pagination ? <nav className="flex flex-wrap items-center gap-3 border-t pt-4 text-xs" aria-label="Paginación de gastos">{pagination.pagina > 1 ? <Link className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 font-semibold hover:border-primary/50" href={pageUrl(pagination.pagina - 1)}><ChevronLeftIcon className="size-3.5"/>Anterior</Link> : null}<span className="num text-muted-foreground">Página {pagination.pagina} de {pagination.totalPaginas}</span>{pagination.hayMas ? <Link className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 font-semibold hover:border-primary/50" href={pageUrl(pagination.pagina + 1)}>Siguiente<ChevronRightIcon className="size-3.5"/></Link> : null}</nav> : null}
    </Card>}
  </div>;
}
function Composition({ summary }: { summary: Parameters<typeof expenseComposition>[0] }) {
  const composition = expenseComposition(summary);
  return composition ? <CompositionBar composition={composition}/> : null;
}
