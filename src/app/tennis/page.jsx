import { sportIcons } from '../_components/nav';
import ComingSoon from '../_components/ComingSoon';

export const metadata = { title: 'Tennis', icons: sportIcons('tennis') };

export default function TennisPage() {
  return <ComingSoon sport="tennis" />;
}
