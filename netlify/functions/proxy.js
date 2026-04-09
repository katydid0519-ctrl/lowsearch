// netlify/functions/proxy.js
const https = require('https');
const http = require('http');
const { URL } = require('url');

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
  // ── 트렌드·뉴스 ──
  'news.google.com',
  'trends.google.com',
  'www.moel.go.kr',
  'api.rss2json.com',
];

exports.handler = async function(event) {
  const targetUrl = event.queryStringParameters && event.queryStringParameters.url;
  if (!targetUrl) {
    return { statusCode: 400, body: 'Missing url parameter' };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid URL' };
  }

  const hostname = parsedUrl.hostname;
  const isAllowed = allowedHosts.some(h => hostname === h || hostname.endsWith('.' + h));
  if (!isAllowed) {
    return {
      statusCode: 403,
      headers: { 'x-deny-reason': 'host not in allowlist' },
      body: `Host not allowed: ${hostname}`,
    };
  }

  return new Promise((resolve) => {
    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LawSearchBot/7.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/json, text/html, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
      },
      timeout: 15000,
    };

    const req = lib.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        const ct = res.headers['content-type'] || '';
        resolve({
          statusCode: res.statusCode || 200,
          headers: {
            'Content-Type': ct || 'text/plain; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=120',
          },
          body,
        });
      });
    });

    req.on('error', (e) => {
      resolve({ statusCode: 502, body: `Proxy error: ${e.message}` });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ statusCode: 504, body: 'Proxy timeout' });
    });
    req.end();
  });
};
