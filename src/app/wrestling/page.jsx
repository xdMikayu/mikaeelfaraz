import SportsBar, { sportIcons } from '../_components/SportsBar';
import ComingSoon from '../_components/ComingSoon';

export const metadata = { title: 'Wrestling', icons: sportIcons('wrestling') };

export default function WrestlingPage() {
  return (
    <>
      <SportsBar active="wrestling" />
      <ComingSoon sport="wrestling" />
    </>
  );
}
