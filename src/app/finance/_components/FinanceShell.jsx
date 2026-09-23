'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Moon, Sun, LogOut, Wallet } from 'lucide-react';
import { getSupabase, supabaseConfigured } from '@/lib/finance/supabase-browser';
import { DEFAULT_ACCOUNTS } from '@/lib/finance/accounts.mjs';
import { demoData } from './demo';

const FinanceContext = createContext(null);
export const useFinance = () => useContext(FinanceContext);

const HISTORY_MONTHS = 24;
const PAGE = 1000;

const NAV = [
  { href: '/finance', label: 'Overview' },
  { href: '/finance/transactions', label: 'Transactions' },
  { href: '/finance/setup', label: 'Setup' },
  { href: '/finance/portfolio', label: 'Portfolio' },
];

function useTheme() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    let stored = null;
    try { stored = localStorage.getItem('mf-finance-theme'); } catch {}
    const prefers = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    setDark(stored ? stored === 'dark' : prefers ?? true);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
  const toggle = () => {
    setDark((d) => {
      try { localStorage.setItem('mf-finance-theme', d ? 'light' : 'dark'); } catch {}
      return !d;
    });
  };
  return [dark, toggle];
}

async function fetchAll(query) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query().range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

export default function FinanceShell({ children }) {
  const [dark, toggleTheme] = useTheme();
  const pathname = usePathname();
  const params = useSearchParams();
  const demo = params.get('demo') === '1' || !supabaseConfigured();
  const supabase = demo ? null : getSupabase();

  const [session, setSession] = useState(undefined); // undefined = loading
  const [data, setData] = useState({ accounts: [], transactions: [], rules: [], budgets: [], rawEvents: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reloadTimer = useRef(null);

  useEffect(() => {
    if (demo) {
      setSession({ user: { id: 'demo', email: 'demo@example.com' } });
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [demo, supabase]);

  const load = useCallback(async () => {
    if (demo) {
      setData(demoData());
      setLoading(false);
      return;
    }
    if (!session) return;
    try {
      const since = new Date();
      since.setMonth(since.getMonth() - HISTORY_MONTHS);
      let { data: accounts, error: aErr } = await supabase.from('fin_accounts').select('*').order('sort');
      if (aErr) throw aErr;
      if (!accounts.length) {
        const { data: created, error: cErr } = await supabase.from('fin_accounts').insert(DEFAULT_ACCOUNTS).select();
        if (cErr) throw cErr;
        accounts = created;
      }
      const [transactions, rules, budgets, raw] = await Promise.all([
        fetchAll(() => supabase.from('fin_transactions').select('*').gte('occurred_at', since.toISOString()).order('occurred_at', { ascending: false })),
        supabase.from('fin_merchant_rules').select('*').then((r) => (r.error ? Promise.reject(r.error) : r.data)),
        supabase.from('fin_budgets').select('*').then((r) => (r.error ? Promise.reject(r.error) : r.data)),
        supabase.from('fin_raw_events').select('*').eq('status', 'unparsed').order('received_at', { ascending: false }).limit(50)
          .then((r) => (r.error ? Promise.reject(r.error) : r.data)),
      ]);
      setData({ accounts, transactions, rules, budgets, rawEvents: raw });
      setError(null);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [demo, session, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates: a new SMS / email / Wallet tap shows up without refreshing.
  useEffect(() => {
    if (demo || !session) return;
    const channel = supabase
      .channel('fin-transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fin_transactions' }, () => {
        clearTimeout(reloadTimer.current);
        reloadTimer.current = setTimeout(load, 600);
      })
      .subscribe();
    return () => {
      clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
    };
  }, [demo, session, supabase, load]);

  /** Call one of our /api/finance routes as the signed-in user. */
  const api = useCallback(
    async (path, body) => {
      if (demo) throw new Error('Not available in demo mode');
      const { data: s } = await supabase.auth.getSession();
      const res = await fetch(`/api/finance/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${s.session?.access_token}` },
        body: JSON.stringify(body ?? {}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      return json;
    },
    [demo, supabase]
  );

  const value = useMemo(
    () => ({ ...data, loading, error, reload: load, supabase, session, demo, api, setData }),
    [data, loading, error, load, supabase, session, demo, api]
  );

  return (
    <div className="fin-root">
      <header className="sticky top-0 z-20 border-b" style={{ borderColor: 'var(--fin-border)', background: 'var(--fin-page)' }}>
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/finance" className="flex items-center gap-2 font-semibold">
            <Wallet size={18} /> <span className="hidden sm:inline">Money</span>
          </Link>
          <nav className="fin-nav flex flex-1 gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <Link key={n.href} href={`${n.href}${demo && supabaseConfigured() ? '?demo=1' : ''}`} aria-current={pathname === n.href ? 'page' : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
          <button className="fin-btn" onClick={toggleTheme} aria-label="Toggle dark mode" style={{ padding: 7 }}>
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {session && !demo && (
            <button className="fin-btn" onClick={() => supabase.auth.signOut()} aria-label="Sign out" style={{ padding: 7 }}>
              <LogOut size={16} />
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {demo && (
          <p className="fin-card mb-4 px-4 py-2 text-sm fin-ink-2">
            {supabaseConfigured()
              ? 'Demo mode — showing made-up data.'
              : 'Demo mode — this build has no Supabase URL / anon key, so this is made-up data. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Netlify, then redeploy.'}
          </p>
        )}
        {session === undefined ? (
          <p className="fin-muted">Loading…</p>
        ) : !session ? (
          <SignIn supabase={supabase} />
        ) : (
          <FinanceContext.Provider value={value}>
            {error && <p className="fin-card mb-4 px-4 py-3 text-sm" style={{ color: 'var(--fin-bad)' }}>Couldn’t load data: {error}. Did you run the SQL migration?</p>}
            {children}
          </FinanceContext.Provider>
        )}
      </main>
    </div>
  );
}

function SignIn({ supabase }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="fin-card mx-auto mt-10 max-w-sm space-y-3 p-6">
      <h1 className="text-lg font-semibold">Sign in</h1>
      <p className="text-sm fin-ink-2">Private dashboard. Use the account you created in Supabase → Authentication → Users.</p>
      <div>
        <label className="fin-label" htmlFor="email">Email</label>
        <input id="email" className="fin-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className="fin-label" htmlFor="pw">Password</label>
        <input id="pw" className="fin-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {msg && <p className="text-sm" style={{ color: 'var(--fin-bad)' }}>{msg}</p>}
      <button className="fin-btn fin-btn-primary w-full justify-center" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
