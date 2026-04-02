exports.handler = async function(event) {
  try {
    const targetUrl = event.queryStringParameters && event.queryStringParameters.url;
    if (!targetUrl) {
      return { statusCode: 400, headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify({ error: "Missing url query parameter" }) };
    }

    const url = new URL(targetUrl);
    const allowedHosts = new Set([
      "www.law.go.kr","law.go.kr",
      "query1.finance.yahoo.com",
      "www.moel.go.kr","moel.go.kr",
      "kosha.or.kr","www.kosha.or.kr"
    ]);

    if (!allowedHosts.has(url.hostname)) {
      return { statusCode: 403, headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify({ error: "Host not allowed" }) };
    }

    const upstream = await fetch(targetUrl, {
      method: "GET",
      headers: { "user-agent": "Mozilla/5.0 Netlify Function Proxy", "accept": "*/*" }
    });

    const contentType = upstream.headers.get("content-type") || "text/plain; charset=utf-8";
    const text = await upstream.text();

    return {
      statusCode: upstream.status,
      headers: {
        "content-type": contentType,
        "access-control-allow-origin": "*",
        "cache-control": "public, max-age=300"
      },
      body: text
    };
  } catch (error) {
    return { statusCode: 500, headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify({ error: error.message || "Proxy failed" }) };
  }
};