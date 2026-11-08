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

### Windows (חבילת `personnel-billets-windows-*.zip`)
החבילה כוללת `node.exe` (Node.js 22, ההפצה הרשמית מ־nodejs.org) — **לא צריך להתקין כלום**.
1. חלץ את ה־zip (קליק ימני ← Extract All) לתיקייה, למשל `C:\personnel-billets`. אם Windows חוסם קבצים שהגיעו מבחוץ: קליק ימני על ה־zip ← Properties ← Unblock, לפני החילוץ.
2. העתק את `config.cmd.example` ל־`config.cmd` וערוך: `DATA_DIR` (תיקייה מקומית, או נתיב רשת מהצורה `\\שרת\שיתוף\personnel-billets-data`; מומלץ נתיב UNC ולא אות כונן ממופה).
3. לחיצה כפולה על **`check.cmd`**: בודק את המחשב ואת תיקיית הנתונים (כתיבה, החלפת קבצים בטוחה, **נעילת "שרת אחד בלבד"**, פורט פנוי). כל השורות צריכות להיות `OK`. חשוב במיוחד כשהתיקייה נמצאת על שיתוף רשת.
4. לחיצה כפולה על **`start.cmd`**. בהפעלה הראשונה Windows שואל אם לאפשר ל־`node.exe` גישה לרשת — אשרו (רשת פרטית). **אל תסגרו את החלון השחור** — סגירתו עוצרת את השרת.
5. במחשב השרת פותחים `http://localhost:8080`; משתמשים אחרים פותחים `http://<שם-המחשב>:8080` (שם המחשב: הפקודה `hostname`).
6. אם חומת האש חוסמת משתמשים אחרים, הרצה כמנהל: `netsh advfirewall firewall add rule name="Personnel Billets" dir=in action=allow protocol=TCP localport=8080`.
7. הפעלה אוטומטית בכניסה למחשב (כמשתמש שיש לו גישה לשיתוף): `schtasks /Create /SC ONLOGON /TN "PersonnelBillets" /TR "\"C:\personnel-billets\start.cmd\""`.
8. **NFS מ־Windows:** דורש את התכונה "Client for NFS" (Windows Pro / Enterprise) או שימוש בשיתוף SMB. בכל מקרה — הריצו `check.cmd` על התיקייה הסופית ובדקו שנעילת "שרת אחד בלבד" עוברת.
9. **מקור `node.exe`:** הועתק ללא שינוי מ־https://nodejs.org/dist/v22.23.4/win-x64/node.exe (SHA-256: `dccc52de28d8df2ee22d2062424f8c563070d95d8ad70c54c4bf01d590dec14f`, זהה לסכום הרשמי ב־`SHASUMS256.txt`). בארגון עם מדיניות קבצים מחמירה אפשר להחליף את `node\node.exe` בגרסה שאושרה אצלכם (Node.js 20 ומעלה).
10. אם תוכנת אבטחה חוסמת את `node.exe` או את קובצי ה־`.cmd`, יש לבקש אישור מאיש האבטחה; ללא זה אין דרך אחרת להריץ שרת.

### אם קשה להתקין — דרכים נוספות להפעלה
1. **קובץ HTML בודד, בלי שרת ובלי התקנה** (`personnel-billets-standalone.html`): פותחים בדפדפן בלחיצה כפולה. עובד ללא רשת. כל דפדפן שומר נתונים משלו (מצב מקומי), ולכן זה מתאים להתרשמות או למשתמש יחיד — **לא** לעבודה משותפת. אפשר לגבות ולשחזר דרך "ניהול נתונים".
2. **שרת בלי סקריפטים**: אם אי אפשר להריץ סקריפט, מריצים ישירות: `node server.mjs` (Linux), או ב־Windows `set DATA_DIR=D:\data` ואז `node\node.exe server.mjs`. המשתנים זהים להגדרות בקובץ ההגדרות. בדיקת תקינות בלי הפעלה: `node server.mjs --check`.
3. **החבילה כקובץ zip או כקובץ טקסט**: אם `.tar.gz` או `.md` חסומים, השתמשו ב־`personnel-billets-0.1.0.zip`; המדריך זמין גם כ־`INSTALL.txt`.

