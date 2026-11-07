import { useState, type ReactNode } from 'react';
import { ConfirmDialog } from './Dialog';
import { useStore } from '../store/store';
import { IconBillet, IconChart, IconClock, IconGift, IconPeople, IconReset } from './Icons';

export type Route = 'people' | 'billets' | 'grants' | 'overview' | 'simulator';

const MAIN: { route: Route; label: string; icon: ReactNode }[] = [
  { route: 'people', label: 'כוח אדם', icon: <IconPeople size={20} /> },
  { route: 'billets', label: 'תקנים', icon: <IconBillet size={20} /> },
  { route: 'grants', label: 'מענקים ותמריצים', icon: <IconGift size={20} /> },
  { route: 'overview', label: 'תמונת מצב', icon: <IconChart size={20} /> },
];

function NavLink({ route, label, icon, current }: { route: Route; label: string; icon: ReactNode; current: Route }) {
  const active = route === current;
  return (
    <a
      href={`#/${route}`}
      aria-label={label}
      title={label}
      aria-current={active ? 'page' : undefined}
      className={`flex h-12 w-12 items-center justify-center rounded-md text-white no-underline hover:bg-white/10 ${active ? 'bg-white/15' : ''}`}
    >
      {icon}
    </a>
  );
}

/** Narrow icon rail on the right (RTL inline-start). */
export function Rail({ current }: { current: Route }) {
  const reset = useStore((s) => s.resetDemo);
  const toast = useStore((s) => s.showToast);
  const [confirm, setConfirm] = useState(false);
  return (
    <nav aria-label="ניווט ראשי" className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 bg-nav px-2 py-3.5 text-white">
      <span className="pb-3 text-center text-[13px] font-bold">גדוד 51</span>
      {MAIN.map((m) => <NavLink key={m.route} {...m} current={current} />)}
      <div className="my-2.5 h-px w-10 bg-white/20" />
      <NavLink route="simulator" label="סימולטור (כלי נוסף)" icon={<IconClock size={20} />} current={current} />
      <span className="flex-1" />
      <button
        type="button"
        title="איפוס נתוני הדגמה"
        aria-label="איפוס נתוני הדגמה"
        className="flex h-10 w-10 items-center justify-center rounded-md text-white/80 hover:bg-white/10"
        onClick={() => setConfirm(true)}
      >
        <IconReset size={18} />
      </button>
      {confirm && (
        <ConfirmDialog
          title="איפוס נתוני ההדגמה"
          message="כל השינויים שביצעת יימחקו והנתונים יחזרו למצב ההתחלתי."
          confirmLabel="כן, אפס"
          onCancel={() => setConfirm(false)}
          onConfirm={() => { reset(); setConfirm(false); toast('נתוני ההדגמה אופסו'); }}
        />
      )}
    </nav>
  );
}
