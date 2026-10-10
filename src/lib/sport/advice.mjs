// Gameweek advice written by Claude, grounded in our own numbers.
//
// The server works everything out first (projections, the transfer plans in three risk modes,
// wildcard and free-hit values, the best eleven) and hands Claude that packet. Claude picks the
// transfers, eleven, captain and chip and explains them, choosing players only from the list it
// was given. Every pick is then checked against the game's rules here, and anything that doesn't
// hold is replaced with our own choice and said so. Server-only: it reads ANTHROPIC_API_KEY.
import Anthropic from '@anthropic-ai/sdk';
import { projectAhead, suggestTransfers, POS } from './fpl.mjs';
import { netFor } from './netxg.mjs';
import { planTransfers, buildSquad, bestXI, estimateFree } from './optimise.mjs';

// Sonnet 5.5 reasons better than Haiku 5.5 for a multi-week plan; override with MATCHDAY_AI_MODEL.
export const MODEL = process.env.MATCHDAY_AI_MODEL || 'claude-sonnet-5-5';
export const adviceEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

const CHIPS = ['wildcard', 'freehit', 'bboost', '3xc'];
const CHIP_NAME = { wildcard: 'Wildcard', freehit: 'Free Hit', bboost: 'Bench Boost', '3xc': 'Triple Captain' };
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

/** Chips still available in the current half of the season (two of each since 2025/26). */
export function chipsLeft(used, gw) {
  const half = gw <= 19 ? [1, 19] : [20, 38];
  return CHIPS.filter((c) => !used.some((u) => u.name === c && u.event >= half[0] && u.event <= half[1]));
}

/** Everything Claude sees, built from FPL, our projections and the optimiser. */
export function buildPacket({ st, fixtures, entry, kit, ctx, learned, nx, free: freeIn }) {
  const target = st.events.find((e) => new Date(e.deadline) > Date.now());
  if (!target) throw new Error('No deadline left this season');
  const gw = target.id;
  const gws = Array.from({ length: 5 }, (_, i) => gw + i).filter((g) => g <= 38);
  const els = ctx.elements;
  const squad = entry.gw.picks.map((p) => p.element);
  const bank = entry.gw.bank ?? 0;
  const free = freeIn ?? estimateFree(entry.history ?? [], entry.chips ?? [], gw - 1);
  const ahead = projectAhead(st.elements.map((e) => e.id), fixtures, gws, ctx);
  const total = (id) => ahead[id]?.total ?? 0;
  const xpNext = (id) => ahead[id]?.per[gw]?.xp ?? 0;

  const plans = Object.fromEntries(['conservative', 'balanced', 'aggressive'].map((mode) => [mode, planTransfers({ squad, bank, free, gws, ahead, els, mode })]));
  const budget = squad.reduce((t, id) => t + els[id].cost, 0) + bank;
  const wildcard = buildSquad({ budget, gws, ahead, els });
  const freeHit = buildSquad({ budget, gws: [gw], ahead, els });
  const singles = suggestTransfers(squad, bank, ahead, ctx, { limit: 8, minGain: 0.3 });
  const hold = bestXI(squad, gw, ahead, els);

  // Players Claude may bring in: the best by position over the horizon, plus everyone the optimiser named.
  const named = new Set([...Object.values(plans).flatMap((p) => p.plan.flatMap((s) => s.moves.map((m) => m.in))), ...wildcard.squad, ...freeHit.squad, ...singles.map((s) => s.in)]);
  const byType = { 1: [], 2: [], 3: [], 4: [] };
  for (const e of st.elements) if (!squad.includes(e.id) && !['u', 'i', 's'].includes(e.status) && ahead[e.id]) byType[e.type].push(e.id);
  const pool = new Set(named);
  for (const t of [1, 2, 3, 4]) for (const id of byType[t].sort((a, b) => total(b) - total(a)).slice(0, t === 1 ? 6 : 14)) pool.add(id);
  for (const id of squad) pool.delete(id);

  const net = (id) => {
    const el = els[id];
    if (!nx || !learned) return null;
    const fx = fixtures.filter((f) => f.event === gw && !f.started && (f.home === el.team || f.away === el.team));
    return r2(fx.reduce((t, f) => t + netFor(el, f, ctx, kit, nx.players[id], 'xg', learned).value, 0));
  };
  const opp = (id, g) =>
    (ahead[id]?.per[g]?.fx ?? []).map((x) => `${st.teams.find((t) => t.id === x.opp)?.short}${x.home ? '(H)' : '(A)'}`).join('+') || 'blank';
  const priceTonight = (e) => {
    const n = e.price?.nights?.find((x) => x[0] === 0);
    return n && n[1] >= 100 ? 'likely rise tonight' : n && n[1] <= -100 ? 'likely fall tonight' : null;
  };
  const row = (id) => {
    const e = els[id];
    const recent = nx?.players[id]?.r;
    return {
      id,
      name: e.name,
      pos: POS[e.type],
      team: st.teams.find((t) => t.id === e.team)?.short,
      price: e.cost,
      owned: e.owned,
      status: e.status === 'a' ? 'fit' : `${e.status === 'i' ? 'injured' : e.status === 'd' ? 'doubtful' : e.status === 's' ? 'suspended' : 'unavailable'}${e.chance != null ? ` ${e.chance}%` : ''}${e.news ? `: ${e.news}` : ''}`,
      fixtures: gws.map((g) => opp(id, g)),
      xp: gws.map((g) => r1(ahead[id]?.per[g]?.xp ?? 0)),
      xp5: r1(total(id)),
      netXgNext: net(id),
      xgxa90Last5: recent && recent[0] >= 90 ? r2(((recent[1] + recent[2]) / recent[0]) * 90) : null,
      setPieces: ['pens', 'free kicks', 'corners'].filter((_, i) => e.setPieces?.[i] === 1),
      price_tonight: priceTonight(e),
    };
  };
  const planOut = (p) => ({
    projected: r1(p.total),
    vsHold: r1(p.gain),
    weeks: p.plan.map((s) => ({ gw: s.gw, moves: s.moves.map((m) => `${els[m.out].name} (${m.out}) -> ${els[m.in].name} (${m.in})`), hit: s.hit, xp: r1(s.points) })),
  });

  return {
    gw,
    deadline: target.deadline,
    horizon: gws,
    team: entry.name,
    bank,
    freeTransfers: free,
    freeEstimated: freeIn == null,
    chipsAvailable: chipsLeft(entry.chips ?? [], gw),
    squad: squad.map(row),
    currentBestXi: { xi: hold.xi, captain: hold.captain, projected: r1(hold.points) },
    plans: Object.fromEntries(Object.entries(plans).map(([k, p]) => [k, planOut(p)])),
    bestSingleSwaps: singles.map((s) => ({ out: s.out, in: s.in, gain5: r1(s.gain), costChange: r1(s.cost) })),
    wildcardDraft: { projected5: r1(wildcard.value), squad: wildcard.squad },
    freeHitDraft: { projectedNext: r1(freeHit.value), squad: freeHit.squad },
    holdProjected5: r1(plans.conservative.hold),
    pool: [...pool].map(row),
    // Kept for validation; not sent.
    _: { squad, bank, free, gw, gws, ahead, els, pool },
  };
}

const SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'One sentence: the main recommendation.' },
    transfers: {
      type: 'array',
      description: 'Transfers to make before this deadline, 0 to 3. Player ids from squad (out) and pool (in).',
      items: {
        type: 'object',
        properties: { out: { type: 'integer' }, in: { type: 'integer' }, reason: { type: 'string' } },
        required: ['out', 'in', 'reason'],
        additionalProperties: false,
      },
    },
    starting_xi: { type: 'array', items: { type: 'integer' }, description: 'Eleven player ids from the squad after transfers.' },
    bench: { type: 'array', items: { type: 'integer' }, description: 'The other four in bench order, goalkeeper first.' },
    captain: { type: 'integer' },
    vice_captain: { type: 'integer' },
    chip: {
      type: 'object',
      properties: { play: { type: 'string', enum: ['none', ...CHIPS] }, reason: { type: 'string' } },
      required: ['play', 'reason'],
      additionalProperties: false,
    },
    reasoning: { type: 'array', items: { type: 'string' }, description: '3 to 6 points, each citing the numbers it rests on.' },
    risks: { type: 'array', items: { type: 'string' }, description: '1 to 3 things that could make this wrong.' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: ['headline', 'transfers', 'starting_xi', 'bench', 'captain', 'vice_captain', 'chip', 'reasoning', 'risks', 'confidence'],
  additionalProperties: false,
};

const SYSTEM = `You are an expert Fantasy Premier League adviser inside Matchday, a stats site. You get one manager's situation as JSON, with projections our own models made:
- xp: expected FPL points per gameweek over the horizon (first entry is this gameweek), from team ratings fitted on xG since 2023/24, each player's xG/xA rates, likely minutes, and how much each opponent concedes to his position.
- netXgNext: our learned Net xG for this gameweek. xgxa90Last5: his recent form.
- plans: our optimiser's transfer plans in three risk modes, with projected points against making no transfers (vsHold). Hits cost 4 points each beyond the free transfers.
- wildcardDraft / freeHitDraft: the best squads the budget buys, for judging chips.

Decide for this gameweek: transfers, starting eleven, bench order, captain and vice, and whether to play a chip. Rules: squad of 15 (2 GK, 5 DEF, 5 MID, 3 FWD), at most 3 per club, eleven with 1 GK, 3-5 DEF, 2-5 MID, 1-3 FWD, budget = bank + sale prices of players out (assume current prices). Free transfers beyond the ones given cost 4 points each; a wildcard or free hit makes transfers free this week, but then list no more than 3 transfers here and say in the chip reason that the full draft is on the Chips tab.

Use only players in squad and pool, by id. Lean on the optimiser's plans but use judgement: injuries and doubts in the status text, rolling a free transfer when the gain is small (under about 2 points over the horizon), price changes tonight, fixture swings beyond this week, and not taking a hit unless it clearly pays back within the horizon. Captain the player with the best mix of projected points and Net xG; mention a differential only if the numbers support it.

Write for a keen FPL player: plain words, short sentences, no hype. Every reasoning point must cite the numbers it rests on (projected points, Net xG, fixtures, gains). If the numbers say hold, say hold.`;

