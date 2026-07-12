import { callPublicRpc } from "./publicDataService.js";

const SESSION_KEY = "euamourania:analytics:sessao";
const EVENT_TYPES = new Set([
  "melhores_index_view",
  "melhores_edition_view",
  "melhores_results_view",
  "melhores_vote_start",
  "melhores_vote_complete",
  "melhores_vote_error",
  "melhores_cta_click"
]);

function sessionHash() {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const value = crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, value);
    return value;
  } catch {
    return null;
  }
}

function deviceType() {
  const width = window.innerWidth || document.documentElement.clientWidth || 1024;
  if (width <= 760) return "mobile";
  if (width <= 1100) return "tablet";
  return "desktop";
}

export function registrarEventoMelhores(tipo, { edicaoId = null, destino = null, metadados = {} } = {}) {
  if (!EVENT_TYPES.has(tipo)) return;
  callPublicRpc("registrar_evento_site", {
    p_tipo: tipo,
    p_pagina: location.pathname,
    p_recurso_tipo: "melhores_de_urania",
    p_recurso_id: edicaoId,
    p_destino: destino,
    p_sessao_hash: sessionHash(),
    p_origem: document.referrer || "Direto",
    p_dispositivo: deviceType(),
    p_metadados: {
      ...metadados,
      url: location.href
    }
  }, { timeout: 3500, keepalive: true }).catch(error => {
    console.debug("Métrica Melhores de Urânia não registrada:", error?.message || error);
  });
}
