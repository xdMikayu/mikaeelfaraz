'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Tags, ArrowRight } from 'lucide-react';
import { useFinance } from './_components/FinanceShell';
import { CumulativeChart, MonthlyBars, HBar } from './_components/charts';
import TransactionEditor from './_components/TransactionEditor';
import { aed, pct, dateTime, relative } from './_components/format';
import { PERIODS, getPeriod } from '@/lib/finance/periods.mjs';
import { summarize, monthlySeries, cumulativeByDay, spendOf } from '@/lib/finance/analytics.mjs';
import { accountColorVar } from '@/lib/finance/accounts.mjs';

function Delta({ change, label, upIsGood = false }) {
  if (change == null) return <span className="text-sm fin-muted">no spend {label} to compare</span>;
  const up = change > 0.005;
  const down = change < -0.005;
  const good = upIsGood ? up : down;
  const color = up || down ? (good ? 'var(--fin-good)' : 'var(--fin-bad)') : 'var(--fin-ink-2)';
  return (
    <span className="text-sm">
      <span style={{ color }} className="font-semibold">{up ? '▲' : down ? '▼' : '•'} {pct(change)}</span>
      <span className="fin-ink-2"> vs {label}</span>
    </span>
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
  const cumulative = useMemo(() => cumulativeByDay(f.transactions), [f.transactions]);
  const recent = f.transactions.slice(0, 6);
  const catMax = Math.max(1, ...s.categories.map((c) => Math.max(c.total, c.budget || 0)));
  const accountById = new Map(f.accounts.map((a) => [a.id, a]));
  const totalUncategorized = f.transactions.filter((t) => !t.category).length;

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

  if (f.loading) return <p className="fin-muted">Loading your transactions…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="fin-seg" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p.key} aria-pressed={periodKey === p.key} onClick={() => setPeriodKey(p.key)}>{p.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {totalUncategorized > 0 && (
            <button className="fin-btn" onClick={categorize} disabled={catBusy === 'Categorizing…'}>
              <Tags size={15} /> Categorize {totalUncategorized}
            </button>
          )}
          <button className="fin-btn" onClick={askClaude} disabled={insight.busy}>
            <Sparkles size={15} /> {insight.busy ? 'Thinking…' : 'AI summary'}
          </button>
        </div>
      </div>
      {catBusy && catBusy !== 'Categorizing…' && <p className="text-sm fin-ink-2">{catBusy}</p>}

      {(insight.text || insight.error) && (
        <section className="fin-card p-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Sparkles size={15} /> Claude’s read on {period.label}</h2>
          {insight.error ? (
            <p className="text-sm" style={{ color: 'var(--fin-bad)' }}>{insight.error}</p>
          ) : (
            <div className="space-y-1.5 text-sm leading-relaxed fin-ink-2">
              {insight.text.split('\n').filter(Boolean).map((l, i) => <p key={i}>{l}</p>)}
            </div>
          )}
        </section>
      )}

      {/* Hero + per-card tiles */}
      <section className="grid gap-4 lg:grid-cols-[1.2fr_2fr]">
        <div className="fin-card p-5">
          <p className="text-sm fin-ink-2">Spent · {period.label}</p>
          <p className="mt-1 font-semibold" style={{ fontSize: 44, lineHeight: 1.1, letterSpacing: '-0.02em' }}>{aed(s.total, { decimals: 0 })}</p>
          <div className="mt-2"><Delta change={s.change} label={period.prevLabel} /></div>
          <p className="mt-3 text-sm fin-muted">
            {s.count} purchases · {aed(s.perDay, { decimals: 0 })}/day{s.perMonth ? ` · ${aed(s.perMonth, { decimals: 0 })}/month` : ''}
          </p>
          {s.biggest && (
            <p className="mt-1 text-sm fin-muted">Biggest: {s.biggest.merchant} · {aed(spendOf(s.biggest), { decimals: 0 })}</p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {s.byAccount.map((b) => {
            const color = accountColorVar(b.account.slug, f.accounts);
            const limit = Number(b.account.credit_limit) || null;
            const used = limit && b.available != null ? Math.max(0, Math.min(1, 1 - b.available / limit)) : null;
            return (
              <div key={b.account.id} className="fin-card p-4">
                <p className="fin-chip"><span className="fin-dot" style={{ background: color }} />{b.account.name}{b.account.last4 ? ` ·${b.account.last4}` : ''}</p>
                <p className="mt-2 text-2xl font-semibold">{aed(b.total, { decimals: 0 })}</p>
                <p className="text-xs fin-muted">{b.count} purchases · {b.prevTotal ? `${pct((b.total - b.prevTotal) / b.prevTotal)} vs before` : 'nothing before'}</p>
                {b.available != null ? (
                  <div className="mt-3">
                    <p className="text-xs fin-ink-2">Available <span className="fin-num font-medium" style={{ color: 'var(--fin-ink)' }}>{aed(b.available, { decimals: 0 })}</span></p>
                    {used != null && (
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded" style={{ background: 'var(--fin-surface-2)' }} title={`${Math.round(used * 100)}% of limit used`}>
                        <div className="h-full" style={{ width: `${used * 100}%`, background: used > 0.8 ? 'var(--fin-bad)' : color }} />
                      </div>
                    )}
                    <p className="mt-1 text-xs fin-muted">{used != null ? `${Math.round(used * 100)}% used · ` : ''}updated {relative(b.availableAt)}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-xs fin-muted">{b.account.slug === 'tabby' ? 'Tabby doesn’t report a balance' : 'Balance appears after the next alert'}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Charts */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="fin-card p-5">
          <h2 className="text-sm font-semibold">Month pace</h2>
          <p className="mb-3 text-xs fin-muted">Running total this month vs last month</p>
          <CumulativeChart {...cumulative} />
        </div>
        <div className="fin-card p-5">
          <h2 className="text-sm font-semibold">Monthly spend</h2>
          <p className="mb-3 text-xs fin-muted">Last 12 months by card · {aed(months.reduce((t, m) => t + m.total, 0) / 12, { decimals: 0 })}/month average</p>
          <MonthlyBars months={months} accounts={f.accounts} />
        </div>
      </section>

      {/* Categories + merchants */}
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="fin-card p-5">
          <h2 className="text-sm font-semibold">Where it went</h2>
          <p className="mb-4 text-xs fin-muted">{period.label} by category · change vs {period.prevLabel}{f.budgets.length ? ' · tick = budget' : ''}</p>
          {s.categories.length === 0 && <p className="text-sm fin-muted">No spending in this period yet.</p>}
          <ul className="space-y-3">
            {s.categories.map((c) => (
              <li key={c.category}>
                <Link href={`/finance/transactions?category=${encodeURIComponent(c.category)}&period=${periodKey}${f.demo ? '&demo=1' : ''}`} className="block">
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{c.category} <span className="fin-muted">· {c.count}</span></span>
                    <span className="flex shrink-0 items-baseline gap-3">
                      <span className="text-xs" style={{ color: c.change == null ? 'var(--fin-muted)' : c.change > 0.005 ? 'var(--fin-bad)' : c.change < -0.005 ? 'var(--fin-good)' : 'var(--fin-muted)' }}>
                        {c.total === 0 ? 'none now' : pct(c.change)}
                      </span>
                      <span className="fin-num w-24 text-right font-medium">{aed(c.total, { decimals: 0 })}</span>
                    </span>
                  </div>
                  <HBar value={c.total} max={catMax} budget={c.budget} />
                  {c.budget && c.total > c.budget && (
                    <p className="mt-1 text-xs" style={{ color: 'var(--fin-bad)' }}>⚠ Over budget by {aed(c.total - c.budget, { decimals: 0 })}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4">
          <div className="fin-card p-5">
            <h2 className="mb-3 text-sm font-semibold">Top merchants</h2>
            <table className="fin-table" style={{ fontSize: 13 }}>
              <tbody>
                {s.merchants.map((m) => (
                  <tr key={m.merchant} style={{ cursor: 'default' }}>
                    <td className="truncate" style={{ maxWidth: 160, paddingLeft: 0 }}>{m.merchant}<span className="block text-xs fin-muted">{m.category || 'Uncategorized'}</span></td>
                    <td className="fin-muted fin-num text-right">{m.count}×</td>
                    <td className="fin-num text-right font-medium" style={{ paddingRight: 0 }}>{aed(m.total, { decimals: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {s.merchants.length === 0 && <p className="text-sm fin-muted">Nothing yet.</p>}
          </div>
          <div className="fin-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Latest</h2>
              <Link href={`/finance/transactions${f.demo ? '?demo=1' : ''}`} className="flex items-center gap-1 text-xs fin-ink-2">All <ArrowRight size={12} /></Link>
            </div>
            <ul>
              {recent.map((t) => (
                <li key={t.id}>
                  <button className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm" onClick={() => setEditing(t)}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="fin-dot" style={{ background: accountColorVar(accountById.get(t.account_id)?.slug, f.accounts) }} />
                      <span className="min-w-0">
                        <span className="block truncate">{t.merchant}</span>
                        <span className="block text-xs fin-muted">{dateTime(t.occurred_at)} · {t.category || 'Uncategorized'}</span>
                      </span>
                    </span>
                    <span className="fin-num shrink-0 font-medium">{t.direction === 'credit' ? '+' : ''}{aed(t.amount_aed)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {recent.length === 0 && <p className="text-sm fin-muted">No transactions yet — see Setup to connect your cards.</p>}
          </div>
        </div>
      </section>
      <p className="text-xs fin-muted">All amounts in AED (foreign purchases converted). Tabby purchases count at full price when you buy, not per instalment.</p>
      {editing && <TransactionEditor tx={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
