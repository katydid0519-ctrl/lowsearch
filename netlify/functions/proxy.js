const https = require("https");
const http  = require("http");
const { URL } = require("url");

const ALLOWED_HOSTS = new Set([
  "www.law.go.kr",
  "law.go.kr",
  "query1.finance.yahoo.com",
  "query2.finance.yahoo.com",
  "www.moel.go.kr",
  "moel.go.kr",
  "kosha.or.kr",
  "www.kosha.or.kr",
  "apis.data.go.kr",
]);

function fetchUrl(targetUrl, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const lib = parsed.protocol === "https:" ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "accept": "application/json, text/xml, text/html, */*",
        "accept-language": "ko-KR,ko;q=0.9",
        "accept-encoding": "identity",
        "cache-control": "no-cache",
        "connection": "close",
      },
      timeout: timeoutMs,
    };

    const req = lib.request(options, (res) => {
      // 리디렉트 처리 (최대 3회)
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303) && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, targetUrl).toString();
        fetchUrl(redirectUrl, timeoutMs).then(resolve).catch(reject);
        res.resume();
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString("utf-8"),
        });
      });
      res.on("error", reject);
    });

    req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
    req.on("error", reject);
    req.end();
  });
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "*",
      },
      body: "",
    };
  }

  try {
    // rawQuery에서 url= 이후 전체 추출 (Netlify의 쿼리스트링 잘림 버그 우회)
    const rawQuery = event.rawQuery || "";
    let targetUrl = null;

    if (rawQuery.startsWith("url=")) {
      targetUrl = decodeURIComponent(rawQuery.slice(4));
    } else {
      const match = rawQuery.match(/(?:^|&)url=(.+)/);
      if (match) targetUrl = decodeURIComponent(match[1]);
    }
    if (!targetUrl) {
      targetUrl = event.queryStringParameters && event.queryStringParameters.url;
    }

    if (!targetUrl) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" },
        body: JSON.stringify({ error: "Missing url parameter", rawQuery }),
      };
    }

    let parsed;
    try { parsed = new URL(targetUrl); }
    catch (e) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" },
        body: JSON.stringify({ error: "Invalid URL: " + targetUrl }),
      };
    }

    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      return {
        statusCode: 403,
        headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" },
        body: JSON.stringify({ error: "Host not allowed: " + parsed.hostname }),
      };
    }

    const result = await fetchUrl(targetUrl, 15000);
    const contentType = result.headers["content-type"] || "application/json; charset=utf-8";

    return {
      statusCode: 200,
      headers: {
        "content-type": contentType,
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "*",
        "cache-control": "public, max-age=300",
        "x-upstream-status": String(result.statusCode),
      },
      body: result.body,
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" },
      body: JSON.stringify({
        error: error.message || "Proxy failed",
        detail: String(error),
      }),
    };
  }
};
