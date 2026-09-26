'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash as Trash2, X } from '@phosphor-icons/react';
import { useFinance, LoadingState } from '../_components/FinanceShell';
import { NetWorthLine } from '../_components/charts';
import { aed, relative } from '../_components/format';
import { typicalMonth } from '@/lib/finance/analytics.mjs';
import { KARATS } from '@/lib/finance/gold.mjs';
import { valuePortfolio, cardLiabilities, KIND_ORDER, ASSET_KINDS, CASH_CURRENCIES, CRYPTO, AED_PER_USD } from '@/lib/finance/portfolio.mjs';

const KIND_COLOR = { cash: 'var(--fin-a-cash)', stock: 'var(--fin-a-stock)', gold: 'var(--fin-a-gold)', crypto: 'var(--fin-a-crypto)' };
const MALABAR_FRESH_MS = 36 * 60 * 60 * 1000;
const RANGES = [
  { key: '1m', label: '1M', days: 31 },
  { key: '3m', label: '3M', days: 92 },
  { key: '1y', label: '1Y', days: 366 },
  { key: 'all', label: 'All', days: Infinity },
];

// ---------- demo data ----------
const DEMO_HOLDINGS = [
  { id: 'd1', asset: 'cash', name: 'Mashreq', currency: 'AED', quantity: 18450 },
  { id: 'd2', asset: 'cash', name: 'Emirates NBD', currency: 'AED', quantity: 6200 },
  { id: 'd3', asset: 'cash', name: 'Bank Alfalah', currency: 'PKR', quantity: 240000 },
  { id: 'd4', asset: 'stock', symbol: 'EMAAR', quantity: 150, cost_aed: 1500 },
  { id: 'd5', asset: 'stock', symbol: 'SALIK', quantity: 400, cost_aed: 2100 },
  { id: 'd6', asset: 'crypto', symbol: 'SOL', quantity: 4.5, cost_aed: 2400 },
  { id: 'd7', asset: 'gold', karat: 24, grams: 20, cost_aed: 9200, note: 'Bar' },
];
function demoHistory(latest) {
  const out = [];
  const today = Date.now();
  let v = latest * 0.86;
  for (let i = 120; i >= 1; i--) {
    v += (latest - v) * 0.02 + Math.sin(i / 6) * latest * 0.004;
    out.push({ day: new Date(today - i * 86400000).toISOString().slice(0, 10), total: Math.round(v) });
  }
  return out;
}