### כלל חשוב: שרת אחד בלבד על כל תיקיית נתונים
קבצים משותפים ב־NFS אינם בטוחים לכתיבה משני תהליכים במקביל. לכן השרת נועל את התיקייה (`server.lock`) ושרת שני שיופעל על אותה תיקייה **יסרב לעלות** עם הודעה ברורה.
- אם השרת קרס והנעילה נשארה: באותו מחשב (למשל הפעלה מחדש אוטומטית של systemd) השרת מזהה שהתהליך הישן אינו קיים ועולה מיד. ממחשב אחר הנעילה פגה אוטומטית אחרי ~2 דקות; אפשר גם להפעיל עם `FORCE_UNLOCK=1` (רק לאחר שוידאת שאין שרת אחר פעיל).
- הרבה משתמשים יחד אינם בעיה: כולם מתחברים לאותו שרת. שינויים של כמה אנשים בו־זמנית מטופלים כך: מי ששומר ראשון נשמר; השני רואה הודעה, הנתונים מתרעננים והוא מבצע שוב את השינוי.

### טיפים ל־NFS
- חבר את התיקייה עם `hard` (לא `soft`) כדי שכתיבה לא תיכשל בשקט בעת תקלת רשת.
- הקבצים נכתבים באופן אטומי (קובץ זמני + שינוי שם), היומן הוא קובץ מצטבר, ונשמרים גיבויים אוטומטיים בתיקייה `backups/` (כל 6 שעות כברירת מחדל, 60 אחרונים).
- אם הגישה ל־NFS נופלת, המשתמשים רואים הודעה אדומה ("אין חיבור לשרת") והשינויים נשמרים אחרי שהחיבור חוזר.

### גיבוי ושחזור
- **אוטומטי:** `DATA_DIR/backups/state-<תאריך>-<גרסה>.json`. לשחזור ידני: עצור את השרת, העתק קובץ גיבוי ל־`DATA_DIR/state.json`, הפעל מחדש.
- **מתוך המערכת:** כפתור "ניהול נתונים" בתפריט — הורדת קובץ גיבוי ושחזור מקובץ (השחזור שומר קודם עותק של המצב הנוכחי).
- אפשר להעתיק את כל תיקיית `DATA_DIR` כגיבוי מלא (נתונים + יומן שינויים).

