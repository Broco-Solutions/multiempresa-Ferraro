import { requireOwner } from '@/modules/identity/session';
import { DetailPage } from '@/components/patterns/page';
export default async function Page(){await requireOwner();return <DetailPage title="Movimientos" description="Consultá las entradas y salidas de las tres empresas en una sola vista."/>}
