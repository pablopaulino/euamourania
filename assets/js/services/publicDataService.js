import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  supabaseConfigurado
} from "../supabase-config.js";

const ALLOWED_TABLES = new Set([
  "banners",
  "campanhas_publicitarias",
  "categorias",
  "configuracoes_site",
  "eventos",
  "guia_comercial",
  "links",
  "melhores_categorias",
  "melhores_consolidados",
  "melhores_edicoes",
  "melhores_indicados",
  "melhores_resultados",
  "noticias",
  "turismo"
]);
const ALLOWED_RPCS = new Set([
  "assinar_newsletter",
  "enviar_colaboracao_voluntaria",
  "registrar_evento_publicidade",
  "registrar_evento_site"
]);
const memoryCache = new Map();
const pending = new Map();

function cacheKey(url) {
  return `euamourania:public:${url}`;
}

function readStored(url, allowExpired = false) {
  const memory = memoryCache.get(url);
  if (memory && (allowExpired || memory.expires > Date.now())) return memory.data;
  try {
    const stored = JSON.parse(sessionStorage.getItem(cacheKey(url)) || "null");
    if (stored && (allowExpired || stored.expires > Date.now())) {
      memoryCache.set(url, stored);
      return stored.data;
    }
  } catch {}
  return null;
}

function store(url, data, ttl) {
  const entry = { data, expires: Date.now() + ttl };
  memoryCache.set(url, entry);
  try {
    sessionStorage.setItem(cacheKey(url), JSON.stringify(entry));
  } catch {}
}

export function publicSupabaseConfigured() {
  return supabaseConfigurado();
}

export async function fetchPublicRows(table, params = {}, { ttl = 120000, timeout = 8000 } = {}) {
  if (!ALLOWED_TABLES.has(table)) throw new Error("Fonte pública não permitida.");
  if (!supabaseConfigurado()) throw new Error("Supabase não configurado.");

  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const cached = readStored(url);
  if (cached) return cached;
  if (pending.has(url)) return pending.get(url);

  const request = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          Accept: "application/json"
        },
        credentials: "omit",
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Conteúdo indisponível (${response.status}).`);
      const data = await response.json();
      store(url, data, ttl);
      return data;
    } catch (error) {
      const stale = readStored(url, true);
      if (stale) return stale;
      if (error?.name === "AbortError") throw new Error("A consulta demorou além do esperado.");
      throw error;
    } finally {
      clearTimeout(timer);
      pending.delete(url);
    }
  })();

  pending.set(url, request);
  return request;
}

export async function callPublicRpc(name, body = {}, { timeout = 5000, keepalive = false } = {}) {
  if (!ALLOWED_RPCS.has(name)) throw new Error("Operação pública não permitida.");
  if (!supabaseConfigurado()) throw new Error("Supabase não configurado.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(body),
      credentials: "omit",
      keepalive,
      signal: controller.signal
    });
    if (!response.ok) {
      const message = await response.json().catch(() => null);
      throw new Error(message?.message || `Operação indisponível (${response.status}).`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timer);
  }
}
