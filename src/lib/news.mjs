// Club news before a deadline: when the manager faces the press, what was said, and the latest on
// injuries, found by Claude with web search. FPL's flags lag the press conferences, and a flag
// can't tell you to wait for one; this can.
//
// Everything Claude reports is checked here before it's used: a source must be one of the pages
// the search actually returned, a press conference must fall in the week before the match, and a
// player must be on the club's FPL roster. Anything that fails is dropped. Server-only.
import Anthropic from '@anthropic-ai/sdk';
import { londonToUtc, ukDate, ukLabel } from './timing.mjs';

export const NEWS_MODEL = process.env.MATCHDAY_NEWS_MODEL || 'claude-haiku-5-5';
const BACKUP_MODEL = 'claude-sonnet-5-5';
const SEARCHES = Number(process.env.MATCHDAY_NEWS_SEARCHES || 3);
const DAY = 864e5;

export class NewsError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

const REPORT = {
  name: 'report_news',
  description: 'Report what you found. Call once, after searching.',
  input_schema: {
    type: 'object',
    properties: {
      press_conference: {
        type: 'object',
        description: "The manager's pre-match press conference for this match.",
        properties: {
          status: { type: 'string', enum: ['scheduled', 'held', 'not_announced'] },
          date: { type: ['string', 'null'], description: 'UK date, YYYY-MM-DD' },
          time_uk: { type: ['string', 'null'], description: 'UK time, 24-hour HH:MM' },
          source_url: { type: ['string', 'null'], description: 'The search result that states it' },
          said: { type: 'array', items: { type: 'string' }, description: 'If held: each fitness update the manager gave, one short line per player' },
        },
        required: ['status', 'date', 'time_uk', 'source_url', 'said'],
      },
      players: {
        type: 'array',
        description: 'Fitness news per player, newest first. Only players with news.',
        items: {
          type: 'object',
          properties: {
            id: { type: ['integer', 'null'], description: 'FPL id from the roster' },
            name: { type: 'string' },
            status: { type: 'string', enum: ['out', 'doubtful', 'back_in_training', 'fit', 'unknown'] },
            expected_return: { type: ['string', 'null'], description: 'YYYY-MM-DD, only if a date or number of weeks was given' },
            detail: { type: 'string', description: 'One short sentence: what was said, and by whom' },
            published: { type: ['string', 'null'], description: 'Date of the source, YYYY-MM-DD' },
            source_url: { type: ['string', 'null'] },
          },
          required: ['id', 'name', 'status', 'expected_return', 'detail', 'published', 'source_url'],
        },
      },
      summary: { type: 'string', description: 'One or two sentences of team news for a fantasy manager' },
    },
    required: ['press_conference', 'players', 'summary'],
  },
};

const SYSTEM = `You research Premier League team news for a fantasy football tool. You get one club, its next match and the players whose fitness matters. Search, then call report_news once.

Find two things:
1. The manager's pre-match press conference for this match: has it happened, and if not, when is it (date and UK time)? Clubs usually announce the time a day or two ahead. Only report a time that a source states for this match. If you can't find one, say not_announced; never guess.
2. The latest fitness news for the listed players, and any new injury, illness or suspension for other players of this club: what the manager or club said, and when.

Rules: every item needs the date of its source and a URL from your search results. Ignore articles about earlier matches or older than ten days. Prefer the club's site and established outlets; quote what was said, don't speculate. If nothing new was said about a player, leave him out.`;

let client;
const getClient = () => (client ??= new Anthropic({ timeout: 50_000, maxRetries: 0 }));

/** What the model is told about the club, its match and its players. */
export function newsPrompt({ club, fixtures, deadline, roster, focus, now }) {
  const name = (id) => roster.find((p) => p.id === id)?.name ?? id;
  const match = fixtures.length
    ? fixtures.map((f) => `${f.home === club.id ? `${club.name} v ${f.oppName}` : `${f.oppName} v ${club.name}`}, ${ukLabel(Date.parse(f.kickoff), { year: true })}`).join('; and ')
    : `none (${club.name} don't play this gameweek)`;
  const flag = (p) => {
    const st = { i: 'injured', d: 'doubtful', s: 'suspended', u: 'unavailable', n: 'not eligible' }[p.status];
    return st ? `FPL: ${st}${p.chance != null ? `, ${p.chance}% to play` : ''}${p.news ? `, "${p.news}"` : ''}${p.newsAt ? ` (flag set ${ukDate(Date.parse(p.newsAt))})` : ''}` : 'FPL: fit';
  };
  return [
    `Today is ${ukLabel(now, { year: true })}.`,
    `Club: ${club.name} (${club.short}). Next Premier League match: ${match}. FPL deadline: ${ukLabel(Date.parse(deadline), { year: true })}.`,
    `Players to check:\n${focus.map((id) => `- ${id} ${name(id)}: ${flag(roster.find((p) => p.id === id))}`).join('\n')}`,
    `Rest of the squad, for matching names (FPL id and name): ${roster.filter((p) => !focus.includes(p.id)).map((p) => `${p.id} ${p.name}`).join(', ')}`,
  ].join('\n\n');
}

