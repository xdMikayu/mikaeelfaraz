'use client';
import { useCallback, useEffect, useState } from 'react';
import { Coins, ChartCandlestick, Bitcoin, TrendingUp, TrendingDown, Plus, Trash2 } from 'lucide-react';
import { useFinance } from '../_components/FinanceShell';
import { aed, relative, dateShort } from '../_components/format';
import { KARATS, valueHoldings } from '@/lib/finance/gold.mjs';

const PLANNED = [
  { name: 'DFM stocks', icon: ChartCandlestick, detail: 'Dubai Financial Market holdings (EMAAR, DEWA, SALIK, …) with daily price and P/L.' },
  { name: 'Crypto', icon: Bitcoin, detail: 'Solana first — balance × live SOL/USD, shown in USD and AED.' },
];

const DEMO_HOLDINGS = [{ id: 'demo-gold', asset: 'gold', karat: 24, grams: 20, cost_aed: 9200, bought_on: '2025-11-02', note: 'Bar' }];

const money = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const grams = (n) => `${Number(n).toLocaleString('en-US', { maximumFractionDigits: 3 })} g`;

export default function Portfolio() {
  return (
    <div className="space-y-6 fin-fade-in">
      <div>
        <p className="fin-eyebrow">Net worth</p>
        <h1 className="fin-h1 mt-1">Portfolio</h1>
        <p className="mt-2 max-w-xl text-sm fin-ink-2">Your gold at today&apos;s rate, with UAE stocks and crypto to follow.</p>
      </div>
      <Gold />
      <Solana />
      <div className="grid gap-4 sm:grid-cols-2">
        {PLANNED.map(({ name, icon: Icon, detail }) => (
          <div key={name} className="fin-card p-5">
            <div className="flex items-center justify-between">
              <span className="fin-avatar"><Icon size={18} /></span>
              <span className="fin-pill fin-pill-neutral">Coming soon</span>
            </div>
            <h2 className="fin-h2 mt-4">{name}</h2>
            <p className="mt-1 text-sm fin-ink-2">{detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Malabar's UAE rate as last sent in by the iPhone Shortcut; it's only used while fresh.
const MALABAR_FRESH_MS = 36 * 60 * 60 * 1000;

function useGoldPrice() {
  const f = useFinance();
  const [price, setPrice] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!f.demo) {
        const { data } = await f.supabase.from('fin_prices').select('per_gram, quoted_at, fetched_at').eq('asset', 'gold').eq('source', 'malabar').maybeSingle();
        if (data && Date.now() - new Date(data.fetched_at).getTime() < MALABAR_FRESH_MS) {
          if (!cancelled) setPrice({ source: 'malabar', perGram: data.per_gram, updated: data.quoted_at || data.fetched_at });
          return;
        }
      }
      const r = await fetch('/api/finance/gold');
      const j = r.ok ? await r.json() : null;
      if (cancelled) return;
      if (j?.perGram) setPrice(j);
      else setFailed(true);
    })().catch(() => !cancelled && setFailed(true));
    return () => { cancelled = true; };
  }, [f.demo, f.supabase]);
  return { price, failed };
}

function useHoldings() {
  const f = useFinance();
  const [holdings, setHoldings] = useState(f.demo ? DEMO_HOLDINGS : null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    if (f.demo) return;
    const { data, error: e } = await f.supabase.from('fin_holdings').select('*').eq('asset', 'gold').order('created_at');
    if (e) setError(/fin_holdings/.test(e.message) ? 'missing' : e.message);
    else { setError(null); setHoldings(data); }
  }, [f.demo, f.supabase]);
  useEffect(() => { load(); }, [load]);

  const add = async (row) => {
    if (f.demo) return setHoldings((h) => [...h, { ...row, id: `demo-${Date.now()}` }]);
    const { error: e } = await f.supabase.from('fin_holdings').insert({ asset: 'gold', ...row });
    if (e) throw e;
    await load();
  };
  const remove = async (id) => {
    if (f.demo) return setHoldings((h) => h.filter((x) => x.id !== id));
    const { error: e } = await f.supabase.from('fin_holdings').delete().eq('id', id);
    if (e) throw e;
    await load();
  };
  return { holdings, error, add, remove };
}

