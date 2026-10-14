import SportsBar, { sportIcons } from '../_components/SportsBar';
import F1Home from '../_components/F1Home';

export const metadata = { title: 'F1', icons: sportIcons('f1') };

export default function F1Page() {
  return (
    <>
      <SportsBar active="f1" />
      <F1Home />
    </>
  );
}
