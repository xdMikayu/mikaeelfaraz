import { card } from './_og/card';

export { size, contentType } from './_og/card';
export const alt = 'Mikaeel Faraz, Operations Strategy Analyst at qlub, Dubai';

export default function Image() {
  return card({
    kicker: 'Operations strategy · product · analytics',
    title: 'Mikaeel Faraz',
    sub: 'Operations Strategy Analyst at qlub, Dubai. I take problems from the analysis to the tool or process that fixes them.',
  });
}
