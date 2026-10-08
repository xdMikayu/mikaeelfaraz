'use client';

import { useEffect, useState } from 'react';

export const currentTheme = () => {
  const set = document.documentElement.getAttribute('data-theme');
  if (set) return set;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// Shared with the command menu, which fires the same event so this button stays in step.
export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('mf-theme', next); } catch {}
  window.dispatchEvent(new Event('mf-theme'));
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(null);
  useEffect(() => {
    const sync = () => setTheme(currentTheme());
    sync();
    window.addEventListener('mf-theme', sync);
    return () => window.removeEventListener('mf-theme', sync);
  }, []);
  if (!theme) return null;
  return (
    <button type="button" onClick={toggleTheme}>
      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  );
}
