'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Tags, ArrowUpRight, ArrowDownRight, Minus, ChevronRight, X } from 'lucide-react';
import { useFinance, LoadingState } from './_components/FinanceShell';
import { PeriodBars, SpendBars, HBar } from './_components/charts';
import TransactionEditor from './_components/TransactionEditor';
import { CategoryAvatar } from './_components/icons';
import { aed, pct, dateTime, relative } from './_components/format';
import { PERIODS, getPeriod } from '@/lib/finance/periods.mjs';
import { summarize, monthlySeries, periodBars, monthlyContext, spendOf } from '@/lib/finance/analytics.mjs';
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
      <span className={`fin-pill ${cls}`}><Icon size={13} strokeWidth={2.4} />{pct(Math.abs(change)).replace(/^[+−]/, '')}</span>
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

  const period = useMemo(() => getPeriod(periodKey), [periodKey]);
  const s = useMemo(() => summarize(f.transactions, period, f.accounts, f.budgets), [f.transactions, period, f.accounts, f.budgets]);
  const months = useMemo(() => monthlySeries(f.transactions, 12), [f.transactions]);
  const bars = useMemo(() => periodBars(f.transactions, period), [f.transactions, period]);
  const context = useMemo(() => monthlyContext(f.transactions, period), [f.transactions, period]);
  const recent = f.transactions.slice(0, 6);
  const catMax = Math.max(1, ...s.categories.map((c) => Math.max(c.total, c.budget || 0)));
  const accountById = new Map(f.accounts.map((a) => [a.id, a]));
  // Closed cards only get a tile for periods they were used in.
  const tiles = s.byAccount.filter((b) => !b.account.closed_at || b.total || b.prevTotal);
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="fin-eyebrow">{greeting()}</p>
          <h1 className="fin-h1 mt-1">Your spending</h1>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="fin-seg" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button key={p.key} aria-pressed={periodKey === p.key} onClick={() => setPeriodKey(p.key)}>{p.label}</button>
            ))}
          </div>
          <div className="flex gap-2">
            {totalUncategorized > 0 && (
              <button className="fin-btn" onClick={categorize} disabled={catBusy === 'Categorizing…'}>
                <Tags size={15} /> Sort {totalUncategorized}
              </button>
            )}
            <button className="fin-btn" onClick={askClaude} disabled={insight.busy}>
              <Sparkles size={15} /> {insight.busy ? 'Thinking…' : 'Insights'}
            </button>
          </div>
        </div>
      </div>
      {catBusy && catBusy !== 'Categorizing…' && <p className="text-sm fin-ink-2">{catBusy}</p>}

      {(insight.text || insight.error) && (
        <section className="fin-card fin-card-hero fin-fade-in p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="fin-h2 flex items-center gap-2"><span className="fin-pill fin-pill-accent"><Sparkles size={12} /> Claude</span> {period.label}</h2>
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

      {/* Hero + cards */}
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="fin-card fin-card-hero flex flex-col p-5 sm:p-7 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="fin-eyebrow">Spent · {period.label}</p>
              <p className="fin-hero-num fin-num mt-3"><span className="fin-cur">AED</span>{whole(s.total)}</p>
              <div className="mt-4"><DeltaPill change={s.change} label={period.prevLabel} /></div>
            </div>
            <dl className="grid grid-cols-3 gap-x-6 gap-y-1 text-right sm:grid-cols-1 sm:gap-y-3">
              <Stat label="Purchases" value={s.count} />
              <Stat label="Per day" value={whole(s.perDay)} />
              <Stat label={s.perMonth ? 'Per month' : '12-mo avg'} value={whole(s.perMonth ?? avgMonth)} />
            </dl>
          </div>
          <div className="mt-auto pt-8">
            <PeriodBars {...bars} height={240} />
          </div>
        </section>

        <div className={`grid gap-4 lg:grid-cols-1 ${tiles.length > 3 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
          {tiles.map((b) => <CardTile key={b.account.id} b={b} accounts={f.accounts} />)}
        </div>
      </div>

      {/* Categories + merchants */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Where it went"
          subtitle={`${period.label} · change vs ${period.prevLabel}${f.budgets.length ? ' · marker = budget' : ''}`}
        >
          {s.categories.length === 0 && <Empty text="No spending in this period yet." />}
          <ul className="space-y-1">
            {s.categories.map((c) => {
              const share = s.total > 0 ? c.total / s.total : 0;
              const up = c.change != null && c.change > 0.005;
              const down = c.change != null && c.change < -0.005;
              return (
                <li key={c.category}>
                  <Link href={f.href(`/finance/transactions?category=${encodeURIComponent(c.category)}&period=${periodKey}`)} className="fin-row">
                    <CategoryAvatar category={c.category} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium">{c.category}</span>
                        <span className="fin-num shrink-0 text-sm font-semibold">{aed(c.total, { decimals: 0 })}</span>
                      </span>
                      <span className="mt-2 block"><HBar value={c.total} max={catMax} budget={c.budget} /></span>
                      <span className="mt-1.5 flex justify-between text-xs fin-muted">
                        <span>{c.count} {c.count === 1 ? 'purchase' : 'purchases'} · {Math.round(share * 100)}%</span>
                        <span style={{ color: c.total === 0 ? undefined : up ? 'var(--fin-bad)' : down ? 'var(--fin-good)' : undefined }}>
                          {c.total === 0 ? 'none this period' : pct(c.change)}
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
          <SpendBars buckets={context.buckets} highlight={context.highlight} accounts={f.accounts} height={230} label="Monthly spend by card, last 12 months" />
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

function Stat({ label, value }) {
  return (
    <div>
      <dt className="text-xs fin-muted">{label}</dt>
      <dd className="fin-num text-base font-semibold">{value}</dd>
    </div>
  );
}

function Empty({ text }) {
  return <p className="fin-inset px-4 py-6 text-center text-sm fin-muted">{text}</p>;
}

function CardTile({ b, accounts }) {
  const color = accountColorVar(b.account.slug, accounts);
  const limit = Number(b.account.credit_limit) || null;
  const used = limit && b.available != null ? Math.max(0, Math.min(1, 1 - b.available / limit)) : null;
  const change = b.prevTotal ? (b.total - b.prevTotal) / b.prevTotal : null;
  return (
    <section className="fin-card relative overflow-hidden p-5">
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: color }} aria-hidden />
      <div className="flex items-center justify-between gap-2">
        <span className="fin-chip text-[13px] font-medium" style={{ color: 'var(--fin-ink)' }}>
          <span className="fin-dot" style={{ background: color }} />
          {b.account.name}
        </span>
        {b.account.last4 && <span className="fin-num text-xs fin-muted">•• {b.account.last4}</span>}
      </div>
      <p className="fin-num mt-3 text-2xl font-semibold tracking-tight">{aed(b.total, { decimals: 0 })}</p>
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
              <span className="fin-ink-2">Available</span>
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
    </section>
  );
}
