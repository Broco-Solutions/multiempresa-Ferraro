import { redirect } from 'next/navigation';
import { getOwnerSession } from '@/modules/identity/session';
import { authEnvSchema } from '@/infrastructure/auth/config';
import { LoginForm } from '@/modules/identity/login-form';
import styles from './login.module.css';
export const dynamic = 'force-dynamic';
export default async function LoginPage() {
  if (await getOwnerSession()) redirect('/');
  const configured = authEnvSchema.safeParse(process.env).success;
  return <main className={styles.page}>
    <section className={styles.brand}><strong>Multi-Empresa <span>FERRARO</span></strong><div><p>UNA MIRADA COMPARTIDA</p><h2>Tus empresas.<br/>Una visión clara.</h2><p>Consulta financiera privada y de solo lectura.</p></div><small>Ferraro Detail · PPF House · RFN Argentina</small></section>
    <section className={styles.panel}><div className={styles.card}><p className={styles.eyebrow}>MULTI-EMPRESA FERRARO</p><h1>Acceso privado</h1><p>Ingresá con tu cuenta de propietario.</p>{configured ? <LoginForm/> : <p role="alert" className={styles.error}>Acceso no disponible. Falta configurar la autenticación y su almacenamiento exclusivo. Las consultas financieras permanecen bloqueadas.</p>}<p className={styles.help}>Acceso exclusivo del propietario. Si no podés ingresar, contactá al responsable técnico.</p></div></section>
  </main>;
}
