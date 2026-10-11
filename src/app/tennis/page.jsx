import SportsBar, { sportIcons } from '../_components/SportsBar';
import ComingSoon from '../_components/ComingSoon';

export const metadata = { title: 'Tennis', icons: sportIcons('tennis') };

export default function TennisPage() {
  return (
    <>
      <SportsBar active="tennis" />
      <ComingSoon sport="tennis" />
    </>
  );
}
