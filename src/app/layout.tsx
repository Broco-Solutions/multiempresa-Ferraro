import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
export const metadata: Metadata = { title: { default: 'Multi-Empresa Ferraro', template: '%s · Multi-Empresa Ferraro' }, robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es-AR" className={inter.variable}><body>{children}</body></html>; }
