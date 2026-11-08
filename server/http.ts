import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { AuditKind } from '../src/domain/types';
import type { AuditFilter } from '../src/logic/auditFilter';
import { DataStore, validateData, validateEntries } from './datastore';

export interface AppOptions {
  store: DataStore;
  /** Folder with the built web app (index.html, assets/...). */
  publicDir: string;
  /** Maximum request body in bytes. */
  maxBodyBytes?: number;
  log?: (msg: string) => void;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

// Everything is served from this one origin; nothing is loaded from the internet.
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; "
  + "worker-src 'self' blob:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'";

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }

function readBody(req: http.IncomingMessage, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    // Too large: keep reading but throw the data away, so the client gets a clean 413 instead of a dropped connection.
    req.on('data', (c: Buffer) => { size += c.length; if (size <= max) chunks.push(c); });
    req.on('end', () => (size > max ? reject(new HttpError(413, 'Request too large')) : resolve(Buffer.concat(chunks).toString('utf8'))));
    req.on('error', reject);
  });
}

export function createApp(opts: AppOptions): http.Server {
  const { store } = opts;
  const publicDir = path.resolve(opts.publicDir);
  const max = opts.maxBodyBytes ?? 25 * 1024 * 1024;
  const log = opts.log ?? ((m: string) => console.log(m));

  const sendJson = (res: http.ServerResponse, status: number, body: unknown) => {
    const text = JSON.stringify(body);
    res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(text) });
    res.end(text);
  };

  const api = async (req: http.IncomingMessage, res: http.ServerResponse, url: URL) => {
    const route = url.pathname.slice(4); // strip "/api"
    const method = req.method ?? 'GET';
    const only = (...m: string[]) => { if (!m.includes(method)) throw new HttpError(405, 'Method not allowed'); };

    if (route === '/health') { only('GET'); return sendJson(res, 200, { ok: true, app: 'personnel-billets', version: store.version }); }
    if (route === '/version') { only('GET'); return sendJson(res, 200, { version: store.version }); }
    if (route === '/info') { only('GET'); return sendJson(res, 200, store.info()); }
    if (route === '/state') {
      if (method === 'GET') return sendJson(res, 200, { version: store.version, data: store.data });
      only('PUT');
      if (!(req.headers['content-type'] ?? '').startsWith('application/json')) throw new HttpError(415, 'Content-Type must be application/json');
      let body: { baseVersion?: unknown; data?: unknown; entries?: unknown; backupBefore?: unknown };
      try { body = JSON.parse(await readBody(req, max)); } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(400, 'Invalid JSON'); }
      if (!Number.isInteger(body.baseVersion)) throw new HttpError(400, 'baseVersion is required');
      if (!validateData(body.data)) throw new HttpError(400, 'data is not a valid data set');
      const entries = validateEntries(body.entries ?? []);
      if (!entries) throw new HttpError(400, 'entries are not valid');
      let actor = '';
      try { actor = decodeURIComponent(String(req.headers['x-actor'] ?? '')); } catch { actor = ''; }
      const r = store.commit({ baseVersion: body.baseVersion as number, data: body.data, entries, actor, backupBefore: body.backupBefore === true });
      if (r.ok) return sendJson(res, 200, { version: r.version });
      if (r.reason === 'conflict') return sendJson(res, 409, { error: 'conflict', version: r.version });
      return sendJson(res, 503, { error: 'This server no longer owns the data directory.' });
    }
    if (route === '/audit') {
      only('GET');
      const q = url.searchParams;
      const f: AuditFilter = {};
      if (q.has('personId') && Number.isInteger(Number(q.get('personId')))) f.personId = Number(q.get('personId'));
      if (q.get('kind')) f.kind = q.get('kind') as AuditKind;
      if (q.get('actor')) f.actor = q.get('actor')!.slice(0, 40);
      if (q.get('q')) f.q = q.get('q')!.slice(0, 100);
      if (/^\d{4}-\d{2}-\d{2}$/.test(q.get('from') ?? '')) f.from = q.get('from')!;
      if (/^\d{4}-\d{2}-\d{2}$/.test(q.get('to') ?? '')) f.to = q.get('to')!;
      if (q.has('limit') && Number.isInteger(Number(q.get('limit')))) f.limit = Number(q.get('limit'));
      return sendJson(res, 200, { ...store.readAudit(f), version: store.version });
    }
    throw new HttpError(404, 'Not found');
  };

  const serveStatic = (req: http.IncomingMessage, res: http.ServerResponse, url: URL) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
    let rel: string;
    try { rel = decodeURIComponent(url.pathname); } catch { throw new HttpError(400, 'Bad path'); }
    if (rel.includes('\0') || rel.includes(':')) throw new HttpError(400, 'Bad path'); // ':' = Windows drive letters / alternate data streams
    let file = path.resolve(path.join(publicDir, rel === '/' ? 'index.html' : rel));
    if (file !== publicDir && !file.startsWith(publicDir + path.sep)) throw new HttpError(403, 'Forbidden'); // path traversal
    let st: fs.Stats | null = null;
    try { st = fs.statSync(file); if (st.isDirectory()) { file = path.join(file, 'index.html'); st = fs.statSync(file); } } catch { st = null; }
    if (!st || !st.isFile()) throw new HttpError(404, 'Not found');
    const ext = path.extname(file).toLowerCase();
    const immutable = rel.startsWith('/assets/');
    res.writeHead(200, {
      ...SECURITY_HEADERS, 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Content-Length': st.size,
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (req.method === 'HEAD') return void res.end();
    fs.createReadStream(file).pipe(res);
  };

  return http.createServer((req, res) => {
    const started = Date.now();
    const url = new URL(req.url ?? '/', 'http://localhost');
    const done = (status: number) => {
      if (req.method !== 'GET' || status >= 400) {
        if (!(status === 404 && url.pathname === '/favicon.ico')) log(`${new Date().toISOString()} ${req.method} ${url.pathname} ${status} ${Date.now() - started}ms`);
      }
    };
    res.on('finish', () => done(res.statusCode));
    const fail = (e: unknown) => {
      if (res.headersSent) { res.destroy(); return; }
      if (e instanceof HttpError) return sendJson(res, e.status, { error: e.message });
      log(`Unhandled error: ${(e as Error).stack ?? e}`);
      return sendJson(res, 500, { error: 'Internal server error' });
    };
    try {
      if (url.pathname.startsWith('/api/')) api(req, res, url).catch(fail);
      else serveStatic(req, res, url);
    } catch (e) { fail(e); }
  });
}