/** Ask the model; resume paused searches; returns the report tool's input and every page the search returned. */
async function ask(model, user) {
  const tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: SEARCHES, user_location: { type: 'approximate', country: 'GB', timezone: 'Europe/London' } }, REPORT];
  const messages = [{ role: 'user', content: user }];
  const pages = new Map();
  let searches = 0;
  let nudged = false;
  for (let turn = 0; turn < 4; turn++) {
    const res = await getClient().messages.create({ model, max_tokens: 4000, system: SYSTEM, tools, messages, output_config: { effort: 'low' } });
    searches += res.usage?.server_tool_use?.web_search_requests ?? 0;
    for (const b of res.content) if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) for (const r of b.content) pages.set(r.url, { title: r.title, age: r.page_age ?? null });
    const report = res.content.find((b) => b.type === 'tool_use' && b.name === 'report_news');
    if (report) return { input: report.input, pages, searches, model: res.model };
    if (res.stop_reason === 'refusal') throw new NewsError('The news search was declined', 'refused');
    if (res.stop_reason === 'pause_turn') {
      // The search loop paused; send the turn back unchanged and it carries on.
      messages.push({ role: 'assistant', content: res.content });
      continue;
    }
    if (nudged) break;
    nudged = true;
    messages.push({ role: 'assistant', content: res.content }, { role: 'user', content: 'Call report_news now with what you found.' });
  }
  throw new NewsError('The news search returned no report', 'no_report');
}

/** Run the search for one club, falling back to Sonnet if the configured model can't use web search. */
export async function fetchClubNews(args) {
  const user = newsPrompt(args);
  const models = [...new Set([NEWS_MODEL, BACKUP_MODEL])];
  let last;
  for (const model of models) {
    try {
      const out = await ask(model, user);
      return cleanReport(out.input, { ...args, pages: out.pages, searches: out.searches, model: out.model });
    } catch (e) {
      // A model that can't search (or doesn't exist) gets one more try on the backup model.
      if (!(e instanceof Anthropic.BadRequestError || e instanceof Anthropic.NotFoundError)) throw e;
      last = e;
    }
  }
  if (/web.?search/i.test(last.message) && /not enabled|disabled|turned off/i.test(last.message)) {
    throw new NewsError('Web search is turned off for this API key. An admin can turn it on in the Claude Console under Settings → Capabilities.', 'web_search_off');
  }
  throw last;
}

const bare = (u) => {
  try {
    const x = new URL(u);
    return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return null;
  }
};
const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ø/g, 'o')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .trim();

/** Match a reported player to the club's roster: by FPL id, else by name. */
export function matchPlayer(p, roster) {
  if (p.id != null && roster.some((r) => r.id === p.id)) return p.id;
  const n = fold(p.name);
  if (!n) return null;
  const exact = roster.filter((r) => fold(r.name) === n || fold(`${r.first} ${r.second}`) === n);
  if (exact.length === 1) return exact[0].id;
  const last = n.split(' ').pop();
  const byLast = roster.filter((r) => fold(r.name).split(' ').pop() === last || fold(r.second).split(' ').pop() === last);
  return byLast.length === 1 ? byLast[0].id : null;
}

/**
 * Keep only what holds up: sources the search returned, dates that make sense, players on the
 * roster. The press conference has to fall in the six days before the club's first match this
 * gameweek, and one whose time has passed counts as held.
 */
