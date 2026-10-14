import { sportIcons } from '../_components/nav';
import F1Home from '../_components/F1Home';

export const metadata = { title: 'F1', icons: sportIcons('f1') };

export default function F1Page() {
  return <F1Home />;
}