// ---------- data ----------
function usePortfolio() {
  const f = useFinance();
  const [holdings, setHoldings] = useState(f.demo ? DEMO_HOLDINGS : null);
  const [history, setHistory] = useState([]);
  const [stored, setStored] = useState(null);
  const [prices, setPrices] = useState(null);
  const [setup, setSetup] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (f.demo) return;
    const [h, n, p] = await Promise.all([
      f.supabase.from('fin_holdings').select('*').order('created_at'),
      f.supabase.from('fin_networth').select('day, total_aed').order('day'),
      f.supabase.from('fin_prices').select('*').eq('asset', 'gold').eq('source', 'malabar').maybeSingle(),
    ]);
    if (h.error || n.error) {
      const msg = (h.error || n.error).message;
      if (/fin_holdings|fin_networth|does not exist|schema cache/.test(msg)) setSetup(true);
      else setError(msg);
      setHoldings((cur) => cur || []);
      return;
    }
    setSetup(false);
    setError(null);
    setHoldings(h.data);
    setHistory(n.data.map((r) => ({ day: r.day, total: Number(r.total_aed) })));
    setStored(p.data || null);
  }, [f.demo, f.supabase]);
  useEffect(() => { load(); }, [load]);

  const cryptoSymbols = useMemo(() => [...new Set((holdings || []).filter((h) => h.asset === 'crypto').map((h) => String(h.symbol).toUpperCase()))].sort().join(','), [holdings]);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/finance/prices?crypto=${cryptoSymbols || 'SOL'}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Prices unavailable'))))
      .then((j) => !cancelled && setPrices(j))
      .catch((e) => !cancelled && setPrices({ stocks: {}, crypto: {}, fx: {}, gold: null, errors: { all: e.message } }));
    return () => { cancelled = true; };
  }, [cryptoSymbols]);

  // Malabar's UAE rate (sent by the iPhone Shortcut) beats the spot price while fresh.
  const gold = stored && Date.now() - new Date(stored.fetched_at).getTime() < MALABAR_FRESH_MS
    ? { source: 'malabar', perGram: stored.per_gram, updated: stored.quoted_at || stored.fetched_at }
    : prices?.gold || null;

  // What the credit cards owe now, from each card's latest alert.
  const liabilities = useMemo(() => {
    const latest = {};
    for (const t of f.transactions) if (t.available_balance != null && latest[t.account_id] == null) latest[t.account_id] = Number(t.available_balance);
    return cardLiabilities(f.accounts, latest);
  }, [f.accounts, f.transactions]);

  const snapshot = () => f.api('networth').then(load).catch(() => {}); // record today's total straight away
  const save = async (row, id) => {
    if (f.demo) {
      setHoldings((hs) => (id ? hs.map((h) => (h.id === id ? { ...h, ...row } : h)) : [...hs, { ...row, id: `demo-${Date.now()}` }]));
      return;
    }
    const q = id
      ? f.supabase.from('fin_holdings').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id)
      : f.supabase.from('fin_holdings').insert(row);
    const { error: e } = await q;
    if (e) throw e;
    await load();
    snapshot();
  };
  const remove = async (id) => {
    if (f.demo) return setHoldings((hs) => hs.filter((h) => h.id !== id));
    const { error: e } = await f.supabase.from('fin_holdings').delete().eq('id', id);
    if (e) throw e;
    await load();
    snapshot();
  };

  // What a normal month of spending costs, for "how long would my cash last".
  const monthlySpend = useMemo(() => typicalMonth(f.transactions, new Date()).total, [f.transactions]);

  return { holdings, history, prices, gold, liabilities, monthlySpend, setup, error, save, remove, demo: f.demo };
}

