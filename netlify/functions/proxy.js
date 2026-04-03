exports.handler = async function(event) {
  var cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "*"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  var https = require("https");
  var http = require("http");

  var ALLOWED = {
    "www.law.go.kr": 1, "law.go.kr": 1,
    "query1.finance.yahoo.com": 1, "query2.finance.yahoo.com": 1,
    "www.moel.go.kr": 1, "moel.go.kr": 1,
    "kosha.or.kr": 1, "www.kosha.or.kr": 1,
    "apis.data.go.kr": 1
  };

  try {
    var raw = event.rawQuery || "";
    var targetUrl = null;
    if (raw.indexOf("url=") === 0) {
      targetUrl = decodeURIComponent(raw.slice(4));
    } else {
      var m = raw.match(/(?:^|&)url=(.+)/);
      if (m) targetUrl = decodeURIComponent(m[1]);
    }
    if (!targetUrl && event.queryStringParameters) {
      targetUrl = event.queryStringParameters.url;
    }
    if (!targetUrl) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "no url" }) };
    }

    var parsed = new URL(targetUrl);
    if (!ALLOWED[parsed.hostname]) {
      return { statusCode: 403, headers: cors, body: JSON.stringify({ error: "blocked: " + parsed.hostname }) };
    }

    var result = await new Promise(function(resolve, reject) {
      var lib = parsed.protocol === "https:" ? https : http;
      var req = lib.request({
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: {
          "user-agent": "Mozilla/5.0",
          "accept": "*/*",
          "accept-encoding": "identity",
          "connection": "close"
        },
        timeout: 15000
      }, function(res) {
        if ([301,302,303,307,308].indexOf(res.statusCode) !== -1 && res.headers.location) {
          res.resume();
          return reject(new Error("redirect: " + res.headers.location));
        }
        var chunks = [];
        res.on("data", function(c) { chunks.push(c); });
        res.on("end", function() {
          resolve({
            ct: res.headers["content-type"] || "text/plain",
            body: Buffer.concat(chunks).toString("utf-8")
          });
        });
        res.on("error", reject);
      });
      req.on("timeout", function() { req.destroy(); reject(new Error("timeout")); });
      req.on("error", reject);
      req.end();
    });

    return {
      statusCode: 200,
      headers: Object.assign({}, cors, { "content-type": result.ct, "cache-control": "public, max-age=300" }),
      body: result.body
    };

  } catch(e) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: e.message || "failed" })
    };
  }
};
