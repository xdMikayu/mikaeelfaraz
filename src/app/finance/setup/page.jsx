'use client';
import { useEffect, useState } from 'react';
import { Copy, Check, Trash2, RefreshCw, MessageSquareText, BellRing, Mail, ChevronDown, CreditCard, Target, Wand2, Activity, FlaskConical, KeyRound } from 'lucide-react';
import { useFinance, LoadingState } from '../_components/FinanceShell';
import { CategoryIcon } from '../_components/icons';
import { CATEGORIES } from '@/lib/finance/categories.mjs';
import { parseEvent } from '@/lib/finance/parse.mjs';
import { accountColorVar } from '@/lib/finance/accounts.mjs';
import { aed, dateTime, relative } from '../_components/format';

const REPO_SCRIPT = 'https://github.com/xdMikayu/mikaeelfaraz/blob/main/integrations/mashreq-gmail.gs';

function CopyText({ value, mono = true }) {
  const [done, setDone] = useState(false);
  return (
    <span className="inline-flex max-w-full items-center gap-1 align-middle">
      <code className={mono ? 'fin-code' : ''}>{value}</code>
      <button
        type="button"
        className="fin-btn fin-btn-ghost h-7 w-7 p-0"
        aria-label="Copy"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        }}
      >
        {done ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </span>
  );
}

function Section({ icon: Icon, title, subtitle, action, children }) {
  return (
    <section className="fin-card p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {Icon && <span className="fin-avatar fin-avatar-sm"><Icon size={15} /></span>}
          <div>
            <h2 className="fin-h2">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs fin-muted">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="space-y-3 text-sm leading-relaxed fin-ink-2">{children}</div>
    </section>
  );
}

function Guide({ icon: Icon, title, status, children, defaultOpen = false }) {
  return (
    <details className="fin-card group overflow-hidden" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="fin-avatar fin-avatar-sm"><Icon size={15} /></span>
        <span className="flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          {status && <span className="block text-xs fin-muted">{status}</span>}
        </span>
        <ChevronDown size={16} className="fin-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-5 pb-5 text-sm leading-relaxed fin-ink-2 sm:px-6">{children}</div>
    </details>
  );
}

