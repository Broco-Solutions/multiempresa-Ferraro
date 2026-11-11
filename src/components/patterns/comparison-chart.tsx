'use client';
import { useState } from 'react';
import { motion } from 'motion/react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AreaChartIcon, BarChart3Icon, ChevronDownIcon, LineChartIcon, TableIcon, TriangleAlertIcon } from 'lucide-react';
import type { ComparisonMonth } from '@/modules/finance/summary.server';
import { companies } from '@/config/companies';
import { usdToCents, centsToUsd } from '@/modules/integrations/rfn/money';
import { CompanyLogo } from '@/components/brand/brand';
import { Card } from '@/components/ui/card';
import { NativeSelect, fieldLabel } from '@/components/ui/field';
import { cn } from '@/lib/utils';

const metrics = { cobros: 'Cobros', egresos: 'Egresos', saldoNeto: 'Saldo neto' } as const;
type Metric = keyof typeof metrics;
const kinds = { barras: { label: 'Barras', Icon: BarChart3Icon }, area: { label: 'Área', Icon: AreaChartIcon }, lineas: { label: 'Líneas', Icon: LineChartIcon } } as const;
type Kind = keyof typeof kinds;
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
const compact = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });
const axis = { tick: { fontSize: 11, fill: 'var(--muted-foreground)' }, tickLine: false, axisLine: false } as const;

