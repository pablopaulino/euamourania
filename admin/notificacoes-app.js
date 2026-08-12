import { exigirPermissao, sair, temPermissao } from "./auth.js";
import { getSupabase } from "../assets/js/services/supabaseClient.js";

let app = null;
let db = null;
let access = null;
let notifications = [];
let deviceCounts = { total: 0, android: 0, ios: 0 };
let cleanupHandlers = [];
let moduleStyle = null;
let context = {};

const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;"
}[char]));
const fmt = value => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";

function addCleanup(handler) {
  cleanupHandlers.push(handler);
}

function toast(message, type = "success") {
  if (typeof context.toast === "function") {
    context.toast(message, type);
    return;
  }
  const stack = document.getElementById("toasts");
  if (!stack) return;
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.textContent = message;
  stack.append(item);
  const timer = setTimeout(() => item.remove(), 4200);
  addCleanup(() => clearTimeout(timer));
}

function statusLabel(status) {
  return ({ rascunho: "Rascunho", enviando: "Enviando", enviado: "Enviado", falhou: "Falhou", cancelado: "Cancelado" })[status] || status;
}

function ensureModuleStyle() {
  if (document.querySelector('link[data-admin-module-style="notificacoes"]')) return;
  moduleStyle = document.createElement("link");
  moduleStyle.rel = "stylesheet";
  moduleStyle.href = "notificacoes-app.css";
  moduleStyle.dataset.adminModuleStyle = "notificacoes";
  document.head.append(moduleStyle);
  addCleanup(() => {
    moduleStyle?.remove();
    moduleStyle = null;
  });
}

function renderShellFrame(container) {
  container.innerHTML = `
    <div class="ads-content push-shell-module">
      <div class="push-heading">
        <div>
          <h2>Central de notificações</h2>
          <p>Envie novidades para quem autorizou notificações no aplicativo.</p>
        </div>
        <button class="admin-button" id="new-notification" type="button">+ Nova notificação</button>
      </div>
      <div id="push-app"><div class="skeleton"></div><div class="skeleton"></div></div>
    </div>`;
}

function bindClick(selector, handler) {
  app.querySelectorAll(selector).forEach(element => {
    element.addEventListener("click", handler);
  });
}

async function load() {
  if (!app) return;
  app.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
  const [{ data: rows, error }, { data: tokens, error: tokenError }] = await Promise.all([
    db.from("app_notificacoes").select("*").order("criado_em", { ascending: false }).limit(100),
    db.from("app_push_tokens").select("plataforma").eq("ativo", true)
  ]);
  if (error || tokenError) {
    app.innerHTML = `<section class="push-card"><h3>Não foi possível carregar</h3><p>${esc(error?.message || tokenError?.message)}</p></section>`;
    return;
  }
  notifications = rows || [];
  const activeTokens = tokens || [];
  deviceCounts = {
    total: activeTokens.length,
    android: activeTokens.filter(item => item.plataforma === "android").length,
    ios: activeTokens.filter(item => item.plataforma === "ios").length
  };
  render();
}

