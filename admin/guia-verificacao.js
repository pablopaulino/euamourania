import { temPermissao } from "./auth.js";
import {
  getBusinessDataQuality,
  matchesBusinessQualityFilter,
  qualityFieldLabels,
  qualityFilterLabels,
  qualityPriorityScore,
  qualityWarningLabels,
  summarizeBusinessQuality
} from "./business-quality.js";

const VERIFICATION_CYCLE_DAYS = 100;
const DUE_SOON_DAYS = 15;

let app = null;
let db = null;
let context = {};
let moduleStyle = null;
let cleanupHandlers = [];

const state = {
  items: [],
  filtered: [],
  loading: true,
  message: "",
  filters: {
    search: "",
    status: "all",
    category: "all",
    due: "all",
    method: "all",
    featured: "all",
    hours: "all"
  },
  qualityFilter: "all",
  qualitySearch: "",
  dialog: null
};

const statusLabels = {
  verified: "Verificado",
  due_soon: "Vence em breve",
  pending: "Pendente",
  awaiting_contact: "Aguardando retorno",
  needs_update: "Precisa atualizar",
  inactive_suspected: "Inatividade suspeita",
  archived: "Arquivado"
};

const methodLabels = {
  whatsapp: "WhatsApp",
  phone: "Telefone",
  instagram: "Instagram",
  website: "Site",
  google: "Google",
  in_person: "Presencial",
  internal_knowledge: "Conhecimento interno",
  other: "Outro"
};

const contactResultLabels = {
  answered: "Respondeu",
  no_response: "Sem resposta",
  data_confirmed: "Dados confirmados",
  data_changed: "Dados precisam mudar",
  inactive_signal: "Indício de inatividade"
};

function addCleanup(handler) {
  cleanupHandlers.push(handler);
}

function ensureModuleStyle() {
  if (document.querySelector('link[data-admin-module-style="guia-verificacao"]')) return;
  moduleStyle = document.createElement("link");
  moduleStyle.rel = "stylesheet";
  moduleStyle.href = "/admin/guia-verificacao.css";
  moduleStyle.dataset.adminModuleStyle = "guia-verificacao";
  document.head.append(moduleStyle);
  addCleanup(() => {
    moduleStyle?.remove();
    moduleStyle = null;
  });
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalize(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
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
    return "—";
  }
}

