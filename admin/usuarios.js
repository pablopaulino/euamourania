import { exigirPermissao, sair, rotulosFuncoes, temPermissao } from "./auth.js";
import { getSupabase } from "../assets/js/services/supabaseClient.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const roles = Object.keys(rotulosFuncoes);

let root = document;
let app = null;
let shellContainer = null;
let moduleContext = {};
let access = null;
let state = { users: [], permissions: [] };
let cleanupHandlers = [];
let toastTimers = [];
let mounted = false;
let runId = 0;

const $ = selector => root.querySelector(selector);
const $$ = selector => Array.from(root.querySelectorAll(selector));
const fmt = value => value ? new Date(value).toLocaleString("pt-BR") : "—";

function addCleanup(handler) {
  cleanupHandlers.push(handler);
}

function addListener(target, event, handler, options) {
  target?.addEventListener(event, handler, options);
  addCleanup(() => target?.removeEventListener(event, handler, options));
}

function ensureModuleStyles() {
  if (document.querySelector('link[href$="publicidade.css"]') || document.querySelector('link[data-admin-module-style="usuarios-publicidade"]')) {
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "publicidade.css";
  link.dataset.adminModuleStyle = "usuarios-publicidade";
  document.head.append(link);
  addCleanup(() => link.remove());
}

function resetState() {
  state = { users: [], permissions: [] };
  toastTimers.forEach(timer => clearTimeout(timer));
  toastTimers = [];
}

function toast(message, type = "success") {
  if (typeof moduleContext.toast === "function") {
    moduleContext.toast(message, type);
    return;
  }
  const stack = document.getElementById("toasts");
  if (!stack) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  stack.append(el);
  const timer = setTimeout(() => el.remove(), 3800);
  toastTimers.push(timer);
}

function getDb() {
  return moduleContext.db || getSupabase();
}

async function api(method = "GET", body) {
  const { data: { session } } = await getDb().auth.getSession();
  if (!session?.access_token) throw new Error("Sessão administrativa expirada.");
  const response = await fetch("/api/admin-users", {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
  return data;
}

function roleOptions(selected) {
  return roles.map(role => `<option value="${role}" ${role === selected ? "selected" : ""}>${esc(rotulosFuncoes[role])}</option>`).join("");
}

function roleSummary(role) {
  if (role === "super_admin") return "Acesso total a todos os módulos e usuários.";
  const rows = state.permissions.filter(permission => permission.funcao === role);
  const byModule = {};
  rows.forEach(permission => (byModule[permission.modulo] ??= []).push(permission.acao));
  return Object.entries(byModule).map(([module, actions]) => `${module.replaceAll("_", " ")}: ${actions.join(", ")}`).join(" · ") || "Sem permissões configuradas.";
}

function renderShell(container) {
  container.classList.add("ads-main");
  container.innerHTML = `<div class="ads-content"><div class="ads-heading"><div><h2>Equipe e permissões</h2><p>Crie contas individuais e atribua somente o acesso necessário.</p></div><button class="admin-button" id="new-user">+ Novo usuário</button></div><div id="users-app"><div class="skeleton"></div></div></div>`;
}

function render() {
  app.innerHTML = `<section class="ads-card"><div class="cms-toolbar-v2"><input id="user-search" type="search" placeholder="Pesquisar nome ou e-mail…"><select id="role-filter"><option value="">Todas as funções</option>${roleOptions("")}</select><select id="status-filter"><option value="">Todos os status</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option></select></div><div class="table-wrap"><table class="cms-table"><thead><tr><th>Usuário</th><th>Função</th><th>Status</th><th>Último login</th><th>Criação</th><th>Ações</th></tr></thead><tbody id="user-rows">${state.users.map(user => `<tr data-search="${esc(`${user.nome || ""} ${user.email || ""}`.toLowerCase())}" data-role="${esc(user.funcao)}" data-status="${user.ativo ? "ativo" : "inativo"}"><td class="cms-title-cell"><strong>${esc(user.nome || "Sem nome")}</strong><small>${esc(user.email)}${user.id === access.user.id ? " · você" : ""}</small></td><td><span class="status-pill ativo">${esc(rotulosFuncoes[user.funcao] || user.funcao)}</span></td><td><span class="status-pill ${user.ativo ? "ativo" : "inativo"}">${user.ativo ? "ativo" : "inativo"}</span></td><td>${fmt(user.ultimo_login)}</td><td>${fmt(user.auth_criado_em || user.criado_em)}</td><td><div class="cms-actions"><button data-edit-user="${esc(user.id)}">Editar</button><button data-toggle-user="${esc(user.id)}" ${user.id === access.user.id ? "disabled" : ""}>${user.ativo ? "Desativar" : "Ativar"}</button><button class="danger" data-delete-user="${esc(user.id)}" ${user.id === access.user.id ? "disabled" : ""}>Excluir</button></div></td></tr>`).join("") || '<tr><td colspan="6">Nenhum usuário.</td></tr>'}</tbody></table></div></section><section class="ads-card"><h3>Permissões por função</h3><div class="dashboard-grid">${roles.map(role => `<article class="metric-card"><span>${esc(rotulosFuncoes[role])}</span><small>${esc(roleSummary(role))}</small></article>`).join("")}</div></section>`;
  const filter = () => {
    const q = $("#user-search").value.toLowerCase();
    const role = $("#role-filter").value;
    const status = $("#status-filter").value;
    $$("#user-rows tr[data-search]").forEach(row => {
      row.hidden = !(row.dataset.search.includes(q) && (!role || row.dataset.role === role) && (!status || row.dataset.status === status));
    });
  };
  ["user-search", "role-filter", "status-filter"].forEach(id => addListener($("#" + id), "input", filter));
}

function form(user = null) {
  const editing = Boolean(user);
  app.innerHTML = `<section class="ads-card"><h3>${editing ? "Editar usuário" : "Novo usuário"}</h3><form id="user-form" class="cms-form"><div class="cms-field"><label>Nome *</label><input name="nome" required value="${esc(user?.nome || "")}"></div><div class="cms-field"><label>E-mail *</label><input name="email" type="email" required value="${esc(user?.email || "")}"></div><div class="cms-field"><label>${editing ? "Nova senha (opcional)" : "Senha temporária *"}</label><input name="password" type="password" minlength="8" ${editing ? "" : "required"} autocomplete="new-password"><small>Mínimo de 8 caracteres. A senha nunca é exibida novamente.</small></div><div class="cms-field"><label>Função *</label><select name="funcao" required>${roleOptions(user?.funcao || "visualizador")}</select></div><label class="ads-checkbox"><input name="ativo" type="checkbox" ${user?.ativo !== false ? "checked" : ""}> Usuário ativo</label><div class="cms-field full"><strong id="permission-preview"></strong><p id="permission-description"></p></div><div class="cms-sticky-actions"><button type="button" class="admin-button secondary" id="cancel-user">Cancelar</button><button class="admin-button">Salvar usuário</button></div></form></section>`;
  const f = $("#user-form");
  const preview = () => {
    const role = f.elements.funcao.value;
    $("#permission-preview").textContent = rotulosFuncoes[role];
    $("#permission-description").textContent = roleSummary(role);
  };
  addListener(f.elements.funcao, "change", preview);
  addListener($("#cancel-user"), "click", render);
  addListener(f, "submit", async event => {
    event.preventDefault();
    const button = event.submitter;
    const fd = new FormData(f);
    const payload = { id: user?.id, nome: fd.get("nome"), email: fd.get("email"), password: fd.get("password") || undefined, funcao: fd.get("funcao"), ativo: fd.get("ativo") === "on" };
    button.disabled = true;
    button.textContent = "Salvando…";
    try {
      await api(editing ? "PATCH" : "POST", payload);
      toast(editing ? "Usuário atualizado." : "Usuário criado.");
      await load();
    } catch (error) {
      toast(error.message, "error");
      button.disabled = false;
      button.textContent = "Salvar usuário";
    }
  });
  preview();
}

async function load() {
  const requestRun = runId;
  app.innerHTML = '<div class="ads-card"><div class="skeleton"></div><div class="skeleton"></div></div>';
  try {
    state = await api();
    if (!mounted || requestRun !== runId) return;
    render();
  } catch (error) {
    if (!mounted || requestRun !== runId) return;
    app.innerHTML = `<div class="empty-state"><strong>Não foi possível carregar usuários</strong>${esc(error.message)}<br><small>Confirme a variável SUPABASE_SERVICE_ROLE_KEY na Vercel.</small></div>`;
  }
}

async function handleUsersClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.editUser) {
    form(state.users.find(user => user.id === button.dataset.editUser));
  }
  if (button.dataset.toggleUser) {
    const user = state.users.find(item => item.id === button.dataset.toggleUser);
    if (!user) return;
    try {
      await api("PATCH", { id: user.id, nome: user.nome, email: user.email, funcao: user.funcao, ativo: !user.ativo });
      toast(user.ativo ? "Usuário desativado." : "Usuário ativado.");
      await load();
    } catch (error) {
      toast(error.message, "error");
    }
  }
  if (button.dataset.deleteUser && confirm("Excluir este usuário e seu acesso ao CMS?")) {
    try {
      await api("DELETE", { id: button.dataset.deleteUser });
      toast("Usuário excluído.");
      await load();
    } catch (error) {
      toast(error.message, "error");
    }
  }
}

async function initModule(context = {}) {
  moduleContext = context;
  access = context.access || await exigirPermissao("usuarios", "acessar");
  if (!access) return;
  if (!temPermissao(access.admin, "usuarios", "acessar")) {
    throw new Error("Usuário sem permissão para acessar Usuários administrativos.");
  }
  mounted = true;
  runId += 1;
  moduleContext.setTitle?.("Usuários administrativos", "Equipe, papéis e permissões de acesso ao CMS.");
  document.title = "Usuários administrativos | Eu Amo Urânia";
  const adminUser = document.getElementById("admin-user");
  if (adminUser) adminUser.textContent = access.admin?.nome || access.user?.email || "";
  addListener($("#new-user"), "click", () => form());
  addListener(app, "click", handleUsersClick);
  await load();
}

export async function mount(container, context = {}) {
  unmount();
  shellContainer = container;
  root = container;
  ensureModuleStyles();
  renderShell(container);
  app = $("#users-app");
  await initModule(context);
}

export function unmount() {
  mounted = false;
  cleanupHandlers.splice(0).forEach(handler => {
    try { handler(); } catch (error) { console.warn("Falha ao desmontar Usuários:", error); }
  });
  resetState();
  if (shellContainer) {
    shellContainer.classList.remove("ads-main");
    shellContainer.innerHTML = "";
  }
  shellContainer = null;
  moduleContext = {};
  access = null;
  app = null;
  root = document;
}

async function bootLegacyPage() {
  if (document.body?.dataset.adminShell === "true") return;
  const legacyApp = document.getElementById("users-app");
  if (!legacyApp) return;
  root = document;
  app = legacyApp;
  access = await exigirPermissao("usuarios", "acessar");
  if (!access) return;
  mounted = true;
  runId += 1;
  const adminUser = document.getElementById("admin-user");
  if (adminUser) adminUser.textContent = access.admin?.nome || access.user?.email || "";
  addListener(document.getElementById("logout"), "click", sair);
  addListener(document.getElementById("mobile-menu"), "click", () => document.getElementById("sidebar")?.classList.toggle("open"));
  addListener($("#new-user"), "click", () => form());
  addListener(app, "click", handleUsersClick);
  await load();
}

bootLegacyPage();
