import https from "https";
import http from "http";

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
    const req = lib.request(
      {
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
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          const next = new URL(res.headers.location, targetUrl).toString();
          res.resume();
          fetchUrl(next, timeoutMs).then(resolve).catch(reject);
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            statusCode: res.statusCode,
            contentType: res.headers["content-type"] || "application/json; charset=utf-8",
            body: Buffer.concat(chunks).toString("utf-8"),
          })
        );
        res.on("error", reject);
      }
    );
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject);
    req.end();
  });
}

export const handler = async (event) => {
  const corsHeaders = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "*",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  try {
    // rawQuery에서 url= 이후 전체 추출 (Netlify 쿼리스트링 잘림 버그 우회)
    const rawQuery = event.rawQuery || "";
    let targetUrl =
      rawQuery.startsWith("url=")
        ? decodeURIComponent(rawQuery.slice(4))
        : (() => { const m = rawQuery.match(/(?:^|&)url=(.+)/); return m ? decodeURIComponent(m[1]) : null; })()
      ?? event.queryStringParameters?.url
      ?? null;

    if (!targetUrl) {
      return { statusCode: 400, headers: { ...corsHeaders, "content-type": "application/json" }, body: JSON.stringify({ error: "Missing url", rawQuery }) };
    }

    let parsed;
    try { parsed = new URL(targetUrl); }
    catch { return { statusCode: 400, headers: { ...corsHeaders, "content-type": "application/json" }, body: JSON.stringify({ error: "Invalid URL" }) }; }

    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      return { statusCode: 403, headers: { ...corsHeaders, "content-type": "application/json" }, body: JSON.stringify({ error: "Host not allowed: " + parsed.hostname }) };
    }

    const result = await fetchUrl(targetUrl);

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        "content-type": result.contentType,
        "cache-control": "public, max-age=300",
        "x-upstream-status": String(result.statusCode),
      },
      body: result.body,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
      body: JSON.stringify({ error: err.message || "Proxy failed", detail: String(err) }),
    };
  }
};
