'use client';
import { Fragment, useEffect, useRef, useState } from 'react';

// Ask Matchday AI about a transfer (src/lib/chat.mjs through /api/chat): why we suggest
// one player and not the one you want, whether yours is a good pick anyway, who else fits the budget.
// The answer streams in as it's written; while the model looks things up the page says what it's
// checking. The conversation is kept for this browser tab, per team.

const KEY = (id) => `sp-chat-${id}`;
const load = (id) => {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY(id)) ?? '[]');
    return Array.isArray(v) ? v.filter((m) => m && typeof m.content === 'string') : [];
  } catch {
    return [];
  }
};
const save = (id, messages) => {
  try {
    sessionStorage.setItem(KEY(id), JSON.stringify(messages.slice(-20)));
  } catch {
    // Private mode or storage full: the conversation just won't survive a reload.
  }
};

/** **bold** inside a line of the answer. */
function Inline({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (/^\*\*[^*]+\*\*$/.test(part) ? <b key={i}>{part.slice(2, -2)}</b> : <Fragment key={i}>{part}</Fragment>));
}

/** The answer as paragraphs and lists: the little markdown the model is asked to use. */
function Answer({ text }) {
  const blocks = [];
  for (const line of text.split('\n')) {
    const item = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    const last = blocks[blocks.length - 1];
    if (item) {
      if (last?.type === 'list') last.items.push(item[1]);
      else blocks.push({ type: 'list', items: [item[1]] });
    } else if (line.trim()) {
      if (last?.type === 'p' && !last.closed) last.lines.push(line.trim());
      else blocks.push({ type: 'p', lines: [line.trim()] });
    } else if (last) last.closed = true;
  }
  return blocks.map((b, i) =>
    b.type === 'list' ? (
      <ul key={i}>
        {b.items.map((t, j) => (
          <li key={j}>
            <Inline text={t} />
          </li>
        ))}
      </ul>
    ) : (
      <p key={i}>
        <Inline text={b.lines.join(' ')} />
      </p>
    ),
  );
}

export default function TransferChat({ entry, horizon, league, suggestions = [] }) {
  const id = entry?.id;
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const abort = useRef(null);
  const box = useRef(null);
  const list = useRef(null);

  useEffect(() => {
    if (id) setMessages(load(id));
    return () => abort.current?.abort();
  }, [id]);
  useEffect(() => {
    // Keep the newest words in view while the answer streams in.
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const send = async (text) => {
    const q = text.trim();
    if (!q || busy || !id) return;
    const history = [...messages, { role: 'user', content: q }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setDraft('');
    setError('');
    setStatus('Thinking it through');
    setBusy(true);
    const ctl = new AbortController();
    abort.current = ctl;
    let answer = '';
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, horizon, league: league ?? undefined, messages: history }),
        signal: ctl.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Matchday AI answered ${res.status}`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.t === 'status') setStatus(ev.text);
          else if (ev.t === 'text') {
            answer += ev.d;
            setStatus('');
            setMessages([...history, { role: 'assistant', content: answer }]);
          } else if (ev.t === 'error') throw new Error(ev.error);
          else if (ev.t === 'done') finished = true;
        }
      }
      // A connection that drops mid-answer keeps what arrived, marked as cut short.
      if (!finished && !answer) throw new Error('The answer was cut off. Try again.');
      if (!finished) answer += ' …';
      const done = [...history, { role: 'assistant', content: answer }];
      setMessages(done);
      save(id, done);
    } catch (e) {
      const stopped = e.name === 'AbortError';
      // Keep what was written; an empty answer leaves the question to ask again.
      const kept = answer ? [...history, { role: 'assistant', content: answer }] : history.slice(0, -1);
      setMessages(kept);
      save(id, kept);
      if (!answer) setDraft(q);
      if (!stopped) setError(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
      setStatus('');
      abort.current = null;
    }
  };

  const clear = () => {
    abort.current?.abort();
    setMessages([]);
    save(id, []);
    setError('');
  };

  const ideas = [
    ...suggestions.slice(0, 1).flatMap((s) => [`Why ${s.in} for ${s.out}?`, `Who else could replace ${s.out}?`]),
    'Which of my players should I sell first?',
  ].slice(0, 3);

  return (
    <section className="sp-panel sp-chat" id="ask">
      <div className="sp-section-head">
        <h2 className="sp-h2">Ask Matchday AI</h2>
        {messages.length > 0 && (
          <button className="sp-tiny sp-link sp-ink2" onClick={clear}>
            New chat
          </button>
        )}
      </div>
      <p className="sp-small sp-ink2" style={{ margin: '4px 0 10px' }}>
        Ask about any player or move, like “Why not Vuskovic instead of Tavernier?”: why we suggest one player and not the one you want, whether yours is fine anyway, who else fits your
        budget. It answers from the same numbers as the planner, over the next {horizon} gameweeks.
      </p>
      {messages.length > 0 && (
        <div className="sp-chat-log" ref={list} aria-live="polite">
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <p key={i} className="sp-chat-q">
                {m.content}
              </p>
            ) : (
              <div key={i} className="sp-chat-a">
                <span className="sp-chat-who">Matchday AI</span>
                {m.content ? <Answer text={m.content} /> : <p className="sp-muted">{status || 'Thinking it through'}…</p>}
                {busy && i === messages.length - 1 && m.content && status && <p className="sp-tiny sp-muted">{status}…</p>}
              </div>
            ),
          )}
        </div>
      )}
      {messages.length === 0 && (
        <div className="sp-chat-ideas">
          {ideas.map((t) => (
            <button key={t} className="sp-chat-idea" onClick={() => send(t)} disabled={busy}>
              {t}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="sp-small" role="alert" style={{ margin: '8px 0 0', color: 'var(--sp-loss)' }}>
          {error}
        </p>
      )}
      <form
        className="sp-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <textarea
          ref={box}
          className="sp-chat-input"
          rows={1}
          value={draft}
          maxLength={800}
          placeholder="Ask about any player or transfer"
          aria-label="Ask Matchday AI about a transfer"
          onChange={(e) => {
            setDraft(e.target.value);
            const el = e.target;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(draft);
            }
          }}
        />
        {busy ? (
          <button type="button" className="sp-chat-send" onClick={() => abort.current?.abort()} aria-label="Stop">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor" />
            </svg>
          </button>
        ) : (
          <button type="submit" className="sp-chat-send" disabled={!draft.trim()} aria-label="Send">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </form>
      <p className="sp-tiny sp-muted" style={{ margin: '8px 0 0' }}>
        Matchday AI explains our projections and FPL’s data. Both have real error, and it knows injuries only from FPL’s flags.
      </p>
    </section>
  );
}
