import { normalizePerson } from '../domain/rules';
import type { AppData, Billet, BilletAssignment, Grant, Person, SectionPeriod } from '../domain/types';

/** Synthetic demo data only — no real personnel. */
export type Data = AppData;

type P = Omit<Person, 'program' | 'entryDate'> & Partial<Pick<Person, 'program' | 'entryDate'>>;
const person = (p: P): Person => normalizePerson({ program: null, entryDate: null, ...p });

export function seedData(): Data {
  const people: Person[] = [
    person({ id: 1, name: 'דנה רוזן', mid: 7012345, pop: 'keva', rank: 'officer', degree: 'אל"מ', sectionId: null, entryDate: '2004-08-01', releaseDate: '2032-08-01', bachelor: true, masters: true, gamoshA: true, gamoshB: true, dmahCFirst: '2012-03-01', dmahC: true, dmahCElig: '2013-03-01', dmahBFirst: '2016-03-01', dmahB: true, dmahBElig: '2017-03-01', dmahAFirst: '2020-03-01', dmahA: true, dmahAElig: '2021-03-01' }),
    person({ id: 2, name: 'יוסי כהן', mid: 7023456, pop: 'keva', rank: 'officer', degree: 'סא"ל', sectionId: 's1', entryDate: '2008-07-01', releaseDate: '2031-07-01', bachelor: true, masters: true, gamoshA: true, gamoshB: true, dmahCFirst: '2015-07-01', dmahC: true, dmahCElig: '2016-07-01', dmahBFirst: '2019-07-01', dmahB: true, dmahBElig: '2020-07-01', dmahAFirst: '2023-07-01', dmahA: false, dmahAElig: '2027-02-01' }),
    person({ id: 3, name: 'מיכל ביטון', mid: 7034567, pop: 'keva', rank: 'officer', degree: 'רס"ן', program: 'עתודה', sectionId: 's1', entryDate: '2012-08-01', releaseDate: '2030-08-01', bachelor: true, gamoshA: true, gamoshB: true, dmahCFirst: '2019-08-01', dmahC: true, dmahCElig: '2020-08-01', dmahBFirst: '2023-08-01', dmahB: false, dmahBElig: '2026-12-15', dmahAFirst: '2027-08-01', dmahAElig: '2028-08-01' }),
    person({ id: 4, name: 'אורי לוי', mid: 7045678, pop: 'keva', rank: 'officer', degree: 'סרן', program: 'אקדמזיציה', sectionId: 's2', entryDate: '2016-08-01', releaseDate: '2029-08-01', bachelor: true, gamoshA: true, dmahCFirst: '2024-08-01', dmahCElig: '2027-03-01', dmahBFirst: '2028-08-01', dmahAFirst: '2030-08-01' }),
    person({ id: 5, name: 'נועה פרץ', mid: 7056789, pop: 'keva', rank: 'officer', degree: 'רס"ן', sectionId: 's2', entryDate: '2011-06-01', releaseDate: '2031-06-01', bachelor: true, masters: true, gamoshA: true, gamoshB: true, dmahCFirst: '2018-06-01', dmahC: true, dmahCElig: '2019-06-01', dmahBFirst: '2022-06-01', dmahB: true, dmahBElig: '2023-06-01', dmahAFirst: '2026-06-01', dmahAElig: '2027-06-01' }),
    person({ id: 13, name: 'איתי מזרחי', mid: 7067890, pop: 'hova', rank: 'officer', degree: 'סגן', program: 'תלפיות', sectionId: 's3', releaseDate: '2027-02-10', dmahCFirst: '2026-12-01', dmahCElig: '2027-12-01' }),
    person({ id: 6, name: 'עמית שפירא', mid: 7078901, pop: 'keva', rank: 'ncos', degree: 'רס"ר', sectionId: 's1', entryDate: '2010-03-01', releaseDate: '2030-03-01', bachelor: true, gamoshA: true }),
    person({ id: 7, name: 'רן אברהם', mid: 7089012, pop: 'keva', rank: 'ncos', degree: 'רס"ל', sectionId: 's3', entryDate: '2018-09-01', releaseDate: '2033-09-01', gamoshA: true }),
    person({ id: 8, name: 'שירה גולן', mid: 7090123, pop: 'keva', rank: 'ncos', degree: 'רס"מ', sectionId: 's3', entryDate: '2012-02-01', releaseDate: '2031-02-01', bachelor: true, masters: true, gamoshA: true }),
    person({ id: 14, name: 'נועם דהן', mid: 7101234, pop: 'keva', rank: 'ncos', degree: 'רנ"ג', sectionId: null, entryDate: '2003-01-01', releaseDate: '2029-01-01', gamoshA: true }),
    person({ id: 16, name: 'עדי כרמי', mid: 7156789, pop: 'keva', rank: 'ncos', degree: 'סמ"ר', sectionId: 's2', entryDate: '2025-03-01', releaseDate: '2031-03-01' }),
    person({ id: 9, name: 'תומר דהן', mid: 7112345, pop: 'hova', rank: 'soldier', degree: 'סמל', program: 'מט"ל', sectionId: 's1', releaseDate: '2027-01-15' }),
    person({ id: 15, name: 'ליאור בן דוד', mid: 7167890, pop: 'hova', rank: 'soldier', degree: 'סמ"ר', sectionId: 's1', releaseDate: '2027-05-01' }),
    person({ id: 10, name: 'אלון חיים', mid: 7123456, pop: 'hova', rank: 'soldier', degree: 'טוראי', sectionId: 's2', releaseDate: '2027-08-01' }),
    person({ id: 11, name: 'מאיה סעד', mid: 7134567, pop: 'hova', rank: 'soldier', degree: 'רב"ט', sectionId: 's3', releaseDate: '2026-12-20' }),
    person({ id: 12, name: 'תמר אזולאי', mid: 7145678, pop: 'civ', rank: 'civilian', degree: 'אע"ב', sectionId: 's2', releaseDate: '2036-04-01' }),
  ];

  const billets: Billet[] = [
    { id: 1001, scope: 'int', kind: 'fix', dmah: true },
    { id: 1002, scope: 'int', kind: 'fix', dmah: true },
    { id: 1003, scope: 'int', kind: 'fix', dmah: true },
    { id: 1004, scope: 'int', kind: 'fix', dmah: false },
    { id: 1005, scope: 'int', kind: 'fix', dmah: false },
    { id: 1006, scope: 'int', kind: 'fix', dmah: true },
    { id: 1007, scope: 'int', kind: 'tmp', dmah: false },
    { id: 1010, scope: 'int', kind: 'fix', dmah: true },
    { id: 1011, scope: 'int', kind: 'fix', dmah: false },
    { id: 1021, scope: 'int', kind: 'fix', dmah: false },
    { id: 2001, scope: 'ext', kind: 'fix', dmah: true },
    { id: 2002, scope: 'ext', kind: 'tmp', dmah: false },
  ];

  let aid = 0;
  const a = (billetId: number, personId: number | null, personName: string, start: string, end: string | null): BilletAssignment => ({ id: ++aid, billetId, personId, personName, start, end });
  const assignments: BilletAssignment[] = [
    a(1001, null, 'אבי שגב', '2015-01-01', '2019-08-01'), a(1001, null, 'רונית כץ', '2019-08-01', '2024-07-01'), a(1001, 1, 'דנה רוזן', '2024-07-01', null),
    a(1002, null, 'משה ברק', '2016-03-01', '2022-09-01'), a(1002, 2, 'יוסי כהן', '2022-09-01', null),
    a(1003, null, 'יעל נחום', '2018-01-01', '2023-06-01'), a(1003, 3, 'מיכל ביטון', '2023-06-01', null),
    a(1004, 6, 'עמית שפירא', '2019-02-01', null),
    a(1005, 14, 'נועם דהן', '2020-05-01', null),
    a(1006, null, 'גלית אורן', '2017-01-01', '2025-12-01'),
    a(1010, null, 'דורון פז', '2017-09-01', '2021-08-01'), a(1010, 5, 'נועה פרץ', '2021-08-01', null),
    a(1011, null, 'עידו רז', '2014-04-01', '2026-06-01'),
    a(1021, 8, 'שירה גולן', '2021-02-01', null),
    a(2001, null, 'אריאל נבון', '2020-01-01', '2025-01-01'),
    a(2002, 7, 'רן אברהם', '2025-03-01', '2026-09-01'),
  ];

  let gid = 0;
  const g = (personId: number, type: Grant['type'], signingMonths: number | null, signingStart: string | null, signingEnd: string | null, amount: number, basis: Grant['basis'], enteredAt: string): Grant =>
    ({ id: ++gid, personId, type, signingMonths, signingStart, signingEnd, amount, basis, enteredAt });
  const grants: Grant[] = [
    g(1, 'grant', 36, '2020-03-01', '2023-03-01', 60000, 'gross', '2020-02-20'),
    g(1, 'incentive', 24, '2024-07-01', '2026-07-01', 30000, 'gross', '2024-06-15'),
    g(2, 'voucher', null, null, null, 3000, 'net', '2021-12-01'),
    g(2, 'grant', 48, '2022-09-01', '2026-09-01', 80000, 'gross', '2022-08-20'),
    g(2, 'incentive', 36, '2026-09-01', '2029-09-01', 45000, 'gross', '2026-08-25'),
    g(3, 'grant', 24, '2023-06-01', '2025-06-01', 40000, 'gross', '2023-05-28'),
    g(4, 'incentive', 12, '2025-08-01', '2026-08-01', 12000, 'net', '2025-07-20'),
    g(6, 'grant', 36, '2019-02-01', '2022-02-01', 35000, 'gross', '2019-01-25'),
    g(6, 'voucher', null, null, null, 1500, 'net', '2025-04-10'),
    g(8, 'incentive', 24, '2026-02-01', '2028-02-01', 28000, 'gross', '2026-01-22'),
    g(14, 'grant', 60, '2015-01-01', '2020-01-01', 90000, 'gross', '2014-12-20'),
    g(14, 'incentive', 36, '2020-05-01', '2023-05-01', 42000, 'gross', '2020-04-18'),
    g(9, 'voucher', null, null, null, 800, 'net', '2026-10-01'),
  ];

  // everyone starts in their current section "since always"; two demo moves make the history visible
  let hid = 0;
  const sectionHistory: SectionPeriod[] = people.flatMap((p): SectionPeriod[] => {
    if (p.id === 3) return [{ id: ++hid, personId: 3, sectionId: 's2', start: '1900-01-01', end: '2026-03-01' }, { id: ++hid, personId: 3, sectionId: 's1', start: '2026-03-01', end: null }];
    if (p.id === 7) return [{ id: ++hid, personId: 7, sectionId: 's1', start: '1900-01-01', end: '2025-09-01' }, { id: ++hid, personId: 7, sectionId: 's3', start: '2025-09-01', end: null }];
    return [{ id: ++hid, personId: p.id, sectionId: p.sectionId, start: '1900-01-01', end: null }];
  });

  return {
    sections: [
      { id: 's1', name: 'מדור מבצעים' },
      { id: 's2', name: 'מדור כוח אדם' },
      { id: 's3', name: 'מדור לוגיסטיקה' },
    ],
    people,
    commanders: { org: 1, sections: { s1: 2, s2: 5, s3: 8 } },
    billets,
    assignments,
    grants,
    notes: [],
    sectionHistory,
  };
}
