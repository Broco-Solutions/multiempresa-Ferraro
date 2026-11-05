import { styles } from './page';
import { formatUsd } from './rfn-finance';
import type { Result } from '@/modules/integrations/customer-receipts/client.server';
export function CustomerReceiptsPanel({ name, result }: { name: string; result: Result }) {
  return <section className={styles.panel}><div className={styles.panelHead}><h2>{name}</h2><span className={styles.badge}>{result.ok ? 'Conectada' : 'Sin datos'}</span></div>{result.ok ? <div className={styles.metric}><span>Cobros netos de clientes</span><strong>{formatUsd(result.cobros)}</strong><p>{result.movimientos === 0 ? 'Sin movimientos en el período.' : 'Incluye devoluciones y reversiones. Excluye ingresos manuales.'}</p></div> : <p role="status">{result.message}</p>}</section>;
}
