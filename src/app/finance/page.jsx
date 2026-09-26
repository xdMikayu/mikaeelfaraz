'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Sparkle as Sparkles, Tag as Tags, ArrowUpRight, ArrowDownRight, Minus, CaretRight as ChevronRight, X } from '@phosphor-icons/react';
import { useFinance, LoadingState } from './_components/FinanceShell';
import { PeriodBars, SpendBars, HBar, CategoryRing, ringSlices, WeekBars, PaceChart, Spark } from './_components/charts';
import TransactionEditor from './_components/TransactionEditor';
import { CategoryAvatar, CategoryIcon } from './_components/icons';
import { aed, pct, dateTime, relative } from './_components/format';
import { PERIODS, getPeriod, monthPeriod, rangePeriod } from '@/lib/finance/periods.mjs';
import { summarize, monthlySeries, periodBars, monthlyContext, spendOf, weekCompare, paceSeries, typicalMonth, categoryContext, recurringCharges } from '@/lib/finance/analytics.mjs';
import { accountColorVar } from '@/lib/finance/accounts.mjs';
import { dubaiParts } from '@/lib/finance/parse.mjs';

const whole = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');

/** Spending up is bad, down is good. */
function DeltaPill({ change, label }) {
  if (change == null) return <span className="fin-pill fin-pill-neutral">New · nothing {label}</span>;
  const up = change > 0.005;
  const down = change < -0.005;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  const cls = up ? 'fin-pill-bad' : down ? 'fin-pill-good' : 'fin-pill-neutral';
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className={`fin-pill ${cls}`}><Icon size={13} />{pct(Math.abs(change)).replace(/^[+−]/, '')}</span>
      <span className="text-sm fin-ink-2">{up ? 'more' : down ? 'less' : 'same'} than {label}</span>
    </span>
  );
}

