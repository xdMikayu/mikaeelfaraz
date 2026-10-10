import { Suspense } from 'react';
import MatchView from '../_components/MatchView';

// The title never names the score, so spoiler mode holds in the tab bar and history too.
export const metadata = { title: 'Match' };

export default function MatchPage() {
  return (
    <Suspense>
      <MatchView />
    </Suspense>
  );
}