function render() {
  if (!app) return;
  const sent = notifications.filter(item => item.status === "enviado").length;
  const accepted = notifications.reduce((sum, item) => sum + (item.total_aceitos || 0), 0);
  const canDelete = temPermissao(access.admin, "notificacoes", "excluir");
  app.innerHTML = `
    <section class="push-metrics">
      <article class="metric-card"><span>Aparelhos ativos</span><strong>${deviceCounts.total}</strong></article>
      <article class="metric-card"><span>Android</span><strong>${deviceCounts.android}</strong></article>
      <article class="metric-card"><span>iPhone</span><strong>${deviceCounts.ios}</strong></article>
      <article class="metric-card"><span>Envios aceitos</span><strong>${accepted}</strong><em>${sent} campanhas</em></article>
    </section>
    <section class="push-card table-card">
      <div class="push-history-head"><h3>Histórico</h3>${canDelete && notifications.length ? '<button class="admin-button secondary" id="clear-history" type="button">Limpar histórico</button>' : ""}</div>
      <table class="push-table"><thead><tr><th>Notificação</th><th>Público</th><th>Status</th><th>Resultado</th><th>Data</th><th>Ações</th></tr></thead>
      <tbody>${notifications.map(item => `<tr>
        <td class="push-copy"><strong>${esc(item.titulo)}</strong><small>${esc(item.mensagem)}</small></td>
        <td>${esc(item.plataforma)}</td>
        <td><span class="status-pill ${esc(item.status)}">${esc(statusLabel(item.status))}</span></td>
        <td>${item.total_aceitos || 0} aceitos${item.total_erros ? ` · ${item.total_erros} erros` : ""}</td>
        <td>${fmt(item.enviado_em || item.criado_em)}</td>
        <td><div class="push-row-actions">${["rascunho", "falhou"].includes(item.status) ? `<button class="admin-button" data-send="${item.id}" type="button">Enviar</button>` : ""}${canDelete ? `<button class="admin-button secondary" data-delete="${item.id}" type="button">Excluir</button>` : ""}</div></td>
      </tr>`).join("") || '<tr><td colspan="6">Nenhuma notificação criada.</td></tr>'}</tbody></table>
    </section>`;
  bindClick("[data-send]", event => send(event.currentTarget.dataset.send, event.currentTarget));
  bindClick("[data-delete]", event => removeNotification(event.currentTarget.dataset.delete, event.currentTarget));
  const clear = app.querySelector("#clear-history");
  if (clear) clear.addEventListener("click", () => clearHistory(clear));
}

function openForm() {
  if (!app) return;
  app.innerHTML = `<section class="push-card"><h3>Nova notificação</h3>
    <form id="push-form" class="push-form">
      <div class="push-notice full push-field">A mensagem será enviada somente após sua confirmação. Use textos objetivos e envie apenas informações relevantes.</div>
      <div class="push-field full"><label>Título *</label><input name="titulo" maxlength="80" required placeholder="Ex.: Agenda do fim de semana"><small class="push-counter" id="title-count">0/80</small></div>
      <div class="push-field full"><label>Mensagem *</label><textarea name="mensagem" maxlength="220" required placeholder="Conte a novidade em poucas palavras."></textarea><small class="push-counter" id="body-count">0/220</small></div>
      <div class="push-field"><label>Público</label><select name="plataforma"><option value="todos">Android e iPhone</option><option value="android">Somente Android</option><option value="ios">Somente iPhone</option></select></div>
      <div class="push-field"><label>Ao tocar, abrir</label><select name="destino_tipo"><option value="home">Página inicial</option><option value="empresa">Empresa</option><option value="turismo">Turismo</option><option value="evento">Evento</option></select></div>
      <div class="push-field full" id="destination-field" hidden><label>Slug do conteúdo</label><input name="destino_valor" maxlength="160" placeholder="exemplo-do-conteudo"><small>Use o slug exibido na URL do conteúdo.</small></div>
      <div class="push-actions"><button type="button" class="admin-button secondary" id="cancel">Cancelar</button><button class="admin-button">Salvar rascunho</button></div>
    </form></section>`;
  const form = app.querySelector("#push-form");
  const destination = app.querySelector("#destination-field");
  form.elements.titulo.addEventListener("input", () => {
    app.querySelector("#title-count").textContent = `${form.elements.titulo.value.length}/80`;
  });
  form.elements.mensagem.addEventListener("input", () => {
    app.querySelector("#body-count").textContent = `${form.elements.mensagem.value.length}/220`;
  });
  form.elements.destino_tipo.addEventListener("change", () => {
    destination.hidden = form.elements.destino_tipo.value === "home";
  });
  app.querySelector("#cancel").addEventListener("click", render);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const button = event.submitter;
    const values = Object.fromEntries(new FormData(form));
    button.disabled = true;
    button.textContent = "Salvando…";
    const { error } = await db.from("app_notificacoes").insert({ ...values, criado_por: access.user.id });
    if (error) {
      toast(error.message, "error");
      button.disabled = false;
      button.textContent = "Salvar rascunho";
      return;
    }
    toast("Rascunho salvo. Revise e clique em Enviar.");
    await load();
  });
}

