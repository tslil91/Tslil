import type { ReactNode } from 'react';
import { IconSearch } from './Icons';

export function PageHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-line bg-surface px-3.5">
      <div className="flex flex-col">
        <h1 className="m-0 text-[17px] font-bold leading-tight">{title}</h1>
        <span className="text-xs text-muted">{subtitle}</span>
      </div>
      <span className="flex-1" />
      {children}
    </header>
  );
}

export function SearchBox({ value, onChange, placeholder, width = 280 }: { value: string; onChange: (v: string) => void; placeholder: string; width?: number }) {
  return (
    <div className="relative" style={{ width }}>
      <input
        type="search"
        className="input h-[34px] ps-3 pe-9"
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <IconSearch size={16} className="pointer-events-none absolute top-[9px] left-3 text-muted" />
    </div>
  );
}
