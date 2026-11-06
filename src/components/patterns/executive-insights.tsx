import Link from 'next/link';
import type { FinancialCompanySummary } from '@/modules/finance/summary.server';
import { executiveComparison, receiptsParticipation } from '@/modules/finance/executive-metrics';
import { executivePresets, activeExecutivePreset, type previousExecutivePeriod } from '@/modules/finance/executive-periods';
import { formatUsd } from './rfn-finance';
import { styles } from './page';

type Period = FinancialCompanySummary['periodo'];
type PreviousPeriod = ReturnType<typeof previousExecutivePeriod>;
const labels = { cobros: 'Cobros', egresos: 'Egresos', saldoNeto: 'Saldo neto' };
const colors = { 'ferraro-detail': '#346b59', 'ppf-house': '#376db5', 'rfn-argentina': '#9a4b83' };
export function ExecutiveFilters({ period, now }: { period: Period; now: Date }) {
  const active = activeExecutivePreset(period, now);
  return <div><nav aria-label="Filtros rápidos" className={styles.executivePresets}>
    {executivePresets(now).map(preset => <Link key={preset.id} href={`/?${new URLSearchParams(preset.period)}`} prefetch={false} aria-current={active?.id === preset.id ? 'true' : undefined}>{preset.label}</Link>)}
  </nav><p className={styles.executiveNote}>{active?.label ?? 'Rango personalizado'} · {period.desde} al {period.hasta} · America/Argentina/Buenos_Aires</p></div>;
}
export function PreviousComparison({ current, previous, period, comparison }: { current: FinancialCompanySummary[]; previous: FinancialCompanySummary[]; period: Period; comparison: PreviousPeriod }) {
  const result = executiveComparison(current, previous, comparison.equivalent);
  return <section className={`${styles.panel} ${styles.executivePanel}`} aria-label="Comparación con el período anterior">
    <h2>Comparación con el período anterior</h2>
    <p className={styles.executiveNote}>Actual: {period.desde} al {period.hasta} · Anterior: {comparison.period.desde} al {comparison.period.hasta}</p>
    {!comparison.equivalent ? <p role="status">Períodos no equivalentes</p> : null}
    {!result.complete ? <div role="status"><strong>Comparación consolidada incompleta</strong><p>Faltan datos completos en el período actual: {result.missingCurrent.join(', ') || 'ninguna empresa'}. En el anterior: {result.missingPrevious.join(', ') || 'ninguna empresa'}. No se calculan variaciones globales.</p></div>
      : <div className={styles.executiveComparison}>{result.metrics.map(metric => <div key={metric.key}><h3>{labels[metric.key]}</h3><dl>
        <div><dt>Actual</dt><dd>{formatUsd(metric.current)}</dd></div>
        <div><dt>Anterior</dt><dd>{formatUsd(metric.previous)}</dd></div>
        <div><dt>Diferencia USD</dt><dd>{metric.difference === null ? 'No disponible' : formatUsd(metric.difference)}</dd></div>
        <div><dt>Variación</dt><dd>{metric.percentage ?? metric.reason}</dd></div>
      </dl></div>)}</div>}
  </section>;
}
export function CompanyParticipation({ summaries }: { summaries: FinancialCompanySummary[] }) {
  const result = receiptsParticipation(summaries);
  return <section className={`${styles.panel} ${styles.executivePanel}`} aria-label="Participación de las empresas">
    <h2>Participación de las empresas</h2><p className={styles.executiveNote}>Cobros netos informados por las fuentes · USD</p>
    {result.reason ? <p role="status"><strong>Participación no disponible.</strong> {result.reason}</p> : null}
    <div className={styles.participationRows}>{result.rows.map(row => <div key={row.id} className={styles.participationRow}>
      <span className={styles.participationName}>{row.name}</span><span className={styles.participationAmount}>{row.receipts === null ? 'No disponible' : formatUsd(row.receipts)}</span><strong className={styles.participationPercent}>{row.percentage ?? 'No disponible'}</strong>
      {row.tenths !== null ? <div className={styles.participationTrack} aria-hidden="true"><div style={{ width: `${Number(row.tenths) / 10}%`, backgroundColor: colors[row.id] }}/></div> : null}
    </div>)}</div>
  </section>;
}
