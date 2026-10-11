import SportsBar, { sportIcons } from '../_components/SportsBar';
import ComingSoon from '../_components/ComingSoon';

export const metadata = { title: 'F1', icons: sportIcons('f1') };

export default function F1Page() {
  return (
    <>
      <SportsBar active="f1" />
      <ComingSoon sport="f1" />
    </>
  );
}