export default function Setup() {
  const f = useFinance();
  const [origin, setOrigin] = useState('https://mikaeelfaraz.com');
  useEffect(() => setOrigin(window.location.origin), []);
  const endpoint = `${origin}/api/finance/ingest`;
  if (f.loading) return <LoadingState />;

  return (
    <div className="fin-fade-in space-y-5">
      <div>
        <p className="fin-eyebrow">Connections, cards & rules</p>
        <h1 className="fin-h1 mt-1">Setup</h1>
      </div>

      <ConnectionStatus />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <Guide icon={MessageSquareText} title="SIB — forward bank SMS" status="iPhone Shortcuts · message trigger">
            <ol className="fin-steps mt-1">
              <li>New shortcut → add trigger <b>When I receive a message</b> where <b>Message</b> contains <CopyText value="A txn on your Card" />. Automation on, Notify off.</li>
              <li>Add <b>Get Contents of URL</b> → the endpoint below, Method <b>POST</b>, header <code className="fin-code">Authorization</code> = <code className="fin-code">Bearer YOUR_TOKEN</code>.</li>
              <li>Request Body <b>JSON</b>: <code className="fin-code">source</code> = <code className="fin-code">sms</code>, <code className="fin-code">text</code> = <b>Shortcut Input → Content</b>.</li>
            </ol>
          </Guide>
          <Guide icon={BellRing} title="Tabby — notifications & Wallet taps" status="Two shortcuts; duplicates merge automatically">
            <p className="mb-3 font-medium" style={{ color: 'var(--fin-ink)' }}>A · Notification (online, in-store and automatic charges)</p>
            <ol className="fin-steps">
              <li>Trigger <b>When I receive a notification from Tabby</b> — no filter (filters are unreliable on iOS 27).</li>
              <li><b>Get Contents of URL</b> (same endpoint, POST, Authorization header). JSON: <code className="fin-code">source</code> = <code className="fin-code">alert</code>, <code className="fin-code">title</code> / <code className="fin-code">subtitle</code> / <code className="fin-code">body</code> = the notification’s fields.</li>
            </ol>
            <p className="mb-3 mt-4 font-medium" style={{ color: 'var(--fin-ink)' }}>B · Wallet tap (reliable for Apple Pay)</p>
            <ol className="fin-steps">
              <li>Trigger <b>When Tabby Visa Card is tapped</b>, any category / merchant.</li>
              <li>JSON: <code className="fin-code">source</code> = <code className="fin-code">wallet</code>, <code className="fin-code">account</code> = <code className="fin-code">tabby</code>, <code className="fin-code">merchant</code> / <code className="fin-code">amount</code> / <code className="fin-code">card</code> = the tap’s Merchant, Amount, Card or Pass.</li>
            </ol>
            <p className="mt-2 text-xs fin-muted">iOS 27 sometimes hands over blank notifications — those appear on Activity with an “Add details” button.</p>
          </Guide>
          <Guide icon={Mail} title="Mashreq — Gmail alerts" status="Google Apps Script · checks every 5 minutes">
            <ol className="fin-steps mt-1">
              <li>Open <a className="fin-link" href="https://script.google.com/home/projects/create" target="_blank" rel="noreferrer">script.google.com → New project</a> in the Gmail that receives MashreqAlerts.</li>
              <li>Paste <a className="fin-link" href={REPO_SCRIPT} target="_blank" rel="noreferrer">integrations/mashreq-gmail.gs</a>.</li>
              <li>⚙ Project Settings → Script Properties: <code className="fin-code">INGEST_URL</code> = endpoint, <code className="fin-code">INGEST_TOKEN</code> = your token.</li>
              <li>Run <code className="fin-code">setup</code> (approve access), then <code className="fin-code">backfill</code> once for history.</li>
            </ol>
          </Guide>
          <Section icon={KeyRound} title="Your details" subtitle="Used by the shortcuts and Netlify">
            <div className="fin-inset space-y-2 px-4 py-3">
              <p className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs fin-muted">Endpoint</span> <CopyText value={endpoint} /></p>
              <p className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs fin-muted">User ID</span> {f.session?.user?.id ? <CopyText value={f.session.user.id} /> : '—'}</p>
            </div>
          </Section>
        </div>

        <div className="space-y-5">
          <ActivityLog />
          <ParserTester />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <AccountsEditor />
        <BudgetsEditor />
      </div>
      <RulesList />
    </div>
  );
}

/** One tile per card: is anything arriving from it? */
function ConnectionStatus() {
  const f = useFinance();
  const CHANNEL = { sib: 'SMS', mashreq: 'Gmail', tabby: 'Notification / Wallet' };
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {f.accounts.filter((a) => !a.closed_at).map((a) => {
        const last = f.transactions.find((t) => t.account_id === a.id && !['manual', 'statement'].includes(t.source));
        const fresh = last && Date.now() - new Date(last.created_at || last.occurred_at).getTime() < 30 * 86400000;
        return (
          <div key={a.id} className="fin-card flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: 'var(--fin-surface-2)', color: accountColorVar(a.slug, f.accounts) }}>
              <CreditCard size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{a.name}</p>
              <p className="truncate text-xs fin-muted">{CHANNEL[a.slug] || 'Manual'}{last ? ` · last ${relative(last.created_at || last.occurred_at)}` : ''}</p>
            </div>
            <span className={`fin-pill ${fresh ? 'fin-pill-good' : 'fin-pill-neutral'}`}>{fresh ? 'Live' : 'Waiting'}</span>
          </div>
        );
      })}
    </div>
  );
}