function greeting() {
  const h = dubaiParts(new Date()).hh;
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`fin-card p-5 sm:p-6 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="fin-h2">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs fin-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Overview() {
  const f = useFinance();
  const [periodKey, setPeriodKey] = useState('this_month');
  const [editing, setEditing] = useState(null);
  const [insight, setInsight] = useState({ busy: false, text: null, error: null });
  const [catBusy, setCatBusy] = useState(null);
  const [ringSel, setRingSel] = useState(null);
  const [chartMode, setChartMode] = useState('pace');

  // Drill-down: tap a card tile to focus on that card, a month or week bar to open it.
  const [focusAccount, setFocusAccount] = useState(null);
  const [range, setRange] = useState(null); // { kind: 'month', y, m } | { kind: 'range', start, end, label }

  const earliest = useMemo(() => f.transactions.reduce((min, t) => (!min || t.occurred_at < min ? t.occurred_at : min), null), [f.transactions]);
  const period = useMemo(() => {
    if (range?.kind === 'month') return monthPeriod(range.y, range.m);
    if (range?.kind === 'range') return rangePeriod(new Date(range.start), new Date(range.end), range.label);
    return getPeriod(periodKey, new Date(), earliest);
  }, [periodKey, earliest, range]);
  const focused = focusAccount ? f.accounts.find((a) => a.id === focusAccount) : null;
  const txs = useMemo(() => (focusAccount ? f.transactions.filter((t) => t.account_id === focusAccount) : f.transactions), [f.transactions, focusAccount]);
  const s = useMemo(() => summarize(txs, period, focused ? [focused] : f.accounts, f.budgets), [txs, period, focused, f.accounts, f.budgets]);
  // Card tiles always show every card, so you can switch between them.
  const sAll = useMemo(() => (focusAccount ? summarize(f.transactions, period, f.accounts, f.budgets) : s), [focusAccount, f.transactions, period, f.accounts, f.budgets, s]);
  const months = useMemo(() => monthlySeries(txs, 12), [txs]);
  const bars = useMemo(() => periodBars(txs, period), [txs, period]);
  const context = useMemo(() => monthlyContext(txs, period), [txs, period]);
  const week = useMemo(() => weekCompare(txs), [txs]);
  const slices = useMemo(() => ringSlices(s.categories), [s.categories]);
  const pace = useMemo(() => paceSeries(txs, period), [txs, period]);
  const typical = useMemo(() => typicalMonth(txs, period.start), [txs, period.start]);
  const catCtx = useMemo(() => categoryContext(txs, period), [txs, period]);
  const recurring = useMemo(() => recurringCharges(txs, period.start), [txs, period.start]);
  // How far a category is from its usual for a period this long (null when there's no usual, or it's close).
  // A category's ring colour (top six), so the ring and the list read as one.
  const sliceColor = (cat) => slices.find((x) => x.key === cat)?.color || 'var(--fin-k-other)';
  const usualDelta = (c) => {
    const u = catCtx.get(c.category)?.usual;
    if (!u || period.noCompare) return null;
    const d = c.total - u;
    return Math.abs(d) < Math.max(20, u * 0.05) ? null : d;
  };
  const notes = useMemo(() => buildNotes({ s, pace, catCtx, recurring, period }), [s, pace, catCtx, recurring, period]);
  const recent = txs.slice(0, 6);
  const scopeLabel = focused ? `${focused.name} · ${period.label}` : period.label;
  // A summary belongs to the view it was asked for.
  useEffect(() => { setInsight({ busy: false, text: null, error: null }); setRingSel(null); }, [period.key, focusAccount]);
  const openBucket = (b) => {
    const p = dubaiParts(b.start);
    if (bars.unit === 'month') setRange({ kind: 'month', y: p.y, m: p.m });
    else if (bars.unit === 'week') setRange({ kind: 'range', start: b.start, end: b.end, label: b.fullLabel });
    else return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openMonth = (mo) => {
    setRange({ kind: 'month', y: mo.y, m: mo.m });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const catMax = Math.max(1, ...s.categories.map((c) => Math.max(c.total, c.budget || 0)));
  const accountById = new Map(f.accounts.map((a) => [a.id, a]));
  // Closed cards only get a tile for periods they were used in.
  const tiles = sAll.byAccount.filter((b) => !b.account.closed_at || b.total || b.prevTotal || b.account.id === focusAccount);
  const wideTiles = tiles.length > 3;
  const totalUncategorized = f.transactions.filter((t) => !t.category).length;
  const avgMonth = months.reduce((t, m) => t + m.total, 0) / 12;

  const categorize = async () => {
    setCatBusy('Categorizing…');
    try {
      const r = await f.api('categorize');
      await f.reload();
      setCatBusy(
        r.aiError ? `AI error: ${r.aiError}` :
        `Done: ${r.byRule} by rules, ${r.byAi} by Claude${r.remaining ? `, ${r.remaining} left` : ''}${!r.ai ? ' (add ANTHROPIC_API_KEY for AI)' : ''}`
      );
    } catch (e) {
      setCatBusy(e.message);
    }
  };

  const askClaude = async () => {
    setInsight({ busy: true, text: null, error: null });
    try {
      const summary = {
        focus: focused ? `Only the ${focused.name} (${focused.kind === 'debit' ? 'debit card' : focused.kind === 'bnpl' ? 'buy-now-pay-later card' : 'credit card'})` : 'All cards',
        period: period.label,
        comparedWith: period.prevLabel,
        totalAed: Math.round(s.total),
        previousTotalAed: Math.round(s.prevTotal),
        transactions: s.count,
        perDayAed: Math.round(s.perDay),
        byCard: s.byAccount.map((b) => ({ card: b.account.name, spentAed: Math.round(b.total), previousAed: Math.round(b.prevTotal) })),
        categories: s.categories.map((c) => ({ category: c.category, spentAed: Math.round(c.total), previousAed: Math.round(c.prevTotal), transactions: c.count, budgetAed: c.budget ? Math.round(c.budget) : undefined })),
        topMerchants: s.merchants.map((m) => ({ merchant: m.merchant, spentAed: Math.round(m.total), visits: m.count, category: m.category })),
        biggestPurchase: s.biggest ? { merchant: s.biggest.merchant, aed: Math.round(spendOf(s.biggest)) } : null,
        last12Months: months.map((m) => ({ month: m.fullLabel, aed: Math.round(m.total) })),
      };
      const r = await f.api('insights', summary);
      setInsight({ busy: false, text: r.text, error: null });
    } catch (e) {
      setInsight({ busy: false, text: null, error: e.message });
    }
  };

  if (f.loading) return <LoadingState />;

  return (
    <div className="fin-fade-in space-y-5">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="fin-eyebrow">{greeting()}</p>
            <h1 className="fin-h1 mt-1">Your spending</h1>
          </div>
          <div className="flex shrink-0 gap-2">
            {totalUncategorized > 0 && (
              <button className="fin-btn" onClick={categorize} disabled={catBusy === 'Categorizing…'}>
                <Tags size={16} /> <span className="hidden sm:inline">Sort</span> {totalUncategorized}
              </button>
            )}
            <button className="fin-btn" onClick={askClaude} disabled={insight.busy}>
              <Sparkles size={16} /> {insight.busy ? 'Thinking…' : 'Insights'}
            </button>
          </div>
        </div>
        <div className="fin-seg w-full" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p.key} aria-pressed={!range && periodKey === p.key} onClick={() => { setRange(null); setPeriodKey(p.key); }}>{p.label}</button>
          ))}
        </div>
      </div>
      {catBusy && catBusy !== 'Categorizing…' && <p className="text-sm fin-ink-2">{catBusy}</p>}

      {(focused || range) && (
        <div className="fin-fade-in flex flex-wrap items-center gap-2">
          <span className="text-sm fin-muted">Showing</span>
          {focused && (
            <button className="fin-chipbtn" data-active="true" onClick={() => setFocusAccount(null)} aria-label={`Show all cards instead of ${focused.name}`}>
              <span className="fin-dot" style={{ background: accountColorVar(focused.slug, f.accounts) }} />{focused.name}<X size={13} />
            </button>
          )}
          {range && (
            <button className="fin-chipbtn" data-active="true" onClick={() => setRange(null)} aria-label={`Back to ${PERIODS.find((p) => p.key === periodKey)?.label}`}>
              {period.label}<X size={13} />
            </button>
          )}
          <button className="fin-link text-sm" onClick={() => { setFocusAccount(null); setRange(null); }}>Clear</button>
        </div>
      )}

      {(insight.text || insight.error) && (
        <section className="fin-card fin-card-hero fin-fade-in p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="fin-h2 flex items-center gap-2"><span className="fin-pill fin-pill-accent"><Sparkles size={12} /> Claude</span> {scopeLabel}</h2>
            <button className="fin-btn fin-btn-ghost fin-icon-btn" onClick={() => setInsight({ busy: false, text: null, error: null })} aria-label="Close insights"><X size={16} /></button>
          </div>
          {insight.error ? (
            <p className="text-sm" style={{ color: 'var(--fin-bad)' }}>{insight.error}</p>
          ) : (
            <div className="space-y-2 text-[14.5px] leading-relaxed fin-ink-2">
              {insight.text.split('\n').filter(Boolean).map((l, i) => <p key={i}>{l}</p>)}
            </div>
          )}
        </section>
      )}

      {/* Hero + cards. Up to three cards sit beside the hero; more would stretch it
          (leaving a gap above the chart), so they move into a row underneath instead. */}
      <div className={`grid gap-5 ${wideTiles ? '' : 'lg:grid-cols-3'}`}>
        <section className={`fin-card fin-card-hero flex flex-col p-5 sm:p-7 ${wideTiles ? '' : 'lg:col-span-2'}`}
          style={focused ? { borderColor: `color-mix(in srgb, ${accountColorVar(focused.slug, f.accounts)} 45%, var(--fin-border))` } : undefined}>
          <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
            <div className="min-w-0">
              <p className="fin-eyebrow">Spent · {scopeLabel}</p>
              <p className="fin-hero-num mt-3"><span className="fin-cur">AED</span>{whole(s.total)}</p>
              {pace?.projected != null && !pace.complete && (
                <p className="mt-3 text-[15px] fin-ink-2">
                  On pace for <span className="fin-num font-semibold" style={{ color: 'var(--fin-ink)' }}>{aed(pace.projected, { decimals: 0 })}</span>
                  {pace.typical ? <> · a typical {pace.unit} is <span className="fin-num">{aed(pace.typical, { decimals: 0 })}</span></> : null}
                </p>
              )}
              {!period.noCompare && <div className="mt-3"><DeltaPill change={s.change} label={period.prevLabel} /></div>}
            </div>
            <dl className="grid grid-cols-3 gap-x-6 gap-y-1 sm:text-right lg:grid-cols-1 lg:gap-y-4">
              <Stat label="Per day" value={whole(s.perDay)} sub={typical.total ? `usual ${whole(typical.total / 30.44)}` : null} />
              <Stat label="Purchases" value={s.count} />
              <Stat label={s.perMonth ? 'Per month' : 'Typical month'} value={whole(s.perMonth ?? typical.total ?? avgMonth)} sub={s.perMonth ? null : 'median, last 6'} />
            </dl>
          </div>
          <div className="mt-auto pt-7">
            {pace && (
              <div className="mb-3 flex items-center justify-between gap-3">
                {chartMode === 'pace' ? (
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs fin-ink-2">
                    <span className="fin-chip"><span style={{ width: 14, height: 2, background: 'var(--fin-ink)', display: 'inline-block' }} />{period.week ? 'This week' : 'This month'}</span>
                    <span className="fin-chip"><span style={{ width: 14, height: 2, background: 'var(--fin-compare)', display: 'inline-block' }} />{period.week ? 'Last week' : 'Last month'}</span>
                    {pace.typical && <span className="fin-chip"><span style={{ width: 14, borderTop: '2px dashed var(--fin-compare)', display: 'inline-block' }} />Typical pace</span>}
                  </p>
                ) : <span />}
                <div className="fin-seg shrink-0" role="group" aria-label="Chart">
                  <button aria-pressed={chartMode === 'pace'} onClick={() => setChartMode('pace')}>Pace</button>
                  <button aria-pressed={chartMode === 'daily'} onClick={() => setChartMode('daily')}>Daily</button>
                </div>
              </div>
            )}
            {pace && chartMode === 'pace' ? (
              <PaceChart pace={pace} color={focused ? accountColorVar(focused.slug, f.accounts) : undefined} height={240} />
            ) : (
              <PeriodBars {...bars} color={focused ? accountColorVar(focused.slug, f.accounts) : undefined} height={240} onSelect={bars.unit === 'day' ? undefined : openBucket} />
            )}
          </div>
        </section>

        <div className={`grid gap-3 sm:gap-4 ${!wideTiles ? 'sm:grid-cols-3 lg:grid-cols-1' : tiles.length === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5'}`}>
          {tiles.map((b) => (
            <CardTile key={b.account.id} b={b} accounts={f.accounts} selected={focusAccount === b.account.id} dimmed={Boolean(focusAccount) && focusAccount !== b.account.id}
              onClick={() => setFocusAccount((cur) => (cur === b.account.id ? null : b.account.id))} />
          ))}
        </div>
      </div>

      {notes.length > 0 && (
        <section className={`fin-card grid divide-y sm:divide-x sm:divide-y-0 ${notes.length === 3 ? 'sm:grid-cols-3' : notes.length === 2 ? 'sm:grid-cols-2' : ''}`} style={{ borderColor: 'var(--fin-border)' }}>
          {notes.map((n) => (
            <div key={n.key} className="p-5" style={{ borderColor: 'var(--fin-border)' }}>
              <p className="text-xs fin-muted">{n.label}</p>
              <p className="mt-1.5 text-lg font-semibold tracking-tight" style={n.tone ? { color: `var(--fin-${n.tone})` } : undefined}>{n.headline}</p>
              <p className="mt-1 text-[13px] leading-snug fin-ink-2">{n.detail}</p>
            </div>
          ))}
        </section>
      )}

      {/* The week so far against last week */}
      {!period.week && !range && (
        <Panel
          title="This week"
          subtitle={`Monday to today${focused ? ` · ${focused.name}` : ''}`}
          action={<button className="fin-link text-xs" onClick={() => { setRange(null); setPeriodKey('last_week'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Open last week</button>}
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <div>
              <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-3xl font-semibold tracking-tight fin-num">{aed(week.total, { decimals: 0 })}</span>
                <span className="text-sm fin-ink-2">
                  vs {aed(week.prevSameTotal, { decimals: 0 })} by this point last week
                  {week.change != null && Math.abs(week.change) >= 0.005 && (
                    <span className="ml-1.5" style={{ color: week.change > 0 ? 'var(--fin-bad)' : 'var(--fin-good)' }}>({pct(week.change)})</span>
                  )}
                </span>
              </div>
              <WeekBars days={week.days} />
              <p className="mt-2 flex items-center gap-4 text-xs fin-muted">
                <span className="fin-chip"><span className="fin-dot" style={{ background: 'var(--fin-bar)' }} />This week</span>
                <span className="fin-chip"><span className="fin-dot" style={{ background: 'var(--fin-bar-soft)' }} />Last week · {aed(week.prevWeekTotal, { decimals: 0 })} in all</span>
              </p>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Biggest changes</p>
              {week.movers.length === 0 ? (
                <p className="text-sm fin-muted">Nothing to compare yet.</p>
              ) : (
                <ul className="divide-y" style={{ borderColor: 'var(--fin-border)' }}>
                  {week.movers.map((m) => (
                    <li key={m.category} className="flex items-center gap-3 py-2.5" style={{ borderColor: 'var(--fin-border)' }}>
                      <CategoryAvatar category={m.category} small />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{m.category}</span>
                        <span className="block text-xs fin-muted fin-num">{aed(m.prev, { decimals: 0 })} → {aed(m.total, { decimals: 0 })}</span>
                      </span>
                      <span className="fin-num text-sm font-semibold" style={{ color: m.delta > 0 ? 'var(--fin-bad)' : 'var(--fin-good)' }}>
                        {m.delta > 0 ? '+' : '−'}{Math.round(Math.abs(m.delta)).toLocaleString('en-US')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Panel>
      )}

      {/* Categories + merchants */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Where it went"
          subtitle={`${period.label}${period.noCompare ? '' : ' · against your usual'}${f.budgets.length ? ' · marker = budget' : ''}`}
        >
          {s.categories.length === 0 && <Empty text="No spending in this period yet." />}
          {slices.length > 0 && (
            <div className="mb-6 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
              <CategoryRing
                slices={slices}
                selected={ringSel}
                onSelect={setRingSel}
                center={(sl) => sl ? (
                  <div className="px-6">
                    <span className="mx-auto mb-1 grid place-items-center fin-ink-2">{sl.key === '__rest' ? null : <CategoryIcon category={sl.key} size={20} />}</span>
                    <p className="text-2xl font-semibold tracking-tight fin-num">{aed(sl.total, { decimals: 0 })}</p>
                    <p className="mt-0.5 text-xs fin-ink-2">{sl.label}</p>
                    <p className="text-xs fin-muted">{Math.round((sl.total / (s.total || 1)) * 100)}% · {sl.count} {sl.count === 1 ? 'purchase' : 'purchases'}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs fin-muted">Spent</p>
                    <p className="text-2xl font-semibold tracking-tight fin-num">{aed(s.total, { decimals: 0 })}</p>
                    <p className="text-xs fin-muted">{s.categories.filter((c) => c.total > 0).length} categories</p>
                  </div>
                )}
              />
              <div className="flex flex-1 flex-wrap justify-center gap-2 sm:justify-start">
                {slices.map((sl) => (
                  <button key={sl.key} className="fin-chipbtn" aria-pressed={ringSel === sl.key} onClick={() => setRingSel(ringSel === sl.key ? null : sl.key)}>
                    <span className="fin-dot" style={{ background: sl.color }} />{sl.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <ul className="space-y-1">
            {s.categories.map((c) => {
              const share = s.total > 0 ? c.total / s.total : 0;
              const up = c.change != null && c.change > 0.005;
              const down = c.change != null && c.change < -0.005;
              return (
                <li key={c.category} style={{ opacity: ringSel && !(ringSel === c.category || (ringSel === '__rest' && slices.find((x) => x.key === '__rest')?.members.includes(c.category))) ? 0.35 : 1, transition: 'opacity 0.15s' }}>
                  <Link href={f.href(`/finance/transactions?category=${encodeURIComponent(c.category)}&period=${periodKey}`)} className="fin-row">
                    <CategoryAvatar category={c.category} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium">{c.category}</span>
                        <span className="flex shrink-0 items-center gap-3">
                          {catCtx.get(c.category) && <Spark values={catCtx.get(c.category).trail} now={c.total / (period.months || 1)} />}
                          <span className="fin-num text-sm font-semibold">{aed(c.total, { decimals: 0 })}</span>
                        </span>
                      </span>
                      <span className="mt-2 block"><HBar value={c.total} max={catMax} budget={c.budget} color={sliceColor(c.category)} /></span>
                      <span className="mt-1.5 flex justify-between text-xs fin-muted">
                        <span>{c.count} {c.count === 1 ? 'purchase' : 'purchases'} · {Math.round(share * 100)}%</span>
                        <span style={{ color: c.total === 0 ? undefined : usualDelta(c) != null ? (usualDelta(c) > 0 ? 'var(--fin-bad)' : 'var(--fin-good)') : up ? 'var(--fin-bad)' : down ? 'var(--fin-good)' : undefined }}>
                          {c.total === 0 ? 'none this period' : usualDelta(c) != null ? `${usualDelta(c) > 0 ? '+' : '−'}${aed(Math.abs(usualDelta(c)), { decimals: 0 })} vs usual` : period.noCompare ? '' : pct(c.change)}
                          {c.budget && c.total > c.budget ? ` · ${aed(c.total - c.budget, { decimals: 0 })} over budget` : ''}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Top merchants" subtitle={period.label}>
          {s.merchants.length === 0 && <Empty text="Nothing yet." />}
          <ol className="space-y-0.5">
            {s.merchants.slice(0, 8).map((m, i) => (
              <li key={m.merchant} className="fin-row" style={{ cursor: 'default' }}>
                <span className="w-5 text-center text-xs font-semibold fin-muted fin-num">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{m.merchant}</span>
                  <span className="block text-xs fin-muted">{m.count}× · {m.category || 'Uncategorized'}</span>
                </span>
                <span className="fin-num text-sm font-semibold">{aed(m.total, { decimals: 0 })}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      {/* Trend + latest */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Last 12 months"
          subtitle={`By card · ${aed(context.average, { decimals: 0 })} a month on average${context.highlight.length < context.buckets.length ? ` · ${period.label} highlighted` : ''}`}
        >
          <SpendBars buckets={context.buckets} highlight={context.highlight} accounts={focused ? [focused] : f.accounts} height={230} label="Monthly spend by card, last 12 months" onSelect={openMonth} />
        </Panel>

        <Panel
          title="Latest"
          action={<Link href={f.href('/finance/transactions')} className="fin-link flex items-center text-xs">See all <ChevronRight size={14} /></Link>}
        >
          {recent.length === 0 && <Empty text="No transactions yet. Connect your cards in Setup." />}
          <ul className="space-y-0.5">
            {recent.map((t) => (
              <li key={t.id}>
                <button className="fin-row" onClick={() => setEditing(t)}>
                  <span className="relative">
                    <CategoryAvatar category={t.category} />
                    <span className="fin-dot absolute -bottom-0.5 -right-0.5" style={{ background: accountColorVar(accountById.get(t.account_id)?.slug, f.accounts), boxShadow: '0 0 0 2px var(--fin-surface)' }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{t.merchant}</span>
                    <span className="block text-xs fin-muted">{dateTime(t.occurred_at)}</span>
                  </span>
                  <span className="fin-num shrink-0 text-sm font-semibold" style={t.direction === 'credit' ? { color: 'var(--fin-good)' } : undefined}>
                    {t.direction === 'credit' ? '+' : '−'}{aed(t.amount_aed).replace('AED ', '')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <p className="px-1 text-xs fin-muted">All amounts in AED. Tabby purchases count at full price when you buy, not per instalment.</p>
      {editing && <TransactionEditor tx={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div>
      <dt className="text-xs fin-muted">{label}</dt>
      <dd className="fin-num text-base font-semibold">{value}</dd>
      {sub && <dd className="text-[11px] fin-muted">{sub}</dd>}
    </div>
  );
}

/**
 * Up to three plain-language notes that explain the numbers: pace against a typical period,
 * the category furthest from its usual, and what regular charges cost each month.
 */
function buildNotes({ s, pace, catCtx, recurring, period }) {
  const out = [];
  const money = (n) => aed(Math.abs(n), { decimals: 0 });
  if (pace?.aheadOfTypical != null && !pace.complete && pace.elapsed >= 3) {
    const d = pace.aheadOfTypical;
    out.push({
      key: 'pace', label: `Pace this ${pace.unit}`,
      headline: Math.abs(d) < Math.max(25, (pace.typical || 0) * 0.03) ? 'Right on your usual pace' : `${money(d)} ${d > 0 ? 'ahead of' : 'under'} usual`,
      detail: `${aed(pace.spent, { decimals: 0 })} spent by day ${pace.elapsed}; a typical ${pace.unit} would be at ${aed((pace.typical * pace.elapsed) / pace.days, { decimals: 0 })}.`,
      tone: d > Math.max(25, (pace.typical || 0) * 0.03) ? 'bad' : d < -Math.max(25, (pace.typical || 0) * 0.03) ? 'good' : null,
    });
  }
  if (!period.noCompare) {
    const scored = s.categories
      .map((c) => ({ c, u: catCtx.get(c.category)?.usual || 0 }))
      .filter(({ u }) => u > 0)
      .map(({ c, u }) => ({ c, u, d: c.total - u }))
      .sort((a, b) => b.d - a.d);
    const top = scored[0];
    if (top && top.d > Math.max(50, top.u * 0.15)) {
      out.push({ key: 'cat', label: 'Furthest above usual', headline: `${top.c.category} +${money(top.d)}`, detail: `${aed(top.c.total, { decimals: 0 })} so far against a usual ${aed(top.u, { decimals: 0 })} for ${period.label.toLowerCase().startsWith('this') || period.label.toLowerCase().startsWith('last') ? period.label.toLowerCase() : 'this period'}.`, tone: 'bad' });
    } else if (scored.length && scored.at(-1).d < -Math.max(50, scored.at(-1).u * 0.15)) {
      const low = scored.at(-1);
      out.push({ key: 'cat', label: 'Furthest below usual', headline: `${low.c.category} −${money(low.d)}`, detail: `${aed(low.c.total, { decimals: 0 })} against a usual ${aed(low.u, { decimals: 0 })}.`, tone: 'good' });
    }
  }
  if (recurring.length) {
    const total = recurring.reduce((t, r) => t + r.monthly, 0);
    const names = recurring.slice(0, 3).map((r) => r.merchant).join(', ');
    out.push({ key: 'rec', label: 'Regular charges', headline: `${aed(total, { decimals: 0 })} a month`, detail: `${names}${recurring.length > 3 ? ` and ${recurring.length - 3} more` : ''}, charged most months.` });
  }
  if (out.length < 3 && s.biggest) {
    out.push({ key: 'big', label: 'Biggest purchase', headline: aed(spendOf(s.biggest), { decimals: 0 }), detail: `${s.biggest.merchant}${s.biggest.category ? ` · ${s.biggest.category}` : ''}, ${Math.round((spendOf(s.biggest) / (s.total || 1)) * 100)}% of the period.` });
  }
  return out.slice(0, 3);
}

function Empty({ text }) {
  return <p className="fin-inset px-4 py-6 text-center text-sm fin-muted">{text}</p>;
}

function CardTile({ b, accounts, selected, dimmed, onClick }) {
  const color = accountColorVar(b.account.slug, accounts);
  const limit = Number(b.account.credit_limit) || null;
  const used = limit && b.available != null ? Math.max(0, Math.min(1, 1 - b.available / limit)) : null;
  const change = b.prevTotal ? (b.total - b.prevTotal) / b.prevTotal : null;
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className="fin-card relative flex w-full min-w-0 flex-col justify-start overflow-hidden p-4 text-left sm:p-5 transition-[opacity,box-shadow] duration-150"
      style={{
        opacity: dimmed ? 0.5 : 1,
        boxShadow: selected ? `0 0 0 1px ${color}` : undefined,
        borderColor: selected ? color : undefined,
      }}>
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: color }} aria-hidden />
      <div className="flex items-center justify-between gap-2">
        <span className="fin-chip min-w-0 text-[13px] font-medium" style={{ color: 'var(--fin-ink)' }}>
          <span className="fin-dot" style={{ background: color }} />
          <span className="truncate">{b.account.name}</span>
        </span>
        {b.account.last4 && <span className="fin-num hidden text-xs fin-muted sm:inline">•• {b.account.last4}</span>}
      </div>
      <p className="fin-num mt-3 text-lg font-semibold tracking-tight sm:text-2xl">{aed(b.total, { decimals: 0 })}</p>
      <p className="mt-0.5 text-xs fin-muted">
        {b.count} {b.count === 1 ? 'purchase' : 'purchases'}
        {change != null && <> · <span style={{ color: change > 0.005 ? 'var(--fin-bad)' : change < -0.005 ? 'var(--fin-good)' : undefined }}>{pct(change)}</span></>}
      </p>
      <div className="mt-4">
        {b.account.closed_at ? (
          <span className="fin-pill fin-pill-neutral">Closed</span>
        ) : b.available != null ? (
          <>
            <div className="flex justify-between text-xs">
              <span className="fin-ink-2">{b.account.kind === 'debit' ? 'Balance' : 'Available'}</span>
              <span className="fin-num font-semibold">{aed(b.available, { decimals: 0 })}</span>
            </div>
            {used != null && (
              <div className="fin-bar-track mt-2" title={`${Math.round(used * 100)}% of limit used`}>
                <div className="fin-bar-fill" style={{ width: `${used * 100}%`, background: used > 0.8 ? 'var(--fin-bad)' : color }} />
              </div>
            )}
            <p className="mt-1.5 text-[11px] fin-muted">{used != null ? `${Math.round(used * 100)}% used · ` : ''}updated {relative(b.availableAt)}</p>
          </>
        ) : (
          <p className="text-xs fin-muted">Balance shows after the next alert</p>
        )}
      </div>
    </button>
  );
}
