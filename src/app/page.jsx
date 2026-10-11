import SportsBar from './_components/SportsBar';
import Today from './_components/Today';

export const metadata = { title: 'Scores' };

export default function ScoresPage() {
  return (
    <>
      <SportsBar active="football" />
      <Today />
    </>
  );
}
