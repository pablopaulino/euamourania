// Auth and permission checks always reach the server.
export const ttl = 4 * 60 * 1000;
let readSignal;
export function setReadSignal(signal) { readSignal = signal; }
const entries = new Map();
const summaries = new Map();

// Aggregates also cover queries with a moving date window.
export function cachedSummary(key, load) {
  const existing = summaries.get(key);
  if (existing && Date.now() - existing.time < ttl) return existing.value;
  const entry = { time: Date.now(), value: null };
  entry.value = Promise.resolve().then(load).catch(error => {
    if (summaries.get(key) === entry) summaries.delete(key);
    throw error;
  });
  summaries.set(key, entry);
  return entry.value;
}
const readOnlyRpcs = new Set([
  "admin_listar_achados_pendentes", "listar_midias_cms", "obter_audiencia_app", "obter_audiencia_avancada",
  "exportar_catalogo", "melhores_obter_apuracao", "melhores_consultar_agendamento"
]);
export let revision = 0;

export function invalidateAdminData() {
  entries.clear();
  summaries.clear();
  revision++;
}

export async function adminFetch(input, init = {}) {
  const request = new Request(input, init);
  const { pathname } = new URL(request.url);
  const read = ["GET", "HEAD"].includes(request.method);
  const rpcRead = pathname.startsWith("/rest/v1/rpc/") && readOnlyRpcs.has(pathname.split("/").pop());
  const eligible = rpcRead || read && pathname.startsWith("/rest/v1/") &&
    !pathname.startsWith("/rest/v1/rpc/") && !pathname.endsWith("/usuarios_admin");
  if (!eligible) {
    const response = await fetch(request);
    if (response.ok && !read && !pathname.startsWith("/auth/")) invalidateAdminData();
    return response;
  }
  readSignal?.throwIfAborted();
  const signal = readSignal ? AbortSignal.any([request.signal, readSignal]) : request.signal;
  const key = JSON.stringify([request.method, request.url, [...request.headers], rpcRead && !read ? await request.clone().text() : ""]);
  let entry = entries.get(key);
  if (!entry || Date.now() - entry.time >= ttl) {
    // Consume the response once, even when two views request the same data.
    entry = { time: Date.now(), result: fetch(request, {signal}).then(async response => ({
      body: request.method === "HEAD" || [204, 205, 304].includes(response.status) ? null : await response.blob(),
      status: response.status, statusText: response.statusText, headers: response.headers,
      ok: response.ok
    })) };
    entries.set(key, entry);
    if (entries.size > 350) entries.delete(entries.keys().next().value);
  }
  try {
    const result = await entry.result;
    if (!result.ok && entries.get(key) === entry) entries.delete(key);
    return new Response(result.body, result);
  } catch (error) {
    if (entries.get(key) === entry) entries.delete(key);
    throw error;
  }
}

export async function adminApiFetch(input, init) {
  const result = await fetch(input, init);
  if (result.ok && init?.method && init.method !== "GET") invalidateAdminData();
  return result;
}
