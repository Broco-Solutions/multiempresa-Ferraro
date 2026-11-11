import Link from 'next/link';
import { AlertTriangleIcon, ArrowUpRightIcon, ChartNoAxesCombinedIcon, CheckCircle2Icon, CircleDashedIcon, CircleSlashIcon, DollarSignIcon, type LucideIcon } from 'lucide-react';
import { companies, companyById } from '@/config/companies';
import { CompanyLogo } from '@/components/brand/brand';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { NativeSelect, fieldLabel } from '@/components/ui/field';
import { cn } from '@/lib/utils';

/** Clases de layout compartidas por páginas y estados. */
export const layout = {
  page: 'mx-auto grid w-full max-w-[1320px] min-w-0 gap-8',
  section: 'grid min-w-0 gap-4',
  grid3: 'grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3',
  footnote: 'max-w-4xl text-xs leading-relaxed text-muted-foreground',
  filters: 'flex min-w-0 flex-wrap items-end gap-3 rounded-2xl border bg-card/70 p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)] backdrop-blur [&>label]:min-w-[150px] [&>label]:flex-1 max-[550px]:[&>label]:basis-full',
  submit: 'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_-10px_rgb(255_206_19/0.7)] transition hover:brightness-105 active:translate-y-px max-[550px]:w-full',
  link: 'inline-flex items-center gap-1.5 text-xs font-semibold text-highlight underline-offset-4 hover:underline',
};

export function PageHeader({ title, description, eyebrow = 'Multi-Empresa Ferraro', icon: Icon, aside }: { title: string; description: string; eyebrow?: string; icon?: LucideIcon; aside?: React.ReactNode }) {
  return <header className="flex min-w-0 animate-rise flex-wrap items-end justify-between gap-6">
    <div className="flex min-w-0 items-start gap-4">
      {Icon ? <span className="mt-1 hidden size-12 shrink-0 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-highlight shadow-[0_0_32px_-8px_rgb(255_206_19/0.5)] sm:grid"><Icon className="size-6"/></span> : null}
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[10px] font-bold tracking-[0.22em] text-highlight uppercase"><span className="inline-flex gap-[3px]" aria-hidden><i className="h-2.5 w-1 rounded-[1px] bg-foreground"/><i className="h-2.5 w-1 rounded-[1px] bg-brand-gray"/><i className="h-2.5 w-1 rounded-[1px] bg-brand-yellow"/></span>{eyebrow}</p>
        <h1 className="mt-2.5 text-[28px] leading-[1.08] font-bold tracking-[-0.035em] sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
    <div className="flex items-center gap-3">{aside}<div className="flex items-center gap-2.5 rounded-xl border bg-card/70 px-3.5 py-2"><DollarSignIcon className="size-4 text-highlight"/><span className="grid leading-tight"><span className="text-[9px] font-bold tracking-[0.16em] text-muted-foreground">MONEDA</span><strong className="text-sm">USD</strong></span></div></div>
  </header>;
}

export function SectionTitle({ title, description, children, as: Tag = 'h2' }: { title: string; description?: React.ReactNode; children?: React.ReactNode; as?: 'h2' | 'h3' }) {
  return <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
    <div className="min-w-0"><Tag className="text-lg font-semibold tracking-tight">{title}</Tag>{description ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p> : null}</div>
    {children}
  </div>;
}

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';
const toneIcons: Record<Tone, LucideIcon> = { success: CheckCircle2Icon, warning: AlertTriangleIcon, danger: CircleSlashIcon, neutral: CircleDashedIcon, info: CircleDashedIcon };
/** El estado se comunica con icono + texto, nunca solo con color. */
export function statusTone(status: string): Tone {
  if (/^Conectada|^Disponible|^Datos completos/.test(status)) return 'success';
  if (/parcial|incompatible|Sin movimientos/i.test(status)) return 'warning';
  if (/No disponible|Sin datos/.test(status)) return 'danger';
  return 'neutral';
}
export function StatusBadge({ status, tone = statusTone(status), className }: { status: string; tone?: Tone; className?: string }) {
  const Icon = toneIcons[tone];
  return <Badge variant={tone} className={cn('whitespace-normal', className)}><Icon/>{status}</Badge>;
}

