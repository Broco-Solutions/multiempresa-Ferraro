import Link from 'next/link';
import { requireOwner } from '@/modules/identity/session';
import { PageHeader, styles } from '@/components/patterns/page';
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
  return <div className={styles.page}>
    <PageHeader title="Gastos y egresos" description="Consulta financiera de Ferraro Detail, PPF House y RFN Argentina"/>
    <p>Moneda USD · Zona horaria: {argentinaTimeZone}</p>
    <form className={styles.filters} method="get">
      <label>Fecha desde<input name="desde" type="date" defaultValue={period.desde} required/></label>
      <label>Fecha hasta<input name="hasta" type="date" defaultValue={period.hasta} required/></label>
      <label>Empresa<select name="empresa" defaultValue={company}><option value="todas">Todas las empresas</option>{Object.entries(companies).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      {company === 'rfn-argentina' ? <label>Categoría original<input name="categoria" defaultValue={options.categoria ?? ''} maxLength={100} placeholder="Todas"/></label> : null}
      <button type="submit">Consultar</button>
    </form>
    <section aria-label="Resumen de egresos">
      <div className={styles.expenseSummary}>
        <div className={styles.metric}><h2>Egresos registrados del conjunto</h2><p>{missing.length ? 'Subtotal de empresas disponibles' : 'Total de las tres empresas'}</p>{total !== null ? <strong>{formatUsd(total)}</strong> : <p>No disponible</p>}</div>
        {sources.map(source => <div className={styles.metric} key={source.name}><h2>{source.name}</h2><span className={styles.badge}>{source.status}</span>{source.total !== null ? <strong>{formatUsd(source.total)}</strong> : <p role="status">{source.message}</p>}</div>)}
      </div>
      {missing.length ? <div className={styles.notice} role="status"><div><strong>Consolidado incompleto</strong><p>Fuentes sin datos válidos: {missing.map(source => source.name).join(', ')}. {valid.length ? 'El subtotal incluye únicamente las empresas disponibles; no es un consolidado definitivo.' : 'No hay importes validados para calcular un subtotal.'}</p></div></div> : null}
    </section>
    <section className={styles.panel} aria-label="Desglose por empresa">
      <h2>Desglose por empresa</h2>
      {([['Ferraro Detail', ferraro], ['PPF House', ppf]] as const).map(([name, result]) => <div className={styles.expenseBreakdown} key={name}>
        <div className={styles.panelHead}><h3>{name}</h3><span className={styles.badge}>{expenseStatus(result)}</span></div>
        {result.ok ? <dl className={styles.expenseTotals}>{([['Compras', 'compras'], ['Sueldos pagados', 'sueldosPagados'], ['Otros gastos · Gastos manuales', 'gastosManuales'], ['Egresos totales', 'egresos']] as const).map(([label, key]) => <div key={key}><dt>{label}</dt><dd>{formatUsd(result.expenses.totales[key])}</dd></div>)}</dl> : <p role="status">{result.message}</p>}
      </div>)}
      <div className={styles.expenseBreakdown}><div className={styles.panelHead}><h3>RFN Argentina</h3><span className={styles.badge}>{sources[2]!.status}</span></div>
        {rfn.ok ? <dl className={styles.expenseTotals}>{([['Compras', 'compras'], ['Sueldos pagados', null], ['Otros gastos · Gastos operativos', 'gastos'], ['Egresos totales', 'egresos']] as const).map(([label, key]) => <div key={label}><dt>{label}</dt><dd>{key === null ? 'Incluidos en gastos operativos' : formatUsd(rfn.summary.totales[key])}</dd></div>)}</dl> : <p role="status">{rfn.message}</p>}
      </div>
      <p className={styles.footnote}>Los sueldos pagados ya están incluidos en los totales de Ferraro y PPF. En RFN, los sueldos forman parte de los gastos operativos. Las compras de RFN corresponden a mercadería recibida según la regla de RFN; no necesariamente equivalen a pagos bancarios confirmados. El conjunto representa egresos registrados según las reglas de cada fuente, no ganancia ni caja bancaria conciliada. No se compensan transferencias entre empresas sin identificar.</p>
    </section>
    {company === 'todas' ? <p>El detalle de movimientos se consulta seleccionando una empresa.</p> : <section className={styles.panel} aria-label="Listado de movimientos">
      <div className={styles.panelHead}><h2>Movimientos de {companies[company as keyof typeof companies]}</h2></div>
      {selected ? !selected.ok ? <p role="status">{expenseStatus(selected)}: {selected.message}</p> : <div className={styles.tableScroll}><table><thead><tr><th>Fecha</th><th>Empresa</th><th>Tipo</th><th>Movimiento/reversión</th><th>Importe USD</th></tr></thead><tbody>{selected.expenses.movimientos.map(row => <tr key={row.id}><td>{dates.format(new Date(row.fecha))}</td><td>{companies[company as keyof typeof companies]}</td><td>{types[row.tipo]}</td><td>{row.reversion ? 'Reversión' : 'Movimiento'}</td><td>{formatUsd(row.importeUsd)}</td></tr>)}</tbody></table>{selected.expenses.movimientos.length === 0 ? <p>Sin movimientos en esta página.</p> : null}</div> : null}
      {company === 'rfn-argentina' && !rfn.ok ? <p role="status">{rfnErrorStatus(rfn.message)}: {rfn.message}</p> : null}
      {rfn.ok && rfnList ? !rfnList.ok ? <p role="status">{rfnErrorStatus(rfnList.message)}: {rfnList.message}</p> : <>
        <p>Gastos operativos de RFN. Este listado no incluye compras. Total del filtro: {formatUsd(rfnList.expenses.totalDelFiltro)}</p>
        <div className={styles.tableScroll}><table><thead><tr><th>Fecha</th><th>Categoría original</th><th>Medio de pago</th><th>Importe USD</th></tr></thead><tbody>{rfnList.expenses.gastos.map(row => <tr key={row.id}><td>{dates.format(new Date(row.fecha))}</td><td>{row.categoria}</td><td>{row.medioPago}</td><td>{formatUsd(row.importe)}</td></tr>)}</tbody></table>{rfnList.expenses.gastos.length === 0 ? <p>Sin movimientos en esta página.</p> : null}</div>
      </> : null}
      {pagination ? <nav className={styles.pagination} aria-label="Paginación de gastos">{pagination.pagina > 1 ? <Link href={pageUrl(pagination.pagina - 1)}>Anterior</Link> : null}<span>Página {pagination.pagina} de {pagination.totalPaginas}</span>{pagination.hayMas ? <Link href={pageUrl(pagination.pagina + 1)}>Siguiente</Link> : null}</nav> : null}
    </section>}
  </div>;
}
