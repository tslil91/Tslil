import { addMonths } from '../domain/dates';
import type { Grant, GrantBasis, GrantType, ISODate } from '../domain/types';

export const GRANT_TYPE_LABELS: Record<GrantType, string> = { voucher: 'שובר', grant: 'מענק', incentive: 'תמריץ' };
export const BASIS_LABELS: Record<GrantBasis, string> = { gross: 'ברוטו', net: 'נטו' };

/** The date a grant is ordered by: signing start, or entry date when there is no signing period. */
export const grantDate = (g: Grant): ISODate => g.signingStart ?? g.enteredAt;

export function latestFirst(grants: Grant[]): Grant[] {
  return [...grants].sort((a, b) => {
    const x = grantDate(a), y = grantDate(b);
    if (x !== y) return x < y ? 1 : -1;
    return b.id - a.id;
  });
}

/** Totals are never mixed: gross and net are summed separately. */
export function totals(grants: Grant[]): { gross: number; net: number } {
  return grants.reduce(
    (t, g) => (g.basis === 'gross' ? { ...t, gross: t.gross + g.amount } : { ...t, net: t.net + g.amount }),
    { gross: 0, net: 0 },
  );
}

export interface GrantDraft {
  personId: string;
  type: GrantType;
  signingMonths: string;
  signingStart: string;
  signingEnd: string;
  amount: string;
  basis: GrantBasis;
}

export const emptyGrantDraft = (): GrantDraft => ({ personId: '', type: 'grant', signingMonths: '', signingStart: '', signingEnd: '', amount: '', basis: 'gross' });

export const draftFromGrant = (g: Grant): GrantDraft => ({
  personId: String(g.personId),
  type: g.type,
  signingMonths: g.signingMonths ? String(g.signingMonths) : '',
  signingStart: g.signingStart ?? '',
  signingEnd: g.signingEnd ?? '',
  amount: String(g.amount),
  basis: g.basis,
});

/** Apply a form change; recompute the end date when duration and start are both set. */
export function updateGrantDraft(d: GrantDraft, patch: Partial<GrantDraft>): GrantDraft {
  const n = { ...d, ...patch };
  const months = parseInt(n.signingMonths, 10);
  if (('signingMonths' in patch || 'signingStart' in patch) && n.signingStart && months > 0) {
    n.signingEnd = addMonths(n.signingStart, months);
  }
  return n;
}

export function validateGrant(d: GrantDraft): string | null {
  if (!d.personId) return 'יש לבחור איש צוות.';
  const amount = Number(d.amount);
  if (!d.amount || !Number.isFinite(amount) || amount <= 0) return 'יש להזין סכום גדול מאפס.';
  if (d.signingMonths && !(parseInt(d.signingMonths, 10) > 0)) return 'משך חתימה חייב להיות מספר חודשים חיובי.';
  if (d.signingMonths && !d.signingStart) return 'כאשר מוזן משך חתימה יש להזין תאריך תחילה.';
  if (d.signingStart && d.signingEnd && d.signingEnd <= d.signingStart) return 'תאריך הסיום חייב להיות אחרי תאריך התחילה.';
  return null;
}

export function grantFromDraft(d: GrantDraft, id: number, enteredAt: ISODate): Grant {
  return {
    id,
    personId: Number(d.personId),
    type: d.type,
    signingMonths: d.signingMonths ? parseInt(d.signingMonths, 10) : null,
    signingStart: d.signingStart || null,
    signingEnd: d.signingEnd || null,
    amount: Number(d.amount),
    basis: d.basis,
    enteredAt,
  };
}
