'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Moon, Sun, LogOut, LayoutDashboard, ReceiptText, Settings2, TrendingUp, Lock } from 'lucide-react';
import { getSupabase, supabaseConfigured } from '@/lib/finance/supabase-browser';
import { DEFAULT_ACCOUNTS } from '@/lib/finance/accounts.mjs';
import { demoData } from './demo';

const FinanceContext = createContext(null);
export const useFinance = () => useContext(FinanceContext);

const HISTORY_MONTHS = 24;
const PAGE = 1000;

const NAV = [
  { href: '/finance', label: 'Overview', icon: LayoutDashboard },
  { href: '/finance/transactions', label: 'Activity', icon: ReceiptText },
  { href: '/finance/portfolio', label: 'Portfolio', icon: TrendingUp },
  { href: '/finance/setup', label: 'Setup', icon: Settings2 },
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

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-[10px] text-[15px] font-bold" style={{ background: 'linear-gradient(135deg, var(--fin-s1), var(--fin-s7))', color: '#fff' }}>M</span>
      <span className="text-[15px] font-semibold tracking-tight">Money</span>
    </span>
  );
}

export default function FinanceShell({ children }) {
  const [dark, toggleTheme] = useTheme();
  const pathname = usePathname();
  const params = useSearchParams();
  const demo = params.get('demo') === '1' || !supabaseConfigured();
  const supabase = demo ? null : getSupabase();
  const keepDemo = demo && supabaseConfigured();
  const href = useCallback((path) => `${path}${keepDemo ? (path.includes('?') ? '&' : '?') + 'demo=1' : ''}`, [keepDemo]);

  const [session, setSession] = useState(undefined); // undefined = loading
  const [data, setData] = useState({ accounts: [], transactions: [], rules: [], budgets: [], rawEvents: [], activity: [] });
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
      const [transactions, rules, budgets, raw, activity] = await Promise.all([
        fetchAll(() => supabase.from('fin_transactions').select('*').gte('occurred_at', since.toISOString()).order('occurred_at', { ascending: false })),
        supabase.from('fin_merchant_rules').select('*').then((r) => (r.error ? Promise.reject(r.error) : r.data)),
        supabase.from('fin_budgets').select('*').then((r) => (r.error ? Promise.reject(r.error) : r.data)),
        supabase.from('fin_raw_events').select('*').eq('status', 'unparsed').order('received_at', { ascending: false }).limit(50)
          .then((r) => (r.error ? Promise.reject(r.error) : r.data)),
        // Everything that reached the ingest endpoint, whatever happened to it.
        supabase.from('fin_raw_events').select('id, received_at, source, status, reason, payload').order('received_at', { ascending: false }).limit(25)
          .then((r) => (r.error ? Promise.reject(r.error) : r.data)),
      ]);
      setData({ accounts, transactions, rules, budgets, rawEvents: raw, activity });
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
    () => ({ ...data, loading, error, reload: load, supabase, session, demo, api, setData, href }),
    [data, loading, error, load, supabase, session, demo, api, href]
  );

  const signedIn = Boolean(session);
  const isActive = (h) => (h === '/finance' ? pathname === h : pathname.startsWith(h));

  return (
    <div className="fin-root">
      {signedIn && (
        <aside className="fin-side">
          <Link href={href('/finance')} className="mb-8 px-2"><Logo /></Link>
          <nav className="flex flex-col gap-1">
            {NAV.map(({ href: h, label, icon: Icon }) => (
              <Link key={h} href={href(h)} className="fin-nav-item" aria-current={isActive(h) ? 'page' : undefined}>
                <Icon size={18} strokeWidth={1.9} /> {label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-1">
            {demo && <p className="fin-inset mb-2 px-3 py-2 text-xs fin-ink-2">Demo data</p>}
            <button className="fin-nav-item" onClick={toggleTheme}>{dark ? <Sun size={18} /> : <Moon size={18} />} {dark ? 'Light mode' : 'Dark mode'}</button>
            {!demo && <button className="fin-nav-item" onClick={() => supabase.auth.signOut()}><LogOut size={18} /> Sign out</button>}
          </div>
        </aside>
      )}

      <div className={signedIn ? 'lg:pl-[248px]' : ''}>
        <header className="fin-topbar">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <Link href={href('/finance')}><Logo /></Link>
            <div className="flex items-center gap-1">
              <button className="fin-btn fin-btn-ghost fin-icon-btn" onClick={toggleTheme} aria-label="Toggle dark mode">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
              {signedIn && !demo && (
                <button className="fin-btn fin-btn-ghost fin-icon-btn" onClick={() => supabase.auth.signOut()} aria-label="Sign out"><LogOut size={18} /></button>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-32 pt-5 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
          {demo && (
            <div className="fin-card mb-5 flex items-start gap-3 px-4 py-3 text-sm fin-ink-2">
              <span className="fin-pill fin-pill-accent shrink-0">Demo</span>
              <span>
                {supabaseConfigured()
                  ? 'You’re looking at made-up data.'
                  : 'This build has no Supabase URL / anon key, so this is made-up data. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Netlify, then redeploy.'}
              </span>
            </div>
          )}
          {session === undefined ? (
            <LoadingState />
          ) : !session ? (
            <SignIn supabase={supabase} />
          ) : (
            <FinanceContext.Provider value={value}>
              {error && (
                <div className="fin-card mb-5 px-4 py-3 text-sm" style={{ color: 'var(--fin-bad)' }}>
                  Couldn’t load data: {error}. Did you run the SQL migration?
                </div>
              )}
              {children}
            </FinanceContext.Provider>
          )}
        </main>
      </div>

      {signedIn && (
        <nav className="fin-tabbar" aria-label="Sections">
          {NAV.map(({ href: h, label, icon: Icon }) => (
            <Link key={h} href={href(h)} aria-current={isActive(h) ? 'page' : undefined}>
              <Icon size={20} strokeWidth={isActive(h) ? 2.2 : 1.8} />
              {label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="fin-skeleton h-9 w-56" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="fin-skeleton h-44 lg:col-span-2" />
        <div className="fin-skeleton h-44" />
      </div>
      <div className="fin-skeleton h-72" />
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
    <div className="grid min-h-[70vh] place-items-center">
      <form onSubmit={submit} className="fin-card fin-card-hero fin-fade-in w-full max-w-sm space-y-4 p-7">
        <div className="mb-2 flex flex-col items-start gap-4">
          <Logo />
          <div>
            <h1 className="fin-h1">Welcome back</h1>
            <p className="mt-1 text-sm fin-ink-2">Your private spending dashboard.</p>
          </div>
        </div>
        <div>
          <label className="fin-label" htmlFor="email">Email</label>
          <input id="email" className="fin-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="fin-label" htmlFor="pw">Password</label>
          <input id="pw" className="fin-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {msg && <p className="text-sm" style={{ color: 'var(--fin-bad)' }}>{msg}</p>}
        <button className="fin-btn fin-btn-primary h-11 w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="flex items-center gap-1.5 text-xs fin-muted"><Lock size={12} /> Data is private to your account.</p>
      </form>
    </div>
  );
}
