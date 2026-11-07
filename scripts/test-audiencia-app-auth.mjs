import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../admin/editorial-audience.js", import.meta.url), "utf8");
const start = source.indexOf("async function appAudience(");
const end = source.indexOf("\nfunction appRank(", start);
assert.ok(start >= 0 && end > start, "Função de audiência do app não encontrada");

let currentAccess = null;
let finishLogin;
let loginCalls = 0;
let rpcCalls = 0;
const login = new Promise(resolve => { finishLogin = resolve; });
const context = {
  access: () => currentAccess,
  exigirAdministrador: () => { loginCalls++; return login; },
  temPermissao: (admin, module) => module === "insights" && Boolean(admin?.allowed),
  db: { rpc: async () => { rpcCalls++; return { data: { summary: { opens: 12 } } }; } },
  safeCountRows: async () => 0,
  safeListRows: async () => []
};
const appAudience = vm.runInNewContext(`${source.slice(start, end)}\nappAudience`, context);

const pending = appAudience("2026-11-01", "2026-11-06");
await Promise.resolve();
assert.equal(rpcCalls, 0, "Consulta iniciada antes da autenticação terminar");
currentAccess = { admin: { allowed: true } };
finishLogin(currentAccess);
const first = await pending;
assert.equal(first.available, true);
assert.equal(first.opens, 12);

const returned = await appAudience("2026-11-01", "2026-11-06");
assert.equal(returned.available, true);
assert.equal(loginCalls, 1, "Não deve autenticar novamente ao retornar");

currentAccess = { admin: { allowed: false } };
const denied = await appAudience("2026-11-01", "2026-11-06");
assert.equal(denied.available, false);
assert.match(denied.error, /permissao/);
assert.equal(rpcCalls, 2, "Perfil sem permissão não deve consultar os dados");
console.log("Audiência do app: autenticação pendente, retorno e permissão verificados.");