function dateOnly(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "medium",
      timeZone: "America/Sao_Paulo"
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function hasStructuredHours(item) {
  return getBusinessDataQuality(item).hasStructuredHours;
}

function deriveVerificationStatus(item) {
  if (item.status === "arquivado" || item.verification_status === "archived" || item.archived_at) return "archived";
  if (["awaiting_contact", "needs_update", "inactive_suspected"].includes(item.verification_status)) return item.verification_status;
  if (!item.next_verification_at && !item.last_verified_at) return "pending";
  if (!item.next_verification_at) return "pending";
  const now = new Date();
  const next = new Date(item.next_verification_at);
  if (Number.isNaN(next.getTime())) return "pending";
  if (next <= now) return "pending";
  if (next <= addDays(now, DUE_SOON_DAYS)) return "due_soon";
  return "verified";
}

function statusClass(status) {
  if (status === "verified") return "success";
  if (status === "due_soon" || status === "awaiting_contact") return "warning";
  if (status === "needs_update" || status === "inactive_suspected") return "danger";
  if (status === "archived") return "muted";
  return "warning";
}

function isFeatured(item) {
  return Boolean(item.recomendado || item.destaque || item.destaque_home);
}

function businessPhone(item) {
  return item.whatsapp || item.telefone || "";
}

function whatsappUrl(item) {
  const raw = String(item.whatsapp || item.telefone || "").replace(/\D/g, "");
  if (!raw) return "";
  const phone = raw.startsWith("55") ? raw : `55${raw}`;
  const message = encodeURIComponent(`Olá! Aqui é da equipe Eu Amo Urânia. Estamos conferindo os dados do Guia Comercial para manter as informações atualizadas. Pode confirmar se nome, endereço, telefone, horário e redes sociais do cadastro continuam corretos?`);
  return `https://wa.me/${phone}?text=${message}`;
}

function verificationMessage(item) {
  return `Olá! Aqui é da equipe Eu Amo Urânia. Estamos conferindo os dados do Guia Comercial para manter as informações atualizadas.\n\nCadastro: ${item.nome || "empresa"}\n\nVocê pode confirmar se nome, endereço, telefone/WhatsApp, horário de funcionamento e redes sociais continuam corretos?`;
}

function applyFilters() {
  const search = normalize(state.filters.search);
  state.filtered = state.items.filter(item => {
    const derived = deriveVerificationStatus(item);
    const haystack = normalize([item.nome, item.categoria_nome, item.endereco, item.whatsapp, item.telefone, item.instagram, item.site].filter(Boolean).join(" "));
    if (search && !haystack.includes(search)) return false;
    if (state.filters.status !== "all" && derived !== state.filters.status) return false;
    if (state.filters.category !== "all" && item.categoria_nome !== state.filters.category) return false;
    if (state.filters.method !== "all" && item.verification_method !== state.filters.method) return false;
    if (state.filters.featured === "yes" && !isFeatured(item)) return false;
    if (state.filters.featured === "no" && isFeatured(item)) return false;
    if (state.filters.hours === "structured" && !hasStructuredHours(item)) return false;
    if (state.filters.hours === "missing" && hasStructuredHours(item)) return false;
    if (state.filters.due === "overdue" && derived !== "pending") return false;
    if (state.filters.due === "soon" && derived !== "due_soon") return false;
    if (state.filters.due === "ok" && derived !== "verified") return false;
    return true;
  }).sort((a, b) => {
    const order = { pending: 0, due_soon: 1, awaiting_contact: 2, needs_update: 3, inactive_suspected: 4, verified: 5, archived: 6 };
    const aStatus = deriveVerificationStatus(a);
    const bStatus = deriveVerificationStatus(b);
    if (order[aStatus] !== order[bStatus]) return order[aStatus] - order[bStatus];
    return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
  });
}

function categories() {
  return [...new Set(state.items.map(item => item.categoria_nome).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function metrics() {
  const active = state.items.filter(item => deriveVerificationStatus(item) !== "archived");
  return {
    pending: active.filter(item => deriveVerificationStatus(item) === "pending").length,
    dueSoon: active.filter(item => deriveVerificationStatus(item) === "due_soon").length,
    awaiting: active.filter(item => deriveVerificationStatus(item) === "awaiting_contact").length,
    missingHours: active.filter(item => !hasStructuredHours(item)).length
  };
}

function qualityItems() {
  const search = normalize(state.qualitySearch);
  return state.items
    .filter(item => deriveVerificationStatus(item) !== "archived")
    .filter(item => matchesBusinessQualityFilter(item, state.qualityFilter))
    .filter(item => {
      if (!search) return true;
      const haystack = normalize([item.nome, item.categoria_nome, item.endereco, item.whatsapp, item.telefone, item.instagram, item.site].filter(Boolean).join(" "));
      return haystack.includes(search);
    })
    .map(item => ({ item, quality: getBusinessDataQuality(item), verificationStatus: deriveVerificationStatus(item) }))
    .sort((a, b) => {
      const priorityDiff = qualityPriorityScore(b.item, b.quality) - qualityPriorityScore(a.item, a.quality);
      if (priorityDiff) return priorityDiff;
      if (a.quality.score !== b.quality.score) return a.quality.score - b.quality.score;
      return String(a.item.nome || "").localeCompare(String(b.item.nome || ""), "pt-BR");
    });
}

function renderMetric(label, value, hint) {
  return `<div class="verification-metric"><span>${escapeHtml(label)}</span><strong>${value}</strong><small>${escapeHtml(hint)}</small></div>`;
}

function scoreClass(score) {
  if (score >= 85) return "success";
  if (score >= 70) return "warning";
  return "danger";
}

function renderQualityFilterButton(filter, value) {
  const selected = state.qualityFilter === filter;
  return `
    <button type="button" class="quality-filter-card ${selected ? "active" : ""}" data-quality-filter="${escapeHtml(filter)}">
      <span>${escapeHtml(qualityFilterLabels[filter] || filter)}</span>
      <strong>${value}</strong>
    </button>`;
}

function renderQualityTags(quality) {
  const missing = quality.missingFields
    .filter(field => field !== "contact")
    .map(field => qualityFieldLabels[field] || field);
  const warnings = quality.warnings.map(warning => qualityWarningLabels[warning] || warning);
  const tags = [...missing, ...warnings].slice(0, 6);
  if (!tags.length) return `<span class="verification-pill success">Cadastro completo</span>`;
  return tags.map(label => `<span class="verification-pill ${label.includes("incompleto") || label.includes("apenas") ? "warning" : "danger"}">${escapeHtml(label)}</span>`).join("");
}

function renderQualityRow({ item, quality, verificationStatus }) {
  const combinedAlert = verificationStatus !== "verified" && quality.score < 85
    ? `<span class="verification-pill warning">Revisão + qualidade</span>`
    : "";
  return `
    <tr>
      <td class="verification-business">
        <strong>${escapeHtml(item.nome || "Sem nome")}</strong>
        <small>${escapeHtml(item.categoria_nome || "Sem categoria")} · ${escapeHtml(item.status || "sem status")}</small>
        <div class="verification-tags">${combinedAlert}${renderQualityTags(quality)}</div>
      </td>
      <td><span class="quality-score ${scoreClass(quality.score)}">${quality.score}</span></td>
      <td>
        <strong>${quality.hasStructuredHours ? "Sim" : "Não"}</strong>
        <small>${quality.hasCompleteStructuredHours ? "Semana completa" : quality.hasStructuredHours ? "Precisa conferir dias" : "Sem horário estruturado"}</small>
      </td>
      <td><span class="verification-pill ${statusClass(verificationStatus)}">${escapeHtml(statusLabels[verificationStatus] || verificationStatus)}</span></td>
      <td class="verification-row-actions">
        <button type="button" class="primary" data-action="edit-business" data-id="${item.id}">Editar cadastro</button>
        <button type="button" data-action="needs-update" data-id="${item.id}">Marcar para revisão</button>
      </td>
    </tr>`;
}

function renderQualityPanel() {
  const summary = summarizeBusinessQuality(state.items);
  const rows = qualityItems();
  return `
    <section class="verification-panel quality-panel">
      <header class="verification-panel-header">
        <div>
          <p class="verification-section-eyebrow">Qualidade dos cadastros</p>
          <h2>${summary.averageScore}% de completude média</h2>
          <p>Diagnóstico não bloqueante: organiza o que está faltando sem impedir publicação nem substituir a verificação periódica.</p>
        </div>
        <button class="admin-button secondary" type="button" data-action="open-guide">Abrir Guia Comercial</button>
      </header>
      <div class="quality-filter-grid">
        ${renderQualityFilterButton("all", summary.total)}
        ${renderQualityFilterButton("missing_hours", summary.missingHours)}
        ${renderQualityFilterButton("missing_address", summary.missingAddress)}
        ${renderQualityFilterButton("missing_whatsapp", summary.missingWhatsapp)}
        ${renderQualityFilterButton("missing_image", summary.missingImage)}
        ${renderQualityFilterButton("missing_category", summary.missingCategory)}
        ${renderQualityFilterButton("missing_description", summary.missingDescription)}
        ${renderQualityFilterButton("missing_location", summary.missingLocation)}
        ${renderQualityFilterButton("low_score", summary.lowScore)}
        ${renderQualityFilterButton("complete", summary.complete)}
      </div>
      <div class="verification-filters quality-search">
        <input data-quality-search value="${escapeHtml(state.qualitySearch)}" placeholder="Buscar empresa dentro do diagnóstico">
      </div>
      <div class="verification-table-wrap">
        <table class="verification-table">
          <thead><tr><th>Cadastro</th><th>Score</th><th>Horários</th><th>Verificação</th><th>Ações</th></tr></thead>
          <tbody>${rows.length ? rows.map(renderQualityRow).join("") : `<tr><td colspan="5" class="verification-empty">Nenhum cadastro encontrado neste filtro de qualidade.</td></tr>`}</tbody>
        </table>
      </div>
    </section>`;
}

function renderBusinessRow(item) {
  const derived = deriveVerificationStatus(item);
  const tags = [
    isFeatured(item) ? `<span class="verification-pill warning">★ Destaque</span>` : "",
    hasStructuredHours(item) ? `<span class="verification-pill success">Horário estruturado</span>` : `<span class="verification-pill danger">Sem horário do app</span>`,
    businessPhone(item) ? "" : `<span class="verification-pill danger">Sem contato direto</span>`
  ].filter(Boolean).join("");
  const wa = whatsappUrl(item);
  return `
    <tr>
      <td class="verification-business">
        <strong>${escapeHtml(item.nome || "Sem nome")}</strong>
        <small>${escapeHtml(item.categoria_nome || "Sem categoria")} · ${escapeHtml(item.endereco || "Endereço não informado")}</small>
        <div class="verification-tags">${tags}</div>
      </td>
      <td><span class="verification-pill ${statusClass(derived)}">${escapeHtml(statusLabels[derived] || derived)}</span></td>
      <td>
        <strong>${dateOnly(item.next_verification_at)}</strong>
        <small>Última: ${dateOnly(item.last_verified_at)}</small>
      </td>
      <td>
        <strong>${escapeHtml(methodLabels[item.verification_method] || "—")}</strong>
        <small>${item.contact_attempt_count || 0} tentativa(s)</small>
      </td>
      <td class="verification-row-actions">
        <button type="button" class="primary" data-open-dialog="verified" data-id="${item.id}">Verificado</button>
        <button type="button" data-open-dialog="contact" data-id="${item.id}">Contato</button>
        <button type="button" data-action="copy" data-id="${item.id}">Copiar mensagem</button>
        ${wa ? `<a class="verification-copy" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
        <button type="button" data-action="needs-update" data-id="${item.id}">Precisa atualizar</button>
        <button type="button" data-action="inactive" data-id="${item.id}">Inatividade</button>
        ${derived === "archived"
          ? `<button type="button" data-action="restore" data-id="${item.id}">Restaurar</button>`
          : `<button type="button" class="danger" data-open-dialog="archive" data-id="${item.id}">Arquivar</button>`}
        <button type="button" data-action="open-guide">Ver cadastro</button>
      </td>
    </tr>`;
}

function renderDialog() {
  const dialog = state.dialog;
  if (!dialog) return "";
  const item = state.items.find(row => row.id === dialog.id);
  if (!item) return "";
  if (dialog.type === "verified") {
    return `
      <div class="verification-dialog-backdrop" data-dialog-backdrop>
        <form class="verification-dialog" data-dialog-form="verified">
          <h3>Marcar como verificado</h3>
          <p>${escapeHtml(item.nome)} terá nova verificação programada para ${VERIFICATION_CYCLE_DAYS} dias.</p>
          <label>Método
            <select name="method" required>${Object.entries(methodLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select>
          </label>
          <label>Observações internas
            <textarea name="notes" rows="4" placeholder="Ex.: confirmado pelo WhatsApp, endereço e horários revisados."></textarea>
          </label>
          <label class="checkline"><input type="checkbox" name="confirmed" value="yes" required> Os principais dados foram conferidos.</label>
          <div class="verification-dialog-actions">
            <button type="button" class="admin-button secondary" data-close-dialog>Cancelar</button>
            <button type="submit" class="admin-button">Salvar verificação</button>
          </div>
        </form>
      </div>`;
  }
  if (dialog.type === "contact") {
    return `
      <div class="verification-dialog-backdrop" data-dialog-backdrop>
        <form class="verification-dialog" data-dialog-form="contact">
          <h3>Registrar contato</h3>
          <p>Registre a tentativa sem enviar mensagem automaticamente.</p>
          <label>Canal
            <select name="method" required>${Object.entries(methodLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select>
          </label>
          <label>Resultado
            <select name="result" required>${Object.entries(contactResultLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select>
          </label>
          <label>Observações
            <textarea name="notes" rows="4"></textarea>
          </label>
          <div class="verification-dialog-actions">
            <button type="button" class="admin-button secondary" data-close-dialog>Cancelar</button>
            <button type="submit" class="admin-button">Registrar</button>
          </div>
        </form>
      </div>`;
  }
  return `
    <div class="verification-dialog-backdrop" data-dialog-backdrop>
      <form class="verification-dialog" data-dialog-form="archive">
        <h3>Arquivar cadastro</h3>
        <p>O cadastro deixa de aparecer publicamente, mas os dados e o histórico permanecem preservados.</p>
        <label>Motivo do arquivamento
          <textarea name="reason" rows="4" required placeholder="Ex.: empresa sem atividade confirmada, pedido do responsável, duplicado..."></textarea>
        </label>
        <div class="verification-dialog-actions">
          <button type="button" class="admin-button secondary" data-close-dialog>Cancelar</button>
          <button type="submit" class="admin-button danger">Arquivar</button>
        </div>
      </form>
    </div>`;
}

function render() {
  if (!app) return;
  applyFilters();
  const count = metrics();
  app.classList.remove("loading");
  app.innerHTML = `
    <section class="verification-shell">
      ${state.message ? `<div class="submissions-toast">${escapeHtml(state.message)}</div>` : ""}
      <div class="verification-hero">
        <div>
          <p class="verification-eyebrow">Guia Comercial</p>
          <h2>Verificação periódica de cadastros</h2>
          <p>Ciclo padrão de ${VERIFICATION_CYCLE_DAYS} dias. A tela organiza vencidos, próximos vencimentos, tentativas de contato e cadastros que precisam de atualização.</p>
        </div>
        <div class="verification-actions">
          <button class="admin-button secondary" type="button" data-refresh>Atualizar</button>
          <button class="admin-button" type="button" data-action="open-guide">Abrir Guia Comercial</button>
        </div>
      </div>

      <div class="verification-metrics">
        ${renderMetric("Pendentes", count.pending, "Vencidos ou nunca verificados")}
        ${renderMetric("Vence em breve", count.dueSoon, `${DUE_SOON_DAYS} dias`)}
        ${renderMetric("Aguardando", count.awaiting, "Contato sem retorno")}
        ${renderMetric("Sem horário app", count.missingHours, "Prioridade de qualidade")}
      </div>

      <section class="verification-panel">
        <header class="verification-panel-header">
          <div>
            <p class="verification-section-eyebrow">Revisão de cadastros</p>
            <h2>${state.filtered.length} cadastro(s)</h2>
            <p>Use os filtros para priorizar contatos, revisão de horários e cadastros comerciais em destaque.</p>
          </div>
        </header>
        <div class="verification-filters">
          <input data-filter="search" value="${escapeHtml(state.filters.search)}" placeholder="Buscar por nome, categoria, contato ou endereço">
          <select data-filter="status">
            <option value="all">Todos os status</option>
            ${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${state.filters.status === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
          <select data-filter="category">
            <option value="all">Todas categorias</option>
            ${categories().map(category => `<option value="${escapeHtml(category)}" ${state.filters.category === category ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}
          </select>
          <select data-filter="method">
            <option value="all">Todos métodos</option>
            ${Object.entries(methodLabels).map(([value, label]) => `<option value="${value}" ${state.filters.method === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
          <select data-filter="featured">
            <option value="all">Destaque: todos</option>
            <option value="yes" ${state.filters.featured === "yes" ? "selected" : ""}>Somente destaque</option>
            <option value="no" ${state.filters.featured === "no" ? "selected" : ""}>Sem destaque</option>
          </select>
          <select data-filter="hours">
            <option value="all">Horários: todos</option>
            <option value="structured" ${state.filters.hours === "structured" ? "selected" : ""}>Com horário do app</option>
            <option value="missing" ${state.filters.hours === "missing" ? "selected" : ""}>Sem horário do app</option>
          </select>
        </div>
        <div class="verification-table-wrap">
          <table class="verification-table">
            <thead><tr><th>Cadastro</th><th>Status</th><th>Próxima revisão</th><th>Método</th><th>Ações</th></tr></thead>
            <tbody>${state.filtered.length ? state.filtered.map(renderBusinessRow).join("") : `<tr><td colspan="5" class="verification-empty">Nenhum cadastro encontrado com estes filtros.</td></tr>`}</tbody>
          </table>
        </div>
      </section>
      ${renderQualityPanel()}
    </section>
    ${renderDialog()}`;
}

async function loadItems() {
  state.loading = true;
  app.innerHTML = `<section class="verification-shell loading">Carregando verificação do Guia…</section>`;
  const { data, error } = await db
    .from("guia_comercial")
    .select("*")
    .order("nome", { ascending: true });
  if (error) throw error;
  state.items = data || [];
  render();
}

async function writeLog(businessId, action, payload = {}) {
  const actorId = context.access?.user?.id || context.access?.admin?.id || null;
  const { error } = await db.from("business_verification_logs").insert({
    business_id: businessId,
    actor_id: actorId,
    action,
    method: payload.method || null,
    result: payload.result || null,
    notes: payload.notes || payload.reason || null,
    metadata: payload.metadata || {}
  });
  if (error) {
    console.warn("Histórico de verificação não registrado.", {
      code: error.code,
      message: error.message
    });
    return { ok: false, error };
  }
  return { ok: true };
}

async function updateBusiness(id, values, logAction, logPayload = {}) {
  const { error } = await db.from("guia_comercial").update(values).eq("id", id);
  if (error) {
    if (error.code === "42703" || String(error.message || "").includes("verification_status")) {
      throw new Error("A migration de Verificação do Guia ainda não parece estar aplicada no Supabase. Rode a migration 20260823_business_verification_workflow.sql antes de revisar cadastros.");
    }
    throw error;
  }
  const log = await writeLog(id, logAction, logPayload);
  state.message = log.ok
    ? "Cadastro atualizado."
    : "Cadastro atualizado. O histórico de verificação não foi registrado; confira se a migration e as permissões do log estão aplicadas.";
  await loadItems();
}

function selectedDialogItem() {
  return state.items.find(item => item.id === state.dialog?.id);
}

async function handleVerifiedSubmit(form) {
  const item = selectedDialogItem();
  if (!item) return;
  const now = new Date();
  const method = form.get("method");
  const notes = String(form.get("notes") || "").trim();
  state.dialog = null;
  await updateBusiness(item.id, {
    verification_status: "verified",
    last_verified_at: now.toISOString(),
    next_verification_at: addDays(now, VERIFICATION_CYCLE_DAYS).toISOString(),
    verification_method: method,
    verification_notes: notes || null,
    verified_by: context.access?.user?.id || context.access?.admin?.id || null
  }, "marked_verified", { method, notes });
}

async function handleContactSubmit(form) {
  const item = selectedDialogItem();
  if (!item) return;
  const method = form.get("method");
  const result = form.get("result");
  const notes = String(form.get("notes") || "").trim();
  const verificationStatus = result === "no_response" ? "awaiting_contact" : result === "data_changed" ? "needs_update" : result === "inactive_signal" ? "inactive_suspected" : item.verification_status || "pending";
  state.dialog = null;
  await updateBusiness(item.id, {
    verification_status: verificationStatus,
    verification_method: method,
    verification_notes: notes || item.verification_notes || null,
    last_contact_attempt_at: new Date().toISOString(),
    contact_attempt_count: (item.contact_attempt_count || 0) + 1
  }, "contact_registered", { method, result, notes });
}

async function handleArchiveSubmit(form) {
  const item = selectedDialogItem();
  if (!item) return;
  const reason = String(form.get("reason") || "").trim();
  state.dialog = null;
  await updateBusiness(item.id, {
    status: "arquivado",
    verification_status: "archived",
    archived_at: new Date().toISOString(),
    archived_by: context.access?.user?.id || context.access?.admin?.id || null,
    archive_reason: reason
  }, "archived", { reason, metadata: { previous_status: item.status || null } });
}

async function quickAction(action, item) {
  if (action === "copy") {
    await navigator.clipboard.writeText(verificationMessage(item));
    state.message = "Mensagem de verificação copiada.";
    render();
    return;
  }
  if (action === "open-guide") {
    context.navigate?.("guia_comercial");
    return;
  }
  if (action === "needs-update") {
    await updateBusiness(item.id, { verification_status: "needs_update" }, "needs_update", { notes: "Marcado pela equipe para atualização." });
    return;
  }
  if (action === "inactive") {
    await updateBusiness(item.id, { verification_status: "inactive_suspected" }, "inactive_suspected", { notes: "Marcado pela equipe como possível inativo." });
    return;
  }
  if (action === "restore") {
    await updateBusiness(item.id, {
      status: "publicado",
      verification_status: "pending",
      archived_at: null,
      archived_by: null,
      archive_reason: null
    }, "restored", { notes: "Cadastro restaurado pela equipe." });
  }
}

function bindEvents() {
  app.addEventListener("input", event => {
    const qualitySearch = event.target.closest("[data-quality-search]");
    if (qualitySearch) {
      state.qualitySearch = qualitySearch.value;
      render();
      return;
    }
    const field = event.target.closest("[data-filter]");
    if (!field) return;
    state.filters[field.dataset.filter] = field.value;
    render();
  });

  app.addEventListener("change", event => {
    const field = event.target.closest("[data-filter]");
    if (!field) return;
    state.filters[field.dataset.filter] = field.value;
    render();
  });

  app.addEventListener("click", async event => {
    const button = event.target.closest("button,[data-action]");
    if (!button) return;
    if (button.dataset.refresh !== undefined) return loadItems();
    if (button.dataset.qualityFilter) {
      state.qualityFilter = button.dataset.qualityFilter;
      render();
      return;
    }
    if (button.dataset.closeDialog !== undefined || event.target.dataset.dialogBackdrop !== undefined) {
      state.dialog = null;
      render();
      return;
    }
    if (button.dataset.openDialog) {
      state.dialog = { type: button.dataset.openDialog, id: button.dataset.id };
      render();
      return;
    }
    if (button.dataset.action) {
      const item = state.items.find(row => row.id === button.dataset.id);
      if (button.dataset.action === "open-guide") return context.navigate?.("guia_comercial");
      if (button.dataset.action === "edit-business") return context.editResource?.("guia_comercial", button.dataset.id) || context.navigate?.("guia_comercial");
      if (!item) return;
      try {
        await quickAction(button.dataset.action, item);
      } catch (error) {
        state.message = error.message || "Não foi possível concluir a ação.";
        render();
      }
    }
  });

  app.addEventListener("submit", async event => {
    const form = event.target.closest("[data-dialog-form]");
    if (!form) return;
    event.preventDefault();
    try {
      if (form.dataset.dialogForm === "verified") await handleVerifiedSubmit(new FormData(form));
      if (form.dataset.dialogForm === "contact") await handleContactSubmit(new FormData(form));
      if (form.dataset.dialogForm === "archive") await handleArchiveSubmit(new FormData(form));
    } catch (error) {
      state.message = error.message || "Não foi possível salvar.";
      state.dialog = null;
      render();
    }
  });
}

export async function mount(container, options = {}) {
  app = null;
  db = options.db;
  context = options;
  cleanupHandlers = [];
  ensureModuleStyle();
  options.setTitle?.("Verificação do Guia", "Conferência periódica dos cadastros comerciais.");
  container.innerHTML = `<section id="business-verification-app" class="verification-shell loading">Carregando…</section>`;
  app = container.querySelector("#business-verification-app");
  state.items = [];
  state.filtered = [];
  state.message = "";
  state.dialog = null;
  state.qualitySearch = "";
  state.qualityFilter = sessionStorage.getItem("euamourania:guide-quality-filter") || "all";
  sessionStorage.removeItem("euamourania:guide-quality-filter");
  if (!temPermissao(options.access?.admin, "guia_comercial", "ler")) {
    app.innerHTML = `<section class="verification-panel"><div class="verification-empty">Você não tem permissão para acessar esta área.</div></section>`;
    return;
  }
  bindEvents();
  try {
    await loadItems();
  } catch (error) {
    app.innerHTML = `
      <section class="verification-panel">
        <div class="verification-empty">
          <h2>Não foi possível carregar a verificação.</h2>
          <p>${escapeHtml(error.message || "Erro inesperado.")}</p>
          <p>Se a migration ainda não foi executada, rode primeiro <code>supabase/migrations/20260823_business_verification_workflow.sql</code>.</p>
          <button class="admin-button" type="button" data-refresh>Tentar novamente</button>
        </div>
      </section>`;
  }
}

export function unmount() {
  cleanupHandlers.forEach(handler => handler());
  cleanupHandlers = [];
  app = null;
  db = null;
  context = {};
}
