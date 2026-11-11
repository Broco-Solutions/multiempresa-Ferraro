import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/brand/theme-provider';
import './globals.css';
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono-numbers', weight: ['400', '500', '600', '700'] });
export const metadata: Metadata = { title: { default: 'Multi-Empresa Ferraro', template: '%s · Multi-Empresa Ferraro' }, description: 'Consulta financiera privada de Ferraro Detail, PPF House y RFN Argentina.', robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: [{ media: '(prefers-color-scheme: dark)', color: '#070707' }, { media: '(prefers-color-scheme: light)', color: '#f7f6f3' }] };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-AR" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
    <body><ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>{children}</ThemeProvider></body>
  </html>;
}
