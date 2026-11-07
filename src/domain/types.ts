/** Date-only ISO string: YYYY-MM-DD. Never a Date object in state. */
export type ISODate = string;

export type Population = 'keva' | 'hova' | 'civ';
export type RankType = 'soldier' | 'officer' | 'ncos' | 'civilian';
export type SectionId = string;

export interface Section {
  id: SectionId;
  name: string;
}

export interface Person {
  id: number;
  name: string;
  /** מ.א */
  mid: number;
  pop: Population;
  rank: RankType;
  degree: string;
  /** Optional program (מט"ל / עתודה / ...). Only for soldiers and officers. */
  program: string | null;
  /** null = directly under the head of the organization. */
  sectionId: SectionId | null;
  /** תאריך כניסה לקבע — KEVA only. */
  entryDate: ISODate | null;
  releaseDate: ISODate | null;
  // NCO + officer
  bachelor?: boolean;
  masters?: boolean;
  gamoshA?: boolean;
  // officer only
  gamoshB?: boolean;
  dmahCFirst?: ISODate | null;
  dmahC?: boolean;
  dmahCElig?: ISODate | null;
  dmahBFirst?: ISODate | null;
  dmahB?: boolean;
  dmahBElig?: ISODate | null;
  dmahAFirst?: ISODate | null;
  dmahA?: boolean;
  dmahAElig?: ISODate | null;
}

/** Person as shown in the table: with the billet derived from billet assignments. */
export type PersonRow = Person & { billet: number | null };

export interface Commanders {
  /** Commander of the organization — never a section commander, always without a section. */
  org: number | null;
  sections: Record<SectionId, number | null>;
}

export type BilletScope = 'int' | 'ext';
export type BilletKind = 'fix' | 'tmp';

export interface Billet {
  id: number;
  scope: BilletScope;
  kind: BilletKind;
  dmah: boolean;
}

/** One occupancy period of a billet. Half-open interval [start, end). */
export interface BilletAssignment {
  id: number;
  billetId: number;
  /** null for people who are no longer in the system (history only). */
  personId: number | null;
  personName: string;
  start: ISODate;
  end: ISODate | null;
}

export type GrantType = 'voucher' | 'grant' | 'incentive';
export type GrantBasis = 'gross' | 'net';

export interface Grant {
  id: number;
  personId: number;
  type: GrantType;
  /** משך חתימה (months) — optional. */
  signingMonths: number | null;
  signingStart: ISODate | null;
  signingEnd: ISODate | null;
  amount: number;
  basis: GrantBasis;
  enteredAt: ISODate;
}
