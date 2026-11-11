import { Card } from '@/components/ui/card';
import { companies } from '@/config/companies';
import { formatUsd } from './rfn-finance';
import { CompanyHeading, StatusBadge, layout } from './page';
import type { Result } from '@/modules/integrations/customer-receipts/client.server';
export function CustomerReceiptsPanel({ name, result }: { name: string; result: Result }) {
  const id = companies.find(company => company.name === name)?.id ?? '';
  return <Card className="grid gap-4 p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><CompanyHeading id={id} title={name}/><StatusBadge status={result.ok ? 'Conectada' : 'Sin datos'}/></div>{result.ok ? <div><span className="text-xs text-muted-foreground">Cobros netos de clientes</span><strong className="num mt-2 block text-2xl font-semibold">{formatUsd(result.cobros)}</strong><p className={layout.footnote}>{result.movimientos === 0 ? 'Sin movimientos en el período.' : 'Incluye devoluciones y reversiones. Excluye ingresos manuales.'}</p></div> : <p role="status">{result.message}</p>}</Card>;
}
