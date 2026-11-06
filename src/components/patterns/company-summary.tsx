import Link from 'next/link';
import type { FinancialCompanySummary } from '@/modules/finance/summary.server';
import { formatUsd } from './rfn-finance';
import { styles } from './page';

export function financialStatus(summary: FinancialCompanySummary) {
  return summary.estado === 'completo' ? 'Conectada · Datos completos' : summary.estado === 'parcial' ? 'Datos parciales' : 'No disponible';
}
export function CompanySummary({ summary }: { summary: FinancialCompanySummary }) {
  const query = new URLSearchParams(summary.periodo).toString();
  const fields = [
    ['Cobros', summary.cobros], ['Egresos totales', summary.egresos], ['Saldo neto', summary.saldoNeto],
    ['Compras', summary.compras], ['Sueldos pagados', summary.sueldosPagados], ['Otros gastos', summary.otrosGastos],
  ] as const;
  const empty = summary.estado === 'completo' && fields.every(([, value]) => value === null || /^-?0(?:\.0{1,2})?$/.test(value));
  return <article className={`${styles.panel} ${styles.financialCard}`} aria-label={`Resumen de ${summary.nombre}`}>
    <header className={styles.summaryHeader}><h2>{summary.nombre}</h2><span className={styles.badge}>{financialStatus(summary)}</span><p>{summary.periodo.desde} al {summary.periodo.hasta} · USD</p></header>
    <dl className={styles.companyIndicators}>{fields.map(([label, value], index) => <div key={label} className={index < 3 ? styles.primaryIndicator : styles.secondaryIndicator}>
      <dt>{label}</dt><dd>{label === 'Sueldos pagados' && summary.empresaId === 'rfn-argentina' ? 'Incluidos en gastos operativos' : value === null ? 'No disponible' : formatUsd(value)}</dd>
      {label === 'Otros gastos' ? <p>{summary.detalleOtrosGastos}</p> : null}
    </div>)}</dl>
    {summary.mensaje ? <p role="status">{summary.mensaje}</p> : empty ? <p>Sin movimientos en el período.</p> : null}
    <footer className={styles.summaryLinks}><Link href={`/empresas/${summary.empresaId}?${query}`}>Ver empresa</Link><Link href={`/gastos?empresa=${summary.empresaId}&${query}`}>Ver gastos</Link></footer>
  </article>;
}
