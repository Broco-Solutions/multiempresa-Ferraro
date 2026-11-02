import { PageHeader, CompanyCards, styles } from '@/components/patterns/page';
export default function Page(){return <div className={styles.page}><PageHeader title="Empresas" description="Consultá el estado financiero de cada empresa."/><section><div className={styles.sectionHead}><div><h2>Empresas</h2><p>Seleccioná una empresa para ver su detalle.</p></div></div><CompanyCards/></section></div>}
