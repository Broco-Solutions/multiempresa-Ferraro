import { Building2Icon, CalendarDaysIcon } from 'lucide-react';
import { requireOwner } from '@/modules/identity/session';
import { PageHeader, CompanyCards, layout } from '@/components/patterns/page';
import { financialStatus } from '@/components/patterns/company-summary';
import { currentMonth } from '@/modules/integrations/rfn/period';
import { loadFinancialSummaries } from '@/modules/finance/summary.server';
export default async function CompaniesPage() {
  await requireOwner();
  const period = currentMonth();
  const summaries = await loadFinancialSummaries(period);
  const statuses = Object.fromEntries(summaries.map(summary => [summary.empresaId, financialStatus(summary)]));
  return <div className={layout.page}><PageHeader title="Empresas" description="Estado de las fuentes de consulta financiera." icon={Building2Icon}/><p className="num -mt-3 flex items-center gap-2 text-xs text-muted-foreground"><CalendarDaysIcon className="size-3.5 text-highlight"/>Período: {period.desde} al {period.hasta} · Calendario argentino</p><CompanyCards sourceStatuses={statuses} rfnStatus={statuses['rfn-argentina']}/></div>;
}
