import { notFound } from 'next/navigation';
import { LEAGUES, LEAGUE_BY_SLUG } from '@/lib/sport/leagues.mjs';
import TableView from '../../_components/TableView';

// One static page per competition; the standings themselves load in the browser.
export const dynamicParams = false;
export const generateStaticParams = () => LEAGUES.filter((l) => l.table).map((l) => ({ league: l.slug }));
export const generateMetadata = ({ params }) => ({ title: `${LEAGUE_BY_SLUG[params.league]?.name ?? 'League'} table` });

export default function TablePage({ params }) {
  if (!LEAGUE_BY_SLUG[params.league]?.table) notFound();
  return <TableView slug={params.league} />;
}
