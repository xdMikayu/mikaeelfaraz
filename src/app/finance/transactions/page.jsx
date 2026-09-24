'use client';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Upload, Download, Inbox, Search, X, ChevronDown } from 'lucide-react';
import { useFinance, LoadingState } from '../_components/FinanceShell';
import TransactionEditor from '../_components/TransactionEditor';
import { CategoryAvatar } from '../_components/icons';
import { aed, dateTime } from '../_components/format';
import { CATEGORIES, UNCATEGORIZED } from '@/lib/finance/categories.mjs';
import { PERIODS, getPeriod } from '@/lib/finance/periods.mjs';
import { inRange, spendOf } from '@/lib/finance/analytics.mjs';
import { accountColorVar } from '@/lib/finance/accounts.mjs';
import { dubaiParts, dubaiDate, splitPastedMessages } from '@/lib/finance/parse.mjs';

const SOURCE_LABEL = { sms: 'SMS', email: 'Email', wallet: 'Wallet', alert: 'Tabby alert', manual: 'Manual', import: 'Import', text: 'Text', statement: 'Statement' };
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayLabel(iso) {
  const p = dubaiParts(iso);
  const t = dubaiParts(new Date());
  const today = dubaiDate(t.y, t.m, t.d).getTime();
  const that = dubaiDate(p.y, p.m, p.d).getTime();
  const diff = Math.round((today - that) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${DAY[p.dow]}, ${p.d} ${MON[p.m]}${p.y !== t.y ? ` ${p.y}` : ''}`;
}

function hhmm(iso) {
  const p = dubaiParts(iso);
  return `${String(p.hh).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`;
}

export default function Transactions() {
  const f = useFinance();
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [account, setAccount] = useState('');
  const [category, setCategory] = useState(params.get('category') || '');
  const [periodKey, setPeriodKey] = useState(params.get('period') || 'all');
  const [editing, setEditing] = useState(null); // tx | 'new' | null
  const [showImport, setShowImport] = useState(false);
  const [limit, setLimit] = useState(120);

  const accountById = useMemo(() => new Map(f.accounts.map((a) => [a.id, a])), [f.accounts]);
  const rows = useMemo(() => {
    const period = periodKey === 'all' ? null : getPeriod(periodKey);
    const needle = q.trim().toLowerCase();
    return f.transactions.filter((t) => {
      if (period && !inRange(t, period.start, period.end)) return false;
      if (account && t.account_id !== account) return false;
      if (category === UNCATEGORIZED ? t.category : category && t.category !== category) return false;
      if (needle && !`${t.merchant} ${t.merchant_raw} ${t.notes || ''} ${t.amount}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [f.transactions, q, account, category, periodKey]);
  const total = rows.reduce((s, t) => s + spendOf(t), 0);

  const groups = useMemo(() => {
    const out = [];
    for (const t of rows.slice(0, limit)) {
      const label = dayLabel(t.occurred_at);
      if (!out.length || out[out.length - 1].label !== label) out.push({ label, items: [], total: 0 });
      const g = out[out.length - 1];
      g.items.push(t);
      g.total += spendOf(t);
    }
    return out;
  }, [rows, limit]);

  const filtered = q || account || category || periodKey !== 'all';

  const exportCsv = () => {
    const head = ['date', 'card', 'merchant', 'category', 'amount', 'currency', 'amount_aed', 'type', 'available_balance', 'source', 'notes'];
    const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const lines = rows.map((t) => [t.occurred_at, accountById.get(t.account_id)?.name, t.merchant, t.category, t.amount, t.currency, t.amount_aed, t.direction, t.available_balance, (t.sources || [t.source]).join('+'), t.notes].map(esc).join(','));
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (f.loading) return <LoadingState />;

  return (
    <div className="fin-fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="fin-eyebrow">{rows.length} transactions{filtered ? ' · filtered' : ''}</p>
          <h1 className="fin-h1 mt-1">Activity</h1>
          <p className="fin-num mt-1 text-sm fin-ink-2">{aed(total)} total</p>
        </div>
        <div className="flex gap-2">
          <button className="fin-btn fin-icon-btn sm:w-auto sm:px-3.5" onClick={() => setShowImport((v) => !v)} aria-label="Import"><Upload size={15} /><span className="hidden sm:inline">Import</span></button>
          <button className="fin-btn fin-icon-btn sm:w-auto sm:px-3.5" onClick={exportCsv} aria-label="Export CSV"><Download size={15} /><span className="hidden sm:inline">Export</span></button>
          <button className="fin-btn fin-btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Add</button>
        </div>
      </div>

      {showImport && <ImportPanel onDone={() => f.reload()} onClose={() => setShowImport(false)} />}
      {f.rawEvents.length > 0 && <UnreadInbox />}

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 fin-muted" />
          <input className="fin-input" style={{ paddingLeft: 42, height: 46, borderRadius: 999 }} placeholder="Search merchants, notes or amounts" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 fin-muted" onClick={() => setQ('')} aria-label="Clear search"><X size={16} /></button>
          )}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" style={{ scrollbarWidth: 'none' }}>
          <button className="fin-chipbtn" aria-pressed={!account} onClick={() => setAccount('')}>All cards</button>
          {f.accounts.map((a) => (
            <button key={a.id} className="fin-chipbtn" aria-pressed={account === a.id} onClick={() => setAccount(account === a.id ? '' : a.id)}>
              <span className="fin-dot" style={{ background: accountColorVar(a.slug, f.accounts) }} />{a.name}
            </button>
          ))}
          <SelectChip value={category} onChange={setCategory} label={category || 'Category'} active={!!category}>
            <option value="">All categories</option>
            <option value={UNCATEGORIZED}>{UNCATEGORIZED}</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </SelectChip>
          <SelectChip value={periodKey} onChange={setPeriodKey} label={periodKey === 'all' ? 'All time' : PERIODS.find((p) => p.key === periodKey)?.label} active={periodKey !== 'all'}>
            <option value="all">All time (24 months)</option>
            {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </SelectChip>
          {filtered && (
            <button className="fin-chipbtn" onClick={() => { setQ(''); setAccount(''); setCategory(''); setPeriodKey('all'); }}>
              <X size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Feed */}
      {rows.length === 0 ? (
        <div className="fin-card px-6 py-14 text-center">
          <p className="text-sm font-medium">No transactions match</p>
          <p className="mt-1 text-sm fin-muted">Try clearing filters, or add one manually.</p>
        </div>
      ) : (
        <div>
          {groups.map((g) => (
            <section key={g.label} className="mb-2">
              <div className="fin-day">
                <span>{g.label}</span>
                <span className="fin-num">{aed(g.total, { decimals: 0 })}</span>
              </div>
              <div className="fin-card px-4 py-1.5 sm:px-5">
                <ul>
                  {g.items.map((t, i) => {
                    const a = accountById.get(t.account_id);
                    return (
                      <li key={t.id} className={i ? 'border-t fin-divider' : ''}>
                        <button className="fin-row" style={{ opacity: t.excluded ? 0.5 : 1 }} onClick={() => setEditing(t)}>
                          <span className="relative">
                            <CategoryAvatar category={t.category} />
                            <span className="fin-dot absolute -bottom-0.5 -right-0.5" style={{ background: accountColorVar(a?.slug, f.accounts), boxShadow: '0 0 0 2px var(--fin-surface)' }} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14.5px] font-medium">{t.merchant}</span>
                            <span className="block truncate text-xs fin-muted">
                              {t.category || UNCATEGORIZED}{t.category_source === 'ai' ? ' ✦' : ''} · {a?.name} · {hhmm(t.occurred_at)}
                              <span className="hidden sm:inline"> · {(t.sources || [t.source]).map((s) => SOURCE_LABEL[s] || s).join(' + ')}</span>
                              {t.excluded ? ' · excluded' : ''}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="fin-num block text-[14.5px] font-semibold" style={t.direction === 'credit' ? { color: 'var(--fin-good)' } : undefined}>
                              {t.direction === 'credit' ? '+' : '−'}{Number(t.amount_aed).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {t.currency !== 'AED' ? (
                              <span className="fin-num block text-xs fin-muted">{t.currency} {Number(t.amount).toFixed(2)}{t.fx_estimated ? ' ≈' : ''}</span>
                            ) : t.available_balance != null ? (
                              <span className="fin-num hidden text-xs fin-muted sm:block">{aed(t.available_balance, { decimals: 0 })} left</span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          ))}
          {rows.length > limit && (
            <div className="pt-3 text-center">
              <button className="fin-btn" onClick={() => setLimit((l) => l + 200)}>Show more</button>
            </div>
          )}
        </div>
      )}
      {editing && <TransactionEditor tx={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/** A filter chip that opens a native select (great on phones). */
function SelectChip({ value, onChange, label, active, children }) {
  return (
    <label className="fin-chipbtn relative cursor-pointer" data-active={active}>
      {label} <ChevronDown size={13} />
      <select className="absolute inset-0 cursor-pointer opacity-0" value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}

/** Paste old SMS / emails to backfill history. Goes through the same parser as live alerts. */
function ImportPanel({ onDone, onClose }) {
  const f = useFinance();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const messages = splitPastedMessages(text);

  const run = async () => {
    setBusy(true);
    setResult(null);
    const totals = { parsed: 0, merged: 0, duplicate: 0, ignored: 0, unparsed: 0, errors: 0 };
    try {
      // Small batches: each message takes a few DB round-trips and Netlify stops a function after ~10s.
      for (let i = 0; i < messages.length; i += 5) {
        const r = await f.api('ingest', { events: messages.slice(i, i + 5).map((m) => ({ source: 'import', text: m })) });
        for (const k of Object.keys(totals)) totals[k] += r[k] || 0;
      }
      setResult(totals);
      setText('');
      onDone();
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="fin-card fin-fade-in space-y-4 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="fin-h2">Import history</h2>
          <p className="mt-0.5 text-sm fin-ink-2">Paste old SIB texts, Mashreq emails or Tabby alerts — as many as you like. Duplicates are skipped.</p>
        </div>
        <button className="fin-btn fin-btn-ghost fin-icon-btn" onClick={onClose} aria-label="Close import"><X size={16} /></button>
      </div>
      <textarea className="fin-textarea" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="A txn on your Card XXXX…" />
      <div className="flex flex-wrap items-center gap-3">
        <button className="fin-btn fin-btn-primary" disabled={!messages.length || busy} onClick={run}>
          {busy ? 'Importing…' : `Import ${messages.length || ''} message${messages.length === 1 ? '' : 's'}`}
        </button>
        {result && (
          <span className="text-sm fin-ink-2">
            {result.error ? <span style={{ color: 'var(--fin-bad)' }}>{result.error}</span> :
              `${result.parsed} added · ${result.duplicate + result.merged} already there · ${result.ignored} skipped · ${result.unparsed} unreadable`}
          </span>
        )}
      </div>
    </section>
  );
}

/** Messages that reached the endpoint but weren't recognised — nothing is silently lost. */
function UnreadInbox() {
  const f = useFinance();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(null); // raw event being turned into a transaction
  const tabby = f.accounts.find((a) => a.slug === 'tabby');
  const isBlankAlert = (r) => r.source === 'alert' && !['text', 'title', 'subtitle', 'body'].some((k) => String(r.payload?.[k] ?? '').trim());
  const [retrying, setRetrying] = useState(null);
  const [notes, setNotes] = useState({}); // raw id → why a retry still failed
  const dismiss = async (id) => {
    if (!f.demo) await f.supabase.from('fin_raw_events').update({ status: 'dismissed' }).eq('id', id);
    f.setData((d) => ({ ...d, rawEvents: d.rawEvents.filter((r) => r.id !== id) }));
  };
  const textOf = (r) => r.payload?.text || [r.payload?.title, r.payload?.subtitle, r.payload?.body].filter(Boolean).join(' · ') || JSON.stringify(r.payload);
  // Run a stored message through the parser again (e.g. after a new format was added).
  const retry = async (r) => {
    setRetrying(r.id);
    try {
      const { external_id: _drop, ...payload } = r.payload || {};
      const res = await f.api('ingest', { events: [{ ...payload, source: r.source, received_at: r.received_at, external_id: `retry:${r.id}:${Date.now()}` }] });
      const out = res.results?.[0] || {};
      if (['parsed', 'merged', 'duplicate'].includes(out.status)) {
        await dismiss(r.id);
        f.reload();
      } else {
        setNotes((n) => ({ ...n, [r.id]: out.reason || 'Still not recognised' }));
      }
    } catch (e) {
      setNotes((n) => ({ ...n, [r.id]: e.message }));
    } finally {
      setRetrying(null);
    }
  };
  return (
    <section className="fin-card overflow-hidden">
      <button className="flex w-full items-center gap-3 px-5 py-4 text-left" onClick={() => setOpen((o) => !o)}>
        <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: 'var(--fin-bad-soft)', color: 'var(--fin-bad)' }}><Inbox size={17} /></span>
        <span className="flex-1">
          <span className="block text-sm font-semibold">{f.rawEvents.length} message{f.rawEvents.length === 1 ? ' needs' : 's need'} a look</span>
          <span className="block text-xs fin-muted">Alerts that arrived but couldn’t be read</span>
        </span>
        <ChevronDown size={16} className="fin-muted transition-transform" style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open && (
        <ul className="space-y-2 px-5 pb-5">
          {f.rawEvents.map((r) => (
            <li key={r.id} className="fin-inset p-3.5">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs fin-muted">
                <span>{dateTime(r.received_at)} · {r.source}</span>
                <span className="flex gap-2">
                  {isBlankAlert(r) && tabby && <button className="fin-btn fin-btn-sm" onClick={() => setAdding(r)}>Add details</button>}
                  {!isBlankAlert(r) && !f.demo && (
                    <button className="fin-btn fin-btn-sm" disabled={retrying === r.id} onClick={() => retry(r)}>{retrying === r.id ? 'Trying…' : 'Try again'}</button>
                  )}
                  <button className="fin-btn fin-btn-ghost fin-btn-sm" onClick={() => dismiss(r.id)}>Dismiss</button>
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm">
                {isBlankAlert(r) ? 'A Tabby notification arrived but iOS didn’t pass its text. If it was a purchase, tap “Add details”.' : textOf(r)}
              </p>
              {!isBlankAlert(r) && (notes[r.id] || r.reason) && <p className="mt-1 text-xs fin-muted">{notes[r.id] || r.reason}</p>}
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <TransactionEditor
          tx={null}
          preset={{ account_id: tabby.id, occurred_at: adding.received_at, notes: 'From a blank Tabby notification' }}
          onSaved={() => dismiss(adding.id)}
          onClose={() => setAdding(null)}
        />
      )}
    </section>
  );
}
