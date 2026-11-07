import { useSync } from '../sync/sync';

/** Warns when the connection to the server is lost (changes made meanwhile are not saved until it returns). */
export function SyncBanner() {
  const { mode, status, unsaved } = useSync();
  if (mode !== 'server' || status !== 'offline') return null;
  return (
    <div role="alert" className="flex shrink-0 items-center gap-2 bg-danger px-4 py-2 text-[13px] font-semibold text-white">
      אין חיבור לשרת — {unsaved > 0 ? `${unsaved} שינויים טרם נשמרו. ` : ''}מנסה להתחבר מחדש. אל תסגור/י את הדף.
    </div>
  );
}