let client;
const getClient = () => (client ??= new Anthropic({ timeout: 55_000, maxRetries: 0 }));

/** Ask Claude for the plan. Returns the parsed JSON and token usage. */
export async function askClaude(packet) {
  const { _, ...send } = packet;
  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    // A declined request is re-run on Anthropic's recommended fallback model instead of failing.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: 'user', content: `Advise for gameweek ${packet.gw}.\n\n${JSON.stringify(send)}` }],
  });
  if (response.stop_reason === 'refusal') throw new Error('Claude declined to advise on this one');
  if (response.stop_reason === 'max_tokens') throw new Error('The advice ran too long; try again');
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { advice: JSON.parse(text), usage: response.usage, model: response.model };
}

/**
 * Hold Claude's picks to the rules. Invalid transfers are dropped, an illegal eleven or captain is
 * replaced with our own best, hits are worked out here, and every change is listed in `fixes`.
 */
export function validate(advice, packet) {
  const { squad, bank, free, gw, ahead, els, pool } = packet._;
  const fixes = [];
  const chip = packet.chipsAvailable.includes(advice.chip?.play) ? advice.chip.play : 'none';
  if (advice.chip?.play && advice.chip.play !== 'none' && chip === 'none') fixes.push(`${CHIP_NAME[advice.chip.play] ?? advice.chip.play} isn't available, so no chip.`);

  let money = bank;
  let sq = [...squad];
  const transfers = [];
  for (const t of advice.transfers ?? []) {
    const eo = els[t.out];
    const ei = els[t.in];
    const why = !eo || !sq.includes(t.out) ? 'not in your squad' : !ei || !pool.has(t.in) || sq.includes(t.in) ? 'not an available option' : ei.type !== eo.type ? 'a different position' : ei.cost > eo.cost + money + 1e-9 ? 'over budget' : null;
    const next = why ? null : sq.map((x) => (x === t.out ? t.in : x));
    const clubs = next && Object.values(next.reduce((c, id) => ((c[els[id].team] = (c[els[id].team] ?? 0) + 1), c), {})).some((n) => n > 3);
    if (why || clubs) {
      fixes.push(`Dropped ${eo?.name ?? t.out} → ${ei?.name ?? t.in}: ${why ?? 'more than three from one club'}.`);
      continue;
    }
    money += eo.cost - ei.cost;
    sq = next;
    transfers.push(t);
  }
  const hit = chip === 'wildcard' || chip === 'freehit' ? 0 : Math.max(0, transfers.length - free) * 4;

  // The eleven: exactly the new squad's players, in a legal formation.
  const best = bestXI(sq, gw, ahead, els);
  const xi = advice.starting_xi ?? [];
  const n = (t) => xi.filter((id) => els[id]?.type === t).length;
  const legal = new Set(xi).size === 11 && xi.every((id) => sq.includes(id)) && n(1) === 1 && n(2) >= 3 && n(2) <= 5 && n(3) >= 2 && n(3) <= 5 && n(4) >= 1 && n(4) <= 3;
  const startXi = legal ? xi : best.xi;
  if (!legal) fixes.push('The suggested eleven wasn’t legal for the new squad, so this is our best eleven instead.');
  const rest = sq.filter((id) => !startXi.includes(id));
  const benchIn = (advice.bench ?? []).filter((id) => rest.includes(id));
  // FPL keeps the reserve goalkeeper in the first bench slot; the outfield order is Claude's, then ours.
  const order = [...new Set([...benchIn, ...rest])];
  const bench = [...order.filter((id) => els[id].type === 1), ...order.filter((id) => els[id].type !== 1)];
  let captain = advice.captain;
  if (!startXi.includes(captain)) {
    captain = best.captain;
    fixes.push('The captain wasn’t in the eleven, so ours is used.');
  }
  let vice = advice.vice_captain;
  if (!startXi.includes(vice) || vice === captain) vice = startXi.filter((id) => id !== captain).sort((a, b) => (ahead[b]?.per[gw]?.xp ?? 0) - (ahead[a]?.per[gw]?.xp ?? 0))[0];

  const xp = (id) => ahead[id]?.per[gw]?.xp ?? 0;
  const capMult = chip === '3xc' ? 3 : 2;
  const projected = startXi.reduce((t, id) => t + xp(id), 0) + (capMult - 1) * xp(captain) + (chip === 'bboost' ? bench.reduce((t, id) => t + xp(id), 0) : 0) - hit;
  return { ...advice, transfers, chip: { play: chip, reason: advice.chip?.reason ?? '' }, starting_xi: startXi, bench, captain, vice_captain: vice, hit, projected: r1(projected), holdProjected: r1(bestXI(squad, gw, ahead, els).points), bankAfter: r1(money), fixes };
}
