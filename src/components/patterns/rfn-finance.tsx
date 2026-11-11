import Link from 'next/link';
import { RotateCcwIcon, SearchIcon, TriangleAlertIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input, fieldLabel } from '@/components/ui/field';
import type { RfnDateRange } from '@/modules/integrations/rfn/client.server';
import type { RfnSummary } from '@/modules/integrations/rfn/schema';
import { centsToUsd, usdToCents } from '@/modules/integrations/rfn/money';
import { CompanyHeading, KpiCard, Notice, StatusBadge, layout } from './page';
export function formatUsd(value: string) {
  const canonical = centsToUsd(usdToCents(value));
  const [whole, fraction] = canonical.split('.');
  return `USD ${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${fraction}`;
}
export function PeriodForm({ period, category }: { period: RfnDateRange; category?: string }) {
  return <form className={layout.filters} method="get"><label className={fieldLabel}>Desde<Input name="desde" type="date" defaultValue={period.desde} required/></label><label className={fieldLabel}>Hasta<Input name="hasta" type="date" defaultValue={period.hasta} required/></label>{category !== undefined ? <label className={fieldLabel}>Categoría original<Input name="categoria" defaultValue={category} maxLength={100} placeholder="Todas"/></label> : null}<button className={layout.submit} type="submit"><SearchIcon className="size-4"/>Consultar</button></form>;
}
export function RfnSummaryPanel({ result, period }: { result: { ok: true; summary: RfnSummary } | { ok: false; message: string }; period: RfnDateRange }) {
  return <Card className="grid gap-5 p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><CompanyHeading id="rfn-argentina" title="RFN Argentina" subtitle={`${period.desde} al ${period.hasta} · America/Argentina/Buenos_Aires`}/><StatusBadge status={result.ok ? 'Conectada' : 'Sin datos'}/></div>
    {result.ok ? <><div className={layout.grid3}>{([['Cobros', 'cobros'], ['Gastos operativos', 'gastos'], ['Compras', 'compras'], ['Egresos totales', 'egresos'], ['Saldo neto', 'resultadoNeto']] as const).map(([label, key]) => <KpiCard key={key} label={label} value={formatUsd(result.summary.totales[key])}/>)}</div><p className={layout.footnote}>Importes individuales de RFN. Egresos = gastos + compras; los sueldos ya están incluidos en gastos. Las compras corresponden a mercadería recibida. El saldo neto no representa ganancia.</p></> : <p role="status" className={layout.footnote}>{result.message}</p>}
  </Card>;
}
export function IncompleteNotice() { return <Notice title="Consolidado incompleto">Cobertura parcial: se muestran datos individuales validados. No hay totales consolidados de las tres empresas.</Notice>; }
export function InvalidFilters() {
  return <div className="mx-auto grid max-w-lg place-items-center gap-4 py-16 text-center"><span className="grid size-14 place-items-center rounded-2xl bg-danger-surface text-danger"><TriangleAlertIcon className="size-7"/></span><p role="alert" className="text-sm leading-relaxed">Período o filtros inválidos. Usá fechas válidas y un rango ordenado. <Link href="?" className={layout.link}><RotateCcwIcon className="size-3.5"/>Restablecer filtros</Link></p></div>;
}
