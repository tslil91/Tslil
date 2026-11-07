import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataStore, LockError } from './datastore';
import { createApp } from './http';

const HELP = `Personnel & Billets server

Environment variables (all optional):
  PORT            port to listen on                      (default 8080)
  HOST            address to listen on                   (default 0.0.0.0 = all interfaces)
  DATA_DIR        folder for data, log and backups       (default ./data)  <- put this on the shared NFS
  PUBLIC_DIR      folder of the web app                  (default ./public next to this file)
  BACKUP_HOURS    minimum hours between backups          (default 6)
  KEEP_BACKUPS    how many backups to keep               (default 60)
  FORCE_UNLOCK=1  take over the data folder even if a lock exists (only after making sure no other server runs)
`;

const env = process.env;
if (process.argv.includes('--help') || process.argv.includes('-h')) { console.log(HELP); process.exit(0); }

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(env.PORT ?? 8080);
const host = env.HOST ?? '0.0.0.0';
const dataDir = path.resolve(env.DATA_DIR ?? './data');
const publicDir = path.resolve(env.PUBLIC_DIR ?? path.join(here, 'public'));

if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error(`Invalid PORT: ${env.PORT}`); process.exit(2); }
if (!fs.existsSync(path.join(publicDir, 'index.html'))) { console.error(`The web app was not found in ${publicDir} (index.html is missing). Set PUBLIC_DIR.`); process.exit(2); }

let store: DataStore;
try {
  store = DataStore.open({
    dataDir,
    backupEveryMs: Number(env.BACKUP_HOURS ?? 6) * 3600_000,
    keepBackups: Number(env.KEEP_BACKUPS ?? 60),
    forceUnlock: env.FORCE_UNLOCK === '1',
  });
} catch (e) {
  console.error(e instanceof LockError ? `\n${e.message}\n` : `Cannot open the data folder ${dataDir}: ${(e as Error).message}`);
  process.exit(1);
}

const server = createApp({ store, publicDir });
server.listen(port, host, () => {
  console.log(`Server running: http://${host === '0.0.0.0' ? '<this-machine>' : host}:${port}`);
  console.log(`Data folder:    ${dataDir}`);
  console.log(`Web app:        ${publicDir}`);
});
server.on('error', (e) => { console.error(`Cannot listen on ${host}:${port}: ${(e as Error).message}`); store.close(); process.exit(1); });

const stop = (sig: string) => {
  console.log(`\n${sig} received, shutting down...`);
  server.close(() => { store.close(); process.exit(0); });
  setTimeout(() => { store.close(); process.exit(0); }, 3000).unref();
};
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('uncaughtException', (e) => { console.error(`Fatal: ${e.stack}`); store.close(); process.exit(1); });
