'use client';

import { useState } from 'react';

// A step-through of how Mifolio files one purchase that reaches it three ways.
// The rules shown are the ones in the ingest code; the messages and numbers are made up.
const STEPS = [
  {
    at: '08:41',
    channel: 'Wallet',
    title: 'An Apple Wallet tap arrives first',
    message: '{ card: "Card ending 4821", merchant: "Starbucks", amount: 23.00 }',
    checks: [
      ['Already received this exact message?', false],
      ['Same card, amount and currency in the last 20 minutes?', false],
    ],
    outcome: 'New purchase',
    note: 'Wallet sends no timestamp, so the time is when the message arrived. That gets corrected if a better source turns up.',
    row: { time: '08:41 (approx.)', merchant: 'Starbucks', detail: 'from Wallet', sources: ['Wallet'], count: 1 },
  },
  {
    at: '08:42',
    channel: 'Email',
    title: 'Then the bank’s email alert',
    message: 'Your card ending with 4821 was used for a purchase of AED 23.00 at STARBUCKS DUBAI MALL on 09-OCT-2026 08:41 AM. Available limit is AED 11,420.00',
    checks: [
      ['Already received this exact message?', false],
      ['Same card, amount and currency in the last 20 minutes?', true],
      ['Has email already been merged into that purchase?', false],
    ],
    outcome: 'Merged into the same purchase',
    note: 'The bank alert carries the real time and the full merchant descriptor, so those replace what Wallet guessed. The available limit is kept for the card balance.',
    row: { time: '08:41', merchant: 'Starbucks', detail: 'STARBUCKS DUBAI MALL · limit AED 11,420', sources: ['Wallet', 'Email'], count: 1 },
  },
  {
    at: '08:47',
    channel: 'Email',
    title: 'The same email is sent again',
    message: 'Gmail sync retries and sends message id 18f2… a second time.',
    checks: [['Already received this exact message?', true]],
    outcome: 'Ignored: already received',
    note: 'Every message is stored before it is parsed, keyed on its message id, so a retry can never add a second purchase.',
    row: { time: '08:41', merchant: 'Starbucks', detail: 'STARBUCKS DUBAI MALL · limit AED 11,420', sources: ['Wallet', 'Email'], count: 1 },
  },
  {
    at: 'next day',
    channel: 'Statement',
    title: 'The monthly statement is imported',
    message: '10/10/2026   STARBUCKS DUBAI MALL   23.00',
    checks: [
      ['Same card, amount and currency within 36 hours?', true],
      ['Same Dubai day?', false],
      ['Or the same merchant name?', true],
    ],
    outcome: 'Merged into the same purchase',
    note: 'Statements only have a date, often the day the purchase posted rather than the day it happened. So they get a wider window, but must also share the day or the merchant name.',
    row: { time: '08:41', merchant: 'Starbucks', detail: 'STARBUCKS DUBAI MALL · limit AED 11,420', sources: ['Wallet', 'Email', 'Statement'], count: 1 },
  },
];

export default function OncePurchase() {
  const [n, setN] = useState(0);
  const [gap, setGap] = useState(12);
  const step = STEPS[n];
  const merged = gap <= 20;

  return (
    <div className="op">
      <div className="op-steps" role="tablist" aria-label="Messages, in the order they arrive">
        {STEPS.map((s, i) => (
          <button key={i} type="button" role="tab" aria-selected={i === n} onClick={() => setN(i)} className={i < n ? 'past' : ''}>
            <span className="mono">{s.at}</span>
            <span>{s.channel}</span>
          </button>
        ))}
      </div>

      <div className="op-body" role="tabpanel" aria-live="polite">
        <p className="op-title">{step.title}</p>
        <pre className="op-msg mono">{step.message}</pre>
        <ul className="op-checks">
          {step.checks.map(([q, yes]) => (
            <li key={q}><span className={yes ? 'yes' : 'no'}>{yes ? 'yes' : 'no'}</span>{q}</li>
          ))}
        </ul>
        <p className="op-outcome"><b>{step.outcome}.</b> {step.note}</p>

        <div className="op-ledger">
          <p className="mono faint">What Mifolio stores</p>
          <div className="op-row">
            <span className="mono">{step.row.time}</span>
            <span><b>{step.row.merchant}</b><br /><span className="faint">{step.row.detail}</span></span>
            <span className="op-src">{step.row.sources.map((s) => <i key={s}>{s}</i>)}</span>
            <span className="mono">AED 23.00</span>
          </div>
          <p className="mono faint">Purchases counted: {step.row.count}</p>
        </div>

        <div className="op-nav">
          <button type="button" onClick={() => setN(n - 1)} disabled={n === 0}>← back</button>
          <button type="button" onClick={() => setN(n + 1)} disabled={n === STEPS.length - 1}>next message →</button>
        </div>
      </div>

      <div className="op-try">
        <label htmlFor="op-gap">
          Now a second AED 23 coffee goes on the same card <b className="mono">{gap}</b> minutes later.
        </label>
        <input id="op-gap" type="range" min="1" max="60" value={gap} onChange={(e) => setGap(Number(e.target.value))} />
        <p>
          {merged
            ? <>Inside the 20-minute window, so it is <b>merged</b> into the first coffee and counted once. This is the trade-off of matching on card and amount: two identical purchases this close together look like one.</>
            : <>Outside the 20-minute window, so it is a <b>separate purchase</b>. Purchases counted: 2.</>}
        </p>
      </div>
    </div>
  );
}
