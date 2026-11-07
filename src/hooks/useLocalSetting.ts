import { useCallback, useState } from 'react';

/** A small per-browser preference (kept in localStorage; falls back to memory if storage is unavailable). */
export function useLocalSetting<T extends string | number | boolean>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>((): T => {
    try {
      const raw = localStorage.getItem(`pb-${key}`);
      if (raw === null) return initial;
      const parsed = JSON.parse(raw) as unknown;
      return typeof parsed === typeof initial ? (parsed as T) : initial;
    } catch { return initial; }
  });
  const set = useCallback((v: T) => {
    setValue(v);
    try { localStorage.setItem(`pb-${key}`, JSON.stringify(v)); } catch { /* ignore */ }
  }, [key]);
  return [value, set];
}
