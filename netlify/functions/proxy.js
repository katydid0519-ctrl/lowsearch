/* Netlify Function - CommonJS (Node.js 18+) */
"use strict";
const https = require("https");
const http  = require("http");

const ALLOWED_HOSTS = new Set([
  "www.law.go.kr", "law.go.kr",
  "query1.finance.yahoo.com", "query2.finance.yahoo.com",
  "www.moel.go.kr", "moel.go.kr",
  "kosha.or.kr", "www.kosha.or.kr",
  "apis.data.go.kr",
]);

function fetchUrl(targetUrl, timeoutMs) {
  timeoutMs = timeoutMs || 15000;
  return new Promise(function(resolve, reject) {
    var parsed;
    try { parsed = new URL(targetUrl); } catch(e) { return reject(e); }
    var lib = parsed.protocol === "https:" ? https : http;
    var options = {
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
    var req = lib.request(options, function(res) {
      if ([301,302,303,307,308].indexOf(res.statusCode) !== -1 && res.headers.location) {
        var next;
        try { next = new URL(res.headers.location, targetUrl).toString(); } catch(e) { next = res.headers.location; }
        res.resume();
        return fetchUrl(next, timeoutMs).then(resolve).catch(reject);
      }
      var chunks = [];
      res.on("data", function(c) { chunks.push(c); });
      res.on("end", function() {
        resolve({
          statusCode: res.statusCode,
          contentType: res.headers["content-type"] || "application/json; charset=utf-8",
          body: Buffer.concat(chunks).toString("utf-8"),
        });
      });
      res.on("error", reject);
    });
    req.on("timeout", function() { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject);
    req.end();
  });
}

exports.handler = async function(event) {
  var corsHeaders = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "*",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  try {
    // rawQuery에서 url= 이후 전체 추출 (Netlify 쿼리스트링 잘림 버그 우회)
    var rawQuery = event.rawQuery || "";
    var targetUrl = null;

    if (rawQuery.indexOf("url=") === 0) {
      targetUrl = decodeURIComponent(rawQuery.slice(4));
    } else {
      var m = rawQuery.match(/(?:^|&)url=(.+)/);
      if (m) targetUrl = decodeURIComponent(m[1]);
    }
    if (!targetUrl && event.queryStringParameters && event.queryStringParameters.url) {
      targetUrl = event.queryStringParameters.url;
    }

    if (!targetUrl) {
      return { statusCode: 400, headers: Object.assign({}, corsHeaders, {"content-type":"application/json"}),
        body: JSON.stringify({ error: "Missing url", rawQuery: rawQuery }) };
    }

    var parsed;
    try { parsed = new URL(targetUrl); }
    catch(e) {
      return { statusCode: 400, headers: Object.assign({}, corsHeaders, {"content-type":"application/json"}),
        body: JSON.stringify({ error: "Invalid URL: " + targetUrl }) };
    }

    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      return { statusCode: 403, headers: Object.assign({}, corsHeaders, {"content-type":"application/json"}),
        body: JSON.stringify({ error: "Host not allowed: " + parsed.hostname }) };
    }

    var result = await fetchUrl(targetUrl, 15000);

    return {
      statusCode: 200,
      headers: Object.assign({}, corsHeaders, {
        "content-type": result.contentType,
        "cache-control": "public, max-age=300",
        "x-upstream-status": String(result.statusCode),
      }),
      body: result.body,
    };

  } catch(err) {
    return {
      statusCode: 500,
      headers: Object.assign({}, corsHeaders, {"content-type":"application/json"}),
      body: JSON.stringify({ error: err.message || "Proxy failed", detail: String(err) }),
    };
  }
};