export function ComparisonChart({ months }: { months: ComparisonMonth[] }) {
  const [metric, setMetric] = useState<Metric>('cobros');
  const [kind, setKind] = useState<Kind>('barras');
  const rows = months.map(month => ({ etiqueta: month.etiqueta,
    ...Object.fromEntries(companies.map(company => [company.id, coordinate(month.empresas.find(summary => summary.empresaId === company.id)?.[metric] ?? null)])),
  }));
  const hasData = months.some(month => month.empresas.some(summary => summary[metric] !== null));
  const missing = companies.filter(company => months.some(month => month.empresas.find(summary => summary.empresaId === company.id)?.[metric] == null));
  const latest = months.at(-1);
  const tooltip = <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5, stroke: 'var(--border)' }} content={({ active, label }) => {
    if (!active) return null;
    const month = months.find(value => value.etiqueta === label);
    if (!month) return null;
    return <div className="glass min-w-[220px] rounded-xl border p-3 text-xs shadow-2xl"><strong className="mb-2 block text-[13px]">{month.etiqueta} · {metrics[metric]}</strong>{companies.map(company => {
      const value = month.empresas.find(summary => summary.empresaId === company.id)?.[metric] ?? null;
      return <p key={company.id} className="flex items-center justify-between gap-4 py-0.5"><span className="flex items-center gap-2"><i className="size-2 rounded-full" style={{ background: company.color }}/>{company.name}</span><span className="num font-semibold">{value === null ? 'No disponible' : exactUsd(value)}</span></p>;
    })}</div>;
  }}/>;
  const common = { data: rows, margin: { top: 12, right: 8, left: 0, bottom: 4 }, accessibilityLayer: true } as const;
  const grid = <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="var(--border)"/>;
  const x = <XAxis dataKey="etiqueta" interval="preserveStartEnd" minTickGap={8} {...axis} tickMargin={10} height={40}/>;
  const y = <YAxis width={56} {...axis} tickFormatter={value => compact.format(value)}/>;
  const zero = <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5}/>;
  return <Card as="section" className="grid gap-5 p-5 sm:p-6" aria-label="Comparación mensual">
    <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
      <div className="min-w-0"><h2 className="text-lg font-semibold tracking-tight">Comparación mensual</h2><p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Seis meses calendario completos, o el acumulado disponible del mes en curso, hasta el mes de la fecha hasta seleccionada. Comparación independiente del rango parcial del resumen. Moneda USD.</p></div>
      <div className="flex flex-wrap items-end gap-3 max-[550px]:w-full">
        <div role="group" aria-label="Tipo de gráfico" className="flex h-10 items-center gap-0.5 rounded-lg border bg-muted/60 p-1">{(Object.keys(kinds) as Kind[]).map(key => {
          const { label, Icon } = kinds[key];
          return <button key={key} type="button" aria-pressed={kind === key} onClick={() => setKind(key)} className={cn('relative flex h-full cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-muted-foreground transition-colors', kind === key && 'text-foreground')}>
            {kind === key ? <motion.span layoutId="chart-kind" transition={{ type: 'spring', stiffness: 500, damping: 38 }} className="absolute inset-0 rounded-md bg-card shadow-sm ring-1 ring-border"/> : null}
            <Icon className="relative size-3.5"/><span className="relative">{label}</span>
          </button>;
        })}</div>
        <label className={cn(fieldLabel, 'min-w-[150px] max-[550px]:flex-1')}>Métrica<NativeSelect value={metric} onChange={event => setMetric(event.target.value as Metric)}>{Object.entries(metrics).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</NativeSelect></label>
      </div>
    </div>
    {latest ? <ul className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">{companies.map(company => {
      const value = latest.empresas.find(summary => summary.empresaId === company.id)?.[metric] ?? null;
      return <li key={company.id} className="flex min-w-0 items-center gap-3 rounded-xl border bg-muted/30 px-3 py-2.5"><CompanyLogo id={company.id} size="sm"/><span className="min-w-0"><span className="block truncate text-[11px] text-muted-foreground">{company.name} · {latest.etiqueta}</span><span className="num block truncate text-sm font-semibold">{value === null ? 'No disponible' : exactUsd(value)}</span></span><i aria-hidden className="ml-auto h-6 w-1 shrink-0 rounded-full" style={{ background: company.color }}/></li>;
    })}</ul> : null}
    {missing.length ? <p role="status" className="flex items-start gap-2 rounded-lg bg-warning-surface px-3 py-2 text-xs text-foreground"><TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-warning"/>Cobertura parcial: faltan datos de {missing.map(company => company.name).join(', ')} en uno o más meses. No disponible no equivale a cero.</p> : null}
    {hasData ? <div className="h-[340px] w-full min-w-0 sm:h-[380px]">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        {kind === 'barras' ? <BarChart {...common} barGap={3}>
          <defs>{companies.map(company => <linearGradient key={company.id} id={`bar-${company.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={company.color} stopOpacity={1}/><stop offset="100%" stopColor={company.color} stopOpacity={0.55}/></linearGradient>)}</defs>
          {grid}{x}{y}{zero}{tooltip}
          {companies.map(company => <Bar key={company.id} dataKey={company.id} name={company.name} fill={`url(#bar-${company.id})`} radius={[5, 5, 1, 1]} maxBarSize={28} animationDuration={700}/>)}
        </BarChart> : kind === 'area' ? <AreaChart {...common}>
          <defs>{companies.map(company => <linearGradient key={company.id} id={`area-${company.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={company.color} stopOpacity={0.35}/><stop offset="100%" stopColor={company.color} stopOpacity={0}/></linearGradient>)}</defs>
          {grid}{x}{y}{zero}{tooltip}
          {companies.map(company => <Area key={company.id} type="monotone" dataKey={company.id} name={company.name} stroke={company.color} strokeWidth={2.25} fill={`url(#area-${company.id})`} connectNulls={false} dot={{ r: 3, strokeWidth: 0, fill: company.color }} activeDot={{ r: 5 }} animationDuration={800}/>)}
        </AreaChart> : <LineChart {...common}>
          {grid}{x}{y}{zero}{tooltip}
          {companies.map(company => <Line key={company.id} type="monotone" dataKey={company.id} name={company.name} stroke={company.color} strokeWidth={2.5} connectNulls={false} dot={{ r: 3.5, strokeWidth: 2, fill: 'var(--card)' }} activeDot={{ r: 6 }} animationDuration={800}/>)}
        </LineChart>}
      </ResponsiveContainer>
    </div> : <p role="status" className="grid min-h-[200px] place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">No hay datos validados para comparar {metrics[metric].toLowerCase()}.</p>}
    <p className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">{companies.map(company => <span key={company.id} className="inline-flex items-center gap-2"><i aria-hidden className="size-2.5 rounded-sm" style={{ background: company.color }}/>{company.name}</span>)}</p>
    <details className="group rounded-xl border bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-semibold"><TableIcon className="size-3.5 text-highlight"/>Ver tabla de valores exactos<ChevronDownIcon className="ml-auto size-4 transition-transform group-open:rotate-180"/></summary>
      <div className="max-w-full overflow-x-auto px-4 pb-4"><table className="w-full border-collapse text-left text-xs whitespace-nowrap [&_td]:num [&_td]:border-t [&_td]:px-3 [&_td]:py-2.5 [&_td]:text-right [&_th]:border-t [&_th]:px-3 [&_th]:py-2.5"><caption className="py-2 text-left text-muted-foreground">{metrics[metric]} por mes y empresa · USD</caption><thead><tr><th scope="col" className="text-muted-foreground">Mes</th>{companies.map(company => <th scope="col" key={company.id} className="text-right text-muted-foreground">{company.name}</th>)}</tr></thead><tbody>{months.map(month => <tr key={month.periodo.desde}><th scope="row" className="font-semibold">{month.etiqueta}</th>{companies.map(company => {
        const value = month.empresas.find(summary => summary.empresaId === company.id)?.[metric] ?? null;
        return <td key={company.id}>{value === null ? 'No disponible' : exactUsd(value)}</td>;
      })}</tr>)}</tbody></table></div>
    </details>
  </Card>;
}
