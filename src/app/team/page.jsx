import { Suspense } from 'react';
import TeamView from '../_components/TeamView';

export const metadata = { title: 'Team' };

export default function TeamPage() {
  return (
    <Suspense>
      <TeamView />
    </Suspense>
  );
}