function ParserTester() {
  const [text, setText] = useState('');
  const result = text.trim() ? parseEvent({ text }) : null;
  return (
    <Section icon={FlaskConical} title="Test a message" subtitle="See how an SMS, email or alert will be read. Nothing is saved.">
      <textarea className="fin-textarea" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a bank SMS or Tabby alert…" />
      {result && (
        result.ok ? (
          <div className="fin-inset flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3" style={{ color: 'var(--fin-ink)' }}>
            <span className="fin-pill fin-pill-good">✓ {result.account.toUpperCase()}</span>
            <span className="fin-num font-semibold">{result.currency} {result.amount.toFixed(2)}</span>
            <span>{result.merchant}</span>
            <span className="text-xs fin-muted">{new Date(result.occurredAt).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })}{result.availableBalance != null ? ` · ${aed(result.availableBalance)} left` : ''}</span>
          </div>
        ) : (
          <p className="fin-inset px-4 py-3" style={{ color: result.status === 'ignored' ? 'var(--fin-ink-2)' : 'var(--fin-bad)' }}>✗ {result.reason}</p>
        )
      )}
    </Section>
  );
}

function AccountsEditor() {
  const f = useFinance();
  const [rows, setRows] = useState(f.accounts);
  const [saved, setSaved] = useState(false);
  useEffect(() => setRows(f.accounts), [f.accounts]);
  const set = (id, k) => (e) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: e.target.value } : r)));
  const save = async () => {
    if (!f.demo) {
      for (const r of rows) {
        await f.supabase.from('fin_accounts').update({ name: r.name, last4: r.last4 || null, credit_limit: r.credit_limit ? Number(r.credit_limit) : null }).eq('id', r.id);
      }
      await f.reload();
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  return (
    <Section icon={CreditCard} title="Cards" subtitle="Credit limits power the “% used” bars" action={<button className="fin-btn" onClick={save}>{saved ? <><Check size={14} /> Saved</> : 'Save'}</button>}>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-[1fr_76px_112px] items-center gap-2">
            <div className="relative">
              <span className="fin-dot absolute left-3.5 top-1/2 -translate-y-1/2" style={{ background: accountColorVar(r.slug, f.accounts) }} />
              <input className="fin-input" style={{ paddingLeft: 30, paddingRight: r.closed_at ? 72 : undefined }} value={r.name || ''} onChange={set(r.id, 'name')} aria-label="Card name" />
              {r.closed_at && <span className="fin-pill fin-pill-neutral absolute right-2 top-1/2 -translate-y-1/2">Closed</span>}
            </div>
            <input className="fin-input fin-num" value={r.last4 || ''} onChange={set(r.id, 'last4')} placeholder="1234" maxLength={4} aria-label="Last 4 digits" />
            <input className="fin-input fin-num" type="number" value={r.credit_limit || ''} onChange={set(r.id, 'credit_limit')} placeholder="Limit" aria-label="Credit limit" />
          </div>
        ))}
      </div>
    </Section>
  );
}

