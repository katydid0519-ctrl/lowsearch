exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "*"
      },
      body: ""
    };
  }

  try {
    // Netlify는 /.netlify/functions/proxy?url=https://a.com?foo=1&bar=2 요청 시
    // queryStringParameters.url = "https://a.com?foo=1" 만 파싱하고 "&bar=2"를 잘라버림.
    // rawQuery 전체에서 "url=" 이후를 직접 추출해야 쿼리스트링 보존 가능.
    const rawQuery = event.rawQuery || "";
    let targetUrl = null;

    if (rawQuery.startsWith("url=")) {
      targetUrl = decodeURIComponent(rawQuery.slice(4));
    } else {
      const match = rawQuery.match(/(?:^|&)url=(.+)/);
      if (match) targetUrl = decodeURIComponent(match[1]);
    }

    // 폴백: queryStringParameters (단순 URL에는 충분)
    if (!targetUrl) {
      targetUrl = event.queryStringParameters && event.queryStringParameters.url;
    }

    if (!targetUrl) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" },
        body: JSON.stringify({ error: "Missing url query parameter", rawQuery })
      };
    }

    let url;
    try { url = new URL(targetUrl); }
    catch (e) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" },
        body: JSON.stringify({ error: "Invalid URL: " + targetUrl })
      };
    }

    const allowedHosts = new Set([
      "www.law.go.kr",
      "law.go.kr",
      "query1.finance.yahoo.com",
      "query2.finance.yahoo.com",
      "www.moel.go.kr",
      "moel.go.kr",
      "kosha.or.kr",
      "www.kosha.or.kr",
    ]);

    if (!allowedHosts.has(url.hostname)) {
      return {
        statusCode: 403,
        headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" },
        body: JSON.stringify({ error: "Host not allowed: " + url.hostname })
      };
    }

    const upstream = await fetch(targetUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "accept": "text/html,application/xhtml+xml,application/xml,application/json,*/*;q=0.9",
        "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "accept-encoding": "identity",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "referer": url.origin + "/"
      }
    });

    const contentType = upstream.headers.get("content-type") || "text/plain; charset=utf-8";
    const body = await upstream.text();

    return {
      statusCode: upstream.ok ? upstream.status : 200,
      headers: {
        "content-type": contentType,
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "*",
        "cache-control": "public, max-age=60",
        "x-upstream-status": String(upstream.status)
      },
      body
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" },
      body: JSON.stringify({
        error: error && error.message ? error.message : "Proxy failed",
        detail: String(error)
      })
    };
  }
};
