import { useEffect, useId, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  width?: number;
  alert?: boolean;
}

/** Floating modal window: backdrop click or Escape closes; focus moves inside and returns on close. */
export function Dialog({ title, onClose, children, footer, width = 560, alert = false }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>('input, select, textarea, [data-autofocus]');
    (first ?? panel.current)?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); previous?.focus(); };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button type="button" aria-label="סגירה" tabIndex={-1} className="absolute inset-0 bg-[rgba(18,38,58,.5)]" onClick={onClose} />
      <div
        ref={panel}
        role={alert ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[90vh] flex-col gap-3.5 rounded bg-surface p-5 shadow-[0_24px_60px_rgba(0,0,0,.35)] outline-none"
        style={{ width }}
      >
        <h2 id={titleId} className="m-0 text-lg font-bold">{title}</h2>
        <div className="min-h-0 overflow-y-auto">{children}</div>
        <div className="flex justify-end gap-2.5">{footer}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: { title: string; message: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      width={440}
      alert
      footer={<>
        <button type="button" className="btn h-[38px]" onClick={onCancel} data-autofocus>ביטול</button>
        <button type="button" className="btn btn-danger h-[38px] px-5" onClick={onConfirm}>{confirmLabel}</button>
      </>}
    >
      <p className="m-0 text-sm leading-relaxed text-muted">{message}</p>
    </Dialog>
  );
}
