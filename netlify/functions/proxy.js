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
    const targetUrl = event.queryStringParameters && event.queryStringParameters.url;
    if (!targetUrl) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*"
        },
        body: JSON.stringify({ error: "Missing url query parameter" })
      };
    }

    const url = new URL(targetUrl);
    const allowedHosts = new Set([
      "www.law.go.kr",
      "law.go.kr",
      "query1.finance.yahoo.com",
      "www.moel.go.kr",
      "moel.go.kr",
      "kosha.or.kr",
      "www.kosha.or.kr",
      "query2.finance.yahoo.com"
    ]);

    if (!allowedHosts.has(url.hostname)) {
      return {
        statusCode: 403,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*"
        },
        body: JSON.stringify({ error: "Host not allowed" })
      };
    }

    const upstream = await fetch(targetUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (Netlify Proxy)",
        "accept": "*/*",
        "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "accept-encoding": "identity",
        "cache-control": "no-cache",
        "pragma": "no-cache"
      }
    });

    const contentType = upstream.headers.get("content-type") || "text/plain; charset=utf-8";
    const body = await upstream.text();

    return {
      statusCode: upstream.status,
      headers: {
        "content-type": contentType,
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "*",
        "cache-control": "public, max-age=60"
      },
      body
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*"
      },
      body: JSON.stringify({
        error: error && error.message ? error.message : "Proxy failed"
      })
    };
  }
};
