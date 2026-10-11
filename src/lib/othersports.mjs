// The sports after football, while their sections are being built: what's on the tennis tours
// now (from ESPN, the football source) and the F1 calendar (from Jolpica, the free successor to
// the Ergast API). Pure functions over each source's JSON, so they can be tested.

const DAY = 864e5;

/** How far into a draw a round is: qualifying 0, Round n is n, then quarterfinals 7, semis 8, the final 9. */
export function roundRank(name = '') {
  if (/qualif/i.test(name)) return 0;
  if (/^final$/i.test(name)) return 9;
  if (/semi/i.test(name)) return 8;
  if (/quarter/i.test(name)) return 7;
  return Number(name.match(/round (\d)/i)?.[1] ?? 1);
}

/**
 * Tournaments on the ATP and WTA tours from yesterday to a week ahead, from ESPN's scoreboards.
 * feeds: [{ tour: 'ATP', json }, { tour: 'WTA', json }]. A combined event is in both feeds, whole; it's kept once.
 * Each: { id, tours, name, venue, start, end, major, size, live, top, stage, champions }.
 *   size: singles matches in the draws, which tells a Masters from a 250 (ESPN gives no tier);
 *   live: singles matches being played now, top: the furthest-on of them { draw, round, players };
 *   stage: the next singles round still to play; champions: [{ draw, name }] for each singles final decided.
 * Grand Slams first, then anything still being played, what's on now, the bigger draws, and by start.
 */
export function tennisOnNow(feeds, now = Date.now()) {
  const byId = new Map();
  for (const { tour, json } of feeds) {
    for (const e of json?.events ?? []) {
      const start = Date.parse(e.date);
      const end = Date.parse(e.endDate ?? e.date);
      if (!e.name || !(end >= now - DAY && start <= now + 7 * DAY)) continue;
      const seen = byId.get(e.id);
      if (seen) {
        if (!seen.tours.includes(tour)) seen.tours.push(tour);
        continue;
      }
      const singles = (e.groupings ?? []).filter((g) => /singles/i.test(g.grouping?.displayName ?? ''));
      const matches = singles.flatMap((g) => (g.competitions ?? []).map((c) => ({ draw: g.grouping.displayName, c })));
      const state = (m) => m.c.status?.type?.state;
      const inPlay = matches.filter((m) => state(m) === 'in').sort((a, b) => roundRank(b.c.round?.displayName) - roundRank(a.c.round?.displayName));
      const pending = matches.filter((m) => state(m) === 'pre').sort((a, b) => Date.parse(a.c.date) - Date.parse(b.c.date));
      const name = (p) => p?.athlete?.displayName ?? p?.athlete?.shortName ?? null;
      const top = inPlay[0] && { draw: inPlay[0].draw, round: inPlay[0].c.round?.displayName ?? null, players: (inPlay[0].c.competitors ?? []).map(name).filter(Boolean) };
      const champions = singles
        .map((g) => {
          const final = (g.competitions ?? []).find((c) => /^final$/i.test(c.round?.displayName ?? '') && c.status?.type?.completed);
          const won = name(final?.competitors?.find((p) => p.winner));
          return won ? { draw: g.grouping.displayName, name: won } : null;
        })
        .filter(Boolean);
      byId.set(e.id, {
        id: e.id,
        tours: [tour],
        name: e.name.replace(/\s+presented by\s.*$/i, ''),
        venue: e.venue?.displayName ?? null,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        major: Boolean(e.major),
        size: Math.max(0, ...singles.map((g) => g.competitions?.length ?? 0)),
        live: inPlay.length,
        top: top ?? null,
        stage: pending[0]?.c.round?.displayName ?? null,
        champions,
      });
    }
  }
  const on = (t) => Date.parse(t.start) <= now && Date.parse(t.end) >= now;
  const over = (t) => !t.live && !t.stage && t.champions.length > 0;
  return [...byId.values()].sort(
    (a, b) => b.major - a.major || over(a) - over(b) || on(b) - on(a) || b.size - a.size || Date.parse(a.start) - Date.parse(b.start),
  );
}

// Jolpica's session keys, in weekend order, with how long each usually runs.
const SESSIONS = [
  ['FirstPractice', 'Practice 1', 60],
  ['SecondPractice', 'Practice 2', 60],
  ['ThirdPractice', 'Practice 3', 60],
  ['SprintQualifying', 'Sprint qualifying', 45],
  ['SprintShootout', 'Sprint qualifying', 45],
  ['Sprint', 'Sprint', 60],
  ['Qualifying', 'Qualifying', 60],
];
const at = (s) => (s?.date ? new Date(`${s.date}T${s.time ?? '12:00:00Z'}`).toISOString() : null);

/** The season's races from Jolpica's /current.json: { season, races: [{ round, name, circuit, place, country, sessions }] }. */
export function f1Season(json) {
  const table = json?.MRData?.RaceTable;
  return {
    season: table?.season ?? null,
    races: (table?.Races ?? []).map((r) => ({
      round: Number(r.round),
      name: r.raceName,
      circuit: r.Circuit?.circuitName ?? null,
      place: r.Circuit?.Location?.locality ?? null,
      country: r.Circuit?.Location?.country ?? null,
      sessions: [
        ...SESSIONS.filter(([k]) => r[k]).map(([k, label, minutes]) => ({ label, at: at(r[k]), minutes })),
        { label: 'Race', at: at(r), minutes: 120 },
      ]
        .filter((s) => s.at)
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
    })),
  };
}

/** When a session ends, roughly: its start plus its usual length. */
export const sessionEnd = (s) => Date.parse(s.at) + s.minutes * 6e4;

/**
 * The race weekend that matters now: the first whose race hasn't finished. With the session on
 * now, if any, the next one to start, and the race after this weekend.
 */
export function nextRace(races, now = Date.now()) {
  const i = races.findIndex((r) => r.sessions.length && sessionEnd(r.sessions[r.sessions.length - 1]) > now);
  if (i < 0) return null;
  const race = races[i];
  const after = races[i + 1];
  return {
    ...race,
    live: race.sessions.find((s) => Date.parse(s.at) <= now && sessionEnd(s) > now) ?? null,
    upcoming: race.sessions.find((s) => Date.parse(s.at) > now) ?? null,
    after: after ? { round: after.round, name: after.name, at: after.sessions[after.sessions.length - 1]?.at ?? null } : null,
  };
}
