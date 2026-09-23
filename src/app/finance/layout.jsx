import { Suspense } from 'react';
import { Inter } from 'next/font/google';
import FinanceShell from './_components/FinanceShell';
import './finance.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-fin' });

export const metadata = {
  title: 'Money · Mikaeel Faraz',
  robots: { index: false, follow: false },
};

export const viewport = { themeColor: '#09090b' };

export default function FinanceLayout({ children }) {
  return (
    <div className={inter.variable}>
      <Suspense>
        <FinanceShell>{children}</FinanceShell>
      </Suspense>
    </div>
  );
}
