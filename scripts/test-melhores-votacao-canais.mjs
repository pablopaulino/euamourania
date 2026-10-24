import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

process.env.SUPABASE_SERVICE_ROLE_KEY = "local-test-service-key";
process.env.MELHORES_VOTO_SECRET = "local-test-hash-secret";
process.env.TURNSTILE_SECRET_KEY = "local-test-turnstile";
process.env.TURNSTILE_ALLOWED_HOSTNAMES = "localhost";
const require = createRequire(import.meta.url);
const handler = require("../api/melhores-votar.js");
const ids = {
  edition: "11111111-1111-4111-8111-111111111111",
  category: "22222222-2222-4222-8222-222222222222",
  nominee: "33333333-3333-4333-8333-333333333333"
};
let config = {};
let calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  if (String(url).includes("siteverify")) return new Response(JSON.stringify({ success: !config.turnstileFail, action: config.turnstileAction || "vote", hostname: config.turnstileHostname || "localhost" }), { status: 200 });
  const path = String(url).split("/rest/v1/")[1];
  let body;
  if (path.startsWith("rpc/melhores_voto_rate_check")) body = config.rateBlocked ? false : true;
  else if (path.startsWith("melhores_edicoes")) body = [{ id: ids.edition, status: "votacao_aberta",
    votacao_inicio: "2020-01-01T00:00:00Z",
    votacao_inicio_site: config.siteStart === undefined ? "2020-01-03T00:00:00Z" : config.siteStart,
    votacao_fim: config.end === undefined ? "2099-01-01T00:00:00Z" : config.end }];
  else if (path.startsWith("melhores_votos")) body = [];
  else if (path.startsWith("melhores_categorias")) body = [{ id: ids.category, status: "ativo", visibilidade_publica: true }];
  else if (path.startsWith("melhores_indicados")) body = [{ id: ids.nominee, status: "ativo", aprovado: true }];
  else if (path.startsWith("rpc/melhores_site_registrar_voto")) body = {
    voto_id: "44444444-4444-4444-8444-444444444444", status: "valido",
    ja_registrado: !!config.alreadyRegistered
  };
  else throw new Error(`Unexpected request: ${path}`);
  return new Response(JSON.stringify(body), { status: 200 });
};
const invoke = async (method = "POST", body = {}, cookieHeader = "") => {
  const headers = {};
  const res = {
    setHeader: (key, value) => { headers[key] = value; },
    status(code) { this.code = code; return this; },
    send(data) { this.body = JSON.parse(data); return this; }
  };
  await handler({ method, url: `/?edicao_id=${ids.edition}`, headers: { host: "localhost", "user-agent": "local-test", "x-forwarded-for": "127.0.0.1", cookie: cookieHeader },
    body: { edicao_id: ids.edition, categoria_id: ids.category, indicado_id: ids.nominee, turnstile_token: "local-test-token", ...body } }, res);
  return { ...res, headers };
};

let result = await invoke("GET");
assert.equal(result.code, 200);
assert.ok(result.headers["Set-Cookie"].includes("HttpOnly"));
assert.equal(result.body.votacao_site_aberta, true);
assert.deepEqual(result.body.votos_site, []);
const validCookie = result.headers["Set-Cookie"].split(";")[0];
const repeat = await invoke("GET", {}, validCookie);
assert.equal(repeat.headers["Set-Cookie"].split(";")[0], validCookie);
const forged = await invoke("GET", {}, "euam_melhores_vid=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.bad");
assert.notEqual(forged.headers["Set-Cookie"].split(";")[0], "euam_melhores_vid=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.bad");
result = await invoke("POST", { categoria_id: "invalid" });
assert.equal(result.code, 400);
config = { siteStart: null }; calls = [];
result = await invoke();
assert.equal(result.code, 403);
assert.equal(calls.some(call => call.url.includes("melhores_site_registrar_voto")), false);
config = { end: "2020-01-04T00:00:00Z" };
result = await invoke();
assert.equal(result.code, 403);
config = {}; calls = [];
result = await invoke();
assert.equal(result.code, 200);
assert.equal(result.body.ja_registrado, false);
assert.equal(calls.some(call => call.url.includes("melhores_site_registrar_voto")), true);
config = { alreadyRegistered: true };
result = await invoke();
assert.equal(result.code, 200);
assert.equal(result.body.ja_registrado, true);
config = { rateBlocked: true }; calls = [];
result = await invoke();
assert.equal(result.code, 429);
assert.equal(calls.some(call => call.url.includes("siteverify")), false);
config = { turnstileFail: true };
result = await invoke();
assert.equal(result.code, 403);
config = { turnstileAction: "indication" };
result = await invoke();
assert.equal(result.code, 403);
config = { turnstileHostname: "evil.example" };
result = await invoke();
assert.equal(result.code, 403);

const sql = readFileSync(new URL("../supabase/migrations/20261023_melhores_votacao_canais_segura.sql", import.meta.url), "utf8");
assert.ok(sql.includes("pg_advisory_xact_lock") && sql.includes("melhores_votos_site_v2_categoria_uidx"));
assert.ok(sql.includes("origem in ('site','app')"));
assert.ok(sql.includes("votacao_inicio_site is null"));
assert.ok(sql.includes("melhores_app_registrar_voto") === false);
assert.ok(sql.includes('drop policy if exists "melhores_categorias_select"') && sql.includes('e.mostrar_indicados_antes_votacao = true'));
assert.ok(sql.includes("melhores_confirmar_exportacao_votos") && sql.includes("melhores_exportacoes_votos"));
assert.ok(sql.includes("create or replace function public.melhores_limpar_votos_expirados()"));
assert.ok(sql.includes("e.resultado_publicado_em + e.votos_individuais_remover_apos"));
console.log("Votação por canal: datas, validação, rate limit, Turnstile, idempotência e contrato SQL verificados localmente.");
