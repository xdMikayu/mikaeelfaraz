import { card } from '../../_og/card';
import { selected } from '../../_data/work';
import { cases } from '../../_data/cases';

export { size, contentType } from '../../_og/card';
export const alt = 'A case study by Mikaeel Faraz';

export function generateStaticParams() {
  return selected.map((w) => ({ slug: w.slug }));
}

export default function Image({ params }) {
  const c = cases[params.slug];
  return card({ kicker: 'Mikaeel Faraz · Work at qlub', title: c?.title || 'Work', sub: null });
}
