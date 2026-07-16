import { callPublicRpc } from "../services/publicDataService.js";

const sent = new Set();

function device() {
  const width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  return width < 768 ? "mobile" : width < 1100 ? "tablet" : "desktop";
}

function compact(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 500);
}

function fingerprint(payload) {
  return [payload.message, payload.source, payload.line, payload.column].map(compact).join("|");
}

function report(payload) {
  const key = fingerprint(payload);
  if (!key || sent.has(key)) return;
  sent.add(key);
  callPublicRpc("registrar_evento_site", {
    p_tipo: "client_error",
    p_pagina: location.pathname,
    p_recurso_tipo: "frontend",
    p_recurso_id: null,
    p_destino: null,
    p_sessao_hash: null,
    p_origem: document.referrer ? new URL(document.referrer, location.href).hostname : "Direto",
    p_dispositivo: device(),
    p_metadados: {
      message: compact(payload.message),
      source: compact(payload.source),
      line: payload.line || null,
      column: payload.column || null,
      stack: compact(payload.stack),
      user_agent: compact(navigator.userAgent),
    },
  }, { timeout: 3500, keepalive: true }).catch(() => {});
}

window.addEventListener("error", (event) => {
  report({
    message: event.message,
    source: event.filename,
    line: event.lineno,
    column: event.colno,
    stack: event.error?.stack,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  report({
    message: reason?.message || reason || "Unhandled promise rejection",
    source: "promise",
    stack: reason?.stack,
  });
});
