import { requireOwner } from '@/modules/identity/session';
import { PageHeader, CompanyCards, styles } from '@/components/patterns/page';
import { getRfnIdentity } from '@/modules/integrations/rfn/client.server';
import { integrationMessage } from '@/modules/integrations/rfn/finance.server';
import { IncompleteNotice } from '@/components/patterns/rfn-finance';
export default async function CompaniesPage() {
  await requireOwner();
  let status;
  try { await getRfnIdentity(); status = 'Conectada'; } catch (error) { status = integrationMessage(error); }
  return <div className={styles.page}><PageHeader title="Empresas" description="Estado de las fuentes de consulta financiera."/><IncompleteNotice/><CompanyCards rfnStatus={status}/></div>;
}
