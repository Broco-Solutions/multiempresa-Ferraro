import { requireOwner } from '@/modules/identity/session';
import { styles } from '@/components/patterns/page';

export default async function Loading() {
  await requireOwner();
  return <div className={styles.page}><section className={styles.panel} aria-busy="true" aria-label="Carga de información financiera"><p role="status">Cargando información financiera…</p></section></div>;
}
