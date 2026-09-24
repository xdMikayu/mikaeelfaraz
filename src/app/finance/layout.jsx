import { Suspense } from 'react';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import FinanceShell from './_components/FinanceShell';
import './finance.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-fin' });
const display = Plus_Jakarta_Sans({ subsets: ['latin'], display: 'swap', weight: ['500', '600', '700'], variable: '--font-display' });

export const metadata = {
  title: 'Money · Mikaeel Faraz',
  robots: { index: false, follow: false },
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
