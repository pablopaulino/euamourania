import assert from "node:assert/strict";
import { adminFetch, cachedSummary, invalidateAdminData, ttl } from "../admin/data-cache.js";

const url = "https://fixture.invalid/rest/v1/noticias";
const realFetch = globalThis.fetch;
const now = Date.now;
let time = 0, calls = 0;
try {
  Date.now = () => time;
  globalThis.fetch = async req => {
    calls++;
    return new Response(req.method === "HEAD" ? null : JSON.stringify([calls]), {headers:{"content-range":"0-9/20"}});
  };
  const [first, duplicate] = await Promise.all([adminFetch(url), adminFetch(url)]);
  assert.deepEqual(await first.json(), await duplicate.json());
  assert.equal(calls,1);
  await adminFetch(url, {headers:{authorization:"Bearer other-user"}});
  assert.equal(calls,2);
  const head = await adminFetch(url, {method:"HEAD"});
  assert.equal(head.headers.get("content-range"),"0-9/20");
  const before = calls;
  await adminFetch(url,{method:"PATCH",body:"{}"});
  await adminFetch(url);
  assert.equal(calls,before+2);
  time += ttl;
  await adminFetch(url);
  assert.equal(calls,before+3);
  let summaries = 0;
  assert.equal(await cachedSummary("dashboard",()=>++summaries),1);
  assert.equal(await cachedSummary("dashboard",()=>++summaries),1);
  invalidateAdminData();
  assert.equal(await cachedSummary("dashboard",()=>++summaries),2);
  globalThis.fetch = async () => new Response(null,{status:503});
  assert.equal((await adminFetch(url)).status,503);
  globalThis.fetch = async () => new Response("recuperado");
  assert.equal(await (await adminFetch(url)).text(),"recuperado");
  console.log("Cache administrativo validado: consultas simultâneas, sessão, HEAD, validade, mutações e falhas.");
} finally {
  Date.now = now;
  globalThis.fetch = realFetch;
}
