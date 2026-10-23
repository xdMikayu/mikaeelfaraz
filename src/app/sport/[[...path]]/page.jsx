import Moved from './Moved';

// Matchday lived here until it moved to matchday.mikaeelfaraz.com. Old links, bookmarks and
// home-screen icons land on this page and go on to the same page there, with the viewer's saved
// settings (src/lib/matchday/link.mjs).
export const metadata = { title: 'Matchday has moved', robots: { index: false } };

export default function MatchdayMoved() {
  return <Moved />;
}
