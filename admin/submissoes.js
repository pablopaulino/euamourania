import { exigirPermissao, sair, temPermissao } from "./auth.js";
import { getSupabase } from "../assets/js/services/supabaseClient.js";
import { gerarSlug } from "../assets/js/utils.js";

let app = null;
let db = null;
let moduleStyle = null;
let cleanupHandlers = [];
let context = {};

const state = {
  type: "event",
  status: "pending",
  items: [],
  selected: null,
  access: null,
  message: ""
};

const typeConfig = {
  event: {
    label: "Eventos",
    table: "event_submissions",
    officialTable: "eventos",
    titleKey: "titulo"
  },
  business: {
    label: "Empresas",
    table: "business_submissions",
    officialTable: "guia_comercial",
    titleKey: "nome"
  }
};

const statusLabels = {
  pending: "Pendente",
  under_review: "Em análise",
  approved: "Aprovado",
  rejected: "Recusado"
};

function addCleanup(handler) {
  cleanupHandlers.push(handler);
}

function resetState() {
  state.type = "event";
  state.status = "pending";
  state.items = [];
  state.selected = null;
  state.access = null;
  state.message = "";
}

function ensureModuleStyle() {
  if (document.querySelector('link[data-admin-module-style="submissoes"]')) return;
  moduleStyle = document.createElement("link");
  moduleStyle.rel = "stylesheet";
  moduleStyle.href = "/admin/submissoes.css";
  moduleStyle.dataset.adminModuleStyle = "submissoes";
  document.head.append(moduleStyle);
  addCleanup(() => {
    moduleStyle?.remove();
    moduleStyle = null;
  });
}

