import { notFound } from 'next/navigation';
import Link from 'next/link';
import { companies } from '@/config/companies';
import { PageHeader, EmptyState, Filters, styles } from '@/components/patterns/page';
export default async function Page({params}:{params:Promise<{empresa:string}>}){const {empresa}=await params; const company=companies.find(c=>c.id===empresa); if(!company) notFound(); return <div className={styles.page}><Link className={styles.back} href="/empresas">← Todas las empresas</Link><PageHeader title={company.name} description="Resumen financiero individual en USD."/><Filters/><section className={styles.panel}><div className={styles.panelHead}><div><h2>Información financiera</h2><p>Detalle de la empresa seleccionada.</p></div><span className={styles.badge}>Pendiente de conexión</span></div><EmptyState/></section></div>}
