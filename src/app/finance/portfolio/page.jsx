'use client';
import { useEffect, useState } from 'react';
import { Coins, ChartCandlestick, Bitcoin, TrendingUp, TrendingDown } from 'lucide-react';

const PLANNED = [
  { name: 'Gold', icon: Coins, detail: 'Grams held × live 24K/22K price in AED, with buy price and gain.' },
  { name: 'DFM stocks', icon: ChartCandlestick, detail: 'Dubai Financial Market holdings (EMAAR, DEWA, SALIK, …) with daily price and P/L.' },
  { name: 'Crypto', icon: Bitcoin, detail: 'Solana first — balance × live SOL/USD, shown in USD and AED.' },
];

const money = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

export default function Portfolio() {
  const [sol, setSol] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    // Free public endpoint; a small preview of what the tracker will pull.
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd,aed&include_24hr_change=true')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.solana ? setSol(j.solana) : setFailed(true)))
      .catch(() => setFailed(true));
  }, []);

  const up = sol?.usd_24h_change >= 0;

  return (
    <div className="space-y-6 fin-fade-in">
      <div>
        <p className="fin-eyebrow">Net worth</p>
        <h1 className="fin-h1 mt-1 flex flex-wrap items-center gap-3">
          Portfolio <span className="fin-pill fin-pill-accent">Coming soon</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm fin-ink-2">Gold, UAE stocks and crypto in one place — next up after the card tracker.</p>
      </div>

      <div className="fin-card fin-card-hero p-6 sm:p-8">
        <p className="fin-eyebrow">Live preview · Solana</p>
        {sol ? (
          <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
            <p className="fin-hero-num fin-num"><span className="fin-cur">$</span>{money(sol.usd)}</p>
            {sol.usd_24h_change != null && (
              <span className={`fin-pill ${up ? 'fin-pill-good' : 'fin-pill-bad'} mb-2`}>
                {up ? <TrendingUp size={13} strokeWidth={2.4} /> : <TrendingDown size={13} strokeWidth={2.4} />}
                {Math.abs(sol.usd_24h_change).toFixed(1)}% · 24h
              </span>
            )}
          </div>
        ) : failed ? (
          <p className="mt-3 text-sm fin-muted">Price unavailable right now.</p>
        ) : (
          <div className="fin-skeleton mt-3 h-12 w-56" />
        )}
        {sol && <p className="mt-2 text-sm fin-muted">AED {money(sol.aed)} per SOL</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PLANNED.map(({ name, icon: Icon, detail }) => (
          <div key={name} className="fin-card p-5">
            <span className="fin-avatar"><Icon size={18} /></span>
            <h2 className="fin-h2 mt-4">{name}</h2>
            <p className="mt-1 text-sm fin-ink-2">{detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
