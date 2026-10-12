import { Suspense } from 'react';
import { sportIcons } from '../../_components/SportsBar';
import CricketMatch from '../../_components/CricketMatch';

// The title never names the score, so spoilers stay out of the tab bar and history.
export const metadata = { title: 'Cricket match', icons: sportIcons('cricket') };

export default function CricketMatchPage() {
  return (
    <Suspense>
      <CricketMatch />
    </Suspense>
  );
}
