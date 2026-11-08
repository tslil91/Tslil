// Builds a self-contained release folder for an offline (air-gapped) install:
//   release/personnel-billets/{server.mjs, public/, start.sh, start.cmd, config.env.example, INSTALL.md, VERSION.txt}
// The server is a single bundled file with no npm dependencies. Only Node.js 20+ is needed on the target machine.
//   node scripts/package.mjs            full release (+ .tar.gz and .zip)
//   node scripts/package.mjs --node-win <path-to-node.exe>   also a Windows package that includes node.exe
//   node scripts/package.mjs --dev      only bundle the server into build/ (used by `npm run server`)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
// Windows scripts need CRLF line endings
const crlf = (text) => text.replace(/\r?\n/g, '\r\n');
const cmdRunner = (extraArgs, alwaysPause) => crlf(`@echo off
setlocal
cd /d "%~dp0"
if exist "config.cmd" call "config.cmd"
set "NODE_EXE=node"
if exist "%~dp0node\\node.exe" set "NODE_EXE=%~dp0node\\node.exe"
"%NODE_EXE%" --version >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found.
  echo Use the Windows package (it contains a "node" folder), or install Node.js 20 or newer.
  pause
  exit /b 1
)
"%NODE_EXE%" "%~dp0server.mjs"${extraArgs}
${alwaysPause ? 'pause' : 'if errorlevel 1 pause'}
endlocal
`);
write('start.cmd', cmdRunner('', false));
write('check.cmd', cmdRunner(' --check', true));
write('config.cmd.example', crlf(`rem Copy this file to config.cmd and edit it. Lines starting with "rem" are ignored.
set PORT=8080
rem set HOST=0.0.0.0
rem The folder for data, change log and backups:
set DATA_DIR=D:\\personnel-billets-data
rem For a network share use a UNC path (a mapped drive letter is not available to every kind of start):
rem set DATA_DIR=\\\\fileserver\\share\\personnel-billets-data
set BACKUP_HOURS=6
set KEEP_BACKUPS=60
rem set FORCE_UNLOCK=1
`));
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
// the same guide as plain text, for places that block .md files
fs.copyFileSync(path.join(root, 'docs/INSTALL.md'), path.join(outDir, 'INSTALL.txt'));

let sha = 'unknown';
try { sha = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch { /* not a git checkout */ }
write('VERSION.txt', `personnel-billets ${pkg.version}\nbuilt ${new Date().toISOString()}\ncommit ${sha}\n`);

const tarName = `personnel-billets-${pkg.version}.tar.gz`;
const zipName = tarName.replace(/\.tar\.gz$/, '.zip');
const releaseDir = path.join(root, 'release');

/** .zip with the zip tool when present, otherwise with tar (Windows 10+ has a tar that writes zip files). */
function makeZip(zip, folder) {
  fs.rmSync(path.join(releaseDir, zip), { force: true });
  for (const cmd of [`zip -qr ${zip} ${folder}`, `tar -a -cf ${zip} ${folder}`]) {
    try { execSync(cmd, { cwd: releaseDir, stdio: 'pipe' }); console.log(`archive -> release/${zip}`); return; } catch { fs.rmSync(path.join(releaseDir, zip), { force: true }); }
  }
  console.log(`no zip/tar tool available: skipped ${zip}`);
}

try { run(`tar -czf release/${tarName} -C release personnel-billets`); console.log(`archive -> release/${tarName}`); } catch { console.log('tar not available: copy the folder as is'); }
makeZip(zipName, 'personnel-billets');

// Windows package: the same files plus a private copy of node.exe, so nothing has to be installed on the machine.
const nodeFlag = process.argv.indexOf('--node-win');
if (nodeFlag > 0) {
  const nodeExe = path.resolve(process.argv[nodeFlag + 1] ?? '');
  if (!fs.existsSync(nodeExe)) throw new Error(`node.exe not found: ${nodeExe}`);
  const winName = 'personnel-billets-windows';
  const winDir = path.join(releaseDir, winName);
  fs.rmSync(winDir, { recursive: true, force: true });
  fs.cpSync(outDir, winDir, { recursive: true });
  fs.mkdirSync(path.join(winDir, 'node'));
  fs.copyFileSync(nodeExe, path.join(winDir, 'node', 'node.exe'));
  const lic = path.join(path.dirname(nodeExe), '..', 'LICENSE');
  for (const f of [lic, path.join(path.dirname(nodeExe), 'LICENSE')]) if (fs.existsSync(f)) { fs.copyFileSync(f, path.join(winDir, 'node', 'LICENSE-node.txt')); break; }
  fs.rmSync(path.join(winDir, 'start.sh'), { force: true });
  fs.rmSync(path.join(winDir, 'personnel-billets.service'), { force: true });
  makeZip(`${winName}-${pkg.version}.zip`, winName);
}
console.log(`\nRelease ready: release/personnel-billets  (copy it to the target machine / NFS)`);