function BudgetsEditor() {
  const f = useFinance();
  const [values, setValues] = useState({});
  const [saved, setSaved] = useState(false);
  useEffect(() => setValues(Object.fromEntries(f.budgets.map((b) => [b.category, String(b.monthly_amount)]))), [f.budgets]);
  const save = async () => {
    if (!f.demo) {
      const upserts = Object.entries(values).filter(([, v]) => Number(v) > 0).map(([category, v]) => ({ category, monthly_amount: Number(v) }));
      const removes = CATEGORIES.filter((c) => !(Number(values[c]) > 0) && f.budgets.some((b) => b.category === c));
      if (upserts.length) await f.supabase.from('fin_budgets').upsert(upserts, { onConflict: 'user_id,category' });
      if (removes.length) await f.supabase.from('fin_budgets').delete().in('category', removes);
      await f.reload();
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  return (
    <Section icon={Target} title="Monthly budgets" subtitle="Optional · shown as a marker on each category" action={<button className="fin-btn" onClick={save}>{saved ? <><Check size={14} /> Saved</> : 'Save'}</button>}>
      <div className="grid max-h-[420px] gap-1.5 overflow-y-auto pr-1">
        {CATEGORIES.map((c) => (
          <label key={c} className="fin-inset flex items-center gap-2.5 py-1.5 pl-3 pr-1.5">
            <span className="fin-muted"><CategoryIcon category={c} size={15} /></span>
            <span className="flex-1 truncate text-[13px]" style={{ color: 'var(--fin-ink)' }}>{c}</span>
            <input className="fin-input fin-num text-right" style={{ width: 110, height: 34, background: 'var(--fin-surface)' }} type="number" min="0" placeholder="—" value={values[c] || ''} onChange={(e) => setValues((v) => ({ ...v, [c]: e.target.value }))} aria-label={`${c} budget`} />
          </label>
        ))}
      </div>
    </Section>
  );
}

function RulesList() {
  const f = useFinance();
  if (!f.rules.length) return null;
  const remove = async (id) => {
    if (!f.demo) await f.supabase.from('fin_merchant_rules').delete().eq('id', id);
    f.setData((d) => ({ ...d, rules: d.rules.filter((r) => r.id !== id) }));
  };
  return (
    <Section icon={Wand2} title={`Merchant rules · ${f.rules.length}`} subtitle="Learned from your edits and from Claude — new purchases from these merchants are sorted instantly">
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {f.rules.map((r) => (
          <li key={r.id} className="fin-inset flex items-center gap-2.5 py-1.5 pl-3 pr-1.5">
            <span className="fin-muted"><CategoryIcon category={r.category} size={15} /></span>
            <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: 'var(--fin-ink)' }}>
              {r.match} <span className="fin-muted">→ {r.category}</span>
            </span>
            <span className={`fin-pill ${r.source === 'ai' ? 'fin-pill-accent' : 'fin-pill-neutral'}`}>{r.source === 'ai' ? 'AI' : 'You'}</span>
            <button className="fin-btn fin-btn-ghost h-8 w-8 p-0" onClick={() => remove(r.id)} aria-label="Delete rule"><Trash2 size={14} /></button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const STATUS_STYLE = {
  parsed: { label: 'Logged', cls: 'fin-pill-good' },
  merged: { label: 'Merged', cls: 'fin-pill-good' },
  duplicate: { label: 'Duplicate', cls: 'fin-pill-neutral' },
  ignored: { label: 'Skipped', cls: 'fin-pill-neutral' },
  dismissed: { label: 'Dismissed', cls: 'fin-pill-neutral' },
  unparsed: { label: 'Unreadable', cls: 'fin-pill-bad' },
  pending: { label: 'Error', cls: 'fin-pill-bad' },
};

/** The last messages the endpoint received, so you can see a Shortcut actually delivered. */
function ActivityLog() {
  const f = useFinance();
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    setBusy(true);
    await f.reload();
    setBusy(false);
  };
  return (
    <Section
      icon={Activity}
      title="Recent activity"
      subtitle="Everything your iPhone and Gmail sent, newest first"
      action={<button className="fin-btn fin-icon-btn" onClick={refresh} disabled={busy} aria-label="Refresh"><RefreshCw size={15} className={busy ? 'animate-spin' : ''} /></button>}
    >
      {!f.activity?.length && <p className="fin-inset px-4 py-6 text-center fin-muted">Nothing received yet.</p>}
      <ul className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
        {(f.activity || []).map((e) => {
          const st = STATUS_STYLE[e.status] || { label: e.status, cls: 'fin-pill-neutral' };
          const p = e.payload || {};
          const parts = [p.text, p.title, p.subtitle, p.body].map((x) => String(x ?? '').trim()).filter(Boolean);
          const unique = [...new Set(parts)];
          const text = unique.length ? unique.join(' · ') : p.merchant ? `${p.card || ''} · ${p.merchant} · ${p.amount}` : '(empty — no text received)';
          return (
            <li key={e.id} className="fin-inset px-3.5 py-3">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs fin-muted">{dateTime(e.received_at)} · {e.source}</span>
                <span className={`fin-pill ${st.cls}`}>{st.label}</span>
              </div>
              <p className="line-clamp-3 break-words text-[13px]" style={{ color: 'var(--fin-ink)' }}>{text.slice(0, 300)}</p>
              {e.reason && e.status !== 'parsed' && <p className="mt-1 text-xs fin-muted">{e.reason}</p>}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
