import { Suspense } from 'react';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import FinanceShell from './_components/FinanceShell';
import './finance.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-fin' });
const display = Plus_Jakarta_Sans({ subsets: ['latin'], display: 'swap', weight: ['500', '600', '700'], variable: '--font-display' });

export const metadata = {
  title: 'Money · Mikaeel Faraz',
  robots: { index: false, follow: false },
  // Home-screen app: its own icon and name (iOS reads apple-touch-icon; Android the manifest).
  manifest: '/finance/manifest.webmanifest',
  icons: {
    icon: [{ url: '/finance/favicon-32.png', sizes: '32x32', type: 'image/png' }, { url: '/finance/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/finance/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: { title: 'Money' },
};

export const viewport = { themeColor: '#0b0a10' };

export default function FinanceLayout({ children }) {
  return (
    <div className={`${inter.variable} ${display.variable}`}>
      <Suspense>
        <FinanceShell>{children}</FinanceShell>
      </Suspense>
    </div>
  );
}
