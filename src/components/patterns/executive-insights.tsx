import Link from 'next/link';
import { ArrowDownRightIcon, ArrowUpRightIcon, CalendarClockIcon, MinusIcon, ScaleIcon, TrendingDownIcon, TrendingUpIcon, TriangleAlertIcon } from 'lucide-react';
import type { FinancialCompanySummary } from '@/modules/finance/summary.server';
import { executiveComparison, receiptsParticipation } from '@/modules/finance/executive-metrics';
import { executivePresets, activeExecutivePreset, type previousExecutivePeriod } from '@/modules/finance/executive-periods';
import { usdToCents } from '@/modules/integrations/rfn/money';
import { CompanyLogo } from '@/components/brand/brand';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatUsd } from './rfn-finance';

type Period = FinancialCompanySummary['periodo'];
type PreviousPeriod = ReturnType<typeof previousExecutivePeriod>;
const labels = { cobros: 'Cobros', egresos: 'Egresos', saldoNeto: 'Saldo neto' };
const icons = { cobros: TrendingUpIcon, egresos: TrendingDownIcon, saldoNeto: ScaleIcon };

export function ExecutiveFilters({ period, now }: { period: Period; now: Date }) {
  const active = activeExecutivePreset(period, now);
  return <div className="grid min-w-0 gap-2.5">
    <nav aria-label="Filtros rápidos" className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border bg-card/70 p-1 backdrop-blur max-[550px]:w-full">
      {executivePresets(now).map(preset => <Link key={preset.id} href={`/?${new URLSearchParams(preset.period)}`} prefetch={false} aria-current={active?.id === preset.id ? 'true' : undefined}
        className="rounded-lg px-4 py-2 text-center text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-[current=true]:bg-primary aria-[current=true]:text-primary-foreground aria-[current=true]:shadow-[0_6px_20px_-8px_rgb(255_206_19/0.8)] max-[550px]:flex-[1_1_42%]">{preset.label}</Link>)}
    </nav>
    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><CalendarClockIcon className="size-3.5 text-highlight"/><span className="font-semibold text-foreground">{active?.label ?? 'Rango personalizado'}</span><span className="num">· {period.desde} al {period.hasta} · America/Argentina/Buenos_Aires</span></p>
  </div>;
}

function visual(value: string) {
  const number = Number(usdToCents(value)) / 100;
  return Number.isFinite(number) ? Math.abs(number) : 0;
}
function DeltaChip({ percentage, reason, positiveIsGood }: { percentage: string | null; reason: string | null; positiveIsGood: boolean }) {
  if (percentage === null) return <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground"><MinusIcon className="size-3"/>{reason}</span>;
  const negative = percentage.startsWith('-');
  const zero = /^-?0,0 %$/.test(percentage);
  const good = zero ? null : negative !== positiveIsGood;
  const Icon = zero ? MinusIcon : negative ? ArrowDownRightIcon : ArrowUpRightIcon;
  return <span className={cn('num inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold', good === null ? 'bg-muted text-muted-foreground' : good ? 'bg-success-surface text-success' : 'bg-danger-surface text-danger')}><Icon className="size-3.5"/>{negative || zero ? '' : '+'}{percentage}</span>;
}