function renderShellFrame(container) {
  container.innerHTML = `<section id="submissions-app" class="submissions-shell loading">Carregando submissões…</section>`;
  app = container.querySelector("#submissions-app");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showMessage(message) {
  state.message = message;
  render();
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function normalize(value) {
  return String(value || "").trim();
}

async function createUniqueSlug(table, text) {
  const base = gerarSlug(text) || "cadastro";
  let slug = base;
  for (let index = 1; index < 80; index += 1) {
    const { data, error } = await db
      .from(table)
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) return slug;
    slug = `${base}-${index + 1}`;
  }
  return `${base}-${Date.now()}`;
}

function dataList(item) {
  const hidden = new Set([
    "id",
    "status",
    "created_at",
    "updated_at",
    "reviewed_at",
    "reviewed_by",
    "approved_record_id",
    "submitted_payload",
    "terms_accepted_at",
    "terms_version"
  ]);
  return Object.entries(item || {})
    .filter(([key, value]) => !hidden.has(key) && value !== null && value !== "")
    .map(([key, value]) => {
      const label = key.replaceAll("_", " ");
      const content = typeof value === "object" ? JSON.stringify(value, null, 2) : value;
      return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(content)}</dd></div>`;
    })
    .join("");
}

function getInput(name) {
  return app?.querySelector(`[name="${name}"]`)?.value?.trim() || "";
}

function buildEventOfficialRecord(item) {
  const imageUrl = getInput("imagem_url") || null;
  return {
    titulo: getInput("titulo") || item.titulo,
    slug: null,
    descricao: getInput("descricao") || item.descricao,
    imagem_url: imageUrl,
    data_inicio: getInput("data_inicio") || item.data_inicio,
    data_fim: getInput("data_fim") || item.data_fim || null,
    local: getInput("local") || item.local || null,
    endereco: getInput("endereco") || item.endereco || null,
    organizador: getInput("organizador") || item.organizador || null,
    whatsapp: getInput("whatsapp") || item.whatsapp || null,
    destaque: false,
    status: "publicado"
  };
}

function buildBusinessOfficialRecord(item) {
  const imageUrl = getInput("imagem_url") || null;
  return {
    nome: getInput("nome") || item.nome,
    slug: null,
    categoria_id: item.categoria_id || null,
    categoria_nome: getInput("categoria_nome") || item.categoria_nome || null,
    descricao: getInput("descricao") || item.descricao,
    imagem_url: imageUrl,
    whatsapp: getInput("whatsapp") || item.whatsapp || null,
    telefone: getInput("telefone") || item.telefone || null,
    instagram: getInput("instagram") || item.instagram || null,
    facebook: getInput("facebook") || item.facebook || null,
    site: getInput("site") || item.site || null,
    endereco: getInput("endereco") || item.endereco || null,
    horario: getInput("horario") || item.horario || null,
    recomendado: false,
    status: "publicado"
  };
}

function renderReviewForm(item) {
  if (state.type === "event") {
    return `
      <div class="submissions-form-grid">
        <label class="submissions-field full"><span>Título</span><input name="titulo" value="${escapeHtml(item.titulo || "")}"></label>
        <label class="submissions-field full"><span>Descrição</span><textarea name="descricao">${escapeHtml(item.descricao || "")}</textarea></label>
        <label class="submissions-field"><span>Data de início</span><input name="data_inicio" type="datetime-local" value="${escapeHtml((item.data_inicio || "").slice(0, 16))}"></label>
        <label class="submissions-field"><span>Data de fim</span><input name="data_fim" type="datetime-local" value="${escapeHtml((item.data_fim || "").slice(0, 16))}"></label>
        <label class="submissions-field"><span>Local</span><input name="local" value="${escapeHtml(item.local || "")}"></label>
        <label class="submissions-field"><span>Organizador</span><input name="organizador" value="${escapeHtml(item.organizador || "")}"></label>
        <label class="submissions-field full"><span>Endereço</span><input name="endereco" value="${escapeHtml(item.endereco || "")}"></label>
        <label class="submissions-field"><span>WhatsApp</span><input name="whatsapp" value="${escapeHtml(item.whatsapp || "")}"></label>
        <label class="submissions-field full"><span>Imagem oficial escolhida no CMS</span><input name="imagem_url" placeholder="Cole a URL da imagem escolhida no painel" value=""></label>
        <label class="submissions-field full"><span>Observações internas</span><textarea name="moderation_notes">${escapeHtml(item.moderation_notes || "")}</textarea></label>
      </div>`;
  }
  return `
    <div class="submissions-form-grid">
      <label class="submissions-field full"><span>Nome</span><input name="nome" value="${escapeHtml(item.nome || "")}"></label>
      <label class="submissions-field full"><span>Descrição</span><textarea name="descricao">${escapeHtml(item.descricao || "")}</textarea></label>
      <label class="submissions-field"><span>Categoria</span><input name="categoria_nome" value="${escapeHtml(item.categoria_nome || "")}"></label>
      <label class="submissions-field"><span>WhatsApp</span><input name="whatsapp" value="${escapeHtml(item.whatsapp || "")}"></label>
      <label class="submissions-field"><span>Telefone</span><input name="telefone" value="${escapeHtml(item.telefone || "")}"></label>
      <label class="submissions-field"><span>Instagram</span><input name="instagram" value="${escapeHtml(item.instagram || "")}"></label>
      <label class="submissions-field"><span>Facebook</span><input name="facebook" value="${escapeHtml(item.facebook || "")}"></label>
      <label class="submissions-field"><span>Site</span><input name="site" value="${escapeHtml(item.site || "")}"></label>
      <label class="submissions-field full"><span>Endereço</span><input name="endereco" value="${escapeHtml(item.endereco || "")}"></label>
      <label class="submissions-field full"><span>Horário</span><input name="horario" value="${escapeHtml(item.horario || "")}"></label>
      <label class="submissions-field full"><span>Imagem oficial escolhida no CMS</span><input name="imagem_url" placeholder="Cole a URL da imagem/logotipo escolhida no painel" value=""></label>
      <label class="submissions-field full"><span>Observações internas</span><textarea name="moderation_notes">${escapeHtml(item.moderation_notes || "")}</textarea></label>
    </div>`;
}

function render() {
  if (!app) return;
  const config = typeConfig[state.type];
  const selected = state.selected;
  app.classList.remove("loading");
  app.innerHTML = `
    ${state.message ? `<div class="submissions-toast">${escapeHtml(state.message)}</div>` : ""}
    <div class="submissions-card">
      <div class="submissions-card-header">
        <h2>Fila de revisão</h2>
        <p>Os envios públicos não possuem imagens. A imagem oficial deve ser escolhida pela equipe antes da aprovação, quando necessário.</p>
      </div>
      <div class="submissions-card-body submissions-shell">
        <div class="submissions-toolbar">
          <div class="submissions-tabs">
            <button type="button" data-type="event" class="${state.type === "event" ? "active" : ""}">Eventos</button>
            <button type="button" data-type="business" class="${state.type === "business" ? "active" : ""}">Empresas</button>
          </div>
          <label class="submissions-field" style="max-width:220px">
            <span>Status</span>
            <select data-status-filter>
              ${["pending", "under_review", "approved", "rejected"].map(status => `<option value="${status}" ${state.status === status ? "selected" : ""}>${statusLabels[status]}</option>`).join("")}
            </select>
          </label>
          <button class="submissions-button" type="button" data-refresh>Atualizar</button>
        </div>
        ${selected ? renderSelected(selected) : renderList(config)}
      </div>
    </div>`;
}

function renderList(config) {
  if (!state.items.length) {
    return `<div class="submissions-alert">Nenhuma submissão em ${escapeHtml(config.label.toLowerCase())} com status ${escapeHtml(statusLabels[state.status] || state.status)}.</div>`;
  }
  return `<div class="submissions-list">${state.items.map(item => {
    const title = item[config.titleKey] || "Sem título";
    return `
      <article class="submission-row">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p>Enviado por ${escapeHtml(item.submitter_name || "não informado")} • ${formatDate(item.created_at)}</p>
          <span class="submission-status">${escapeHtml(statusLabels[item.status] || item.status || "Pendente")}</span>
        </div>
        <button class="submissions-button primary" type="button" data-review="${escapeHtml(item.id)}">Revisar</button>
      </article>`;
  }).join("")}</div>`;
}

function renderSelected(item) {
  const config = typeConfig[state.type];
  return `
    <div class="submissions-actions">
      <button class="submissions-button" type="button" data-back>← Voltar para lista</button>
      <button class="submissions-button" type="button" data-under-review>Marcar em revisão</button>
    </div>
    <div class="submissions-review-grid">
      <section class="submissions-card">
        <div class="submissions-card-header">
          <h2>Dados enviados</h2>
          <p>Conteúdo recebido do formulário público.</p>
        </div>
        <div class="submissions-card-body">
          <dl class="submissions-data-list">${dataList(item)}</dl>
        </div>
      </section>
      <section class="submissions-card">
        <div class="submissions-card-header">
          <h2>Revisar e aprovar</h2>
          <p>Edite os dados finais. A imagem abaixo deve vir da biblioteca oficial do CMS.</p>
        </div>
        <div class="submissions-card-body submissions-shell">
          ${item.approved_record_id ? `<div class="submissions-alert">Esta submissão já foi aprovada para ${escapeHtml(config.officialTable)} (${escapeHtml(item.approved_record_id)}).</div>` : ""}
          ${renderReviewForm(item)}
          <div class="submissions-actions">
            <button class="submissions-button primary" type="button" data-approve>Aprovar e criar registro oficial</button>
          </div>
          <label class="submissions-field full"><span>Motivo da recusa</span><textarea name="rejection_reason" placeholder="Explique o motivo, se for recusar.">${escapeHtml(item.rejection_reason || "")}</textarea></label>
          <button class="submissions-button danger" type="button" data-reject>Recusar submissão</button>
        </div>
      </section>
    </div>`;
}

async function loadItems() {
  state.message = "";
  state.selected = null;
  if (!app) return;
  app.classList.add("loading");
  app.textContent = "Carregando submissões…";
  const config = typeConfig[state.type];
  const { data, error } = await db
    .from(config.table)
    .select("*")
    .eq("status", state.status)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) {
    app.classList.remove("loading");
    app.innerHTML = `<div class="submissions-alert">Não foi possível carregar as submissões. Verifique as permissões no Supabase.</div>`;
    return;
  }
  state.items = data || [];
  render();
}

async function updateSelected(fields) {
  const config = typeConfig[state.type];
  const { data, error } = await db
    .from(config.table)
    .update(fields)
    .eq("id", state.selected.id)
    .select("*")
    .single();
  if (error) throw error;
  state.selected = data;
}

async function approveSelected() {
  const config = typeConfig[state.type];
  if (state.selected.approved_record_id) {
    showMessage("Esta submissão já foi aprovada. Nenhum novo registro foi criado.");
    return;
  }
  const record = state.type === "event"
    ? buildEventOfficialRecord(state.selected)
    : buildBusinessOfficialRecord(state.selected);
  record.slug = await createUniqueSlug(config.officialTable, record.titulo || record.nome);
  const { data: official, error: insertError } = await db
    .from(config.officialTable)
    .insert(record)
    .select("id")
    .single();
  if (insertError) throw insertError;
  await updateSelected({
    status: "approved",
    approved_record_id: official.id,
    reviewed_at: new Date().toISOString(),
    reviewed_by: state.access.user.id,
    moderation_notes: getInput("moderation_notes") || null
  });
  state.status = "pending";
  await loadItems();
  showMessage("Submissão aprovada e registro oficial criado.");
}

async function rejectSelected() {
  const reason = normalize(getInput("rejection_reason"));
  if (!reason) {
    showMessage("Informe o motivo da recusa antes de recusar a submissão.");
    return;
  }
  await updateSelected({
    status: "rejected",
    rejection_reason: reason,
    reviewed_at: new Date().toISOString(),
    reviewed_by: state.access.user.id,
    moderation_notes: getInput("moderation_notes") || null
  });
  state.status = "pending";
  await loadItems();
  showMessage("Submissão recusada.");
}

async function markUnderReview() {
  await updateSelected({
    status: "under_review",
    reviewed_at: new Date().toISOString(),
    reviewed_by: state.access.user.id,
    moderation_notes: getInput("moderation_notes") || null
  });
  showMessage("Submissão marcada como em revisão.");
}

async function handleAppClick(event) {
  const target = event.target.closest("button");
  if (!target || !app?.contains(target)) return;
  try {
    if (target.dataset.type) {
      state.type = target.dataset.type;
      await loadItems();
    } else if (target.dataset.refresh !== undefined) {
      await loadItems();
    } else if (target.dataset.review) {
      state.selected = state.items.find(item => String(item.id) === String(target.dataset.review));
      state.message = "";
      render();
    } else if (target.dataset.back !== undefined) {
      state.selected = null;
      state.message = "";
      render();
    } else if (target.dataset.approve !== undefined) {
      target.disabled = true;
      await approveSelected();
    } else if (target.dataset.reject !== undefined) {
      target.disabled = true;
      await rejectSelected();
    } else if (target.dataset.underReview !== undefined) {
      target.disabled = true;
      await markUnderReview();
    }
  } catch (error) {
    showMessage(error?.message || "Não foi possível concluir a ação.");
  }
}

async function handleAppChange(event) {
  if (event.target.matches("[data-status-filter]")) {
    state.status = event.target.value;
    await loadItems();
  }
}

async function initModule(container, moduleContext = {}) {
  context = moduleContext;
  db = moduleContext.db || getSupabase();
  state.access = moduleContext.access || await exigirPermissao("submissoes", "acessar");
  if (!state.access) return;
  if (!temPermissao(state.access.admin, "submissoes", "acessar")) {
    throw new Error("Usuário sem permissão para acessar Submissões públicas.");
  }
  renderShellFrame(container);
  app.addEventListener("click", handleAppClick);
  app.addEventListener("change", handleAppChange);
  addCleanup(() => app?.removeEventListener("click", handleAppClick));
  addCleanup(() => app?.removeEventListener("change", handleAppChange));
  await loadItems();
}

export async function mount(container, moduleContext = {}) {
  unmount();
  ensureModuleStyle();
  moduleContext.setTitle?.("Submissões públicas", "Revise empresas e eventos enviados pelo público. Imagens são escolhidas apenas pela equipe no painel.");
  await initModule(container, moduleContext);
}

export function unmount() {
  cleanupHandlers.forEach(handler => {
    try { handler(); } catch (error) { console.warn("Falha ao desmontar submissões:", error); }
  });
  cleanupHandlers = [];
  resetState();
  app = null;
  context = {};
}

async function bootLegacyPage() {
  if (document.body?.dataset.adminShell === "true") return;
  const legacyApp = document.getElementById("submissions-app");
  if (!legacyApp) return;
  const access = await exigirPermissao("submissoes", "acessar");
  if (!access) return;
  const adminUser = document.getElementById("admin-user");
  const logoutButton = document.getElementById("logout");
  const mobileMenu = document.getElementById("mobile-menu");
  const sidebar = document.getElementById("sidebar");
  adminUser.textContent = `${access.admin.nome || access.user.email} • ${access.admin.funcao}`;
  logoutButton?.addEventListener("click", sair);
  mobileMenu?.addEventListener("click", () => sidebar?.classList.toggle("open"));
  db = getSupabase();
  state.access = access;
  app = legacyApp;
  app.addEventListener("click", handleAppClick);
  app.addEventListener("change", handleAppChange);
  await loadItems();
}

bootLegacyPage();
