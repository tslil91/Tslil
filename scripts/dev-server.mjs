// `npm run server`: bundle the server and run it on http://localhost:8080 serving dist/ (data in ./data).
// Written in Node (not shell) so it works the same on Windows, macOS and Linux.
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const built = spawnSync(process.execPath, [path.join('scripts', 'package.mjs'), '--dev'], { cwd: root, stdio: 'inherit' });
if (built.status !== 0) process.exit(built.status ?? 1);
const child = spawn(process.execPath, [path.join('build', 'server.mjs')], {
  cwd: root, stdio: 'inherit',
  env: { ...process.env, DATA_DIR: process.env.DATA_DIR ?? './data', PUBLIC_DIR: process.env.PUBLIC_DIR ?? './dist' },
});
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
