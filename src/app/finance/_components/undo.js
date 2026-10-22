// Delete with an Undo toast instead of a confirm() box. The row disappears straight away, but
// nothing is deleted until the toast goes: Undo puts it back, and if the page is closed first
// the data simply stays. Safer than deleting and re-inserting, which would lose links to it.
import { toast } from 'sonner';

// Ids waiting to be deleted, so a reload in the meantime doesn't bring them back on screen.
export const pendingDeletes = new Set();

export function deleteWithUndo({ message, ids = [], hide, restore, commit }) {
  let settled = false;
  ids.forEach((id) => pendingDeletes.add(id));
  hide();
  const finish = async () => {
    if (settled) return;
    settled = true;
    try {
      await commit();
    } catch (e) {
      restore();
      toast.error(`Couldn’t delete: ${e.message || e}`);
    } finally {
      ids.forEach((id) => pendingDeletes.delete(id));
    }
  };
  toast(message, {
    duration: 5000,
    action: {
      label: 'Undo',
      onClick: () => {
        if (settled) return;
        settled = true;
        ids.forEach((id) => pendingDeletes.delete(id));
        restore();
      },
    },
    onAutoClose: finish,
    onDismiss: finish,
  });
}
