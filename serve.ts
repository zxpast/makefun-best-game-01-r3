// A tiny static server for playing ROADWARD locally in a browser.
// Serves this directory on http://localhost:8080/ — open /game/ to play.
// No dependencies, Node standard library only. Run: node serve.ts

import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.ts': 'text/typescript; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

const server = createServer((req, res) => {
  const path = normalize(join(root, decodeURIComponent(req.url.split('?')[0])));
  if (!path.startsWith(root)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  let file = path;
  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
    const body = readFileSync(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(port, () => {
  console.log('ROADWARD serving at http://localhost:' + port + '/game/');
});
