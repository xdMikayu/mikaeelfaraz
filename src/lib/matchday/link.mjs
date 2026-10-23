// Matchday has its own address now. It keeps what a viewer chooses in their browser, under keys
// starting md-, and a browser keeps that per address: whatever was saved while Matchday lived at
// /sport here can only be read here. Links to it from this site take it along in the address, and
// Matchday's layout keeps it on arrival unless that browser already has its own.
export const MATCHDAY = 'https://matchday.mikaeelfaraz.com';

/** The address with the viewer's Matchday settings added: #md-import={…}, then &a= and the page's own #part. */
export function withPrefs(href) {
  try {
    const saved = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('md-')) saved[k] = localStorage.getItem(k);
    }
    if (!Object.keys(saved).length) return href;
    const u = new URL(href);
    const part = u.hash.slice(1);
    u.hash = `md-import=${encodeURIComponent(JSON.stringify(saved))}${/^[\w-]+$/.test(part) ? `&a=${part}` : ''}`;
    return u.href;
  } catch {
    return href;
  }
}
