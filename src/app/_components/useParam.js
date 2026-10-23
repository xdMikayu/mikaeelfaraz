'use client';
import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * A tab kept in the address (/fantasy?tab=players&view=sets), so every view can be linked
 * to, found from search and come back to. Changing it replaces the address without a page load;
 * `clear` names the other parameters that belong to the old choice (a tab's own sub-tab).
 */
export function useParam(key, fallback, allowed) {
  const params = useSearchParams();
  const raw = params.get(key);
  const value = raw != null && (!allowed || allowed.includes(raw)) ? raw : fallback;
  const set = useCallback(
    (v, clear = []) => {
      const next = new URLSearchParams(window.location.search);
      if (v == null || v === fallback) next.delete(key);
      else next.set(key, v);
      for (const k of clear) next.delete(k);
      const qs = next.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
    },
    [key, fallback]
  );
  return [value, set];
}

/**
 * A row of tabs wider than the screen scrolls sideways; the chosen one (opened from a link, say)
 * is brought into the row's view, without moving the page.
 */
export function useTabInView(row, value) {
  useEffect(() => {
    const el = row.current;
    const on = el?.querySelector('[aria-selected="true"], [aria-checked="true"]');
    if (!on) return;
    const a = el.getBoundingClientRect();
    const b = on.getBoundingClientRect();
    if (b.right > a.right) el.scrollLeft += b.right - a.right + 16;
    else if (b.left < a.left) el.scrollLeft -= a.left - b.left + 16;
  }, [row, value]);
}