// ---------- page ----------
export default function Portfolio() {
  const p = usePortfolio();
  const [ccy, setCcy] = useState('AED');
  const [range, setRange] = useState('3m');
  const [editing, setEditing] = useState(null); // { asset } for a new holding, or the holding

  const v = useMemo(() => (p.holdings && p.prices
    ? valuePortfolio(p.holdings, { gold: p.gold?.perGram, stocks: p.prices.stocks, crypto: p.prices.crypto, fx: p.prices.fx }, p.liabilities)
    : null), [p.holdings, p.prices, p.gold, p.liabilities]);

  const history = useMemo(() => {
    let pts = p.demo && v ? demoHistory(v.total) : p.history;
    if (v && !v.missing && p.holdings?.length) {
      const today = new Date().toISOString().slice(0, 10);
      pts = [...pts.filter((x) => x.day !== today), { day: today, total: v.total }];
    }
    const days = RANGES.find((r) => r.key === range).days;
    if (Number.isFinite(days)) {
      const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      pts = pts.filter((x) => x.day >= from);
    }
    return pts;
  }, [p.demo, p.history, p.holdings, v, range]);

  if (!p.holdings) return <LoadingState />;

  const money = (n, opts = {}) => (ccy === 'AED'
    ? aed(n, { decimals: 0, ...opts })
    : `${n < 0 ? '−' : opts.sign && n > 0 ? '+' : ''}$${Math.abs(n / AED_PER_USD).toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
  const change = v && history.length > 1 ? v.total - history[0].total : null;
  const rangeLabel = RANGES.find((r) => r.key === range).label;

  return (
    <div className="fin-fade-in space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="fin-eyebrow">Everything you own, less what the cards owe</p>
          <h1 className="fin-h1 mt-1">Net worth</h1>
        </div>
        <div className="fin-seg" role="group" aria-label="Currency">
          {['AED', 'USD'].map((c) => <button key={c} aria-pressed={ccy === c} onClick={() => setCcy(c)}>{c}</button>)}
        </div>
      </div>

      {p.setup && (
        <div className="fin-card p-5 text-sm fin-ink-2">
          <p className="font-semibold" style={{ color: 'var(--fin-ink)' }}>One-time setup</p>
          <p className="mt-1">Run <code className="fin-code">supabase/migrations/20260926000000_portfolio.sql</code> in the Supabase SQL editor, then reload this page.</p>
        </div>
      )}
      {p.error && <p className="text-sm" style={{ color: 'var(--fin-bad)' }}>{p.error}</p>}

      {/* Total + history */}
      <section className="fin-card p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {v ? (
              <>
                <p className="fin-hero-num"><span className="fin-cur">{ccy}</span>{Math.round(ccy === 'AED' ? v.total : v.totalUsd).toLocaleString('en-US')}</p>
                <p className="mt-3 text-sm fin-ink-2">
                  {ccy === 'AED' ? `≈ $${Math.round(v.totalUsd).toLocaleString('en-US')}` : `≈ ${aed(v.total, { decimals: 0 })}`}
                  {change != null && (
                    <span className="ml-2" style={{ color: change >= 0 ? 'var(--fin-good)' : 'var(--fin-bad)' }}>
                      {money(change, { sign: true })} {rangeLabel === 'All' ? 'all time' : `over ${rangeLabel}`}
                    </span>
                  )}
                </p>
                {v.missing && <p className="mt-1 text-xs" style={{ color: 'var(--fin-warn)' }}>Some prices are unavailable right now, so a holding or two isn&apos;t counted.</p>}
              </>
            ) : (
              <div className="fin-skeleton h-14 w-64" />
            )}
          </div>
          <div className="fin-seg" role="group" aria-label="History range">
            {RANGES.map((r) => <button key={r.key} aria-pressed={range === r.key} onClick={() => setRange(r.key)}>{r.label}</button>)}
          </div>
        </div>
        <div className="mt-6">
          {history.length > 1 ? (
            <NetWorthLine
              points={history.map((x) => ({ ...x, total: ccy === 'AED' ? x.total : x.total / AED_PER_USD }))}
              format={(n) => (ccy === 'AED' ? aed(n, { decimals: 0 }) : `$${Math.round(n).toLocaleString('en-US')}`)}
            />
          ) : (
            <p className="py-10 text-center text-sm fin-muted">History starts today: your total is recorded every day from now on.</p>
          )}
        </div>

        {/* Breakdown */}
        {v && v.assets > 0 && (
          <div className="mt-6 border-t pt-5" style={{ borderColor: 'var(--fin-border)' }}>
            <div className="flex h-2.5 overflow-hidden rounded-[3px]" style={{ gap: 2 }}>
              {KIND_ORDER.filter((k) => v.byKind[k]?.value > 0).map((k) => (
                <span key={k} style={{ width: `${(v.byKind[k].value / v.assets) * 100}%`, background: KIND_COLOR[k] }} title={ASSET_KINDS[k].plural} />
              ))}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
              {KIND_ORDER.filter((k) => v.byKind[k]).map((k) => (
                <div key={k}>
                  <dt className="fin-chip"><span className="fin-dot" style={{ background: KIND_COLOR[k] }} />{ASSET_KINDS[k].plural}</dt>
                  <dd className="fin-num mt-0.5 text-sm font-semibold">{money(v.byKind[k].value)} <span className="font-normal fin-muted">{Math.round((v.byKind[k].value / v.assets) * 100)}%</span></dd>
                </div>
              ))}
              {v.owed > 0 && (
                <div>
                  <dt className="fin-chip"><span className="fin-dot" style={{ background: 'var(--fin-bad)' }} />Cards owe</dt>
                  <dd className="fin-num mt-0.5 text-sm font-semibold" style={{ color: 'var(--fin-bad)' }}>−{money(v.owed)}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </section>

      {v && v.assets > 0 && <WorthNotes v={v} history={p.history} monthlySpend={p.monthlySpend} money={money} />}

      {/* Holdings by kind */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {KIND_ORDER.map((kind) => (
          <HoldingList
            key={kind}
            kind={kind}
            rows={(v?.rows || p.holdings).filter((h) => h.asset === kind)}
            money={money}
            prices={p.prices}
            gold={p.gold}
            onAdd={() => setEditing({ asset: kind })}
            onEdit={(h) => setEditing(h)}
          />
        ))}
      </div>

      {v?.liabilities.length > 0 && (
        <section className="fin-card p-5 sm:p-6">
          <h2 className="fin-h2">Card balances</h2>
          <p className="mt-0.5 text-xs fin-muted">Limit minus the available balance in each card&apos;s latest alert</p>
          <ul className="mt-3 divide-y" style={{ borderColor: 'var(--fin-border)' }}>
            {v.liabilities.map((l) => (
              <li key={l.account_id} className="flex justify-between py-2.5 text-sm" style={{ borderColor: 'var(--fin-border)' }}>
                <span>{l.name}</span>
                <span className="fin-num font-semibold" style={{ color: 'var(--fin-bad)' }}>−{money(l.owed)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PriceNotes prices={p.prices} gold={p.gold} />

      {editing && (
        <HoldingSheet
          holding={editing}
          prices={p.prices}
          onClose={() => setEditing(null)}
          onSave={async (row) => { await p.save(row, editing.id); setEditing(null); }}
          onDelete={editing.id ? async () => { await p.remove(editing.id); setEditing(null); } : null}
        />
      )}
    </div>
  );
}

/** Three notes that put the total in context: cash runway, this month's change, the biggest slice. */
function WorthNotes({ v, history, monthlySpend, money }) {
  const notes = [];
  const cash = v.byKind.cash?.value || 0;
  if (cash > 0 && monthlySpend > 0) {
    const months = cash / monthlySpend;
    notes.push({ key: 'runway', label: 'Cash runway', headline: months >= 24 ? `${Math.round(months / 12)} years` : `${months.toFixed(1)} months`, detail: `${money(cash)} in the bank covers that long at your typical ${money(monthlySpend)} a month.`, tone: months < 3 ? 'bad' : null });
  }
  const monthStart = new Date().toISOString().slice(0, 8) + '01';
  const base = history.filter((h) => h.day < monthStart).at(-1) || history.find((h) => h.day >= monthStart);
  if (base && base.day !== new Date().toISOString().slice(0, 10)) {
    const d = v.total - base.total;
    notes.push({ key: 'month', label: 'This month', headline: `${d >= 0 ? '+' : '−'}${money(Math.abs(d))}`, detail: `Since ${new Date(base.day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, when you were at ${money(base.total)}.`, tone: d >= 0 ? 'good' : 'bad' });
  }
  const top = Object.entries(v.byKind).sort((a, b) => b[1].value - a[1].value)[0];
  if (top) notes.push({ key: 'mix', label: 'Biggest share', headline: `${ASSET_KINDS[top[0]].plural} ${Math.round((top[1].value / v.assets) * 100)}%`, detail: v.owed > 0 ? `Cards owe ${money(v.owed)}, ${Math.round((v.owed / v.assets) * 100)}% of what you own.` : 'Nothing owed on the cards right now.' });
  if (!notes.length) return null;
  return (
    <section className={`fin-card grid divide-y sm:divide-x sm:divide-y-0 ${notes.length === 3 ? 'sm:grid-cols-3' : notes.length === 2 ? 'sm:grid-cols-2' : ''}`} style={{ borderColor: 'var(--fin-border)' }}>
      {notes.map((n) => (
        <div key={n.key} className="p-5" style={{ borderColor: 'var(--fin-border)' }}>
          <p className="text-xs fin-muted">{n.label}</p>
          <p className="mt-1.5 text-lg font-semibold tracking-tight" style={n.tone ? { color: `var(--fin-${n.tone})` } : undefined}>{n.headline}</p>
          <p className="mt-1 text-[13px] leading-snug fin-ink-2">{n.detail}</p>
        </div>
      ))}
    </section>
  );
}

const EMPTY = {
  cash: 'Add Mashreq, Emirates NBD, Bank Alfalah — any currency.',
  stock: 'Add a DFM symbol and how many shares you hold.',
  crypto: 'Add your Solana (or BTC, ETH).',
  gold: 'Add grams and karat.',
};

function HoldingList({ kind, rows, money, prices, gold, onAdd, onEdit }) {
  const total = rows.reduce((t, r) => t + (r.value || 0), 0);
  const sub = {
    cash: 'Balances you keep up to date',
    stock: 'Dubai Financial Market, last traded price',
    crypto: prices?.crypto?.SOL ? `SOL $${prices.crypto.SOL.usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : 'Live price',
    gold: gold ? `24K ${aed(gold.perGram[24])}/g · ${gold.source === 'malabar' ? 'Malabar UAE' : 'spot'}` : 'Today’s rate',
  }[kind];
  return (
    <section className="fin-card min-w-0 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="fin-h2 flex items-center gap-2"><span className="fin-dot" style={{ background: KIND_COLOR[kind] }} />{ASSET_KINDS[kind].plural}</h2>
          <p className="mt-0.5 truncate text-xs fin-muted">{sub}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {rows.length > 0 && <span className="fin-num text-sm font-semibold">{money(total)}</span>}
          <button className="fin-btn fin-btn-sm" onClick={onAdd} aria-label={`Add to ${ASSET_KINDS[kind].plural}`}><Plus size={14} /> Add</button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm fin-muted">{EMPTY[kind]}</p>
      ) : (
        <ul className="mt-3">
          {rows.map((h) => (
            <li key={h.id}>
              <button className="fin-row" onClick={() => onEdit(h)}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{title(h)}</span>
                  <span className="block text-xs fin-muted fin-num">{detail(h)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block fin-num text-sm font-semibold">{h.value != null ? money(h.value) : '—'}</span>
                  {h.gain != null ? (
                    <span className="block fin-num text-xs" style={{ color: h.gain >= 0 ? 'var(--fin-good)' : 'var(--fin-bad)' }}>{money(h.gain, { sign: true })} · {h.gain >= 0 ? '+' : '−'}{Math.abs((h.gain / h.cost) * 100).toFixed(1)}%</span>
                  ) : h.dayChangePct ? (
                    <span className="block fin-num text-xs" style={{ color: h.dayChangePct >= 0 ? 'var(--fin-good)' : 'var(--fin-bad)' }}>{h.dayChangePct >= 0 ? '+' : '−'}{Math.abs(h.dayChangePct).toFixed(1)}% today</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const fmtQty = (n, max = 4) => Number(n).toLocaleString('en-US', { maximumFractionDigits: max });

function title(h) {
  if (h.asset === 'cash') return h.name || 'Cash';
  if (h.asset === 'stock') return h.symbol;
  if (h.asset === 'crypto') return CRYPTO[String(h.symbol).toUpperCase()] || h.symbol;
  return `${h.karat}K gold${h.note ? ` · ${h.note}` : ''}`;
}

function detail(h) {
  if (h.asset === 'cash') return h.currency === 'AED' ? 'AED' : `${h.currency} ${fmtQty(h.quantity, 2)}`;
  if (h.asset === 'stock') return `${fmtQty(h.quantity, 0)} shares${h.unitAed ? ` × ${h.unitAed.toFixed(2)}` : ''}`;
  if (h.asset === 'crypto') return `${fmtQty(h.quantity, 6)} ${String(h.symbol).toUpperCase()}${h.unitAed ? ` × $${(h.unitAed / AED_PER_USD).toFixed(2)}` : ''}`;
  return `${fmtQty(h.grams, 3)} g${h.unitAed ? ` × ${h.unitAed.toFixed(2)}` : ''}`;
}

function PriceNotes({ prices, gold }) {
  if (!prices) return null;
  const failed = Object.keys(prices.errors || {});
  return (
    <p className="px-1 text-xs leading-relaxed fin-muted">
      Prices{prices.at ? ` checked ${relative(prices.at)}` : ''}: DFM last traded prices, crypto from CoinGecko, currencies from open.er-api.com,
      gold {gold?.source === 'malabar' ? `from Malabar UAE (sent by your iPhone ${relative(gold.updated)})` : 'at spot until the iPhone Shortcut sends Malabar’s UAE rate'}.
      {failed.length > 0 && <span style={{ color: 'var(--fin-warn)' }}> Unavailable right now: {failed.join(', ')}.</span>}
    </p>
  );
}

// ---------- add / edit ----------
function HoldingSheet({ holding, prices, onClose, onSave, onDelete }) {
  const kind = holding.asset;
  const [form, setForm] = useState({
    name: holding.name || '',
    currency: holding.currency || 'AED',
    symbol: holding.symbol || (kind === 'crypto' ? 'SOL' : ''),
    quantity: holding.quantity ?? '',
    karat: holding.karat || 24,
    grams: holding.grams ?? '',
    cost_aed: holding.cost_aed ?? '',
    note: holding.note || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const symbols = useMemo(() => Object.keys(prices?.stocks || {}).sort(), [prices]);
  const sym = String(form.symbol).trim().toUpperCase();
  const quote = kind === 'stock' ? prices?.stocks?.[sym] : null;

  const submit = async (e) => {
    e.preventDefault();
    const num = (x) => (x === '' || x == null ? null : Number(x));
    let row;
    if (kind === 'cash') {
      if (!form.name.trim()) return setErr('Name the account');
      if (num(form.quantity) == null || Number.isNaN(num(form.quantity))) return setErr('Enter the balance');
      row = { asset: 'cash', name: form.name.trim(), currency: form.currency, quantity: num(form.quantity) };
    } else if (kind === 'stock' || kind === 'crypto') {
      if (!sym) return setErr('Enter a symbol');
      if (!(num(form.quantity) > 0)) return setErr(kind === 'stock' ? 'Enter how many shares' : 'Enter how much you hold');
      if (kind === 'stock' && symbols.length && !prices.stocks[sym]) return setErr(`${sym} isn't a DFM symbol with a price today`);
      row = { asset: kind, symbol: sym, quantity: num(form.quantity), cost_aed: num(form.cost_aed) };
    } else {
      if (!(num(form.grams) > 0)) return setErr('Enter how many grams');
      row = { asset: 'gold', karat: Number(form.karat), grams: num(form.grams), cost_aed: num(form.cost_aed), note: form.note.trim() || null };
    }
    setBusy(true);
    setErr(null);
    try {
      await onSave(row);
    } catch (x) {
      setErr(/check constraint|column|schema cache/.test(x.message) ? 'Run the portfolio migration first (see the note at the top).' : x.message);
      setBusy(false);
    }
  };

  const heading = `${holding.id ? 'Edit' : 'Add'} ${{ cash: 'bank account', stock: 'DFM stock', crypto: 'crypto', gold: 'gold' }[kind]}`;
  return (
    <div className="fin-sheet-backdrop fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="fin-card fin-sheet max-h-[92vh] w-full max-w-md overflow-y-auto rounded-b-none p-5 pb-[calc(20px+env(safe-area-inset-bottom))] sm:rounded-b-[16px] sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="fin-h2">{heading}</h2>
          <button type="button" className="fin-btn fin-btn-ghost fin-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="grid gap-4">
          {kind === 'cash' && (
            <>
              <Field label="Bank or account"><input className="fin-input" value={form.name} onChange={set('name')} placeholder="Mashreq current account" autoFocus /></Field>
              <div className="grid grid-cols-[110px_1fr] gap-3">
                <Field label="Currency">
                  <select className="fin-select" value={form.currency} onChange={set('currency')}>{CASH_CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
                </Field>
                <Field label="Balance"><input className="fin-input fin-num" type="number" inputMode="decimal" step="0.01" value={form.quantity} onChange={set('quantity')} placeholder="0.00" /></Field>
              </div>
            </>
          )}
          {kind === 'stock' && (
            <>
              <Field label="DFM symbol" hint={quote ? `AED ${quote.price.toFixed(2)} · ${quote.changePct >= 0 ? '+' : ''}${quote.changePct.toFixed(2)}% today` : sym && symbols.length ? 'No price for this symbol today' : 'EMAAR, DEWA, SALIK, DIB…'}>
                <input className="fin-input fin-num uppercase" value={form.symbol} onChange={set('symbol')} list="dfm-symbols" placeholder="EMAAR" autoFocus autoCapitalize="characters" />
                <datalist id="dfm-symbols">{symbols.map((s) => <option key={s} value={s} />)}</datalist>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Shares"><input className="fin-input fin-num" type="number" inputMode="decimal" step="1" min="0" value={form.quantity} onChange={set('quantity')} placeholder="100" /></Field>
                <Field label="Paid in total" hint="AED, optional"><input className="fin-input fin-num" type="number" inputMode="decimal" step="0.01" min="0" value={form.cost_aed} onChange={set('cost_aed')} /></Field>
              </div>
            </>
          )}
          {kind === 'crypto' && (
            <>
              <Field label="Coin">
                <select className="fin-select" value={form.symbol} onChange={set('symbol')}>{Object.entries(CRYPTO).map(([s, n]) => <option key={s} value={s}>{n} ({s})</option>)}</select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount"><input className="fin-input fin-num" type="number" inputMode="decimal" step="any" min="0" value={form.quantity} onChange={set('quantity')} placeholder="4.5" autoFocus /></Field>
                <Field label="Paid in total" hint="AED, optional"><input className="fin-input fin-num" type="number" inputMode="decimal" step="0.01" min="0" value={form.cost_aed} onChange={set('cost_aed')} /></Field>
              </div>
            </>
          )}
          {kind === 'gold' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Grams"><input className="fin-input fin-num" type="number" inputMode="decimal" step="0.001" min="0" value={form.grams} onChange={set('grams')} placeholder="20" autoFocus /></Field>
                <Field label="Karat"><select className="fin-select" value={form.karat} onChange={set('karat')}>{KARATS.map((k) => <option key={k} value={k}>{k}K</option>)}</select></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Paid in total" hint="AED, optional"><input className="fin-input fin-num" type="number" inputMode="decimal" step="0.01" min="0" value={form.cost_aed} onChange={set('cost_aed')} /></Field>
                <Field label="Note" hint="optional"><input className="fin-input" value={form.note} onChange={set('note')} placeholder="Bar, coin…" maxLength={60} /></Field>
              </div>
            </>
          )}
        </div>

        {err && <p className="mt-4 text-sm" style={{ color: 'var(--fin-bad)' }}>{err}</p>}
        <div className="mt-6 flex items-center gap-2">
          <button className="fin-btn fin-btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          <button type="button" className="fin-btn fin-btn-ghost" onClick={onClose}>Cancel</button>
          {onDelete && (
            <button type="button" className="fin-btn fin-btn-ghost fin-btn-danger ml-auto" onClick={() => window.confirm('Remove this holding?') && onDelete()}><Trash2 size={15} /> Remove</button>
          )}
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="fin-label">{label}{hint && <span className="ml-1.5 font-normal fin-muted">{hint}</span>}</span>
      {children}
    </label>
  );
}
