'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { CATEGORIES } from '@/lib/finance/categories.mjs';
import { merchantKey, ruleCategory } from '@/lib/finance/categories.mjs';
import { normalizeMerchant, toAed } from '@/lib/finance/parse.mjs';
import { useFinance } from './FinanceShell';
import { aed, fromLocalInput, toLocalInput } from './format';

/** Modal for editing an existing transaction or adding a manual one (tx = null). */
export default function TransactionEditor({ tx, onClose }) {
  const { accounts, transactions, rules, supabase, demo, reload, setData } = useFinance();
  const isNew = !tx;
  const [form, setForm] = useState(() => ({
    account_id: tx?.account_id || accounts[0]?.id || '',
    occurred_at: toLocalInput(tx?.occurred_at),
    amount: tx?.amount ?? '',
    currency: tx?.currency || 'AED',
    merchant: tx?.merchant || '',
    category: tx?.category || '',
    direction: tx?.direction || 'debit',
    notes: tx?.notes || '',
    excluded: tx?.excluded || false,
  }));
  const [applyAll, setApplyAll] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sameMerchant = tx
    ? transactions.filter((t) => t.id !== tx.id && merchantKey(t.merchant) === merchantKey(form.merchant) && t.category_source !== 'user').length
    : 0;
  const categoryChanged = form.category && form.category !== (tx?.category || '');

  const save = async (e) => {
    e.preventDefault();
    if (demo) return onClose();
    setBusy(true);
    setErr(null);
    try {
      const amount = Math.abs(Number(form.amount));
      if (!(amount > 0)) throw new Error('Enter an amount');
      const merchant = form.merchant.trim() || 'Manual';
      const { amountAed, fxEstimated } = toAed(amount, form.currency.toUpperCase());
      const auto = form.category ? null : ruleCategory(merchant, rules);
      const row = {
        account_id: form.account_id,
        occurred_at: fromLocalInput(form.occurred_at),
        amount, currency: form.currency.toUpperCase(), amount_aed: amountAed, fx_estimated: fxEstimated,
        merchant, direction: form.direction, notes: form.notes || null, excluded: form.excluded,
        category: form.category || auto?.category || null,
        category_source: form.category ? (categoryChanged || isNew ? 'user' : tx.category_source) : auto?.source || null,
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
      onClose();
    } catch (e2) {
      setErr(e2.message || String(e2));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (demo) return onClose();
    if (!confirm('Delete this transaction?')) return;
    setBusy(true);
    const { error } = await supabase.from('fin_transactions').delete().eq('id', tx.id);
    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }
    setData((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== tx.id) }));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="fin-card max-h-[92vh] w-full max-w-md overflow-y-auto p-5" style={{ borderRadius: 16 }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{isNew ? 'Add transaction' : 'Edit transaction'}</h2>
          <button type="button" className="fin-btn" style={{ padding: 6 }} onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        {tx?.merchant_raw && tx.merchant_raw !== tx.merchant && (
          <p className="mb-3 text-xs fin-muted">Original descriptor: {tx.merchant_raw}</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="fin-label">Merchant</label>
            <input className="fin-input" value={form.merchant} onChange={set('merchant')} onBlur={(e) => isNew && setForm((f) => ({ ...f, merchant: normalizeMerchant(e.target.value) }))} placeholder="e.g. Carrefour" />
          </div>
          <div>
            <label className="fin-label">Amount</label>
            <input className="fin-input fin-num" type="number" step="0.01" min="0" value={form.amount} onChange={set('amount')} required />
          </div>
          <div>
            <label className="fin-label">Currency</label>
            <input className="fin-input" value={form.currency} onChange={set('currency')} maxLength={3} />
          </div>
          <div>
            <label className="fin-label">Card</label>
            <select className="fin-select" value={form.account_id} onChange={set('account_id')}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="fin-label">Type</label>
            <select className="fin-select" value={form.direction} onChange={set('direction')}>
              <option value="debit">Purchase</option>
              <option value="credit">Refund / credit</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="fin-label">Date & time (Dubai)</label>
            <input className="fin-input" type="datetime-local" value={form.occurred_at} onChange={set('occurred_at')} required />
          </div>
          <div className="col-span-2">
            <label className="fin-label">Category</label>
            <select className="fin-select" value={form.category} onChange={set('category')}>
              <option value="">{isNew ? 'Auto' : 'Uncategorized'}</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {!isNew && categoryChanged && (
              <label className="mt-2 flex items-center gap-2 text-sm fin-ink-2">
                <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />
                Always use this for “{form.merchant}”{sameMerchant ? ` (updates ${sameMerchant} other)` : ''}
              </label>
            )}
            {tx?.category_source && !categoryChanged && (
              <p className="mt-1 text-xs fin-muted">Set by {({ keyword: 'built-in rules', rule: 'your merchant rule', ai: 'Claude', user: 'you' })[tx.category_source]}</p>
            )}
          </div>
          <div className="col-span-2">
            <label className="fin-label">Notes</label>
            <input className="fin-input" value={form.notes} onChange={set('notes')} />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm fin-ink-2">
            <input type="checkbox" checked={form.excluded} onChange={set('excluded')} />
            Exclude from spending totals (reimbursable, transfer…)
          </label>
        </div>
        {tx?.available_balance != null && (
          <p className="mt-3 text-xs fin-muted">Available after this purchase: {aed(tx.available_balance)} · via {(tx.sources || [tx.source]).join(' + ')}</p>
        )}
        {err && <p className="mt-3 text-sm" style={{ color: 'var(--fin-bad)' }}>{err}</p>}
        <div className="mt-5 flex items-center justify-between gap-2">
          {!isNew ? <button type="button" className="fin-btn fin-btn-danger" onClick={remove} disabled={busy}>Delete</button> : <span />}
          <div className="flex gap-2">
            <button type="button" className="fin-btn" onClick={onClose}>Cancel</button>
            <button className="fin-btn fin-btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
