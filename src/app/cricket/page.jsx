import SportsBar, { sportIcons } from '../_components/SportsBar';
import ComingSoon from '../_components/ComingSoon';

export const metadata = { title: 'Cricket', icons: sportIcons('cricket') };

export default function CricketPage() {
  return (
    <>
      <SportsBar active="cricket" />
      <ComingSoon sport="cricket" />
    </>
  );
}
