'use client';

import { useState } from 'react';

// A fictional run of the CRM task automation: one venue's numbers come in, two questions are
// asked, and either a task goes to its account manager or nothing happens. The threshold is
// made up for the example; the real ones are not public.
const THRESHOLD = 25;

export default function TaskLab() {
  const [drop, setDrop] = useState(34);
  const [handled, setHandled] = useState(false);
  const [recovered, setRecovered] = useState(false);

  const big = drop >= THRESHOLD;
  const task = !handled && big;
  const steps = [
    { k: 'in', label: 'Yesterday’s numbers arrive', state: 'done', detail: `Adoption ${drop}% below this venue’s usual` },
    { k: 'h', label: 'Is someone already working this venue?', state: handled ? 'stop' : 'pass', detail: handled ? 'Yes, so no new task. The queue does not repeat itself.' : 'No' },
    { k: 'b', label: 'Is the drop big enough to be worth a call?', state: handled ? 'skip' : big ? 'pass' : 'stop', detail: handled ? 'Not checked' : big ? `Yes (${drop}% against a ${THRESHOLD}% line)` : `No (${drop}% against a ${THRESHOLD}% line). Noise stays out of the queue.` },
    { k: 't', label: 'Task for the venue’s account manager', state: task ? (recovered ? 'closed' : 'live') : 'skip', detail: task ? (recovered ? 'Closed automatically: the numbers recovered.' : 'Opened with the reason, the owner and a due date.') : 'Not created' },
  ];

  return (
    <div className="lab" aria-label="Example: how one venue becomes a task">
      <div className="lab-controls">
        <label className="lab-range">
          <span>Drop against the venue’s usual <b className="mono">{drop}%</b></span>
          <input type="range" min="0" max="60" value={drop} onChange={(e) => { setDrop(Number(e.target.value)); setRecovered(false); }} />
        </label>
        <div className="lab-switches">
          <button type="button" aria-pressed={handled} onClick={() => { setHandled(!handled); setRecovered(false); }}>
            Someone is already on it
          </button>
          <button type="button" aria-pressed={recovered} disabled={!task} onClick={() => setRecovered(!recovered)}>
            Numbers recover
          </button>
        </div>
      </div>

      <ol className="lab-flow">
        {steps.map((s) => (
          <li key={s.k} className={`st-${s.state}`}>
            <span className="lab-dot" aria-hidden="true" />
            <span className="lab-step">
              <b>{s.label}</b>
              <span>{s.detail}</span>
            </span>
          </li>
        ))}
      </ol>

      <p className="lab-result">
        {task
          ? recovered ? <><b>Done.</b> The task opened and closed without anyone having to tidy it up.</> : <><b>One task, one owner.</b> Fictional venue, fictional numbers.</>
          : <><b>No task.</b> {handled ? 'Someone is already working this venue.' : 'The change is too small to be worth a call.'}</>}
      </p>
      <p className="lab-note mono faint">Illustration with made-up numbers and a made-up threshold</p>
    </div>
  );
}
