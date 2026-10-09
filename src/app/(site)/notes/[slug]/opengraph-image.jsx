import { card } from '../../_og/card';
import { notes } from '../../_data/notes';

export { size, contentType } from '../../_og/card';
export const alt = 'A note by Mikaeel Faraz';

export function generateStaticParams() {
  return notes.map((n) => ({ slug: n.slug }));
}

export default function Image({ params }) {
  const n = notes.find((x) => x.slug === params.slug);
  return card({ kicker: 'Mikaeel Faraz · Writing', title: n?.title || 'Writing', sub: n?.summary });
}
