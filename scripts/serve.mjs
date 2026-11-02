import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = process.cwd();
const host = '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, `http://${host}`).pathname);
    let target = resolve(root, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
    if (target !== root && !target.startsWith(root + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    let info = await stat(target);
    if (info.isDirectory()) {
      target = resolve(target, 'index.html');
      info = await stat(target);
    }
    res.writeHead(200, {
      'Content-Type': mime[extname(target)] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-store',
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(target).pipe(res);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

server.listen(port, host, () => {
  console.log(`UI Patterns Gallery: http://${host}:${port}/`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
