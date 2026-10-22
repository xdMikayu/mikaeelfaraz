'use client';
import { useState } from 'react';
import { CATEGORIES } from '@/lib/finance/categories.mjs';
import { merchantKey, ruleCategory } from '@/lib/finance/categories.mjs';
import { normalizeMerchant, toAed } from '@/lib/finance/parse.mjs';
import { cardLabel } from '@/lib/finance/accounts.mjs';
import { useFinance } from './FinanceShell';
import { CategoryAvatar } from './icons';
import Sheet from './Sheet';
import { deleteWithUndo } from './undo';
import { aed, fromLocalInput, toLocalInput } from './format';

// The amount is typed as text (a number input can't show 1,234.50): commas go on when you
// leave the field and come off again when it's read.
const parseAmount = (v) => Number(String(v).replace(/[,\s]/g, ''));
const formatAmount = (v) => {
  const n = parseAmount(v);
  return String(v).trim() && Number.isFinite(n) ? Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v;
};

/** Sheet for editing an existing transaction or adding a manual one (tx = null). */
export default function TransactionEditor({ tx, preset, onSaved, onClose }) {
  const isNew = !tx;
  const card = useFinance().accounts.find((a) => a.id === tx?.account_id);
  return (
    <Sheet
      onClose={onClose}
      title={isNew ? 'New transaction' : tx.merchant || 'Transaction'}
      subtitle={isNew ? 'Added manually' : `${cardLabel(card)} · ${(tx.sources || [tx.source]).join(' + ')}`}
      leading={<CategoryAvatar category={isNew ? null : tx.category} />}
    >
      {(close) => <EditorForm tx={tx} preset={preset} onSaved={onSaved} close={close} />}
    </Sheet>
  );
}

