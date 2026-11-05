import Link from 'next/link';
import { styles } from './page';
import type { RfnDateRange } from '@/modules/integrations/rfn/client.server';
import type { RfnSummary } from '@/modules/integrations/rfn/schema';
import { centsToUsd, usdToCents } from '@/modules/integrations/rfn/money';
export function formatUsd(value: string) {
  const canonical = centsToUsd(usdToCents(value));
  const [whole, fraction] = canonical.split('.');
  return `USD ${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${fraction}`;
}
export function PeriodForm({ period, category }: { period: RfnDateRange; category?: string }) {
  return <form className={styles.filters} method="get"><label>Desde<input name="desde" type="date" defaultValue={period.desde} required/></label><label>Hasta<input name="hasta" type="date" defaultValue={period.hasta} required/></label>{category !== undefined ? <label>Categoría original<input name="categoria" defaultValue={category} maxLength={100} placeholder="Todas"/></label> : null}<button type="submit">Consultar</button></form>;
}
export function RfnSummaryPanel({ result, period }: { result: { ok: true; summary: RfnSummary } | { ok: false; message: string }; period: RfnDateRange }) {
  return <section className={styles.panel}><div className={styles.panelHead}><div><h2>RFN Argentina</h2><p>{period.desde} al {period.hasta} · America/Argentina/Buenos_Aires</p></div><span className={styles.badge}>{result.ok ? 'Conectada' : 'Sin datos'}</span></div>
    {result.ok ? <><div className={styles.metrics}>{([['Cobros', 'cobros'], ['Gastos operativos', 'gastos'], ['Compras', 'compras'], ['Egresos totales', 'egresos'], ['Saldo neto', 'resultadoNeto']] as const).map(([label,key]) => <div className={styles.metric} key={key}><span>{label}</span><strong>{formatUsd(result.summary.totales[key])}</strong></div>)}</div><p className={styles.footnote}>Importes individuales de RFN. Egresos = gastos + compras; los sueldos ya están incluidos en gastos. Las compras corresponden a mercadería recibida. El saldo neto no representa ganancia.</p></> : <p role="status" className={styles.footnote}>{result.message}</p>}
  </section>;
}
export function IncompleteNotice() { return <div className={styles.notice}><span className={styles.noticeDot}/><div><strong>Consolidado incompleto</strong><p>Cobertura parcial: se muestran datos individuales validados. No hay totales consolidados de las tres empresas.</p></div></div>; }
export function InvalidFilters() { return <p role="alert">Período o filtros inválidos. Usá fechas válidas y un rango ordenado. <Link href="?">Restablecer filtros</Link></p>; }
