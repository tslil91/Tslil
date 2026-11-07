// Builds a self-contained release folder for an offline (air-gapped) install:
//   release/personnel-billets/{server.mjs, public/, start.sh, start.cmd, config.env.example, INSTALL.md, VERSION.txt}
// The server is a single bundled file with no npm dependencies. Only Node.js 20+ is needed on the target machine.
//   node scripts/package.mjs            full release (+ .tar.gz)
//   node scripts/package.mjs --dev      only bundle the server into build/ (used by `npm run server`)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dev = process.argv.includes('--dev');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

const outDir = dev ? path.join(root, 'build') : path.join(root, 'release', 'personnel-billets');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [path.join(root, 'server/main.ts')], outfile: path.join(outDir, 'server.mjs'),
  bundle: true, platform: 'node', format: 'esm', target: 'node20', sourcemap: false, legalComments: 'none', logLevel: 'warning',
});
console.log(`server bundled -> ${path.relative(root, path.join(outDir, 'server.mjs'))}`);
if (dev) process.exit(0);

run('npx vite build');
fs.cpSync(path.join(root, 'dist'), path.join(outDir, 'public'), { recursive: true });

const write = (name, text, mode) => fs.writeFileSync(path.join(outDir, name), text, { mode });
write('start.sh', `#!/bin/sh
# Starts the server. Settings are read from config.env (copy config.env.example to config.env and edit it).
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then echo "Node.js 20 or newer is required but was not found." >&2; exit 1; fi
if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)'; then echo "Node.js 20 or newer is required (found $(node -v))." >&2; exit 1; fi
if [ -f ./config.env ]; then set -a; . ./config.env; set +a; fi
exec node ./server.mjs
`, 0o755);
write('start.cmd', `@echo off
cd /d "%~dp0"
if exist config.cmd call config.cmd
node server.mjs
`);
write('config.env.example', `# Copy to config.env and edit. Every line is optional.
PORT=8080
HOST=0.0.0.0
# The folder for data, change log and backups. Put it on the shared NFS (an absolute path).
DATA_DIR=/mnt/shared/personnel-billets-data
BACKUP_HOURS=6
KEEP_BACKUPS=60
# FORCE_UNLOCK=1   only after making sure that no other server is running on this DATA_DIR
`);
write('personnel-billets.service', `# Example systemd unit. Adjust User, paths and the data folder.
[Unit]
Description=Personnel and billets server
After=network-online.target remote-fs.target
Wants=network-online.target
RequiresMountsFor=/mnt/shared

[Service]
Type=simple
User=personnel
WorkingDirectory=/opt/personnel-billets
EnvironmentFile=-/opt/personnel-billets/config.env
ExecStart=/usr/bin/node /opt/personnel-billets/server.mjs
Restart=on-failure
RestartSec=5
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
`);
fs.copyFileSync(path.join(root, 'docs/INSTALL.md'), path.join(outDir, 'INSTALL.md'));

let sha = 'unknown';
try { sha = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch { /* not a git checkout */ }
write('VERSION.txt', `personnel-billets ${pkg.version}\nbuilt ${new Date().toISOString()}\ncommit ${sha}\n`);

const tarName = `personnel-billets-${pkg.version}.tar.gz`;
try { run(`tar -czf release/${tarName} -C release personnel-billets`); console.log(`archive -> release/${tarName}`); } catch { console.log('tar not available: copy the folder as is'); }
console.log(`\nRelease ready: release/personnel-billets  (copy it to the target machine / NFS)`);
