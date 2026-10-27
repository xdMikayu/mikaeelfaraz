'use client';
import { useAccuracy } from './matchupData';
import { one } from './fplbits';

const when = (iso) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Our track record: projections saved before each deadline, graded against what happened and
 * against FPL's own expected points as soon as a gameweek's last match is over (provisional until
 * FPL signs the gameweek off). Nothing here can be adjusted afterwards.
 */
export default function Record() {
  const { data, error } = useAccuracy();
  if (error || !data) return null;
  const { weeks, season, pending } = data;
  const last = weeks[weeks.length - 1];
  const provisional = weeks.filter((w) => w.provisional).map((w) => w.gw);
  const many = provisional.length > 1;
  // Saved when, for the next deadline: the record says, or (a copy from before it did) when it was built.
  const saved = pending && ('savedAt' in pending ? pending.savedAt : data.built);
  return (
    <section className="sp-panel sp-record">
      <div className="sp-section-head">
        <h2 className="sp-h2">Our track record</h2>
        <span className="sp-tiny sp-muted">Graded as each gameweek ends</span>
      </div>
      {season ? (
        <>
          <p className="sp-small sp-ink2" style={{ margin: '0 0 10px' }}>
            Over {season.weeks} gameweek{season.weeks === 1 ? '' : 's'}, our projections were closer than FPL’s own expected points in{' '}
            <b style={{ color: 'var(--sp-ink)' }}>{season.beatFplWeeks} of {season.weeks}</b>. Our top 10 averaged <b style={{ color: 'var(--sp-ink)' }}>{one(season.top10Ours)}</b> points a week, FPL’s {one(season.top10Fpl)}; our captain picks scored {season.captainOurs} in total, FPL’s {season.captainFpl}.
          </p>
          <div className="sp-heat-wrap" style={{ padding: 0 }}>
            <table className="sp-mu-table sp-rec-t">
              <thead>
                <tr>
                  <th className="l">GW</th>
                  <th>Error, ours</th>
                  <th>FPL’s</th>
                  <th>Top 10, ours</th>
                  <th>FPL’s</th>
                  <th className="l">Our captain</th>
                </tr>
              </thead>
              <tbody>
                {[...weeks].reverse().map((w) => (
                  <tr key={w.gw}>
                    <td className="l" style={{ fontWeight: 800 }}>
                      {w.gw}
                      {w.provisional ? '*' : ''}
                    </td>
                    <td className="sp-num" style={{ fontWeight: w.points.maeOurs <= w.points.maeFpl ? 850 : 500 }}>{w.points.maeOurs.toFixed(2)}</td>
                    <td className="sp-num" style={{ fontWeight: w.points.maeFpl < w.points.maeOurs ? 850 : 500 }}>{w.points.maeFpl.toFixed(2)}</td>
                    <td className="sp-num" style={{ fontWeight: w.points.top10Ours >= w.points.top10Fpl ? 850 : 500 }}>{one(w.points.top10Ours)}</td>
                    <td className="sp-num" style={{ fontWeight: w.points.top10Fpl > w.points.top10Ours ? 850 : 500 }}>{one(w.points.top10Fpl)}</td>
                    <td className="l">{w.points.captainOurs ? `${w.points.captainOurs.name} ${w.points.captainOurs.pts}` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="sp-tiny sp-muted" style={{ margin: '8px 0 0' }}>
            Error: average gap between projected and actual points, over players either of us projected at 2 or more (lower is better). Top 10: actual points of each side’s ten highest-projected players.
            {last ? ` Gameweek ${last.gw}: Net xG and actual xG correlated ${last.netXg.corr?.toFixed(2) ?? '–'}.` : ''}
          </p>
          {provisional.length > 0 && (
            <p className="sp-tiny sp-muted" style={{ margin: '8px 0 0' }}>
              * Gameweek{many ? 's' : ''} {provisional.join(' and ')} {many ? 'were' : 'was'} graded the moment {many ? 'their last matches' : 'its last match'} ended, on FPL’s points as they stand. Final once FPL confirms {many ? 'them' : 'it'}, usually within a day.
            </p>
          )}
        </>
      ) : (
        <p className="sp-small sp-ink2" style={{ margin: 0 }}>
          The record starts with gameweek {data.firstWeek}. Projections for every player are saved before each deadline next to FPL’s own expected points, then graded here the moment the gameweek’s last match ends: how close each was, whose top 10 scored more, and how the captain picks did.
        </p>
      )}
      {(data.awaiting ?? []).map((a) => (
        <p key={a.gw} className="sp-tiny sp-muted" style={{ margin: '8px 0 0' }}>
          {a.of == null
            ? `Gameweek ${a.gw}: projections frozen at its deadline, ${when(a.deadline)}. They’re graded once the gameweek is over.`
            : `Gameweek ${a.gw}: projections frozen at its deadline, ${when(a.deadline)}; ${a.played} of ${a.of} matches played. Graded here the moment the last one ends${a.last ? ` (kick-off ${when(a.last)})` : ''}.`}
        </p>
      ))}
      {pending && (
        <p className="sp-tiny sp-muted" style={{ margin: '8px 0 0' }}>
          {saved
            ? `Gameweek ${pending.gw}: projections saved ${when(saved)}, updated with the latest team news before the deadline, ${when(pending.deadline)}, then frozen.`
            : `Gameweek ${pending.gw}: projections are saved before the deadline, ${when(pending.deadline)}, then frozen.`}
        </p>
      )}
    </section>
  );
}
