'use client';
import { useEffect, useState } from 'react';
import { Copy, Check, Trash2 } from 'lucide-react';
import { useFinance } from '../_components/FinanceShell';
import { CATEGORIES } from '@/lib/finance/categories.mjs';
import { parseEvent } from '@/lib/finance/parse.mjs';
import { aed } from '../_components/format';

const REPO_SCRIPT = 'https://github.com/xdMikayu/mikaeelfaraz/blob/main/integrations/mashreq-gmail.gs';

function CopyText({ value }) {
  const [done, setDone] = useState(false);
  return (
    <span className="inline-flex items-center gap-1">
      <code className="fin-code">{value}</code>
      <button
        className="fin-btn"
        style={{ padding: 4 }}
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

function Section({ title, children, id }) {
  return (
    <section id={id} className="fin-card p-5">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed fin-ink-2">{children}</div>
    </section>
  );
}

export default function Setup() {
  const f = useFinance();
  const [origin, setOrigin] = useState('https://mikaeelfaraz.com');
  useEffect(() => setOrigin(window.location.origin), []);
  const endpoint = `${origin}/api/finance/ingest`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Setup</h1>
        <p className="text-sm fin-ink-2">Connect each card once. After that every purchase lands here within seconds.</p>
      </div>

      <Section title="How it works">
        <p>
          <b style={{ color: 'var(--fin-ink)' }}>SIB</b> texts you → an iPhone Shortcuts automation forwards the SMS here.{' '}
          <b style={{ color: 'var(--fin-ink)' }}>Tabby</b> only shows an Apple Wallet notification → a Wallet “Transaction” automation sends the merchant and amount.{' '}
          <b style={{ color: 'var(--fin-ink)' }}>Mashreq</b> emails you → a small Google Apps Script in your Gmail forwards each alert.
          Everything goes to one private endpoint protected by your ingest token, gets parsed, de-duplicated (a Wallet tap and a bank alert for the same purchase merge into one), and categorized.
        </p>
        <p>Your user ID (for <code className="fin-code">FINANCE_OWNER_USER_ID</code> in Netlify): {f.session?.user?.id ? <CopyText value={f.session.user.id} /> : '—'}</p>
        <p>Endpoint: <CopyText value={endpoint} /></p>
      </Section>

      <Section title="1 · SIB — forward the SMS (iPhone Shortcuts)" id="sib">
        <ol className="fin-steps">
          <li>Shortcuts app → <b>Automation</b> → <b>+</b> → <b>Message</b>.</li>
          <li><b>Message Contains</b>: <CopyText value="A txn on your Card" /> (optionally also set Sender to SIB’s sender name). Choose <b>Run Immediately</b>, turn off “Notify When Run”, tap Next → <b>New Blank Automation</b>.</li>
          <li>Add action <b>Get Contents of URL</b>. URL: your endpoint above. Tap ▸ to expand: Method <b>POST</b>.</li>
          <li>Headers → add <code className="fin-code">Authorization</code> = <code className="fin-code">Bearer YOUR_FINANCE_INGEST_TOKEN</code>.</li>
          <li>Request Body <b>JSON</b> → add Text field <code className="fin-code">source</code> = <code className="fin-code">sms</code>, and Text field <code className="fin-code">text</code> = the <b>Shortcut Input</b> variable (tap it and pick <b>Content</b> if asked).</li>
          <li>Done. Test by texting yourself an old SIB message, or paste one into the tester below.</li>
        </ol>
      </Section>

      <Section title="2 · Tabby — Apple Wallet taps (iPhone Shortcuts)" id="tabby">
        <ol className="fin-steps">
          <li>Shortcuts → <b>Automation</b> → <b>+</b> → <b>Transaction</b> (Wallet). Select only your <b>Tabby</b> card. <b>Run Immediately</b>, then New Blank Automation.</li>
          <li>Add <b>Get Contents of URL</b> → your endpoint, Method <b>POST</b>, same <code className="fin-code">Authorization</code> header.</li>
          <li>Request Body <b>JSON</b> with Text fields: <code className="fin-code">source</code> = <code className="fin-code">wallet</code>; <code className="fin-code">card</code> = Shortcut Input → <b>Card or Pass</b>; <code className="fin-code">merchant</code> = Shortcut Input → <b>Merchant</b>; <code className="fin-code">amount</code> = Shortcut Input → <b>Amount</b>.</li>
          <li>Optional: add the Mashreq card to the same automation too — if both the Wallet tap and the Mashreq email arrive, they merge into one transaction and you see it instantly instead of waiting for the email.</li>
        </ol>
        <p className="text-xs fin-muted">
          Wallet automations fire for Apple Pay taps. Online Tabby purchases that don’t go through Apple Pay won’t trigger it — add those with “Add” on the Transactions page.
          If the card name in Wallet doesn’t contain “Tabby”, also add a Text field <code className="fin-code">account</code> = <code className="fin-code">tabby</code>.
        </p>
      </Section>

      <Section title="3 · Mashreq — Gmail alerts (Google Apps Script)" id="mashreq">
        <ol className="fin-steps">
          <li>Open <a className="underline" href="https://script.google.com/home/projects/create" target="_blank" rel="noreferrer">script.google.com → New project</a> while signed in to the Gmail that gets MashreqAlerts emails.</li>
          <li>Replace the code with <a className="underline" href={REPO_SCRIPT} target="_blank" rel="noreferrer">integrations/mashreq-gmail.gs</a> from the repo.</li>
          <li>Project Settings (⚙) → <b>Script Properties</b> → add <code className="fin-code">INGEST_URL</code> = your endpoint and <code className="fin-code">INGEST_TOKEN</code> = your ingest token.</li>
          <li>Back in the editor, pick <code className="fin-code">setup</code> and press <b>Run</b>; approve the Gmail permission. It checks for new alerts every 5 minutes.</li>
          <li>Run <code className="fin-code">backfill</code> once to import the last ~13 months of Mashreq alerts.</li>
        </ol>
      </Section>

      <ParserTester />
      <AccountsEditor />
      <BudgetsEditor />
      <RulesList />
    </div>
  );
}

function ParserTester() {
  const [text, setText] = useState('');
  const result = text.trim() ? parseEvent({ text }) : null;
  return (
    <Section title="Test a message">
      <p>Paste an SMS or email to see how it will be read. Nothing is saved.</p>
      <textarea className="fin-textarea" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="A txn on your Card XXXX…" />
      {result && (
        result.ok ? (
          <p style={{ color: 'var(--fin-ink)' }}>
            ✓ {result.account.toUpperCase()} · {result.currency} {result.amount.toFixed(2)} at <b>{result.merchant}</b> · {new Date(result.occurredAt).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })}
            {result.availableBalance != null ? ` · available ${aed(result.availableBalance)}` : ''}
          </p>
        ) : (
          <p style={{ color: result.status === 'ignored' ? 'var(--fin-ink-2)' : 'var(--fin-bad)' }}>✗ {result.reason}</p>
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
    <Section title="Cards">
      <p>Add your credit limits to see how much of each limit you’re using.</p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-[1fr_80px_120px] gap-2">
            <input className="fin-input" value={r.name || ''} onChange={set(r.id, 'name')} aria-label="Name" />
            <input className="fin-input" value={r.last4 || ''} onChange={set(r.id, 'last4')} placeholder="last 4" maxLength={4} aria-label="Last 4 digits" />
            <input className="fin-input fin-num" type="number" value={r.credit_limit || ''} onChange={set(r.id, 'credit_limit')} placeholder="Limit AED" aria-label="Credit limit" />
          </div>
        ))}
      </div>
      <button className="fin-btn" onClick={save}>{saved ? 'Saved' : 'Save cards'}</button>
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
    <Section title="Monthly budgets">
      <p>Optional. Budgets show as a tick on the category bars and flag when you go over.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {CATEGORIES.map((c) => (
          <label key={c} className="flex items-center justify-between gap-2">
            <span>{c}</span>
            <input className="fin-input fin-num" style={{ width: 120 }} type="number" min="0" placeholder="—" value={values[c] || ''} onChange={(e) => setValues((v) => ({ ...v, [c]: e.target.value }))} />
          </label>
        ))}
      </div>
      <button className="fin-btn" onClick={save}>{saved ? 'Saved' : 'Save budgets'}</button>
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
    <Section title={`Merchant rules (${f.rules.length})`}>
      <p>Learned from your edits (you) and from Claude (AI). New transactions from these merchants are categorized instantly.</p>
      <ul className="divide-y" style={{ borderColor: 'var(--fin-grid)' }}>
        {f.rules.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
            <span><code className="fin-code">{r.match}</code> → {r.category} <span className="text-xs fin-muted">({r.source === 'ai' ? 'AI' : 'you'})</span></span>
            <button className="fin-btn" style={{ padding: 5 }} onClick={() => remove(r.id)} aria-label="Delete rule"><Trash2 size={13} /></button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