### עדכון גרסה — בלי לדרוס נתונים
**עיקרון:** החבילה החדשה מכילה רק תוכנה — **אין בה נתונים ואין בה `config.cmd` / `config.env`**. לכן פריסת החבילה על התיקייה הישנה לא יכולה לדרוס את הנתונים או את ההגדרות שלכם. הסיכון היחיד: להפעיל עותק חדש שמצביע על תיקיית נתונים אחרת (ריקה), ואז נראה כאילו הנתונים נעלמו.
1. **גיבוי לפני כל עדכון:** באפליקציה "ניהול נתונים" ← "הורדת קובץ גיבוי", ובנוסף העתיקו את כל תיקיית הנתונים (`DATA_DIR`; אם לא הוגדרה — התיקייה `data` שליד התוכנית).
2. **עצרו את השרת** (סגרו את החלון השחור). כל עוד הוא רץ, הנתונים נעולים.
3. (מומלץ: מחקו קודם את התיקייה הישנה `public` — היא מכילה תוכנה בלבד ולא נתונים — כדי שלא יישארו קבצים ישנים.) חלצו את ה־zip החדש **מעל התיקייה הקיימת** (Windows: Extract All ← אותה תיקייה ← "Replace the files"), או לתיקייה חדשה. אם בחרתם בתיקייה חדשה: העתיקו אליה את `config.cmd` (ואת תיקיית `data` אם היא ישבה ליד התוכנית), או הגדירו `DATA_DIR` במלואו לנתיב הישן.
4. הריצו `check.cmd` ואז `start.cmd`, ופתחו את האפליקציה: מספר האנשים והתקנים חייב להיות זהה למה שהיה. **אם מוצג מסך "הקמת המערכת" — אל תבחרו כלום:** סגרו את השרת, תקנו את `DATA_DIR` והפעילו שוב. (בחירה ב"התחלה ריקה" על תיקייה חדשה אינה מוחקת את הנתונים הישנים, אך תפצל אתכם לשתי מערכות.)
5. שמרו את התיקייה הישנה (או הגיבוי) עד שוידאתם שהכול תקין.
6. אין צורך בשום פעולה אצל המשתמשים מלבד רענון הדף. הנתונים הישנים תואמים לגרסה החדשה; אין "מעבר" נתונים.
- **גרסאות שמורות פנימית:** רישומים ישנים ביומן השינויים נשארים כפי שנכתבו (גם אם השתמשו בניסוח ישן, למשל "מפקד הארגון").
- **אל תחזרו לגרסה ישנה** אחרי שהוזנו נתונים עם התכונות החדשות: גיבוי מגרסה חדשה (למשל עם דרגת קא"ב) לא ישוחזר בגרסה ישנה שאינה מכירה אותה.
- **הקובץ הבודד (`standalone.html`):** הנתונים שמורים בדפדפן, לא בקובץ. לפני שמחליפים קובץ הורידו גיבוי ("ניהול נתונים"); אם אחרי פתיחת הקובץ החדש אינכם רואים את הנתונים — שחזרו מהגיבוי. (ב־Chrome וב־Edge הנתונים נשמרים גם כשמחליפים קובץ; בדפדפנים אחרים, כמו Firefox, ייתכן שלא.)

### הסרת אנשים והחלפת מפקד (בקצרה)
- כפתור 🗑 בשורה: **עזב/ה את היחידה** (יוצא מהרשימה הפעילה, ההיסטוריה נשמרת, אפשר להחזיר דרך "הצג את מי שהוסרו") או **מחיקה** (הוזן בטעות; סופי, רק שחזור מגיבוי מחזיר). לפני מחיקה מוצג מה יימחק. לפני פעולות כאלה כדאי להוריד גיבוי ("ניהול נתונים").
- אי אפשר להסיר מפקד: קודם ממנים אחר ("החלפת מפקד" בדף המדור ובכותרת הקבוצה בטבלה; "החלפת רע"ן" לראש הארגון).

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

### Windows (the `personnel-billets-windows-*.zip` package)
The package contains `node.exe` (Node.js 22, the official build from nodejs.org), so **nothing needs to be installed**.
1. Extract the zip (right-click → Extract All) to a folder, e.g. `C:\personnel-billets`. If Windows blocks files that came from outside: right-click the zip → Properties → Unblock, before extracting.
2. Copy `config.cmd.example` to `config.cmd` and edit it: `DATA_DIR` (a local folder, or a network path like `\\server\share\personnel-billets-data`; a UNC path is preferable to a mapped drive letter).
3. Double-click **`check.cmd`**: it tests the machine and the data folder (writing, safe file replacement, **the "only one server" lock**, free port). Every line must say `OK`. This matters most when the folder is on a network share.
4. Double-click **`start.cmd`**. On first start Windows asks whether `node.exe` may use the network — allow it (private network). **Do not close the black window** — closing it stops the server.
5. On the server machine open `http://localhost:8080`; other users open `http://<computer-name>:8080` (the name: run `hostname`).
6. If the firewall blocks other users, run as administrator: `netsh advfirewall firewall add rule name="Personnel Billets" dir=in action=allow protocol=TCP localport=8080`.
7. To start automatically at log-on (as a user who can reach the share): `schtasks /Create /SC ONLOGON /TN "PersonnelBillets" /TR "\"C:\personnel-billets\start.cmd\""`.
8. **NFS from Windows:** needs the "Client for NFS" feature (Windows Pro / Enterprise), or use an SMB share. Either way, run `check.cmd` on the final folder and make sure the "only one server" lock check passes.
9. **Where `node.exe` comes from:** copied unchanged from https://nodejs.org/dist/v22.23.4/win-x64/node.exe (SHA-256 `dccc52de28d8df2ee22d2062424f8c563070d95d8ad70c54c4bf01d590dec14f`, identical to the official `SHASUMS256.txt`). If your organization requires an approved build, replace `node\node.exe` with it (Node.js 20 or newer).
10. If security software blocks `node.exe` or the `.cmd` files, ask your security officer for an exception; there is no other way to run a server.

### If installing is difficult — other ways to run it
1. **A single HTML file, no server, no installation** (`personnel-billets-standalone.html`): open it in a browser by double-clicking. It works without any network. Each browser keeps its own data (local mode), so it suits a trial or a single user — **not** shared work. Back up and restore through "ניהול נתונים".
2. **The server without scripts**: if scripts cannot run, start it directly: `node server.mjs` (Linux), or on Windows `set DATA_DIR=D:\data` and then `node\node.exe server.mjs`. The variables are the same as in the config file. Check without starting: `node server.mjs --check`.
3. **The package as a zip or a text file**: if `.tar.gz` or `.md` files are blocked, use `personnel-billets-0.1.0.zip`; the guide is also provided as `INSTALL.txt`.

### Important rule: exactly one server per data folder
Files on NFS are not safe for two processes writing at once. The server therefore locks the folder (`server.lock`); a second server started on the same folder **refuses to start** with a clear message.
- If a server crashed and left the lock: on the same machine (e.g. an automatic systemd restart) the new server notices the old process is gone and starts at once. From another machine the lock expires after ~2 minutes, or start with `FORCE_UNLOCK=1` (only after making sure no other server is running).
- Many users at once are fine: everybody uses the same server. If two people save at the same moment, the first one wins; the second sees a message, the data refreshes, and they repeat their change.

### NFS tips
- Mount with `hard` (not `soft`) so that writes do not fail silently during a network problem.
- Writes are atomic (temporary file + rename), the change log is append-only, and automatic backups go to `backups/` (every 6 hours by default, last 60 kept).
- If the NFS becomes unreachable users see a red banner ("no connection to the server") and changes are saved when the connection returns.

### Backup and restore
- **Automatic:** `DATA_DIR/backups/state-<date>-<version>.json`. To restore by hand: stop the server, copy a backup over `DATA_DIR/state.json`, start again.
- **From the app:** "ניהול נתונים" in the menu — download a backup file and restore from a file (a restore first keeps a copy of the current state).
- Copying the whole `DATA_DIR` is a complete backup (data and change log).

### Upgrading without overwriting data
**Principle:** the new package contains software only — **no data and no `config.cmd` / `config.env`**. Extracting it over the existing folder therefore cannot overwrite your data or settings. The only risk is starting a new copy that points at a different (empty) data folder, which makes the data look lost.
1. **Back up before every upgrade:** in the app "ניהול נתונים" → "Download backup file", and also copy the whole data folder (`DATA_DIR`; if it was not set, the `data` folder next to the program).
2. **Stop the server** (close the black window). While it runs, the data is locked.
3. (Recommended: first delete the old `public` folder — it holds software only, no data — so no old files remain.) Extract the new zip **over the existing folder** (Windows: Extract All → same folder → "Replace the files"), or into a new folder. For a new folder: copy `config.cmd` into it (and the `data` folder if it sat next to the program), or set `DATA_DIR` in full to the old path.
4. Run `check.cmd`, then `start.cmd`, and open the app: the number of people and billets must be the same as before. **If the "הקמת המערכת" (first-run) screen appears, choose nothing:** stop the server, fix `DATA_DIR` and start again. (Choosing "start empty" on a new folder does not delete the old data, but splits you into two systems.)
5. Keep the old folder (or the backup) until you have confirmed everything is fine.
6. Users only need to refresh the page. Old data is compatible with the new version; there is no data migration step.
- **Older log entries** stay as they were written (even if they use older wording, e.g. "מפקד הארגון").
- **Do not go back to an older version** once data has been entered with new features: a backup from a newer version (e.g. containing the degree קא"ב) cannot be restored into an older version that does not know it.
- **The single file (`standalone.html`):** the data is kept in the browser, not in the file. Download a backup before replacing the file; if you cannot see your data after opening the new file, restore from the backup. (Chrome and Edge keep the data when the file is replaced; other browsers, such as Firefox, may not.)

### Removing people and changing a commander (in short)
- The 🗑 button on a row: **left the unit** (leaves the active list, history is kept, can be restored through "show who were removed") or **delete** (entered by mistake; final — only a backup restore brings it back). Before a delete the app shows what will be removed. Download a backup ("ניהול נתונים") before such actions.
- A commander cannot be removed: appoint another first ("החלפת מפקד" on the section page and on the group header in the table; "החלפת רע"ן" for the head of the organization).

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

## Removing people before upgrading (stop-gap)

`release/remove-people-tool.html` (`npm run package:remove-tool`) is an offline page: open a backup file, tick people, save a cleaned backup, then restore it in the app via "ניהול נתונים". Commanders cannot be ticked; the original file is untouched.
