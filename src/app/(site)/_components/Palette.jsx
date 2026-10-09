'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { selected } from '../_data/work';
import { notes } from '../_data/notes';
import { EMAIL } from './CopyEmail';
import { toggleTheme } from './ThemeToggle';

// A plain command menu. No animation on open or close: it is a keyboard tool and should feel instant.
export default function Palette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const [note, setNote] = useState('');
  const box = useRef(null);
  const back = useRef(null);
  const router = useRouter();
  const path = usePathname();

  const goHome = (id, then) => {
    if (path === '/') {
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
      history.replaceState(null, '', `#${id}`);
      if (then) setTimeout(then, 30);
    } else {
      router.push(`/#${id}`);
      if (then) setTimeout(then, 400);
    }
  };

  const items = useMemo(() => [
    { group: 'Go to', label: 'Type the alphabet against my record', keys: 'a z typing guinness record game', run: () => goHome('az', () => window.dispatchEvent(new Event('mf-az-focus'))) },
    ...selected.map((w) => ({ group: 'Case studies', label: w.system, keys: `${w.stack} ${w.outcome}`, run: () => router.push(`/work/${w.slug}`) })),
    { group: 'Go to', label: 'Mifolio, my own product', keys: 'finance tracker', run: () => goHome('mifolio') },
    ...notes.map((n) => ({ group: 'Writing', label: n.title, keys: n.summary, run: () => router.push(`/notes/${n.slug}`) })),
    { group: 'Go to', label: 'Background', keys: 'experience dunkin getdopamine university', run: () => goHome('before') },
    { group: 'Go to', label: 'Home', keys: 'top start', run: () => (path === '/' ? window.scrollTo(0, 0) : router.push('/')) },
    { group: 'Do', label: 'Copy email address', keys: `contact mail ${EMAIL}`, run: async () => { try { await navigator.clipboard.writeText(EMAIL); } catch {} return 'Copied ' + EMAIL; } },
    { group: 'Do', label: 'Open résumé (PDF)', keys: 'cv resume pdf', run: () => window.open('/resume.pdf', '_blank') },
    { group: 'Do', label: 'Résumé as JSON', keys: 'json api machine', run: () => window.open('/resume.json', '_blank') },
    { group: 'Do', label: 'Switch light or dark', keys: 'theme dark light mode', run: () => { toggleTheme(); return 'Theme switched'; } },
    { group: 'Elsewhere', label: 'LinkedIn', keys: 'linkedin', run: () => window.open('https://www.linkedin.com/in/mikaeelf/', '_blank') },
    { group: 'Elsewhere', label: 'GitHub', keys: 'github code', run: () => window.open('https://github.com/xdMikayu', '_blank') },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [path]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((it) => `${it.label} ${it.keys} ${it.group}`.toLowerCase().includes(s));
  }, [q, items]);

  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === '/' && !typing) { e.preventDefault(); setOpen(true); }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('mf-palette', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mf-palette', onOpen); };
  }, []);

  useEffect(() => {
    if (open) {
      back.current = document.activeElement;
      setQ(''); setAt(0); setNote('');
      setTimeout(() => box.current?.focus(), 0);
    } else if (back.current && back.current.focus && (!document.activeElement || document.activeElement === document.body)) {
      back.current.focus({ preventScroll: true });
    }
  }, [open]);

  useEffect(() => setAt(0), [q]);

  const run = async (it) => {
    const msg = await it.run();
    if (typeof msg === 'string') { setNote(msg); setTimeout(() => setOpen(false), 700); }
    else setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setAt((a) => Math.min(a + 1, shown.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && shown[at]) { e.preventDefault(); run(shown[at]); }
  };

  if (!open) return null;
  let lastGroup = null;
  return (
    <div className="pal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="pal" role="dialog" aria-modal="true" aria-label="Command menu">
        <input
          ref={box}
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Jump to a case study, copy my email, switch theme…"
          aria-controls="pal-list"
          aria-activedescendant={shown[at] ? `pal-${at}` : undefined}
          role="combobox"
          aria-expanded="true"
          autoComplete="off"
          spellCheck={false}
        />
        <ul id="pal-list" role="listbox">
          {shown.map((it, i) => {
            const head = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <li key={it.label} role="presentation">
                {head && <div className="pal-group mono faint">{head}</div>}
                <div
                  id={`pal-${i}`}
                  role="option"
                  aria-selected={i === at}
                  className={i === at ? 'on' : ''}
                  onMouseMove={() => setAt(i)}
                  onClick={() => run(it)}
                >
                  {it.label}
                </div>
              </li>
            );
          })}
          {!shown.length && <li className="pal-empty faint">Nothing matches. Try “email” or “crm”.</li>}
        </ul>
        <div className="pal-foot mono faint" aria-live="polite">
          {note || '↑ ↓ move · enter open · esc close'}
        </div>
      </div>
    </div>
  );
}

export function PaletteButton() {
  const [mac, setMac] = useState(true);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.userAgent)), []);
  return (
    <button type="button" className="pal-btn mono" onClick={() => window.dispatchEvent(new Event('mf-palette'))} aria-label="Open command menu">
      <kbd>{mac ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd>
    </button>
  );
}
