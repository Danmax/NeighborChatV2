import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createServer } from 'node:http';

const port = Number(process.env.PORT || 3000);
const distDir = join(process.cwd(), 'dist');
const indexPath = join(distDir, 'index.html');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function sendFile(res, filePath) {
  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const stream = createReadStream(filePath);

  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  if (ext === '.html') {
    res.setHeader('Cache-Control', 'no-cache');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }

  stream.on('error', () => {
    res.statusCode = 500;
    res.end('Internal Server Error');
  });

  stream.pipe(res);
}

function resolveAsset(pathname) {
  const cleanPath = pathname.split('?')[0].split('#')[0];
  const decodedPath = decodeURIComponent(cleanPath);
  const normalized = normalize(decodedPath).replace(/^(\.\.[/\\])+/, '');
  const relativePath = normalized.replace(/^[/\\]+/, '');
  return join(distDir, relativePath);
}

if (!existsSync(indexPath)) {
  console.error('dist/index.html not found. Run `npm run build` before starting.');
  process.exit(1);
}

const server = createServer((req, res) => {
  const pathname = req.url || '/';
  const requestedFile = resolveAsset(pathname);

  if (existsSync(requestedFile) && statSync(requestedFile).isFile()) {
    sendFile(res, requestedFile);
    return;
  }

  sendFile(res, indexPath);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Serving dist on http://0.0.0.0:${port}`);
});
