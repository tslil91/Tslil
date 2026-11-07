import type { Cell, Table } from '../logic/cells';
import type { SheetSpec } from '../logic/sheets';

/** ExcelJS is loaded only when a file is exported or imported, keeping it out of the main bundle. */
const loadExcel = async () => (await import('exceljs')).default;

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

const isoToDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** Write sheets to an .xlsx file (right-to-left, frozen header, real Excel dates) and download it. */
export async function downloadWorkbook(fileName: string, sheets: SheetSpec[]): Promise<void> {
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ניהול כוח אדם ותקנים';
  wb.created = new Date();
  for (const spec of sheets) {
    const ws = wb.addWorksheet(spec.name, { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
    ws.columns = spec.columns.map((c) => ({ header: c.header, width: c.width }));
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12263A' } };
    header.alignment = { vertical: 'middle' };
    spec.rows.forEach((values) => {
      const row = ws.addRow(values.map((v, i) => (v !== null && spec.columns[i].type === 'date' ? isoToDate(String(v)) : v)));
      spec.columns.forEach((c, i) => { if (c.type === 'date') row.getCell(i + 1).numFmt = 'dd/mm/yyyy'; });
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: spec.columns.length } };
  }
  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function normalize(v: unknown): Cell {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join('');
    if ('result' in o) return normalize(o.result);
    if ('text' in o) return String(o.text);
  }
  return null;
}

/**
 * Read one sheet of an .xlsx file. Prefers the sheet with `preferredName`, otherwise the first sheet.
 * The first non-empty row is the header row.
 */
export async function readSheet(file: File, preferredName: string): Promise<Table> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('יש לבחור קובץ Excel בפורמט ‎.xlsx');
  if (file.size > MAX_FILE_BYTES) throw new Error('הקובץ גדול מדי (מקסימום 5MB)');
  const ExcelJS = await loadExcel();
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error('לא ניתן לקרוא את הקובץ. ודא/י שזהו קובץ Excel תקין.');
  }
  const ws = wb.getWorksheet(preferredName) ?? wb.worksheets[0];
  if (!ws) throw new Error('בקובץ אין גיליונות');
  if (ws.rowCount > MAX_ROWS + 1) throw new Error(`בקובץ יותר מ־${MAX_ROWS} שורות`);

  const raw: { n: number; cells: Cell[] }[] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    const values = row.values as unknown[]; // 1-based
    const cells: Cell[] = [];
    for (let i = 1; i < values.length; i++) cells.push(normalize(values[i]));
    raw.push({ n, cells });
  });
  if (raw.length === 0) throw new Error('הגיליון ריק');
  const [head, ...rest] = raw;
  return {
    headers: head.cells.map((c) => (c === null ? '' : String(c).trim())),
    rows: rest.map((r) => r.cells),
    rowNumbers: rest.map((r) => r.n),
  };
}
