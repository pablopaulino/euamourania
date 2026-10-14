import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const handler = require("../api/newsletter-track.js");
const origin = "https://euamourania.com.br";
const originalFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (...args) => { calls.push(args); return { ok: true }; };
function response() {
  return {
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    redirect(status, location) { this.statusCode = status; this.location = location; },
    status(status) { this.statusCode = status; return this; },
    send(body) { this.body = body; }
  };
}
try {
  for (const [input, expected] of [
    ["/noticias/exemplo?origem=email#texto", `${origin}/noticias/exemplo?origem=email#texto`],
    [`${origin}/news/`, `${origin}/news/`],
    ["https://www.euamourania.com.br/guia.html", "https://www.euamourania.com.br/guia.html"],
    ["https://EUAMOURANIA.COM.BR:443/news/", `${origin}/news/`]
  ]) {
    const res = response();
    await handler({ query: { event: "click", url: input } }, res);
    assert.equal(res.location, expected);
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers["Cache-Control"], "no-store");
  }
  for (const input of [undefined, "", [origin], "https://evil.example", "//evil.example", "/\\evil.example",
    "https://euamourania.com.br.evil.example", "https://evil-euamourania.com.br", "https://sub.euamourania.com.br",
    "https://euamourania.com.br@evil.example", "https://evil.example@euamourania.com.br",
    "https://euamourania.com.br:444/a", "http://euamourania.com.br/a", "javascript:alert(1)", "data:text/html,test",
    "https://euamourania.com.br\n.evil.example", "https://euamourania.com.br\\@evil.example",
    "https%3A%2F%2Fevil.example", "noticias/teste", "https://euamourania.com.br./"]) {
    const res = response();
    await handler({ query: { event: "click", url: input } }, res);
    assert.equal(res.location, origin, String(input));
  }
  assert.equal(calls.length, 0, "Missing tokens must not register events");
  const tokens = { c: "12345678-1234-1234-1234-123456789abc", t: "87654321-1234-1234-1234-123456789abc" };
  for (const event of ["click", "open"]) {
    const res = response();
    await handler({ query: { ...tokens, event, url: "/news/" } }, res);
    assert.match(calls.at(-1)[0], /supabase.co\/rest\/v1\/rpc\/registrar_evento_newsletter$/);
    assert.equal(JSON.parse(calls.at(-1)[1].body).p_tipo, event === "click" ? "clique" : "abertura");
    if (event === "open") {
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers["Content-Type"], "image/gif");
      assert.equal(res.body.subarray(0, 6).toString(), "GIF89a");
    }
  }
  console.log("Newsletter tracking: destinos restritos, bypasses bloqueados, clique e pixel preservados — OK");
} finally { globalThis.fetch = originalFetch; }
