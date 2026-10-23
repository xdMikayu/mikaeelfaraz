// Copied from Matchday (github.com/xdMikayu/matchday, src/lib/f1.mjs) for the home page's showcase:
// the title sums alone. Matchday's copy is the one kept up.

export const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];

/**
 * What's left to win, from the standings, the calendar (f1Season) and which rounds have results:
 * races and sprints still to run, the most points a driver or a team can still score, and where
 * each title stands. A round counts as run once Jolpica has its result, so the sums match the table.
 */
export function titleRace(standings, races, raceDone, sprintDone) {
  const racesLeft = races.filter((r) => !raceDone[r.round]).length;
  const sprintsLeft = races.filter((r) => r.sessions.some((s) => s.label === 'Sprint') && !sprintDone[r.round]).length;
  const most = { driver: racesLeft * RACE_POINTS[0] + sprintsLeft * SPRINT_POINTS[0], team: racesLeft * (RACE_POINTS[0] + RACE_POINTS[1]) + sprintsLeft * (SPRINT_POINTS[0] + SPRINT_POINTS[1]) };
  const title = (rows, max) => {
    const [lead, next] = rows;
    if (!lead) return null;
    const alive = rows.filter((x) => x.points + max >= lead.points);
    return { leader: lead, second: next ?? null, gap: next ? lead.points - next.points : null, decided: !next || lead.points > next.points + max, contenders: alive.length };
  };
  return { racesLeft, sprintsLeft, most, drivers: title(standings.drivers, most.driver), constructors: title(standings.constructors, most.team) };
}