export function Notice({ title, children, tone = 'warning', role = 'status' }: { title: string; children?: React.ReactNode; tone?: 'warning' | 'danger' | 'info'; role?: 'status' | 'alert' }) {
  const styles = { warning: 'border-warning/30 bg-warning-surface text-warning', danger: 'border-danger/30 bg-danger-surface text-danger', info: 'border-info/30 bg-info-surface text-info' }[tone];
  return <div role={role} className={cn('flex min-w-0 gap-3 rounded-xl border px-4 py-3.5', styles)}>
    <AlertTriangleIcon className="mt-0.5 size-4 shrink-0"/>
    <div className="min-w-0 text-foreground"><strong className="text-sm font-semibold">{title}</strong>{children ? <div className="mt-1 text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{children}</div> : null}</div>
  </div>;
}

/** Tarjeta KPI: el importe exacto (string USD) es siempre el texto visible. */
export function KpiCard({ label, value, icon: Icon, tone = 'neutral', caption, accent, as: Tag = 'h3', delay = 0, children, className, media }: { media?: React.ReactNode; label: string; value: React.ReactNode; icon?: LucideIcon; tone?: 'neutral' | 'positive' | 'negative' | 'brand'; caption?: React.ReactNode; accent?: string; as?: 'h2' | 'h3'; delay?: number; children?: React.ReactNode; className?: string }) {
  const iconTone = { neutral: 'bg-muted text-muted-foreground', positive: 'bg-success-surface text-success', negative: 'bg-danger-surface text-danger', brand: 'bg-primary/12 text-highlight' }[tone];
  return <Card className={cn('group relative animate-rise overflow-hidden p-5 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-foreground/15 sm:p-6', className)} style={{ animationDelay: `${delay}ms` }}>
    {accent ? <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: accent }}/> : null}
    <span aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-primary/0 blur-3xl transition-colors duration-500 group-hover:bg-primary/10"/>
    <div className="flex items-center justify-between gap-3">
      <Tag className="text-[13px] font-medium text-muted-foreground">{label}</Tag>
      {media ?? (Icon ? <span className={cn('grid size-9 place-items-center rounded-xl', iconTone)}><Icon className="size-[18px]"/></span> : null)}
    </div>
    <strong className="num mt-4 block text-[clamp(22px,2.4vw,30px)] leading-none font-semibold [overflow-wrap:anywhere]">{value}</strong>
    {caption ? <div className="mt-2 text-xs text-muted-foreground">{caption}</div> : null}
    {children}
  </Card>;
}

export function EmptyState({ chart = false }: { chart?: boolean }) {
  return <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center">
    <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><ChartNoAxesCombinedIcon className="size-6"/></span>
    <strong className="text-sm">Sin datos disponibles</strong><p className="mt-1 text-xs text-muted-foreground">La información financiera aún no está conectada.</p>
    {chart && <span className="mt-1 text-xs text-muted-foreground">La evolución se mostrará cuando haya información disponible.</span>}
  </div>;
}

export function Filters({ type = false }: { type?: boolean }) {
  return <Card className="p-5"><div className="flex flex-wrap justify-between gap-3"><strong>Filtros</strong><span className="text-xs text-muted-foreground">Disponibles al conectar las fuentes</span></div>
    <div className="mt-4 flex flex-wrap gap-3">{['Empresa', 'Período', ...(type ? ['Tipo'] : [])].map(label => <label key={label} className={cn(fieldLabel, 'min-w-[170px] flex-1')}>{label}<NativeSelect disabled defaultValue=""><option value="">Pendiente de conexión</option></NativeSelect></label>)}</div>
  </Card>;
}

export function CompanyCards({ rfnStatus = 'Sin verificar', sourceStatuses = {} }: { rfnStatus?: string; sourceStatuses?: Record<string, string> }) {
  return <div className={layout.grid3}>{companies.map((c, index) => {
    const status = c.id === 'rfn-argentina' ? rfnStatus : (sourceStatuses[c.id] ?? 'Pendiente de conexión');
    return <Link key={c.id} href={`/empresas/${c.id}`} className="group block min-w-0 animate-rise" style={{ animationDelay: `${index * 70}ms` }}>
      <Card className="relative h-full overflow-hidden p-6 transition-[border-color,transform] duration-300 group-hover:-translate-y-1 group-hover:border-foreground/20">
        <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: c.color }}/>
        <span aria-hidden className="pointer-events-none absolute -right-10 -bottom-10 size-44 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-25" style={{ background: c.color }}/>
        <div className="flex items-start justify-between gap-4"><CompanyLogo id={c.id} size="lg"/><span className="grid size-9 place-items-center rounded-full border text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-highlight"><ArrowUpRightIcon className="size-4"/></span></div>
        <strong className="mt-6 block text-lg tracking-tight">{c.name}</strong>
        <div className="mt-3"><StatusBadge status={status}/></div>
        <span className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-highlight">Ver empresa <ArrowUpRightIcon className="size-3.5"/></span>
      </Card>
    </Link>;
  })}</div>;
}

export function CompanyHeading({ id, title, subtitle, as: Tag = 'h2' }: { id: string; title: string; subtitle?: React.ReactNode; as?: 'h2' | 'h3' }) {
  const company = companyById(id);
  return <div className="flex min-w-0 items-center gap-3"><CompanyLogo id={id} size="md"/><div className="min-w-0"><Tag className="text-base font-semibold tracking-tight">{title}</Tag>{subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}</div>{company ? <span aria-hidden className="ml-1 hidden h-6 w-px bg-border sm:block"/> : null}</div>;
}

export function DetailPage({ title, description }: { title: string; description: string }) {
  return <div className={layout.page}><PageHeader title={title} description={description}/><Filters type/>
    <Card className="p-6"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-lg font-semibold">Detalle de {title.toLowerCase()}</h2><p className="text-xs text-muted-foreground">Consulta financiera consolidada en USD.</p></div><StatusBadge status="Pendiente de conexión"/></div><EmptyState/></Card>
  </div>;
}
