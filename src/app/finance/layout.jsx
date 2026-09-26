import { Suspense } from 'react';
import { Schibsted_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import FinanceShell from './_components/FinanceShell';
import './finance.css';

// A newspaper grotesk for words and a mono for money, like a bank statement.
const sans = Schibsted_Grotesk({ subsets: ['latin'], display: 'swap', weight: ['400', '500', '600', '700'], variable: '--font-fin' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], display: 'swap', weight: ['400', '500', '600'], variable: '--font-money' });

export const metadata = {
  title: 'Mifolio',
  description: 'Every card, every dirham, in one place.',
  robots: { index: false, follow: false },
  // Home-screen app: its own icon and name (iOS reads apple-touch-icon; Android the manifest).
  manifest: '/finance/manifest.webmanifest',
  icons: {
    icon: [{ url: '/finance/favicon-32.png', sizes: '32x32', type: 'image/png' }, { url: '/finance/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/finance/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: { title: 'Mifolio' },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f0e8' },
    { media: '(prefers-color-scheme: dark)', color: '#131210' },
  ],
};

export default function FinanceLayout({ children }) {
  return (
    <div className={`${sans.variable} ${mono.variable}`}>
      <Suspense>
        <FinanceShell>{children}</FinanceShell>
      </Suspense>
    </div>
  );
}
