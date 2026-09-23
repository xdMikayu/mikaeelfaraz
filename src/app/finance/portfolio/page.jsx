'use client';
import { useEffect, useState } from 'react';

const PLANNED = [
  { name: 'Gold', detail: 'Grams held × live 24K/22K price in AED, with buy price and gain.' },
  { name: 'DFM stocks', detail: 'Dubai Financial Market holdings (EMAAR, DEWA, SALIK, …) with daily price and P/L.' },
  { name: 'Crypto', detail: 'Solana first — balance × live SOL/USD, shown in USD and AED.' },
];

export default function Portfolio() {
  const [sol, setSol] = useState(null);
  useEffect(() => {
    // Free public endpoint; a small preview of what the tracker will pull.
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd,aed&include_24hr_change=true')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.solana && setSol(j.solana))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Portfolio <span className="ml-2 rounded-md px-2 py-0.5 text-xs font-medium" style={{ background: 'var(--fin-surface-2)', color: 'var(--fin-ink-2)' }}>Coming soon</span></h1>
        <p className="text-sm fin-ink-2">Net worth across gold, UAE stocks and crypto — next up after the card tracker.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {PLANNED.map((p) => (
          <div key={p.name} className="fin-card p-5">
            <h2 className="font-semibold">{p.name}</h2>
            <p className="mt-1 text-sm fin-ink-2">{p.detail}</p>
            {p.name === 'Crypto' && sol && (
              <p className="mt-3 text-sm">
                SOL <span className="fin-num font-semibold">${sol.usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                <span className="fin-muted"> · AED {sol.aed.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                {sol.usd_24h_change != null && (
                  <span style={{ color: sol.usd_24h_change >= 0 ? 'var(--fin-good)' : 'var(--fin-bad)' }}> {sol.usd_24h_change >= 0 ? '▲' : '▼'} {Math.abs(sol.usd_24h_change).toFixed(1)}%</span>
                )}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
