import { createServer } from 'node:http'; import { readFile } from 'node:fs/promises'; import { resolve, relative, extname } from 'node:path';
const root = resolve('dist'), port = Number(process.env.PORT || 4173), types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.wav': 'audio/wav' };
createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    const inside = relative(root, path);
    if (inside.startsWith('..') || inside.includes(':')) { res.writeHead(403).end(); return; }
    const file = path === root ? root + '/index.html' : path;
    const body = await readFile(file);
    const headers = { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': body.length, 'Accept-Ranges': 'bytes' };
    // Safari richiede porzioni del WAV per iniziare la riproduzione.
    const range = req.method === 'GET' && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, body.length - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= body.length) {
        res.writeHead(416, { 'Content-Range': `bytes */${body.length}`, 'Content-Length': 0 }).end();
        return;
      }
      res.writeHead(206, { ...headers, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${body.length}` });
      res.end(body.subarray(start, end + 1));
      return;
    }
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404).end('Non trovato'); }
}).listen(port, '127.0.0.1', () => console.log(`Vibe Pulse: http://127.0.0.1:${port}`));