async function send(id, button) {
  if (!confirm("Enviar esta notificação agora? Essa ação alcançará todos os aparelhos do público selecionado.")) return;
  button.disabled = true;
  button.textContent = "Enviando…";
  try {
    const { data: { session } } = await db.auth.getSession();
    const response = await fetch("/api/push-send", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível enviar.");
    toast(`Notificação enviada: ${data.accepted} aceitas, ${data.errors} erros.`);
    await load();
  } catch (error) {
    toast(error.message, "error");
    button.disabled = false;
    button.textContent = "Enviar";
  }
}

async function removeNotification(id, button) {
  if (!confirm("Excluir esta notificação do histórico? Os aparelhos cadastrados não serão removidos.")) return;
  button.disabled = true;
  button.textContent = "Excluindo…";
  const { error } = await db.from("app_notificacoes").delete().eq("id", id);
  if (error) {
    toast(error.message, "error");
    button.disabled = false;
    button.textContent = "Excluir";
    return;
  }
  toast("Notificação excluída do histórico.");
  await load();
}

async function clearHistory(button) {
  const processed = notifications.filter(item => ["enviado", "falhou", "cancelado"].includes(item.status));
  if (!processed.length) {
    toast("Não há envios concluídos para limpar.", "error");
    return;
  }
  if (!confirm(`Excluir ${processed.length} registro(s) concluído(s) do histórico? Rascunhos e aparelhos cadastrados serão mantidos.`)) return;
  button.disabled = true;
  button.textContent = "Limpando…";
  const { error } = await db.from("app_notificacoes").delete().in("id", processed.map(item => item.id));
  if (error) {
    toast(error.message, "error");
    button.disabled = false;
    button.textContent = "Limpar histórico";
    return;
  }
  toast("Histórico concluído removido.");
  await load();
}

async function initModule(container, moduleContext = {}) {
  context = moduleContext;
  db = moduleContext.db || getSupabase();
  access = moduleContext.access || await exigirPermissao("notificacoes", "acessar");
  if (!access) return;
  if (!temPermissao(access.admin, "notificacoes", "acessar")) {
    throw new Error("Usuário sem permissão para acessar Notificações do Viva Urânia.");
  }
  renderShellFrame(container);
  app = container.querySelector("#push-app");
  const newButton = container.querySelector("#new-notification");
  newButton?.addEventListener("click", openForm);
  addCleanup(() => newButton?.removeEventListener("click", openForm));
  await load();
}

export async function mount(container, moduleContext = {}) {
  unmount();
  ensureModuleStyle();
  moduleContext.setTitle?.("Notificações do Viva Urânia", "Envios push, aparelhos cadastrados e histórico do aplicativo Viva Urânia.");
  await initModule(container, moduleContext);
}

export function unmount() {
  cleanupHandlers.forEach(handler => {
    try { handler(); } catch (error) { console.warn("Falha ao desmontar notificações:", error); }
  });
  cleanupHandlers = [];
  notifications = [];
  deviceCounts = { total: 0, android: 0, ios: 0 };
  app = null;
  context = {};
}

async function bootLegacyPage() {
  if (document.body?.dataset.adminShell === "true") return;
  const legacyContainer = document.querySelector(".ads-content");
  if (!legacyContainer) return;
  access = await exigirPermissao("notificacoes", "acessar");
  if (!access) return;
  document.getElementById("admin-user").textContent = access.admin?.nome || access.user.email;
  document.getElementById("logout").addEventListener("click", sair);
  document.getElementById("mobile-menu").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));
  db = getSupabase();
  app = document.getElementById("push-app");
  document.getElementById("new-notification").addEventListener("click", openForm);
  await load();
}

bootLegacyPage();
