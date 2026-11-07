import { useState } from 'react';
import { downloadText } from '../io/download';
import { backupFileName, makeBackup, parseBackup, type ParseResult } from '../logic/backup';
import { pickData } from '../domain/data';
import { useStore } from '../store/store';
import { useSync } from '../sync/sync';
import { ConfirmDialog, Dialog } from './Dialog';

const COUNT_LABELS: Record<string, string> = { sections: 'מדורים', people: 'אנשים', billets: 'תקנים', assignments: 'שיבוצים', grants: 'מענקים', notes: 'הערות' };

/** Backup to a file, restore from a file, and (local demo only) reset. */
export function DataDialog({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const { mode, server } = useSync();
  const [parsed, setParsed] = useState<{ name: string; result: ParseResult } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const download = () => {
    downloadText(backupFileName(), JSON.stringify(makeBackup(pickData(s)), null, 1), 'application/json');
    s.showToast('קובץ הגיבוי הורד');
  };
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setParsed({ name: file.name, result: parseBackup(await file.text()) });
  };

  return (
    <>
      <Dialog title="ניהול נתונים" width={600} onClose={onClose} footer={<button type="button" className="btn btn-primary h-[38px] px-5" onClick={onClose}>סגירה</button>}>
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            <h3 className="m-0 text-[15px] font-bold">גיבוי</h3>
            <p className="m-0 text-[13px] leading-relaxed text-muted">קובץ אחד עם כל הנתונים: אנשים, מדורים, תקנים והיסטוריית שיבוץ, מענקים, הערות והיסטוריית מדורים. מומלץ לשמור עותק במקום נפרד.</p>
            <div><button type="button" className="btn btn-primary" onClick={download}>הורדת קובץ גיבוי</button></div>
          </section>

          <section className="flex flex-col gap-2 border-t border-line pt-3">
            <h3 className="m-0 text-[15px] font-bold">שחזור מגיבוי</h3>
            <p className="m-0 text-[13px] leading-relaxed text-muted">השחזור <strong>מחליף את כל הנתונים הנוכחיים</strong>. {mode === 'server' ? 'לפני כן השרת שומר עותק של המצב הנוכחי בתיקיית הגיבויים. ' : ''}הקובץ נבדק לפני השחזור.</p>
            <label className="btn w-fit cursor-pointer">
              בחירת קובץ גיבוי
              <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            {parsed && (
              <div className={`rounded border px-3 py-2.5 text-[13px] ${parsed.result.ok ? 'border-line bg-bg' : 'border-danger bg-danger-soft text-danger'}`}>
                <div className="mb-1 font-semibold">{parsed.name}</div>
                {parsed.result.ok && parsed.result.counts ? (
                  <>
                    <div>{parsed.result.createdAt ? `נוצר ב־${new Date(parsed.result.createdAt).toLocaleString('he-IL')} · ` : ''}{Object.entries(parsed.result.counts).map(([k, n]) => `${n} ${COUNT_LABELS[k] ?? k}`).join(' · ')}</div>
                    <button type="button" className="btn btn-danger mt-2" onClick={() => setConfirmRestore(true)}>שחזור הנתונים מהקובץ</button>
                  </>
                ) : (
                  <ul className="m-0 ps-5">{parsed.result.errors.map((e) => <li key={e}>{e}</li>)}</ul>
                )}
              </div>
            )}
          </section>

          {mode === 'server' && server && (
            <section className="flex flex-col gap-1 border-t border-line pt-3 text-[13px]">
              <h3 className="m-0 text-[15px] font-bold">השרת</h3>
              <span>מחשב: <strong>{server.host}</strong> · תיקיית נתונים: <bdi className="font-mono text-xs">{server.dataDir}</bdi></span>
              <span>{server.backups} גיבויים אוטומטיים{server.lastBackupAt ? ` · האחרון ב־${new Date(server.lastBackupAt).toLocaleString('he-IL')}` : ''} · {server.auditCount} רישומים ביומן</span>
            </section>
          )}

          {mode === 'local' && (
            <section className="flex flex-col gap-2 border-t border-line pt-3">
              <h3 className="m-0 text-[15px] font-bold">איפוס נתוני הדגמה</h3>
              <p className="m-0 text-[13px] text-muted">מצב מקומי: מוחק את השינויים בדפדפן זה ומחזיר את נתוני ההדגמה.</p>
              <div><button type="button" className="btn" onClick={() => setConfirmReset(true)}>איפוס נתוני הדגמה</button></div>
            </section>
          )}
        </div>
      </Dialog>

      {confirmRestore && parsed?.result.data && (
        <ConfirmDialog
          title="לשחזר מהגיבוי?"
          message="כל הנתונים הנוכחיים יוחלפו בתוכן הקובץ, לכל המשתמשים. הפעולה תירשם ביומן השינויים."
          confirmLabel="כן, שחזר"
          onCancel={() => setConfirmRestore(false)}
          onConfirm={() => { s.replaceData(parsed.result.data!, `שוחזרו נתונים מקובץ גיבוי (${parsed.result.counts?.people ?? 0} אנשים, ${parsed.result.counts?.billets ?? 0} תקנים)`); s.showToast('הנתונים שוחזרו מהגיבוי'); setConfirmRestore(false); onClose(); }}
        />
      )}
      {confirmReset && (
        <ConfirmDialog
          title="איפוס נתוני ההדגמה"
          message="כל השינויים שביצעת בדפדפן זה יימחקו והנתונים יחזרו למצב ההתחלתי."
          confirmLabel="כן, אפס"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => { s.resetDemo(); s.showToast('נתוני ההדגמה אופסו'); setConfirmReset(false); onClose(); }}
        />
      )}
    </>
  );
}
