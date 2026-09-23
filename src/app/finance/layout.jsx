import { Suspense } from 'react';
import FinanceShell from './_components/FinanceShell';
import './finance.css';

export const metadata = {
  title: 'Money · Mikaeel Faraz',
  robots: { index: false, follow: false },
};

export default function FinanceLayout({ children }) {
  return (
    <Suspense>
      <FinanceShell>{children}</FinanceShell>
    </Suspense>
  );
}
