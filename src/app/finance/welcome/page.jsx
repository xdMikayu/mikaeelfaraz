'use client';
// Landing page for invite and password-reset links. Supabase signs the visitor in from
// the link itself; here they choose a password, then carry on to the app.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from '@phosphor-icons/react';
import { useFinance } from '../_components/FinanceShell';

const MIN_LENGTH = 10;

export default function Welcome() {
  const f = useFinance();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (password.length < MIN_LENGTH) return setMsg(`Use at least ${MIN_LENGTH} characters.`);
    if (password !== again) return setMsg('The two passwords don’t match.');
    setBusy(true);
    const { error } = await f.supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setMsg(error.message);
    router.replace('/finance/setup');
  };
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <form onSubmit={submit} className="fin-card fin-card-hero w-full max-w-sm space-y-4 p-7">
        <div>
          <h1 className="fin-h1">Choose a password</h1>
          <p className="mt-1 text-sm fin-ink-2">For {f.session?.user?.email || 'your account'}. You’ll use it to sign in to Mifolio.</p>
        </div>
        <div>
          <label className="fin-label" htmlFor="pw1">New password</label>
          <input id="pw1" className="fin-input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div>
          <label className="fin-label" htmlFor="pw2">Same again</label>
          <input id="pw2" className="fin-input" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required />
        </div>
        {msg && <p className="text-sm" style={{ color: 'var(--fin-bad)' }}>{msg}</p>}
        <button className="fin-btn fin-btn-primary h-11 w-full" disabled={busy}>{busy ? 'Saving…' : 'Save and continue'}</button>
        <p className="flex items-center gap-1.5 text-xs fin-muted"><Lock size={12} /> At least {MIN_LENGTH} characters.</p>
      </form>
    </div>
  );
}
