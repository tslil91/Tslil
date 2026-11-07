# התקנה בסביבה מנותקת (ללא אינטרנט) · Offline installation

> English follows the Hebrew section.

## עברית

### מה יש בחבילה
| קובץ | תפקיד |
|---|---|
| `server.mjs` | השרת (קובץ אחד, ללא תלויות) |
| `public/` | האפליקציה לדפדפן (כולל הגופן — אין פנייה לאינטרנט) |
| `start.sh` / `start.cmd` | הפעלה |
| `config.env.example` | דוגמה להגדרות |
| `personnel-billets.service` | דוגמה לשירות systemd |

### דרישות
- מחשב אחד שירוץ עליו השרת, עם **Node.js 20 ומעלה** (התקנה חד־פעמית; אין צורך ב־npm ולא ברשת).
- תיקיית **NFS משותפת** לנתונים (מומלץ לגיבוי ולשרידות). השרת עצמו יכול לרוץ מכל מחשב שמחובר אליה.
- דפדפן מודרני אצל המשתמשים (Chrome / Edge / Firefox עדכניים). אין צורך בשום התקנה אצלם — פותחים את כתובת השרת.

### התקנה
1. העתק את התיקייה `personnel-billets` למחשב השרת (או לתיקיית ה־NFS) — למשל ל־`/opt/personnel-billets`.
2. `cp config.env.example config.env` ועדכן את `DATA_DIR` לנתיב **מוחלט** בתיקיית ה־NFS, למשל `/mnt/shared/personnel-billets-data`.
3. הרץ `./start.sh`. תופיע הודעה עם הכתובת (ברירת מחדל: `http://<שם-המחשב>:8080`).
4. משתמשים פותחים את הכתובת בדפדפן. בכניסה הראשונה של כל משתמש מתבקש שם (לתיעוד בלבד, אין סיסמאות).
5. בהפעלה הראשונה (שרת ריק) המערכת שואלת: התחלה ריקה / שחזור מגיבוי / נתוני הדגמה. אחרי ההקמה אפשר לייבא אנשים ותקנים מ־Excel.
6. להפעלה אוטומטית: ראה `personnel-billets.service` (systemd), או הוסף ל־`rc.local` / מתזמן המשימות.

### כלל חשוב: שרת אחד בלבד על כל תיקיית נתונים
קבצים משותפים ב־NFS אינם בטוחים לכתיבה משני תהליכים במקביל. לכן השרת נועל את התיקייה (`server.lock`) ושרת שני שיופעל על אותה תיקייה **יסרב לעלות** עם הודעה ברורה.
- אם השרת קרס והנעילה נשארה — היא פגה אוטומטית אחרי ~2 דקות. אפשר גם להפעיל עם `FORCE_UNLOCK=1` (רק לאחר שוידאת שאין שרת אחר פעיל).
- הרבה משתמשים יחד אינם בעיה: כולם מתחברים לאותו שרת. שינויים של כמה אנשים בו־זמנית מטופלים כך: מי ששומר ראשון נשמר; השני רואה הודעה, הנתונים מתרעננים והוא מבצע שוב את השינוי.

### טיפים ל־NFS
- חבר את התיקייה עם `hard` (לא `soft`) כדי שכתיבה לא תיכשל בשקט בעת תקלת רשת.
- הקבצים נכתבים באופן אטומי (קובץ זמני + שינוי שם), היומן הוא קובץ מצטבר, ונשמרים גיבויים אוטומטיים בתיקייה `backups/` (כל 6 שעות כברירת מחדל, 60 אחרונים).
- אם הגישה ל־NFS נופלת, המשתמשים רואים הודעה אדומה ("אין חיבור לשרת") והשינויים נשמרים אחרי שהחיבור חוזר.

### גיבוי ושחזור
- **אוטומטי:** `DATA_DIR/backups/state-<תאריך>-<גרסה>.json`. לשחזור ידני: עצור את השרת, העתק קובץ גיבוי ל־`DATA_DIR/state.json`, הפעל מחדש.
- **מתוך המערכת:** כפתור "ניהול נתונים" בתפריט — הורדת קובץ גיבוי ושחזור מקובץ (השחזור שומר קודם עותק של המצב הנוכחי).
- אפשר להעתיק את כל תיקיית `DATA_DIR` כגיבוי מלא (נתונים + יומן שינויים).

### עדכון גרסה
עצור את השרת, החלף את `server.mjs` ואת התיקייה `public/` בגרסה החדשה (אל תיגע ב־`DATA_DIR`), הפעל מחדש. משתמשים רק מרעננים את הדף.

