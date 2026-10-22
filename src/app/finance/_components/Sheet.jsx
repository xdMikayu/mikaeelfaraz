'use client';
// The one modal Mifolio uses: a bottom sheet on phones (swipe it down to close) and a centred
// dialog from sm up. base-ui's Drawer does focus trapping, scroll lock, Escape, return focus and
// the swipe; finance.css does the look and the motion.
import { useState } from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { X } from '@phosphor-icons/react';

/**
 * Mount it to open it. `children(close)` renders the body; call `close()` (not the parent's
 * onClose) so the sheet animates out, after which `onClose` fires and the parent unmounts it.
 */
export default function Sheet({ title, subtitle, leading, size = 'lg', onClose, children }) {
  const [open, setOpen] = useState(true);
  const close = () => setOpen(false);
  // Portal inside .fin-root: the design tokens and the dark class are scoped there.
  const container = typeof document === 'undefined' ? undefined : document.querySelector('.fin-root');
  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && close()} onOpenChangeComplete={(o) => !o && onClose()}>
      <Drawer.Portal container={container}>
        <Drawer.Backdrop className="fin-sheet-backdrop" />
        <Drawer.Viewport className="fin-sheet-viewport">
          <Drawer.Popup className={`fin-card fin-sheet${size === 'md' ? ' fin-sheet-md' : ''}`}>
            <div className="fin-sheet-grab" aria-hidden />
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {leading}
                <div className="min-w-0">
                  <Drawer.Title className="fin-h2 truncate">{title}</Drawer.Title>
                  {subtitle && <Drawer.Description className="truncate text-xs fin-muted">{subtitle}</Drawer.Description>}
                </div>
              </div>
              <Drawer.Close className="fin-btn fin-btn-ghost fin-icon-btn shrink-0" aria-label="Close"><X size={18} /></Drawer.Close>
            </div>
            {/* Content: with a mouse, dragging selects text instead of moving the sheet. */}
            <Drawer.Content>{children(close)}</Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
