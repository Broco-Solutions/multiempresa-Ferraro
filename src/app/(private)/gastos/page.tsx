import Link from 'next/link';
import { requireOwner } from '@/modules/identity/session';
import { PageHeader, styles } from '@/components/patterns/page';
import { IncompleteNotice, PeriodForm, InvalidFilters, formatUsd } from '@/components/patterns/rfn-finance';
import { readPeriod, readExpensesOptions, argentinaTimeZone, type SearchParams } from '@/modules/integrations/rfn/period';
import { loadRfnExpenses } from '@/modules/integrations/rfn/finance.server';
export default async function ExpensesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireOwner();
  const params = await searchParams;
  let period: ReturnType<typeof readPeriod>, options: ReturnType<typeof readExpensesOptions>;
  try { period = readPeriod(params); options = readExpensesOptions(params); } catch { return <InvalidFilters/>; }
  const result = await loadRfnExpenses(period, options);
  function pageUrl(page: number) { return '?' + new URLSearchParams({ ...period, pagina: String(page), ...(options.categoria ? { categoria: options.categoria } : {}) }); }
  const dates = new Intl.DateTimeFormat('es-AR', { timeZone: argentinaTimeZone });
  return <div className={styles.page}><PageHeader title="Gastos" description="Gastos operativos de RFN Argentina, incluidos los sueldos registrados."/><IncompleteNotice/><PeriodForm period={period} category={options.categoria ?? ''}/><p>{period.desde} al {period.hasta} · America/Argentina/Buenos_Aires. Este listado no incluye compras de mercadería; su total está en el resumen individual de RFN. Se conserva la categoría original y se omiten conceptos que podrían contener datos personales.</p>
    {!result.ok ? <p role="status">{result.message}</p> : <section className={styles.panel}><div className={styles.panelHead}><h2>RFN Argentina</h2><span>Total del filtro: {formatUsd(result.expenses.totalDelFiltro)}</span></div><div className={styles.tableScroll}><table><thead><tr><th>Fecha</th><th>Categoría original</th><th>Medio de pago</th><th>Importe USD</th></tr></thead><tbody>{result.expenses.gastos.map(row => <tr key={row.id}><td>{dates.format(new Date(row.fecha))}</td><td>{row.categoria}</td><td>{row.medioPago}</td><td>{formatUsd(row.importe)}</td></tr>)}</tbody></table>{result.expenses.gastos.length === 0 ? <p>No hay gastos para este filtro.</p> : null}</div><nav className={styles.pagination} aria-label="Paginación de gastos">{options.pagina > 1 ? <Link href={pageUrl(options.pagina - 1)}>Anterior</Link> : null}<span>Página {result.expenses.paginacion.pagina} de {result.expenses.paginacion.totalPaginas}</span>{result.expenses.paginacion.hayMas ? <Link href={pageUrl(options.pagina + 1)}>Siguiente</Link> : null}</nav></section>}
  </div>;
}