export function cleanReport(input, { club, fixtures, roster, now, pages, searches = 0, model = null }) {
  const urls = new Map([...pages.keys()].map((u) => [bare(u), u]));
  const source = (u) => (u && urls.get(bare(u))) || null;
  const day = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s ?? '') && !Number.isNaN(Date.parse(s)) ? s : null);
  const kickoff = fixtures.length ? Math.min(...fixtures.map((f) => Date.parse(f.kickoff))) : null;

  const pc = input?.press_conference ?? {};
  let status = ['scheduled', 'held', 'not_announced'].includes(pc.status) ? pc.status : 'not_announced';
  let date = day(pc.date);
  let time = /^([01]\d|2[0-3]):[0-5]\d$/.test(pc.time_uk ?? '') ? pc.time_uk : null;
  const at = date ? londonToUtc(date, time ?? '12:00') : null;
  const src = source(pc.source_url);
  const inWindow = at != null && kickoff != null && at <= kickoff && at >= kickoff - 6 * DAY;
  if (status !== 'not_announced' && (!inWindow || !src)) {
    status = 'not_announced';
    date = null;
    time = null;
  }
  if (status === 'scheduled' && time && at + 45 * 6e4 < now) status = 'held';
  const presser = {
    status,
    date,
    time,
    at: status !== 'not_announced' && time ? at : null,
    source: status !== 'not_announced' ? src : null,
    said: status === 'held' ? (pc.said ?? []).filter((s) => typeof s === 'string' && s.trim()).slice(0, 8) : [],
  };

  const seen = new Set();
  const players = [];
  for (const p of input?.players ?? []) {
    const id = matchPlayer(p, roster);
    const url = source(p.source_url);
    const published = day(p.published);
    if (id == null || !url || !published || seen.has(id)) continue;
    if (Date.parse(published) > now + DAY || Date.parse(published) < now - 14 * DAY) continue;
    if (!['out', 'doubtful', 'back_in_training', 'fit', 'unknown'].includes(p.status)) continue;
    seen.add(id);
    const back = day(p.expected_return);
    players.push({ id, status: p.status, back: back && Date.parse(back) > now - DAY ? back : null, detail: String(p.detail ?? '').slice(0, 280), published, source: url });
  }
  return {
    team: club.id,
    club: club.short,
    presser,
    players,
    summary: String(input?.summary ?? '').slice(0, 400),
    sources: [...new Set([presser.source, ...players.map((p) => p.source)].filter(Boolean))].map((u) => ({ url: u, title: pages.get(u)?.title ?? bare(u) })),
    searches,
    model,
    at: new Date(now).toISOString(),
  };
}

/**
 * Club news turned into FPL-style flags, where it's newer than FPL's own: { id: { chance, status, returnAt, note } }.
 * out: 0%; doubtful: 50%; back in training: 75%; fit: 100%. A return date replaces FPL's.
 */
export function newsPatches(reports, els) {
  const out = {};
  for (const r of reports) {
    for (const p of r?.players ?? []) {
      const el = els[p.id];
      if (!el || p.status === 'unknown') continue;
      // Same-day news counts as newer: FPL usually updates its flags after the press conference.
      const flagDay = el.newsAt ? Date.parse(el.newsAt.slice(0, 10)) : null;
      if (flagDay != null && Date.parse(p.published) < flagDay) continue;
      const patch = { note: p.detail, noteAt: p.published, noteSource: p.source };
      if (p.status === 'out') Object.assign(patch, { chance: 0, status: el.status === 'a' || el.status === 'd' ? 'i' : el.status });
      if (p.status === 'doubtful') Object.assign(patch, { chance: 50, status: 'd' });
      if (p.status === 'back_in_training') Object.assign(patch, { chance: Math.max(75, el.chance ?? 0), status: 'd' });
      if (p.status === 'fit') Object.assign(patch, { chance: 100, status: 'a' });
      if (p.back) patch.returnAt = Date.parse(p.back);
      out[p.id] = patch;
    }
  }
  return out;
}

/** The players worth asking about: anyone FPL has flagged, plus the club's five most-owned. */
export function focusPlayers(roster) {
  const flagged = roster.filter((p) => p.status !== 'a' || (p.chance != null && p.chance < 100));
  const owned = roster.filter((p) => !flagged.includes(p) && (p.minutes ?? 0) > 0).sort((a, b) => (b.owned ?? 0) - (a.owned ?? 0)).slice(0, 5);
  return [...flagged, ...owned].map((p) => p.id);
}

/** How long a club's news stays fresh: until 45 minutes after a press conference still to come, else two hours (45 minutes on match eve). */
export function newsTtl(report, now, kickoff) {
  const clamp = (s) => Math.max(600, Math.min(6 * 3600, Math.round(s)));
  if (report.presser.status === 'scheduled' && report.presser.at > now) return clamp((report.presser.at + 45 * 6e4 - now) / 1000);
  if (kickoff && kickoff - now < DAY) return 2700;
  return report.presser.status === 'held' ? 3 * 3600 : 2 * 3600;
}
