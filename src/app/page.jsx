import Today from './_components/Today';

// The layout's "%s · Matchday" doesn't reach a page in its own folder, so this one says it in full.
export const metadata = { title: { absolute: 'Scores · Matchday' } };

export default function ScoresPage() {
  return <Today />;
}