### אבטחה — חשוב לדעת
- **אין התחברות ואין סיסמאות.** כל מי שמגיע לכתובת השרת יכול לצפות ולשנות נתונים. השם שמוזן בכניסה הוא תיעוד בלבד ואינו מזהה מאומת.
- הגבלת גישה צריכה להיעשות ברמת הרשת (חומת אש, רשת סגורה) והרשאות הקבצים של תיקיית הנתונים. אם נדרש אימות משתמשים — זו תוספת נפרדת (ראה "הרשאות" ברשימת ההצעות).
- התקשורת היא HTTP רגיל. ברשת סגורה זה מקובל; אם נדרש TLS, אפשר להציב לפניו שרת proxy פנימי.
- האפליקציה לא פונה לשום כתובת חיצונית, וכותרות האבטחה (CSP) מונעות טעינה ממקורות אחרים.
- הנתונים רגישים: הגדר הרשאות מתאימות על `DATA_DIR` ועל קבצי הגיבוי.

### בדיקות תקלות
| תסמין | מה לעשות |
|---|---|
| `The data directory is in use by another server` | שרת אחר רץ על אותה תיקייה. עצור אותו, או המתן ~2 דקות אחרי קריסה, או `FORCE_UNLOCK=1`. |
| `state.json is damaged` | השרת מסרב להתחיל ולא יתחיל ריק. שחזר קובץ מתוך `backups/`. |
| הדף נפתח אך "אין חיבור לשרת" | בדוק שהשרת פעיל, חומת האש (PORT) ושה־NFS נגיש. בדיקת תקינות: `http://<שרת>:8080/api/health`. |
| `Cannot listen on ...` | הפורט תפוס. שנה `PORT`. |

---

## English

### What is in the package
`server.mjs` (the whole server in one file, no dependencies) · `public/` (the web app, fonts included — it never contacts the internet) · `start.sh` / `start.cmd` · `config.env.example` · `personnel-billets.service` (systemd example).

### Requirements
- One machine to run the server with **Node.js 20 or newer** (one-time install; no npm and no network are needed afterwards).
- A **shared NFS folder** for the data (for backup and resilience). The server can run on any machine that mounts it.
- A current browser for the users (Chrome / Edge / Firefox). Nothing to install on their side: they open the server address.

### Install
1. Copy the `personnel-billets` folder to the server machine (or the NFS share), e.g. `/opt/personnel-billets`.
2. `cp config.env.example config.env` and set `DATA_DIR` to an **absolute** path on the NFS share, e.g. `/mnt/shared/personnel-billets-data`.
3. Run `./start.sh`. It prints the address (default `http://<hostname>:8080`).
4. Users open the address. Each user is asked for a name once (for the change log only — there are no passwords).
5. On the very first start (empty server) you choose: start empty / restore from a backup / demo data. Afterwards, people and billets can be imported from Excel.
6. To start automatically see `personnel-billets.service` (systemd) or use your usual task scheduler.

### Important rule: exactly one server per data folder
Files on NFS are not safe for two processes writing at once. The server therefore locks the folder (`server.lock`); a second server started on the same folder **refuses to start** with a clear message.
- If a server crashed and left the lock, it expires after ~2 minutes, or start with `FORCE_UNLOCK=1` (only after making sure no other server is running).
- Many users at once are fine: everybody uses the same server. If two people save at the same moment, the first one wins; the second sees a message, the data refreshes, and they repeat their change.

### NFS tips
- Mount with `hard` (not `soft`) so that writes do not fail silently during a network problem.
- Writes are atomic (temporary file + rename), the change log is append-only, and automatic backups go to `backups/` (every 6 hours by default, last 60 kept).
- If the NFS becomes unreachable users see a red banner ("no connection to the server") and changes are saved when the connection returns.

### Backup and restore
- **Automatic:** `DATA_DIR/backups/state-<date>-<version>.json`. To restore by hand: stop the server, copy a backup over `DATA_DIR/state.json`, start again.
- **From the app:** "ניהול נתונים" in the menu — download a backup file and restore from a file (a restore first keeps a copy of the current state).
- Copying the whole `DATA_DIR` is a complete backup (data and change log).

### Upgrading
Stop the server, replace `server.mjs` and `public/` with the new version (do not touch `DATA_DIR`), start again. Users just refresh the page.

### Security — please read
- **There is no login and no password.** Anyone who can reach the server address can view and change data. The name entered at first use is for the log only and is not verified.
- Restrict access at the network level (firewall, isolated network) and with file permissions on the data folder. User authentication is a separate addition.
- Traffic is plain HTTP. On an isolated network that is usual; if TLS is required, put an internal reverse proxy in front.
- The app makes no external requests, and the Content-Security-Policy headers prevent loading anything from other origins.
- The data is sensitive: set suitable permissions on `DATA_DIR` and on backup files.

### Troubleshooting
| Symptom | What to do |
|---|---|
| `The data directory is in use by another server` | Another server runs on that folder. Stop it, or wait ~2 minutes after a crash, or `FORCE_UNLOCK=1`. |
| `state.json is damaged` | The server refuses to start (it will not start empty). Restore a file from `backups/`. |
| Page opens but "no connection to the server" | Check that the server is running, the firewall (PORT) and that the NFS is reachable. Health check: `http://<server>:8080/api/health`. |
| `Cannot listen on ...` | The port is taken. Change `PORT`. |
