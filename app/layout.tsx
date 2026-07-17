import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css'; // Global styles
import { AppProvider } from '@/context/AppContext';
import ErrorBoundary from '@/components/ErrorBoundary';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://flowjan.cloud'),
  title: 'JanFlow - Gestão Financeira Integrada',
  description: 'Plataforma de gestão financeira integrada para Jan Agência com contexto dual (Empresa/Pessoal).',
  icons: {
    icon: '/CAPAFACE_JAN2021.jpg',
    shortcut: '/CAPAFACE_JAN2021.jpg',
    apple: '/CAPAFACE_JAN2021.jpg',
  },
  openGraph: {
    title: 'JanFlow - Gestão Financeira Integrada',
    description: 'Plataforma de gestão financeira integrada para Jan Agência com contexto dual (Empresa/Pessoal).',
    images: [
      {
        url: '/CAPAFACE_JAN2021.jpg',
        width: 1200,
        height: 630,
        alt: 'JanFlow - Gestão Financeira Integrada',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JanFlow - Gestão Financeira Integrada',
    description: 'Plataforma de gestão financeira integrada para Jan Agência com contexto dual (Empresa/Pessoal).',
    images: ['/CAPAFACE_JAN2021.jpg'],
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-br" suppressHydrationWarning className={inter.variable}>
      <body suppressHydrationWarning className="font-sans">
        <ErrorBoundary>
          <AppProvider>
            {children}
          </AppProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
