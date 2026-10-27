'use client';
import { useFplModel } from './matchupData';

const pct = (p) => `${Math.round(p * 100)}%`;
const weeks = (list) => (list.length > 1 ? `gameweeks ${list[0]}–${list.at(-1)}` : `gameweek ${list[0]}`);

/**
 * What the projections learned from past gameweeks (scripts/sport/fit-fpl.mjs), in numbers, and how
 * the latest fit did on this season's weeks it wasn't taught with, next to the plain model.
 */
export default function Learning() {
  const { data } = useFplModel();
  if (!data?.check?.weeks?.length) return null;
  const { facts, check, trainedOn } = data;
  const rows = [
    ['Order matched the scores (1 is perfect)', 'rho', 2, true],
    ['Typical miss, points (lower is better)', 'sq', 2, false],
    ['Top 50’s average score', 'top50', 2, true],
  ];
  const b = (v) => <b style={{ color: 'var(--sp-ink)' }}>{v}</b>;
  return (
    <section className="sp-panel sp-record">
      <div className="sp-section-head">
        <h2 className="sp-h2">How the projections learn</h2>
        <span className="sp-tiny sp-muted">Retrained every week</span>
      </div>
      <p className="sp-small sp-ink2" style={{ margin: '0 0 8px' }}>
        Every gameweek since {trainedOn.seasons[0]} is projected again from only what was known before its deadline, {trainedOn.playerWeeks.toLocaleString('en-GB')} player-gameweeks in all, and set against what FPL paid. What that taught:
      </p>
      <p className="sp-small sp-ink2" style={{ margin: '0 0 6px' }}>
        {b('Who starts.')} A regular who started each of his last three matches starts the next {b(pct(facts.startedLastThree))} of the time; left out of the last one, {b(pct(facts.droppedLastTime))}; out of all three, {b(pct(facts.noneOfLastThree))}.
      </p>
      <p className="sp-small sp-ink2" style={{ margin: '0 0 10px' }}>
        {b('Defensive contributions come in bursts.')} A defender averaging 6 a match reaches FPL’s 10 in {b(pct(facts.dcDefender6.learned))} of his full matches, not the {pct(facts.dcDefender6.poisson)} an even spread would give.
      </p>
      <div className="sp-heat-wrap" style={{ padding: 0 }}>
        <table className="sp-mu-table sp-rec-t">
          <thead>
            <tr>
              <th className="l">Tested on {weeks(check.weeks)}</th>
              <th>Before</th>
              <th>Learned</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, k, d, up]) => {
              const won = up ? check.learned[k] > check.plain[k] : check.learned[k] < check.plain[k];
              return (
                <tr key={k}>
                  <td className="l" style={{ whiteSpace: 'normal' }}>{label}</td>
                  <td className="sp-num" style={{ fontWeight: won ? 500 : 850 }}>{check.plain[k].toFixed(d)}</td>
                  <td className="sp-num" style={{ fontWeight: won ? 850 : 500 }}>{check.learned[k].toFixed(d)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="sp-tiny sp-muted" style={{ margin: '8px 0 0' }}>
        Each week tested was projected by a fit made without it, and judged on the players who’d been starting. {data.use ? 'The projections use what was learned.' : 'This week’s fit didn’t beat the plain model, so the projections aren’t using it.'} Ideas tested the same way on last season and left out because they didn’t help: weighting recent form, trusting small samples more or less, smoothing bonus points, and scaling each part of the score to what FPL paid for it.
      </p>
    </section>
  );
}