function EditorForm({ tx, preset, onSaved, close }) {
  const { accounts, transactions, rules, supabase, demo, reload, setData } = useFinance();
  const isNew = !tx;
  const [form, setForm] = useState(() => ({
    account_id: tx?.account_id || preset?.account_id || accounts[0]?.id || '',
    occurred_at: toLocalInput(tx?.occurred_at || preset?.occurred_at),
    amount: tx ? formatAmount(tx.amount) : '',
    currency: tx?.currency || 'AED',
    merchant: tx?.merchant || '',
    category: tx?.category || '',
    direction: tx?.direction || 'debit',
    notes: tx?.notes || preset?.notes || '',
    excluded: tx?.excluded || false,
  }));
  const [applyAll, setApplyAll] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const sameMerchant = tx
    ? transactions.filter((t) => t.id !== tx.id && merchantKey(t.merchant) === merchantKey(form.merchant) && t.category_source !== 'user').length
    : 0;
  const categoryChanged = form.category && form.category !== (tx?.category || '');

  const save = async (e) => {
    e.preventDefault();
    if (demo) return close();
    setBusy(true);
    setErr(null);
    try {
      const amount = Math.abs(parseAmount(form.amount));
      if (!(amount > 0)) throw new Error('Enter an amount');
      const merchant = form.merchant.trim() || 'Manual';
      const currency = form.currency.toUpperCase();
      // Keep the stored AED (e.g. what the bank billed) unless the amount or currency changed.
      const same = tx && Number(tx.amount) === amount && tx.currency === currency;
      const { amountAed, fxEstimated } = same ? { amountAed: Number(tx.amount_aed), fxEstimated: tx.fx_estimated } : toAed(amount, currency);
      // Toggling "exclude" yourself also marks the row as yours, so automatic matching leaves it alone.
      const excludedChanged = !isNew && form.excluded !== !!tx.excluded;
      const auto = form.category ? null : ruleCategory(merchant, rules);
      const row = {
        account_id: form.account_id,
        occurred_at: fromLocalInput(form.occurred_at),
        amount, currency, amount_aed: amountAed, fx_estimated: fxEstimated,
        merchant, direction: form.direction, notes: form.notes || null, excluded: form.excluded,
        category: form.category || auto?.category || null,
        category_source: form.category ? (categoryChanged || isNew || excludedChanged ? 'user' : tx.category_source) : auto?.source || null,
      };
      if (isNew) {
        const { error } = await supabase.from('fin_transactions').insert({ ...row, merchant_raw: merchant, source: 'manual', sources: ['manual'] });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fin_transactions').update(row).eq('id', tx.id);
        if (error) throw error;
      }
      if (categoryChanged && applyAll) {
        const match = merchantKey(merchant);
        await supabase.from('fin_merchant_rules').upsert({ match, category: form.category, source: 'user' }, { onConflict: 'user_id,match' });
        const ids = transactions.filter((t) => t.id !== tx?.id && merchantKey(t.merchant) === match && t.category_source !== 'user').map((t) => t.id);
        for (let i = 0; i < ids.length; i += 200) {
          await supabase.from('fin_transactions').update({ category: form.category, category_source: 'rule' }).in('id', ids.slice(i, i + 200));
        }
      }
      await reload();
      onSaved?.();
      close();
    } catch (e2) {
      setErr(e2.message || String(e2));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    close();
    if (demo) return;
    const gone = tx;
    deleteWithUndo({
      message: `Deleted ${gone.merchant || 'transaction'}`,
      ids: [gone.id],
      hide: () => setData((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== gone.id) })),
      restore: () => setData((d) => ({
        ...d,
        transactions: d.transactions.some((t) => t.id === gone.id) ? d.transactions : [...d.transactions, gone].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
      })),
      commit: async () => {
        const { error } = await supabase.from('fin_transactions').delete().eq('id', gone.id);
        if (error) throw error;
      },
    });
  };

  return (
    <form onSubmit={save}>
      {/* Amount */}
      <div className="fin-inset mb-4 px-4 py-4">
        <label className="fin-label" htmlFor="tx-amount">Amount</label>
        <div className="flex items-baseline gap-2">
          <input
            className="w-12 shrink-0 bg-transparent text-lg font-semibold uppercase fin-muted outline-none"
            value={form.currency}
            onChange={set('currency')}
            maxLength={3}
            aria-label="Currency"
          />
          {/* Shrinks for big amounts so 1,234,567.89 still fits a 320px phone. */}
          <input
            id="tx-amount"
            className={`fin-num min-w-0 flex-1 bg-transparent font-semibold tracking-tight outline-none ${form.amount.length > 12 ? 'text-2xl' : form.amount.length > 9 ? 'text-3xl' : 'text-4xl'}`}
            type="text" inputMode="decimal" autoComplete="off" placeholder="0.00"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value.replace(/[^\d.,]/g, '') }))}
            onBlur={() => setForm((f) => ({ ...f, amount: formatAmount(f.amount) }))}
            required
          />
        </div>
        <div className="fin-seg mt-3" role="group" aria-label="Type">
          <button type="button" aria-pressed={form.direction === 'debit'} onClick={() => setForm((f) => ({ ...f, direction: 'debit' }))}>Purchase</button>
          <button type="button" aria-pressed={form.direction === 'credit'} onClick={() => setForm((f) => ({ ...f, direction: 'credit' }))}>Refund</button>
        </div>
      </div>

      {tx?.merchant_raw && tx.merchant_raw !== tx.merchant && (
        <p className="mb-3 text-xs fin-muted">Bank descriptor: {tx.merchant_raw}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="fin-label">Merchant</label>
          <input className="fin-input" value={form.merchant} onChange={set('merchant')} onBlur={(e) => isNew && setForm((f) => ({ ...f, merchant: normalizeMerchant(e.target.value) }))} placeholder="e.g. Carrefour" />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="fin-label">Card</label>
          <select className="fin-select" value={form.account_id} onChange={set('account_id')}>
            {accounts.filter((a) => !a.closed_at || a.id === form.account_id).map((a) => <option key={a.id} value={a.id}>{cardLabel(a)}</option>)}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="fin-label">Date & time</label>
          <input className="fin-input" type="datetime-local" value={form.occurred_at} onChange={set('occurred_at')} required />
        </div>
        <div className="col-span-2">
          <label className="fin-label">Category</label>
          <select className="fin-select" value={form.category} onChange={set('category')}>
            <option value="">{isNew ? 'Auto-detect' : 'Uncategorized'}</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {!isNew && categoryChanged && (
            <label className="mt-2.5 flex items-center gap-2 text-sm fin-ink-2">
              <input type="checkbox" className="h-4 w-4 accent-[var(--fin-accent)]" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />
              Always use this for “{form.merchant}”{sameMerchant ? ` (updates ${sameMerchant} more)` : ''}
            </label>
          )}
          {tx?.category_source && !categoryChanged && (
            <p className="mt-1.5 text-xs fin-muted">Set by {({ keyword: 'built-in rules', rule: 'your merchant rule', ai: 'Mifolio AI', user: 'you' })[tx.category_source]}</p>
          )}
        </div>
        <div className="col-span-2">
          <label className="fin-label">Notes</label>
          <input className="fin-input" value={form.notes} onChange={set('notes')} placeholder="Optional" />
        </div>
        <label className="fin-inset col-span-2 flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span>
            <span className="block font-medium">Exclude from totals</span>
            <span className="block text-xs fin-muted">Reimbursable, transfer, or not really spending</span>
          </span>
          <input type="checkbox" className="h-5 w-5 accent-[var(--fin-accent)]" checked={form.excluded} onChange={set('excluded')} />
        </label>
      </div>
      {tx?.available_balance != null && (
        <p className="mt-3 text-xs fin-muted">Available on the card after this: {aed(tx.available_balance)}</p>
      )}
      {err && <p className="mt-3 text-sm" style={{ color: 'var(--fin-bad)' }}>{err}</p>}
      <div className="mt-6 flex items-center justify-between gap-2">
        {!isNew ? <button type="button" className="fin-btn fin-btn-ghost fin-btn-danger" onClick={remove} disabled={busy}>Delete</button> : <span />}
        <div className="flex gap-2">
          <button type="button" className="fin-btn" onClick={close}>Cancel</button>
          <button className="fin-btn fin-btn-primary px-6" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </form>
  );
}
