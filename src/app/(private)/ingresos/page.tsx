import { requireOwner } from '@/modules/identity/session';
import { DetailPage } from '@/components/patterns/page';
export default async function Page(){await requireOwner();return <DetailPage title="Ingresos" description="Consultá los ingresos y cobros de las tres empresas."/>}
