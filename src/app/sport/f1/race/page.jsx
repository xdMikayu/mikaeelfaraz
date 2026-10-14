import { Suspense } from 'react';
import SportsBar, { sportIcons } from '../../_components/SportsBar';
import F1Weekend from '../../_components/F1Weekend';

// The title never names a result, so spoilers stay out of the tab bar and history.
export const metadata = { title: 'F1 race weekend', icons: sportIcons('f1') };

export default function F1WeekendPage() {
  return (
    <>
      <SportsBar active="f1" />
      <Suspense>
        <F1Weekend />
      </Suspense>
    </>
  );
}
