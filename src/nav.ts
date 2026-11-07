import { useEffect, useState } from 'react';

export type Route = 'people' | 'billets' | 'grants' | 'overview' | 'history' | 'simulator' | 'person' | 'section';
export const ROUTES: Route[] = ['people', 'billets', 'grants', 'overview', 'history', 'simulator', 'person', 'section'];

export interface RouteInfo { route: Route; id: string | null; query: URLSearchParams }

/** Hash routes: #/people, #/person/12, #/section/s1, #/billets?q=1007 ... (a static site needs no server rewrites). */
export function parseHash(hash: string): RouteInfo {
  const raw = hash.replace(/^#\/?/, '');
  const [pathPart, qs = ''] = raw.split('?');
  const [r, id] = pathPart.split('/');
  const route = (ROUTES as string[]).includes(r) ? (r as Route) : 'people';
  let safeId: string | null = null;
  try { safeId = id ? decodeURIComponent(id) : null; } catch { safeId = null; }
  return { route, id: safeId, query: new URLSearchParams(qs) };
}

export function useRoute(): RouteInfo {
  const [info, setInfo] = useState<RouteInfo>(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setInfo(parseHash(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return info;
}

export const go = (path: string) => { window.location.hash = path; };
export const personHref = (id: number) => `#/person/${id}`;
export const sectionHref = (id: string | null) => `#/section/${id ?? 'org'}`;
/** Replace the current hash without adding a history entry (used to drop one-shot parameters). */
export const replaceHash = (path: string) => window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${path}`);
