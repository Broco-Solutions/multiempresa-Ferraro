import Link from 'next/link';
import { ArrowUpRightIcon, ReceiptIcon } from 'lucide-react';
import type { FinancialCompanySummary } from '@/modules/finance/summary.server';
import { usdToCents } from '@/modules/integrations/rfn/money';
import { companyById } from '@/config/companies';
import { CompanyLogo } from '@/components/brand/brand';
import { Card } from '@/components/ui/card';
import { formatUsd } from './rfn-finance';
import { StatusBadge, layout } from './page';

export function financialStatus(summary: FinancialCompanySummary) {
  return summary.estado === 'completo' ? 'Conectada · Datos completos' : summary.estado === 'parcial' ? 'Datos parciales' : 'No disponible';
}

const segments = [
  { key: 'compras', label: 'Compras', className: 'bg-foreground/80' },
  { key: 'sueldosPagados', label: 'Sueldos', className: 'bg-brand-gray' },
  { key: 'otrosGastos', label: 'Otros', className: 'bg-primary' },
] as const;

/** Composición visual de egresos. Solo se dibuja con componentes validados y no negativos; nunca completa nulos con cero. */
export function expenseComposition(summary: Pick<FinancialCompanySummary, 'compras' | 'sueldosPagados' | 'otrosGastos' | 'empresaId'>) {
  const parts = segments.filter(segment => !(segment.key === 'sueldosPagados' && summary.empresaId === 'rfn-argentina'));
  const values = parts.map(segment => summary[segment.key]);
  if (values.some(value => value === null)) return null;
  const cents = values.map(value => usdToCents(value!));
  if (cents.some(value => value < 0n)) return null;
  const total = cents.reduce((sum, value) => sum + value, 0n);
  if (total <= 0n) return null;
  return parts.map((segment, index) => ({ ...segment, share: Number(cents[index]! * 10000n / total) / 100 }));
}

export function CompositionBar({ composition, className }: { composition: NonNullable<ReturnType<typeof expenseComposition>>; className?: string }) {
  return <div className={className}>
    <div aria-hidden className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted">{composition.filter(part => part.share > 0).map(part => <span key={part.key} className={`${part.className} h-full first:rounded-l-full last:rounded-r-full`} style={{ width: `${part.share}%` }}/>)}</div>
    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">{composition.map(part => <span key={part.key} className="inline-flex items-center gap-1.5"><i aria-hidden className={`${part.className} size-2 rounded-full`}/>{part.label} {part.share.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %</span>)}</p>
  </div>;
}

export function CompanySummary({ summary }: { summary: FinancialCompanySummary }) {
  const query = new URLSearchParams(summary.periodo).toString();
  const company = companyById(summary.empresaId);
  const fields = [
    ['Cobros', summary.cobros], ['Egresos totales', summary.egresos], ['Saldo neto', summary.saldoNeto],
    ['Compras', summary.compras], ['Sueldos pagados', summary.sueldosPagados], ['Otros gastos', summary.otrosGastos],
  ] as const;
  const empty = summary.estado === 'completo' && fields.every(([, value]) => value === null || /^-?0(?:\.0{1,2})?$/.test(value));
  const composition = expenseComposition(summary);
  const negative = (value: string | null) => value !== null && value.startsWith('-') && usdToCents(value) !== 0n;
  return <Card className="group relative flex h-full min-w-0 flex-col overflow-hidden [overflow-wrap:anywhere]" as="article" aria-label={`Resumen de ${summary.nombre}`}>
    <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: company?.color }}/>
    <span aria-hidden className="pointer-events-none absolute -top-20 -right-20 size-52 rounded-full opacity-[0.07] blur-3xl transition-opacity duration-500 group-hover:opacity-20" style={{ background: company?.color }}/>
    <header className="flex items-start gap-3.5 p-5 pb-4 sm:p-6 sm:pb-4">
      <CompanyLogo id={summary.empresaId} size="md"/>
      <div className="grid min-w-0 gap-1.5"><h2 className="text-lg font-semibold tracking-tight">{summary.nombre}</h2><StatusBadge status={financialStatus(summary)}/><p className="num text-[11px] text-muted-foreground">{summary.periodo.desde} al {summary.periodo.hasta} · USD</p></div>
    </header>
    <dl className="m-0 grid flex-1 grid-cols-1 px-5 sm:px-6 [&_dd]:m-0 [&_dd]:mt-1 [&_dt]:text-xs [&_dt]:text-muted-foreground">
      {fields.map(([label, value], index) => <div key={label} className={index < 3 ? 'border-t py-3.5' : 'border-t border-dashed py-3'}>
        <dt>{label}</dt>
        <dd className={index < 3 ? `num text-[clamp(19px,1.9vw,24px)] font-semibold ${label === 'Saldo neto' && negative(value) ? 'text-danger' : ''}` : 'num text-sm font-medium'}>{label === 'Sueldos pagados' && summary.empresaId === 'rfn-argentina' ? <span className="font-sans text-xs text-muted-foreground">Incluidos en gastos operativos</span> : value === null ? <span className="font-sans text-sm text-muted-foreground">No disponible</span> : formatUsd(value)}</dd>
        {label === 'Otros gastos' ? <p className="mt-1 text-[11px] text-muted-foreground">{summary.detalleOtrosGastos}</p> : null}
        {label === 'Egresos totales' && composition ? <CompositionBar composition={composition} className="mt-3"/> : null}
      </div>)}
    </dl>
    {summary.mensaje ? <p role="status" className="mx-5 mb-1 rounded-lg bg-warning-surface px-3 py-2 text-xs text-foreground sm:mx-6">{summary.mensaje}</p> : empty ? <p className="mx-5 text-xs text-muted-foreground sm:mx-6">Sin movimientos en el período.</p> : null}
    <footer className="mt-auto flex flex-wrap gap-2 border-t p-4 sm:px-6">
      <Link className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors hover:border-primary/50 hover:text-highlight" href={`/empresas/${summary.empresaId}?${query}`}>Ver empresa<ArrowUpRightIcon className="size-3.5"/></Link>
      <Link className={`${layout.link} px-2 py-2`} href={`/gastos?empresa=${summary.empresaId}&${query}`}><ReceiptIcon className="size-3.5"/>Ver gastos</Link>
    </footer>
  </Card>;
}
