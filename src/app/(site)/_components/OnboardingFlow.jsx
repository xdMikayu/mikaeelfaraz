'use client';

import { useState } from 'react';

// Merchant onboarding before and after, as a simple flow. "Why?" notes open the reasoning
// behind a step. Kept at the level of the published case study.
const BEFORE = [
  { who: 'Sales', what: 'Collects documents and details over WhatsApp' },
  { who: 'Team', what: 'Types every setting into the admin panel, one by one' },
  { who: 'Team', what: 'Makes the print artwork by hand in Illustrator' },
  { who: 'Team', what: 'Sets up the CRM records and lets everyone know' },
];

const AFTER = [
  { who: 'Sales', what: 'Creates the deal', why: null },
  { who: 'Merchant', what: 'Fills in one secure link on their phone', why: 'The link expires and can be revoked, and the form checks details like the IBAN before it can be sent, so mistakes are caught before anyone reviews them.' },
  { who: 'Team', what: 'Reviews the submission', why: 'A person still looks at everything before it goes live. The tool removes the copying, not the judgement.' },
  { who: 'Team', what: 'Clicks publish', why: 'Publishing sets up every outlet, then reads each setting back to confirm it was saved, rather than trusting a success message.' },
  { who: 'Automatic', what: 'Venue live, CRM linked, print artwork ready, team told in Slack', why: 'There is no automatic rollback across systems. A half-finished setup is visible and easy to fix; an automatic undo would be a second source of bugs.' },
];

export default function OnboardingFlow() {
  const [mode, setMode] = useState('after');
  const [open, setOpen] = useState(null);
  const steps = mode === 'after' ? AFTER : BEFORE;

  return (
    <div className="flowbox">
      <div className="seg" role="group" aria-label="Show the process">
        <button type="button" aria-pressed={mode === 'before'} onClick={() => { setMode('before'); setOpen(null); }}>Before</button>
        <button type="button" aria-pressed={mode === 'after'} onClick={() => setMode('after')}>After</button>
      </div>
      <p className="flow-sum">
        {mode === 'after'
          ? 'On the team’s side, only the review and the publish click need a person. Tap why? to see the reasoning.'
          : 'Every merchant went through WhatsApp, the admin panel, Illustrator and the CRM, by hand.'}
      </p>
      <ol className={`flow ${mode}`}>
        {steps.map((s, i) => (
          <li key={`${mode}-${i}`}>
            <span className="flow-who mono">{s.who}</span>
            <span className="flow-what">
              {s.what}
              {s.why && (
                <button type="button" className="flow-why" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                  {open === i ? 'hide' : 'why?'}
                </button>
              )}
              {s.why && open === i && <span className="flow-note">{s.why}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
