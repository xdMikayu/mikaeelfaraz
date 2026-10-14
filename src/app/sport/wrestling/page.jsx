import { sportIcons } from '../_components/nav';
import ComingSoon from '../_components/ComingSoon';

export const metadata = { title: 'Wrestling', icons: sportIcons('wrestling') };

export default function WrestlingPage() {
  return <ComingSoon sport="wrestling" />;
}
