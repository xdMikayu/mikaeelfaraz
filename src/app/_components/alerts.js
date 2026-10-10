'use client';
import { useEffect, useRef } from 'react';
import { usePrefs } from './prefs';

/**
 * Browser notifications for followed teams while a Matchday tab is open: kick-off, goals,
 * red cards, full time. Never for a team under spoiler protection. Push alerts with the page
 * closed would need a server polling ESPN around the clock, which the free tiers don't cover well.
 */
export function useAlerts(matches) {
  const { prefs } = usePrefs();
  const seen = useRef(new Map());
  useEffect(() => {
    if (!prefs.alerts || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const ids = new Set(prefs.teams.map((t) => t.id));
    for (const m of matches) {
      if (!ids.has(m.home.id) && !ids.has(m.away.id)) continue;
      if (prefs.spoilers !== 'off') continue;
      const now = { h: m.home.score, a: m.away.score, state: m.status.state, red: m.home.red + m.away.red };
      const before = seen.current.get(m.id);
      seen.current.set(m.id, now);
      if (!before) continue; // first sight of a match is not news
      const score = `${m.home.short} ${now.h ?? 0}–${now.a ?? 0} ${m.away.short}`;
      const last = m.goals[m.goals.length - 1];
      if (before.state === 'pre' && now.state === 'in') notify(`Kick-off: ${m.home.short} v ${m.away.short}`, '', m.id);
      if (now.h !== before.h || now.a !== before.a) {
        const scored = (now.h ?? 0) + (now.a ?? 0) > (before.h ?? 0) + (before.a ?? 0);
        notify(scored ? `Goal: ${score}` : `Score corrected: ${score}`, last && scored ? `${last.name} ${last.minute}${last.og ? ' (own goal)' : last.pen ? ' (pen)' : ''}` : 'ESPN changed the score.', m.id);
      }
      if (now.red > before.red) notify(`Red card: ${m.home.short} v ${m.away.short}`, score, m.id);
      if (before.state === 'in' && now.state === 'post') notify(`Full time: ${score}`, '', m.id);
    }
  }, [matches, prefs.alerts, prefs.teams, prefs.spoilers]);
}

function notify(title, body, id) {
  try {
    const n = new Notification(title, { body, tag: `${id}-${title}`, icon: '/sport/icon-192.png' });
    n.onclick = () => {
      window.focus();
      window.location.href = `/sport/match?id=${id}`;
    };
  } catch {}
}
