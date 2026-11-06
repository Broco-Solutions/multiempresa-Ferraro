import { Suspense } from 'react';
import Form from 'next/form';
import Link from 'next/link';
import { requireOwner } from '@/modules/identity/session';
import { companies } from '@/config/companies';
import { PageHeader, styles } from '@/components/patterns/page';
import { InvalidFilters, formatUsd } from '@/components/patterns/rfn-finance';
import { argentinaTimeZone, type SearchParams } from '@/modules/integrations/rfn/period';
import { consolidateSummaries, loadCompanySummary, loadFinancialSummaries } from '@/modules/finance/summary.server';
import { loadMovements, movementKey, readMovementFilters, type MovementFilters } from '@/modules/finance/movements.server';

export default async function MovementsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireOwner();
  const params = await searchParams;
  let filters: MovementFilters;
  try { filters = readMovementFilters(params).filters; } catch { return <InvalidFilters/>; }
  return <div className={styles.page}>
    <PageHeader title="Movimientos" description="Entradas y egresos individuales de las tres empresas, en USD."/>
    <Form action="/movimientos" prefetch={false} className={styles.filters} key={JSON.stringify(filters)}>
      <label>Desde<input name="desde" type="date" defaultValue={filters.desde} required/></label>
      <label>Hasta<input name="hasta" type="date" defaultValue={filters.hasta} required/></label>
      <label>Empresa<select aria-label="Empresa" name="empresa" defaultValue={filters.empresa}><option value="todas">Todas las empresas</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Tipo<select aria-label="Tipo" name="tipo" defaultValue={filters.tipo}><option value="todos">Todos</option><option value="cobros">Cobros</option><option value="egresos">Egresos</option></select></label>
      <button type="submit">Consultar</button>
    </Form>
    <Suspense key={JSON.stringify(filters)} fallback={<Loading/>}><MovementSummary filters={filters}/></Suspense>
    <Suspense key={JSON.stringify(params)} fallback={<Loading/>}><MovementListing params={{ ...filters, cursor: params.cursor }} filters={filters}/></Suspense>
  </div>;
}
function Loading() { return <p role="status" aria-busy="true">Cargando información financiera…</p>; }
export async function MovementSummary({ filters }: { filters: MovementFilters }) {
  const all = filters.empresa === 'todas';
  const summaries = all ? await loadFinancialSummaries(filters) : [await loadCompanySummary(filters.empresa as Exclude<MovementFilters['empresa'], 'todas'>, filters)];
  const totals = all ? consolidateSummaries(summaries) : summaries[0]!;
  const missing = summaries.filter(s => s.estado !== 'completo');
  return <section className={styles.panel} aria-label="Resumen financiero del período">
    <div className={styles.panelHead}><div><h2>Resumen financiero del período</h2><p>{filters.desde} al {filters.hasta} · {argentinaTimeZone}</p></div></div>
    {missing.length ? <p role="status">{all ? 'Consolidado incompleto' : 'Resumen incompleto'}: {missing.map(s => s.nombre).join(', ')}.</p> : null}
    {all && missing.length ? <p>Subtotal de empresas disponibles</p> : null}
    <div className={styles.metrics}>{([['Cobros', 'cobros'], ['Egresos', 'egresos'], ['Saldo neto', 'saldoNeto']] as const).map(([label, key]) => <div className={styles.metric} key={key}><h3>{label}</h3><strong>{totals[key] === null ? 'No disponible' : formatUsd(totals[key])}</strong></div>)}</div>
    <p className={styles.footnote}>El saldo neto representa cobros menos egresos registrados. No equivale a ganancia ni saldo bancario conciliado.</p>
    <p className={styles.chartNote}>Los indicadores abarcan todo el período y la empresa seleccionados, independientemente del tipo y las filas visibles. No se compensan transferencias entre empresas sin identificar.</p>
  </section>;
}
const types: Record<string, string> = { CUSTOMER_PAYMENT: 'Cobro', CUSTOMER_REFUND: 'Devolución', PURCHASE: 'Compra', MANUAL_EXPENSE: 'Gasto', SALARY_PAYMENT: 'Sueldo', SENIA: 'Seña', COBRO: 'Cobro', COMPRA_RECIBIDA: 'Compra recibida', GASTO_OPERATIVO: 'Gasto operativo (incluye sueldos)' };
const dateFormat = new Intl.DateTimeFormat('es-AR', { timeZone: argentinaTimeZone, dateStyle: 'short', timeStyle: 'medium', hourCycle: 'h23' });
export async function MovementListing({ params, filters }: { params: SearchParams; filters: MovementFilters }) {
  const result = await loadMovements(params);
  const query = new URLSearchParams({ ...filters, ...(result.nextCursor ? { cursor: result.nextCursor } : {}) });
  return <>
    <section className={styles.panel} aria-label="Estado de las fuentes">
      <h2>Estado de las fuentes</h2>
      {!result.complete ? <p role="status">Listado incompleto. No se puede continuar la paginación global sin cobertura de todas las fuentes requeridas.</p> : null}
      <ul className={styles.movementSources}>{result.sources.map(s => <li key={s.key}>{companies.find(c => c.id === s.empresaId)!.name} · {s.flujo}: <strong>{s.available ? 'Disponible' : 'No disponible'}</strong></li>)}</ul>
    </section>
    <section className={styles.panel} aria-label="Listado de movimientos">
      <h2>Movimientos del período</h2>
      <p className={styles.chartNote}>Compras recibidas de RFN: egresos registrados, sin confirmación independiente de pago bancario. Sus sueldos ya están incluidos en gastos operativos.</p>
      {result.movements.length ? <table className={styles.movementsTable}>
        <caption>Hasta 25 movimientos · Fecha y hora argentina</caption>
        <thead><tr>{['Fecha', 'Empresa', 'Tipo', 'Dirección', 'Importe'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{result.movements.map(row => <tr key={movementKey(row)} data-origen={movementKey(row)}>
          <td data-label="Fecha"><time dateTime={row.fecha}>{dateFormat.format(new Date(row.fecha))}</time></td>
          <td data-label="Empresa">{companies.find(c => c.id === row.empresaId)!.name}</td>
          <td data-label="Tipo">{row.reversion ? `Reversión de ${(types[row.tipo] ?? row.tipo).toLowerCase()}` : types[row.tipo] ?? row.tipo}</td>
          <td data-label="Dirección"><span className={row.direccion === 'entrada' ? styles.movementIn : styles.movementOut}>{row.direccion === 'entrada' ? 'Entrada' : 'Salida'}</span></td>
          <td data-label="Importe">{row.direccion === 'entrada' ? '+' : ''}{formatUsd(row.importeUsd)}</td>
        </tr>)}</tbody>
      </table> : <p role="status">{result.complete ? 'Sin movimientos para los filtros seleccionados.' : 'No hay movimientos validados disponibles. Listado incompleto.'}</p>}
    </section>
    <nav className={styles.pagination} aria-label="Paginación de movimientos">{result.nextCursor ? <Link href={`/movimientos?${query}`} prefetch={false}>Siguiente</Link> : null}<span>Podés volver con el botón Atrás del navegador.</span></nav>
    <p className={styles.chartNote}>Los registros y sus reversiones pueden cambiar entre solicitudes. No existe un snapshot global entre las bases independientes.</p>
  </>;
}
