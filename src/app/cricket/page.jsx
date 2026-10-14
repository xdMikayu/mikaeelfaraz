import { sportIcons } from '../_components/nav';
import ComingSoon from '../_components/ComingSoon';

export const metadata = { title: 'Cricket', icons: sportIcons('cricket') };

export default function CricketPage() {
  return <ComingSoon sport="cricket" />;
}
