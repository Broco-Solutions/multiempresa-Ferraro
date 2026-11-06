'use client';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ComparisonMonth } from '@/modules/finance/summary.server';
import { companies } from '@/config/companies';
import { usdToCents, centsToUsd } from '@/modules/integrations/rfn/money';
import styles from './page.module.css';

const metrics = { cobros: 'Cobros', egresos: 'Egresos', saldoNeto: 'Saldo neto' } as const;
type Metric = keyof typeof metrics;
const colors = ['#346b59', '#376db5', '#9a4b83'];
function exactUsd(value: string) {
  const [whole, fraction] = centsToUsd(usdToCents(value)).split('.');
  return `USD ${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${fraction}`;
}
/** Only coordinates use Number. Exact strings remain the source for all labels. */
function coordinate(value: string | null) {
  if (value === null) return null;
  const cents = usdToCents(value);
  const visual = Number(cents) / 100;
  return Number.isFinite(visual) ? visual : null;
}
export function ComparisonChart({ months }: { months: ComparisonMonth[] }) {
  const [metric, setMetric] = useState<Metric>('cobros');
  const rows = months.map(month => ({ etiqueta: month.etiqueta,
    ...Object.fromEntries(companies.map(company => [company.id, coordinate(month.empresas.find(summary => summary.empresaId === company.id)?.[metric] ?? null)])),
  }));
  const hasData = months.some(month => month.empresas.some(summary => summary[metric] !== null));
  const missing = companies.filter(company => months.some(month => month.empresas.find(summary => summary.empresaId === company.id)?.[metric] == null));
  return <section className={styles.panel} aria-label="Comparación mensual">
    <div className={styles.panelHead}><h2>Comparación mensual</h2><label className={styles.chartSelector}>Métrica<select value={metric} onChange={event => setMetric(event.target.value as Metric)}>{Object.entries(metrics).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label></div>
    <p className={styles.chartNote}>Seis meses calendario completos, o el acumulado disponible del mes en curso, hasta el mes de la fecha hasta seleccionada. Comparación independiente del rango parcial del resumen. Moneda USD.</p>
    {missing.length ? <p role="status" className={styles.chartNote}>Cobertura parcial: faltan datos de {missing.map(company => company.name).join(', ')} en uno o más meses. No disponible no equivale a cero.</p> : null}
    {hasData ? <div className={styles.chartCanvas}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={rows} margin={{ top: 16, right: 8, left: 4, bottom: 10 }} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="etiqueta" interval={0} tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={58}/>
          <YAxis width={64} tick={{ fontSize: 11 }} tickFormatter={value => new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}/>
          <ReferenceLine y={0} stroke="#526660"/>
          <Tooltip content={({ active, label }) => {
            if (!active) return null;
            const month = months.find(value => value.etiqueta === label);
            if (!month) return null;
            return <div className={styles.chartTooltip}><strong>{month.etiqueta} · {metrics[metric]}</strong>{companies.map(company => {
              const value = month.empresas.find(summary => summary.empresaId === company.id)?.[metric] ?? null;
              return <p key={company.id}>{company.name}: {value === null ? 'No disponible' : exactUsd(value)}</p>;
            })}</div>;
          }}/>
          <Legend wrapperStyle={{ fontSize: 12 }}/>
          {companies.map((company, index) => <Bar key={company.id} dataKey={company.id} name={company.name} fill={colors[index]} isAnimationActive={false} maxBarSize={32}/>)}
        </BarChart>
      </ResponsiveContainer>
    </div> : <p role="status" className={styles.empty}>No hay datos validados para comparar {metrics[metric].toLowerCase()}.</p>}
    <div className={styles.tableScroll}><table><caption>{metrics[metric]} por mes y empresa · USD</caption><thead><tr><th scope="col">Mes</th>{companies.map(company => <th scope="col" key={company.id}>{company.name}</th>)}</tr></thead><tbody>{months.map(month => <tr key={month.periodo.desde}><th scope="row">{month.etiqueta}</th>{companies.map(company => {
      const value = month.empresas.find(summary => summary.empresaId === company.id)?.[metric] ?? null;
      return <td key={company.id}>{value === null ? 'No disponible' : exactUsd(value)}</td>;
    })}</tr>)}</tbody></table></div>
  </section>;
}
