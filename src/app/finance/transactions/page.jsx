'use client';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Upload, Download, Inbox } from 'lucide-react';
import { useFinance } from '../_components/FinanceShell';
import TransactionEditor from '../_components/TransactionEditor';
import { aed, dateTime } from '../_components/format';
import { CATEGORIES, UNCATEGORIZED } from '@/lib/finance/categories.mjs';
import { PERIODS, getPeriod } from '@/lib/finance/periods.mjs';
import { inRange, spendOf } from '@/lib/finance/analytics.mjs';
import { accountColorVar } from '@/lib/finance/accounts.mjs';
import { splitPastedMessages } from '@/lib/finance/parse.mjs';

const SOURCE_LABEL = { sms: 'SMS', email: 'Email', wallet: 'Wallet', manual: 'Manual', import: 'Import', text: 'Text' };

export default function Transactions() {
  const f = useFinance();
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [account, setAccount] = useState('');
  const [category, setCategory] = useState(params.get('category') || '');
  const [periodKey, setPeriodKey] = useState(params.get('period') || 'all');
  const [editing, setEditing] = useState(null); // tx | 'new' | null
  const [showImport, setShowImport] = useState(false);
  const [limit, setLimit] = useState(100);

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

  if (f.loading) return <p className="fin-muted">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Transactions</h1>
        <div className="flex flex-wrap gap-2">
          <button className="fin-btn" onClick={() => setShowImport((v) => !v)}><Upload size={15} /> Import</button>
          <button className="fin-btn" onClick={exportCsv}><Download size={15} /> CSV</button>
          <button className="fin-btn fin-btn-primary" onClick={() => setEditing('new')}><Plus size={15} /> Add</button>
        </div>
      </div>

      {showImport && <ImportPanel onDone={() => f.reload()} />}
      {f.rawEvents.length > 0 && <UnreadInbox />}

      <div className="grid gap-2 sm:grid-cols-4">
        <input className="fin-input" placeholder="Search merchant, note, amount" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="fin-select" value={account} onChange={(e) => setAccount(e.target.value)}>
          <option value="">All cards</option>
          {f.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className="fin-select" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          <option value={UNCATEGORIZED}>{UNCATEGORIZED}</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="fin-select" value={periodKey} onChange={(e) => setPeriodKey(e.target.value)}>
          <option value="all">All time (24 months)</option>
          {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>

      <p className="text-sm fin-ink-2">{rows.length} transactions · <span className="fin-num font-medium" style={{ color: 'var(--fin-ink)' }}>{aed(total)}</span></p>

      <div className="fin-card overflow-x-auto">
        <table className="fin-table">
          <thead>
            <tr><th>Date</th><th>Merchant</th><th className="hidden sm:table-cell">Category</th><th className="hidden md:table-cell">Card</th><th className="text-right">Amount</th><th className="hidden md:table-cell text-right">Available</th></tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((t) => {
              const a = accountById.get(t.account_id);
              return (
                <tr key={t.id} onClick={() => setEditing(t)} style={{ opacity: t.excluded ? 0.5 : 1 }}>
                  <td className="whitespace-nowrap fin-ink-2 fin-num">{dateTime(t.occurred_at)}</td>
                  <td className="max-w-[220px]">
                    <span className="block truncate">{t.merchant}</span>
                    <span className="block text-xs fin-muted sm:hidden">{t.category || UNCATEGORIZED}</span>
                    <span className="block text-xs fin-muted">{(t.sources || [t.source]).map((s) => SOURCE_LABEL[s] || s).join(' + ')}{t.excluded ? ' · excluded' : ''}{t.notes ? ` · ${t.notes}` : ''}</span>
                  </td>
                  <td className="hidden sm:table-cell">
                    <span style={{ color: t.category ? 'var(--fin-ink)' : 'var(--fin-muted)' }}>{t.category || UNCATEGORIZED}</span>
                    {t.category_source === 'ai' && <span className="ml-1 text-xs fin-muted" title="Categorized by Claude">✦</span>}
                  </td>
                  <td className="hidden md:table-cell"><span className="fin-chip"><span className="fin-dot" style={{ background: accountColorVar(a?.slug, f.accounts) }} />{a?.name}</span></td>
                  <td className="whitespace-nowrap text-right fin-num font-medium">
                    {t.direction === 'credit' ? '+' : ''}{aed(t.amount_aed)}
                    {t.currency !== 'AED' && <span className="block text-xs fin-muted">{t.currency} {Number(t.amount).toFixed(2)}{t.fx_estimated ? ' ≈' : ''}</span>}
                  </td>
                  <td className="hidden md:table-cell text-right fin-num fin-ink-2">{t.available_balance != null ? aed(t.available_balance, { decimals: 0 }) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-center text-sm fin-muted">No transactions match.</p>}
      </div>
      {rows.length > limit && <button className="fin-btn" onClick={() => setLimit((l) => l + 200)}>Show more</button>}
      {editing && <TransactionEditor tx={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/** Paste old SMS / emails to backfill history. Goes through the same parser as live alerts. */
function ImportPanel({ onDone }) {
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
      for (let i = 0; i < messages.length; i += 25) {
        const r = await f.api('ingest', { events: messages.slice(i, i + 25).map((m) => ({ source: 'import', text: m })) });
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
    <div className="fin-card space-y-3 p-4">
      <p className="text-sm fin-ink-2">
        Paste old SIB SMS messages or Mashreq alert emails (as many as you like — copy them from Messages / Gmail). Duplicates are skipped automatically.
      </p>
      <textarea className="fin-textarea" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="A txn on your Card XXXX…" />
      <div className="flex items-center gap-3">
        <button className="fin-btn fin-btn-primary" disabled={!messages.length || busy} onClick={run}>
          {busy ? 'Importing…' : `Import ${messages.length || ''} message${messages.length === 1 ? '' : 's'}`}
        </button>
        {result && (
          <span className="text-sm fin-ink-2">
            {result.error ? <span style={{ color: 'var(--fin-bad)' }}>{result.error}</span> :
              `${result.parsed} added · ${result.duplicate + result.merged} already there · ${result.ignored} declined · ${result.unparsed} unreadable`}
          </span>
        )}
      </div>
    </div>
  );
}

/** Messages that reached the endpoint but weren't recognised — nothing is silently lost. */
function UnreadInbox() {
  const f = useFinance();
  const [open, setOpen] = useState(false);
  const dismiss = async (id) => {
    if (!f.demo) await f.supabase.from('fin_raw_events').update({ status: 'dismissed' }).eq('id', id);
    f.setData((d) => ({ ...d, rawEvents: d.rawEvents.filter((r) => r.id !== id) }));
  };
  return (
    <div className="fin-card p-4">
      <button className="flex w-full items-center justify-between text-sm" onClick={() => setOpen((o) => !o)}>
        <span className="flex items-center gap-2"><Inbox size={15} /> {f.rawEvents.length} message{f.rawEvents.length === 1 ? '' : 's'} couldn’t be read</span>
        <span className="fin-muted">{open ? 'Hide' : 'Review'}</span>
      </button>
      {open && (
        <ul className="mt-3 space-y-2">
          {f.rawEvents.map((r) => (
            <li key={r.id} className="rounded-lg p-3" style={{ background: 'var(--fin-surface-2)' }}>
              <div className="mb-1 flex justify-between gap-2 text-xs fin-muted">
                <span>{dateTime(r.received_at)} · {r.source} · {r.reason}</span>
                <button className="underline" onClick={() => dismiss(r.id)}>Dismiss</button>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm">{r.payload?.text || JSON.stringify(r.payload)}</p>
            </li>
          ))}
        </ul>
      )}
      {open && <p className="mt-2 text-xs fin-muted">If a real purchase is here, add it with “Add” and send the message format to Claude to extend the parser.</p>}
    </div>
  );
}
