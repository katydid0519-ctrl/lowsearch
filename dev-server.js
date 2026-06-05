const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { URL } = require('url');

const root = __dirname;
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '127.0.0.1';
const lowsearchRoot = path.join(root, 'lowsearch') + path.sep;

const allowedHosts = [
  'www.law.go.kr',
  'law.go.kr',
  'apis.data.go.kr',
  'portal.kosha.or.kr',
  'kosha.or.kr',
  'www.kosha.or.kr',
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'finance.yahoo.com',
  'wttr.in',
  'news.google.com',
  'trends.google.com',
  'www.moel.go.kr',
  'api.rss2json.com',
];
const lawApiOrigin = process.env.LAW_API_ORIGIN || 'https://lawsearchsite.netlify.app';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, statusCode, headers, body) {
  res.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...headers,
  });
  res.end(body);
}

function serveStatic(reqUrl, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(reqUrl, `http://${host}:${port}`).pathname);
  } catch (e) {
    send(res, 400, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Bad request');
    return;
  }

  if (pathname === '/' || pathname === '') pathname = '/index.html';
  const filePath = path.resolve(root, `.${pathname}`);

  if (!filePath.startsWith(root) || filePath.startsWith(lowsearchRoot)) {
    send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    }, data);
  });
}

function proxyRequest(targetUrl, res, attempt = 0) {
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (e) {
    send(res, 400, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Invalid URL');
    return;
  }

  const isAllowed = allowedHosts.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));
  if (!isAllowed) {
    send(res, 403, { 'Content-Type': 'text/plain; charset=utf-8', 'x-deny-reason': 'host not in allowlist' }, `Host not allowed: ${parsed.hostname}`);
    return;
  }

  const lib = parsed.protocol === 'https:' ? https : http;
  const request = lib.request({
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path: parsed.pathname + parsed.search,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LawSearchLocalDev/1.0)',
      'Accept': 'application/rss+xml, application/xml, text/xml, application/json, text/html, */*',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      'Accept-Encoding': 'identity',
      'Cache-Control': 'no-cache',
      ...(parsed.hostname === 'law.go.kr' || parsed.hostname.endsWith('.law.go.kr') ? {
        'Origin': lawApiOrigin,
        'Referer': `${lawApiOrigin}/`,
      } : {}),
    },
    timeout: 18000,
  }, (proxyRes) => {
    const chunks = [];
    proxyRes.on('data', (chunk) => chunks.push(chunk));
    proxyRes.on('end', () => {
      send(res, proxyRes.statusCode || 200, {
        'Content-Type': proxyRes.headers['content-type'] || 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      }, Buffer.concat(chunks));
    });
  });

  request.on('error', (err) => {
    if (attempt < 1 && ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN'].includes(err.code)) {
      proxyRequest(targetUrl, res, attempt + 1);
      return;
    }
    send(res, 502, { 'Content-Type': 'text/plain; charset=utf-8' }, `Proxy error: ${err.message}`);
  });

  request.on('timeout', () => {
    request.destroy(new Error('Proxy timeout'));
  });

  request.end();
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    send(res, 204, {}, '');
    return;
  }

  if (req.method !== 'GET') {
    send(res, 405, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Method not allowed');
    return;
  }

  const url = new URL(req.url, `http://${host}:${port}`);
  if (url.pathname === '/.netlify/functions/proxy') {
    proxyRequest(url.searchParams.get('url') || '', res);
    return;
  }

  serveStatic(req.url, res);
});

server.listen(port, host, () => {
  console.log(`LawSearch dev server: http://${host}:${port}`);
});
