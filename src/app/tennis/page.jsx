import SportsBar from '../_components/SportsBar';
import ComingSoon from '../_components/ComingSoon';

export const metadata = { title: 'Tennis' };

export default function TennisPage() {
  return (
    <>
      <SportsBar active="tennis" />
      <ComingSoon sport="tennis" />
    </>
  );
}
