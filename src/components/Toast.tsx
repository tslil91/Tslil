import { useEffect } from 'react';
import { useStore } from '../store/store';

export function Toast() {
  const toast = useStore((s) => s.toast);
  const clear = useStore((s) => s.clearToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clear, 3200);
    return () => clearTimeout(t);
  }, [toast, clear]);
  if (!toast) return null;
  return (
    <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-[60] flex min-h-11 w-[400px] -translate-x-1/2 items-center justify-center rounded bg-nav px-4 text-sm font-semibold text-white shadow-lg">
      {toast.message}
    </div>
  );
}
