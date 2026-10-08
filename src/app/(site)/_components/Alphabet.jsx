'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const RECORD = 3.01; // seconds, touchscreen phone, July 2022

const read = (k) => { try { const v = parseFloat(localStorage.getItem(k)); return Number.isFinite(v) ? v : null; } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, String(v)); } catch {} };

// The clock starts on "a" and stops on "z". A wrong key does not advance; it is counted.
export default function Alphabet() {
  const input = useRef(null);
  const clock = useRef(null);
  const times = useRef([]);
  const raf = useRef(0);
  const [idx, setIdx] = useState(0);
  const [misses, setMisses] = useState(0);
  const [miss, setMiss] = useState(false);
  const [result, setResult] = useState(null);
  const [focused, setFocused] = useState(false);
  const [device, setDevice] = useState('keys');
  const [best, setBest] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const d = window.matchMedia('(pointer: coarse)').matches ? 'phone' : 'keys';
    setDevice(d);
    setBest(read(`mf-az-best-${d}`));
    const focus = () => input.current?.focus({ preventScroll: true });
    window.addEventListener('mf-az-focus', focus);
    return () => { window.removeEventListener('mf-az-focus', focus); cancelAnimationFrame(raf.current); };
  }, []);

  const reset = useCallback(() => {
    cancelAnimationFrame(raf.current);
    times.current = [];
    setIdx(0);
    setMisses(0);
    setResult(null);
    setCopied(false);
    if (clock.current) clock.current.textContent = '0.00';
    if (input.current) input.current.value = '';
  }, []);

  const tick = () => {
    const t0 = times.current[0];
    if (clock.current && t0 != null) clock.current.textContent = ((performance.now() - t0) / 1000).toFixed(2);
    raf.current = requestAnimationFrame(tick);
  };

  const finish = (n) => {
    cancelAnimationFrame(raf.current);
    const t = times.current;
    const total = (t[25] - t[0]) / 1000;
    const splits = t.slice(1).map((v, i) => (v - t[i]) / 1000);
    let slow = 0;
    splits.forEach((s, i) => { if (s > splits[slow]) slow = i; });
    if (clock.current) clock.current.textContent = total.toFixed(2);
    const key = `mf-az-best-${device}`;
    const prev = read(key);
    const isBest = prev == null || total < prev;
    if (isBest) { write(key, total); setBest(total); }
    setResult({ total, splits, slow, misses: n, isBest });
  };

  const onInput = (e) => {
    const typed = e.target.value.toLowerCase();
    const now = performance.now();
    let i = idx;
    let m = misses;
    let wrong = false;
    for (const c of typed.slice(i)) {
      if (i >= 26 || !/[a-z]/.test(c)) continue;
      if (c === LETTERS[i]) {
        times.current[i] = now;
        if (i === 0) raf.current = requestAnimationFrame(tick);
        i += 1;
      } else if (i > 0) {
        m += 1;
        wrong = true;
      }
    }
    e.target.value = LETTERS.slice(0, i);
    if (wrong) { setMiss(true); setTimeout(() => setMiss(false), 140); }
    setMisses(m);
    setIdx(i);
    if (i === 26) finish(m);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape' || (result && e.key === 'Enter')) { e.preventDefault(); reset(); }
    else if (result && e.key.toLowerCase() === 'a') { reset(); }
  };

  const share = async () => {
    if (!result) return;
    const where = device === 'phone' ? 'on a phone' : 'on a keyboard';
    const text = `I typed a to z in ${result.total.toFixed(2)}s ${where} at mikaeelfaraz.com/#az. His phone record was ${RECORD}s.`;
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch {}
  };

  const verdict = () => {
    if (!result) return null;
    const { total } = result;
    if (device === 'phone') {
      if (total < RECORD) return <>Faster than my record. I would like to hear how: <a href="mailto:mikaeel2013@gmail.com">email me</a>.</>;
      return <>{(total - RECORD).toFixed(2)}s off my record.</>;
    }
    return <>That was on a keyboard; mine was on a phone screen. Try it on your phone.</>;
  };

  const maxSplit = result ? Math.max(...result.splits) : 1;

  return (
    <div className={`az${focused ? ' focus' : ''}${result ? ' done' : ''}`}>
      <div className="az-top">
        <div>
          <span className="az-clock mono" ref={clock} aria-hidden="true">0.00</span>
          <span className="mono faint"> s</span>
        </div>
        <div className="az-ref mono faint">
          <span>my phone record <b>{RECORD.toFixed(2)}</b></span>
          {best != null && <span>your best here <b>{best.toFixed(2)}</b></span>}
        </div>
      </div>

      <label className={`az-track${miss ? ' miss' : ''}`}>
        <span className="sr">Type the alphabet from a to z. The clock starts on a.</span>
        <input
          ref={input}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="done"
          aria-describedby="az-status"
          onInput={onInput}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <span className="az-letters mono" aria-hidden="true">
          {LETTERS.split('').map((l, i) => (
            <span key={l} className={i < idx ? 'hit' : i === idx && !result ? 'nx' : ''}>{l}</span>
          ))}
        </span>
      </label>

      <p id="az-status" className="az-status" aria-live="polite">
        {!result && idx === 0 && (focused ? 'Go. The clock starts on a.' : device === 'phone' ? 'Tap the letters, then type a to z.' : 'Click the letters, then type a to z.')}
        {!result && idx > 0 && <span className="faint">{misses ? `${misses} wrong key${misses > 1 ? 's' : ''}. ` : ''}Esc to restart.</span>}
        {result && (
          <>
            <b>{result.total.toFixed(2)}s</b>{result.misses ? `, ${result.misses} wrong key${result.misses > 1 ? 's' : ''}` : ', clean'}.{' '}
            {verdict()}{' '}
            <button type="button" className="copy" onClick={share}>{copied ? 'copied' : 'copy result'}</button>{' '}
            <button type="button" className="copy" onClick={() => { reset(); input.current?.focus(); }}>again</button>
          </>
        )}
      </p>

      {result && (
        <figure className="az-splits">
          <div className="bars" role="img" aria-label={`Time between letters. Slowest was ${LETTERS[result.slow]} to ${LETTERS[result.slow + 1]}, ${result.splits[result.slow].toFixed(2)} seconds.`}>
            {result.splits.map((s, i) => (
              <span key={i} className={i === result.slow ? 'slow' : ''} style={{ height: `${Math.max(4, (s / maxSplit) * 100)}%` }} title={`${LETTERS[i]} to ${LETTERS[i + 1]}: ${s.toFixed(3)}s`} />
            ))}
          </div>
          <figcaption className="mono faint">
            time between letters · slowest {LETTERS[result.slow]}→{LETTERS[result.slow + 1]} {result.splits[result.slow].toFixed(2)}s
          </figcaption>
        </figure>
      )}
    </div>
  );
}