export function PreviousComparison({ current, previous, period, comparison }: { current: FinancialCompanySummary[]; previous: FinancialCompanySummary[]; period: Period; comparison: PreviousPeriod }) {
  const result = executiveComparison(current, previous, comparison.equivalent);
  return <Card as="section" className="grid gap-5 p-5 sm:p-6" aria-label="Comparación con el período anterior">
    <div><h2 className="text-lg font-semibold tracking-tight">Comparación con el período anterior</h2>
      <p className="num mt-1 text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">Actual: {period.desde} al {period.hasta} · Anterior: {comparison.period.desde} al {comparison.period.hasta}</p></div>
    {!comparison.equivalent ? <p role="status" className="text-xs text-warning">Períodos no equivalentes</p> : null}
    {!result.complete ? <div role="status" className="flex gap-3 rounded-xl border border-warning/30 bg-warning-surface p-4"><TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning"/><div><strong className="text-sm">Comparación consolidada incompleta</strong><p className="mt-1 text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">Faltan datos completos en el período actual: {result.missingCurrent.join(', ') || 'ninguna empresa'}. En el anterior: {result.missingPrevious.join(', ') || 'ninguna empresa'}. No se calculan variaciones globales.</p></div></div>
      : <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">{result.metrics.map(metric => {
        const Icon = icons[metric.key];
        const max = Math.max(visual(metric.current), visual(metric.previous)) || 1;
        return <div key={metric.key} className="min-w-0 rounded-xl border bg-muted/25 p-4">
          <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-highlight"/>{labels[metric.key]}</h3><DeltaChip percentage={metric.percentage} reason={metric.reason} positiveIsGood={metric.key !== 'egresos'}/></div>
          <div aria-hidden className="mt-4 grid gap-1.5">
            <span className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.max(2, visual(metric.current) / max * 100)}%` }}/>
            <span className="h-1.5 rounded-full bg-brand-gray/70" style={{ width: `${Math.max(2, visual(metric.previous) / max * 100)}%` }}/>
          </div>
          <dl className="m-0 mt-3 grid grid-cols-2 gap-x-4 [&_dd]:num [&_dd]:m-0 [&_dd]:mt-1 [&_dd]:text-sm [&_dd]:font-semibold [&_dd]:[overflow-wrap:anywhere] [&_dt]:text-[11px] [&_dt]:text-muted-foreground [&>div]:min-w-0 [&>div]:border-t [&>div]:py-2.5">
            <div><dt>Actual</dt><dd>{formatUsd(metric.current)}</dd></div>
            <div><dt>Anterior</dt><dd>{formatUsd(metric.previous)}</dd></div>
            <div><dt>Diferencia USD</dt><dd>{metric.difference === null ? 'No disponible' : formatUsd(metric.difference)}</dd></div>
            <div><dt>Variación</dt><dd>{metric.percentage ?? metric.reason}</dd></div>
          </dl>
        </div>;
      })}</div>}
  </Card>;
}

/** Dona en CSS (conic-gradient) a partir de décimas exactas: sin JavaScript ni redondeos de punto flotante sobre importes. */
export function Donut({ rows }: { rows: { id: string; color: string; tenths: bigint | null }[] }) {
  const ends = rows.map((_, index) => rows.slice(0, index + 1).reduce((sum, row) => sum + Number(row.tenths ?? 0n) / 10, 0));
  const stops = rows.map((row, index) => `${row.color} ${ends[index - 1] ?? 0}% ${ends[index]}%`);
  return <div aria-hidden className="relative mx-auto grid size-44 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${stops.join(', ')})` }}>
    <div className="grid size-[124px] place-items-center rounded-full bg-card text-center shadow-[inset_0_0_0_1px_var(--border)]"><span><span className="block text-[10px] font-bold tracking-[0.16em] text-muted-foreground">COBROS</span><span className="num block text-xl font-semibold">100 %</span></span></div>
  </div>;
}

export function CompanyParticipation({ summaries }: { summaries: FinancialCompanySummary[] }) {
  const result = receiptsParticipation(summaries);
  return <Card as="section" className="grid gap-5 p-5 sm:p-6" aria-label="Participación de las empresas">
    <div><h2 className="text-lg font-semibold tracking-tight">Participación de las empresas</h2><p className="mt-1 text-xs text-muted-foreground">Cobros netos informados por las fuentes · USD</p></div>
    {result.reason ? <p role="status" className="rounded-xl border border-warning/30 bg-warning-surface p-4 text-xs leading-relaxed [overflow-wrap:anywhere]"><strong className="text-sm">Participación no disponible.</strong> {result.reason}</p> : null}
    <div className={cn('grid min-w-0 items-center gap-6', !result.reason && 'md:grid-cols-[auto_minmax(0,1fr)] md:gap-10')}>
      {!result.reason ? <Donut rows={result.rows}/> : null}
      <div className="grid min-w-0 gap-5">{result.rows.map(row => <div key={row.id} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2">
        <CompanyLogo id={row.id} size="sm"/>
        <span className="min-w-0"><span className="block truncate text-sm font-semibold">{row.name}</span><span className="num block text-xs text-muted-foreground [overflow-wrap:anywhere]">{row.receipts === null ? 'No disponible' : formatUsd(row.receipts)}</span></span>
        <strong className="num text-right text-lg font-semibold [overflow-wrap:anywhere]">{row.percentage ?? 'No disponible'}</strong>
        {row.tenths !== null ? <div data-participation-track aria-hidden="true" className="col-span-full h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Number(row.tenths) / 10}%`, backgroundColor: row.color }}/></div> : null}
      </div>)}</div>
    </div>
  </Card>;
}