function Gold() {
  const { price, failed } = useGoldPrice();
  const { holdings, error, add, remove } = useHoldings();
  const [adding, setAdding] = useState(false);
  const v = holdings && price ? valueHoldings(holdings, price.perGram) : null;
  const up = v?.gain != null && v.gain >= 0;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <section className="fin-card fin-card-hero p-6 sm:p-7 lg:col-span-2"
        style={{ '--fin-glow': 'radial-gradient(90% 120% at 0% 0%, color-mix(in srgb, var(--fin-gold) 20%, transparent), transparent 60%)', borderColor: 'color-mix(in srgb, var(--fin-gold) 28%, var(--fin-border))' }}>
        <div className="flex items-center justify-between gap-3">
          <p className="fin-eyebrow flex items-center gap-2"><Coins size={14} style={{ color: 'var(--fin-gold)' }} /> Your gold</p>
          {holdings?.length > 0 && v && <span className="text-xs fin-muted">{grams(v.grams)}{v.pureGrams !== v.grams ? ` · ${grams(v.pureGrams)} pure` : ''}</span>}
        </div>

        {error === 'missing' ? (
          <p className="mt-4 text-sm fin-ink-2">One-time setup: run <code>supabase/migrations/20260925000000_holdings.sql</code> in the Supabase SQL editor, then reload.</p>
        ) : error ? (
          <p className="mt-4 text-sm" style={{ color: 'var(--fin-bad)' }}>{error}</p>
        ) : !holdings || (!price && !failed) ? (
          <div className="fin-skeleton mt-4 h-14 w-60" />
        ) : holdings.length === 0 ? (
          !adding && (
            <div className="mt-4">
              <p className="text-sm fin-ink-2">Add the gold you own and see what it&apos;s worth at today&apos;s rate.</p>
              <button className="fin-btn fin-btn-primary mt-4" onClick={() => setAdding(true)}><Plus size={16} /> Add gold</button>
            </div>
          )
        ) : (
          <>
            <p className="fin-hero-num fin-num mt-4"><span className="fin-cur">AED</span>{v ? Math.round(v.value).toLocaleString('en-US') : '—'}</p>
            {v?.gain != null && (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm fin-ink-2">
                <span className={`fin-pill ${up ? 'fin-pill-good' : 'fin-pill-bad'}`}>
                  {up ? <TrendingUp size={13} strokeWidth={2.4} /> : <TrendingDown size={13} strokeWidth={2.4} />}
                  {aed(v.gain, { decimals: 0, sign: true })}
                </span>
                {v.cost > 0 && <span>{`${v.gain >= 0 ? '+' : '−'}${Math.abs((v.gain / v.cost) * 100).toFixed(1)}% on ${aed(v.cost, { decimals: 0 })} paid`}</span>}
              </div>
            )}

            <ul className="mt-6 space-y-2">
              {(v?.rows || holdings).map((h) => (
                <li key={h.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 fin-inset">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold" style={{ background: 'color-mix(in srgb, var(--fin-gold) 16%, transparent)', color: 'var(--fin-gold)' }}>{h.karat}K</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{grams(h.grams)}{h.note ? ` · ${h.note}` : ''}</p>
                    <p className="text-xs fin-muted">{h.cost ? `Paid ${aed(h.cost, { decimals: 0 })}` : 'No price paid'}{h.bought_on ? ` · ${dateShort(h.bought_on)}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="fin-num text-sm font-semibold">{h.value != null ? aed(h.value, { decimals: 0 }) : '—'}</p>
                    {h.gain != null && <p className="fin-num text-xs" style={{ color: h.gain >= 0 ? 'var(--fin-good)' : 'var(--fin-bad)' }}>{aed(h.gain, { decimals: 0, sign: true })}</p>}
                  </div>
                  <button className="fin-btn fin-btn-ghost fin-icon-btn fin-btn-danger" aria-label="Remove" onClick={() => window.confirm('Remove this gold?') && remove(h.id)}><Trash2 size={15} /></button>
                </li>
              ))}
            </ul>
            {!adding && <button className="fin-btn fin-btn-sm mt-3" onClick={() => setAdding(true)}><Plus size={14} /> Add gold</button>}
          </>
        )}
        {adding && <AddGold onCancel={() => setAdding(false)} onSave={async (row) => { await add(row); setAdding(false); }} price={price} />}
      </section>

      <section className="fin-card p-6">
        <p className="fin-eyebrow">Today · per gram</p>
        {price ? (
          <>
            <p className="fin-num mt-3 text-3xl font-semibold tracking-tight">{aed(price.perGram[24])}</p>
            <p className="text-xs fin-muted">24K</p>
            <dl className="mt-5 space-y-2.5">
              {KARATS.filter((k) => k !== 24).map((k) => (
                <div key={k} className="flex justify-between text-sm">
                  <dt className="fin-ink-2">{k}K</dt>
                  <dd className="fin-num font-semibold">{aed(price.perGram[k])}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-[11px] leading-relaxed fin-muted">
              {price.source === 'malabar'
                ? `Malabar Gold UAE rate${price.updated ? ` · updated ${relative(price.updated)}` : ''}`
                : `Live spot price${price.usdPerOunce ? ` ($${money(price.usdPerOunce)}/oz)` : ''}, updated ${relative(price.updated)}. Malabar's UAE rate shows here once the iPhone Shortcut has sent it.`}
            </p>
          </>
        ) : failed ? (
          <p className="mt-3 text-sm fin-muted">Gold price unavailable right now.</p>
        ) : (
          <div className="fin-skeleton mt-3 h-10 w-40" />
        )}
      </section>
    </div>
  );
}

function AddGold({ onSave, onCancel, price }) {
  const [form, setForm] = useState({ grams: '', karat: 24, cost_aed: '', bought_on: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const g = Number(form.grams);
  const worth = g > 0 && price ? g * price.perGram[form.karat] : null;
  const submit = async (e) => {
    e.preventDefault();
    if (!(g > 0)) return setErr('Enter how many grams');
    setBusy(true);
    setErr(null);
    try {
      await onSave({
        grams: g,
        karat: Number(form.karat),
        cost_aed: form.cost_aed === '' ? null : Number(form.cost_aed),
        bought_on: form.bought_on || null,
        note: form.note.trim() || null,
      });
    } catch (x) {
      setErr(x.message || String(x));
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="mt-5 rounded-2xl p-4 fin-inset">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="fin-label" htmlFor="g-grams">Grams</label>
          <input id="g-grams" className="fin-input fin-num" type="number" inputMode="decimal" step="0.001" min="0" value={form.grams} onChange={set('grams')} placeholder="20" autoFocus />
        </div>
        <div>
          <label className="fin-label" htmlFor="g-karat">Karat</label>
          <select id="g-karat" className="fin-select" value={form.karat} onChange={set('karat')}>
            {KARATS.map((k) => <option key={k} value={k}>{k}K</option>)}
          </select>
        </div>
        <div>
          <label className="fin-label" htmlFor="g-cost">Paid in total (AED, optional)</label>
          <input id="g-cost" className="fin-input fin-num" type="number" inputMode="decimal" step="0.01" min="0" value={form.cost_aed} onChange={set('cost_aed')} placeholder="For gain / loss" />
        </div>
        <div>
          <label className="fin-label" htmlFor="g-date">Bought on (optional)</label>
          <input id="g-date" className="fin-input" type="date" value={form.bought_on} onChange={set('bought_on')} />
        </div>
        <div className="sm:col-span-2">
          <label className="fin-label" htmlFor="g-note">Note (optional)</label>
          <input id="g-note" className="fin-input" value={form.note} onChange={set('note')} placeholder="Bar, coin, chain…" maxLength={60} />
        </div>
      </div>
      {err && <p className="mt-3 text-sm" style={{ color: 'var(--fin-bad)' }}>{err}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button className="fin-btn fin-btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" className="fin-btn fin-btn-ghost" onClick={onCancel}>Cancel</button>
        {worth != null && <span className="ml-auto text-sm fin-muted">Worth {aed(worth, { decimals: 0 })} today</span>}
      </div>
    </form>
  );
}

function Solana() {
  const [sol, setSol] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    // Free public endpoint; a small preview of what the crypto tracker will pull.
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd,aed&include_24hr_change=true')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.solana ? setSol(j.solana) : setFailed(true)))
      .catch(() => setFailed(true));
  }, []);
  const up = sol?.usd_24h_change >= 0;
  return (
    <div className="fin-card p-6">
      <p className="fin-eyebrow">Live preview · Solana</p>
      {sol ? (
        <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
          <p className="fin-num text-3xl font-semibold tracking-tight">${money(sol.usd)}</p>
          {sol.usd_24h_change != null && (
            <span className={`fin-pill ${up ? 'fin-pill-good' : 'fin-pill-bad'} mb-1`}>
              {up ? <TrendingUp size={13} strokeWidth={2.4} /> : <TrendingDown size={13} strokeWidth={2.4} />}
              {Math.abs(sol.usd_24h_change).toFixed(1)}% · 24h
            </span>
          )}
          <p className="mb-1 text-sm fin-muted">AED {money(sol.aed)} per SOL</p>
        </div>
      ) : failed ? (
        <p className="mt-3 text-sm fin-muted">Price unavailable right now.</p>
      ) : (
        <div className="fin-skeleton mt-3 h-9 w-48" />
      )}
    </div>
  );
}
