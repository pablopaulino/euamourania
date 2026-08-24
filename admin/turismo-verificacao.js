import { temPermissao } from "./auth.js";

const VERIFICATION_CYCLE_DAYS = 180;
const DUE_SOON_DAYS = 30;

let app = null;
let db = null;
let context = {};
let moduleStyle = null;
let cleanupHandlers = [];

const state = {
  items: [],
  filtered: [],
  message: "",
  filters: {
    search: "",
    status: "all",
    category: "all",
    method: "all",
    featured: "all",
    hours: "all",
    location: "all"
  },
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
  moduleStyle.href = "guia-verificacao.css";
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
  return Boolean(item.opening_hours && typeof item.opening_hours === "object" && Object.keys(item.opening_hours).length);
}

function hasLocation(item) {
  const hasAddress = Boolean(String(item.endereco || "").trim());
  const latitude = Number(item.latitude);
  const longitude = Number(item.longitude);
  const hasCoordinates = Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
  return hasAddress || hasCoordinates || Boolean(String(item.mapa_url || "").trim());
}

function hasImage(item) {
  return Boolean(String(item.imagem_url || "").trim());
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
  return Boolean(item.destaque || item.destaque_home || item.curadoria_euamourania);
}

function tourismPhone(item) {
  return item.whatsapp || "";
}

function whatsappUrl(item) {
  const raw = String(tourismPhone(item)).replace(/\D/g, "");
  if (!raw) return "";
  const phone = raw.startsWith("55") ? raw : `55${raw}`;
  const message = encodeURIComponent("Olá! Aqui é da equipe Eu Amo Urânia. Estamos conferindo os dados de Turismo para manter as informações atualizadas. Pode confirmar se nome, endereço, horário, rota e informações do local continuam corretos?");
  return `https://wa.me/${phone}?text=${message}`;
}

function verificationMessage(item) {
  return `Olá! Aqui é da equipe Eu Amo Urânia. Estamos conferindo os dados de Turismo para manter as informações atualizadas.\n\nCadastro: ${item.nome || "ponto turístico"}\n\nVocê pode confirmar se nome, endereço, horário, rota, contato e descrição continuam corretos?`;
}

function categories() {
  return [...new Set(state.items.map(item => item.categoria_nome || item.categoria || "Turismo").filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function applyFilters() {
  const search = normalize(state.filters.search);
  state.filtered = state.items.filter(item => {
    const derived = deriveVerificationStatus(item);
    const category = item.categoria_nome || item.categoria || "Turismo";
    const haystack = normalize([item.nome, category, item.endereco, item.descricao, item.whatsapp, item.horario].filter(Boolean).join(" "));
    if (search && !haystack.includes(search)) return false;
    if (state.filters.status !== "all" && derived !== state.filters.status) return false;
    if (state.filters.category !== "all" && category !== state.filters.category) return false;
    if (state.filters.method !== "all" && item.verification_method !== state.filters.method) return false;
    if (state.filters.featured === "yes" && !isFeatured(item)) return false;
    if (state.filters.featured === "no" && isFeatured(item)) return false;
    if (state.filters.hours === "structured" && !hasStructuredHours(item)) return false;
    if (state.filters.hours === "missing" && hasStructuredHours(item)) return false;
    if (state.filters.location === "complete" && !hasLocation(item)) return false;
    if (state.filters.location === "missing" && hasLocation(item)) return false;
    return true;
  }).sort((a, b) => {
    const order = { pending: 0, due_soon: 1, awaiting_contact: 2, needs_update: 3, inactive_suspected: 4, verified: 5, archived: 6 };
    const aStatus = deriveVerificationStatus(a);
    const bStatus = deriveVerificationStatus(b);
    if (order[aStatus] !== order[bStatus]) return order[aStatus] - order[bStatus];
    return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
  });
}

function metrics() {
  const active = state.items.filter(item => deriveVerificationStatus(item) !== "archived");
  return {
    pending: active.filter(item => deriveVerificationStatus(item) === "pending").length,
    dueSoon: active.filter(item => deriveVerificationStatus(item) === "due_soon").length,
    missingLocation: active.filter(item => !hasLocation(item)).length,
    missingImage: active.filter(item => !hasImage(item)).length
  };
}

function renderMetric(label, value, hint) {
  return `<div class="verification-metric"><span>${escapeHtml(label)}</span><strong>${value}</strong><small>${escapeHtml(hint)}</small></div>`;
}

function renderTourismRow(item) {
  const derived = deriveVerificationStatus(item);
  const category = item.categoria_nome || item.categoria || "Turismo";
  const tags = [
    isFeatured(item) ? `<span class="verification-pill warning">★ Destaque/curadoria</span>` : "",
    hasStructuredHours(item) ? `<span class="verification-pill success">Horário estruturado</span>` : `<span class="verification-pill warning">Horário simples</span>`,
    hasLocation(item) ? `<span class="verification-pill success">Localização</span>` : `<span class="verification-pill danger">Sem localização</span>`,
    hasImage(item) ? "" : `<span class="verification-pill danger">Sem imagem</span>`
  ].filter(Boolean).join("");
  const wa = whatsappUrl(item);
  return `
    <tr>
      <td class="verification-business">
        <strong>${escapeHtml(item.nome || "Sem nome")}</strong>
        <small>${escapeHtml(category)} · ${escapeHtml(item.endereco || "Endereço não informado")}</small>
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
        <button type="button" data-action="edit-tourism" data-id="${item.id}">Ver cadastro</button>
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
          <h3>Marcar Turismo como verificado</h3>
          <p>${escapeHtml(item.nome)} terá nova verificação programada para ${VERIFICATION_CYCLE_DAYS} dias.</p>
          <label>Método
            <select name="method" required>${Object.entries(methodLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select>
          </label>
          <label>Observações internas
            <textarea name="notes" rows="4" placeholder="Ex.: horário, endereço, rota e descrição conferidos."></textarea>
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
        <h3>Arquivar Turismo</h3>
        <p>O cadastro deixa de aparecer publicamente, mas os dados e o histórico permanecem preservados.</p>
        <label>Motivo do arquivamento
          <textarea name="reason" rows="4" required placeholder="Ex.: local desativado, duplicado, informação inválida..."></textarea>
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
          <p class="verification-eyebrow">Turismo</p>
          <h2>Verificação periódica dos atrativos</h2>
          <p>Ciclo padrão de ${VERIFICATION_CYCLE_DAYS} dias. Turismo muda menos que comércio, então o foco é conferir rota, imagem, horário, descrição e se o local continua ativo.</p>
        </div>
        <div class="verification-actions">
          <button class="admin-button secondary" type="button" data-refresh>Atualizar</button>
          <button class="admin-button" type="button" data-action="open-tourism">Abrir Turismo</button>
        </div>
      </div>

      <div class="verification-metrics">
        ${renderMetric("Pendentes", count.pending, "Vencidos ou nunca verificados")}
        ${renderMetric("Vence em breve", count.dueSoon, `${DUE_SOON_DAYS} dias`)}
        ${renderMetric("Sem localização", count.missingLocation, "Endereço, mapa ou coordenadas")}
        ${renderMetric("Sem imagem", count.missingImage, "Impacta app e site")}
      </div>

      <section class="verification-panel">
        <header class="verification-panel-header">
          <div>
            <p class="verification-section-eyebrow">Revisão de atrativos</p>
            <h2>${state.filtered.length} cadastro(s)</h2>
            <p>Use os filtros para priorizar pontos turísticos com informação antiga, rota ausente, imagem faltando ou sinais de inatividade.</p>
          </div>
        </header>
        <div class="verification-filters">
          <input data-filter="search" value="${escapeHtml(state.filters.search)}" placeholder="Buscar por nome, categoria, descrição ou endereço">
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
            <option value="all">Destaque/curadoria: todos</option>
            <option value="yes" ${state.filters.featured === "yes" ? "selected" : ""}>Somente destaque/curadoria</option>
            <option value="no" ${state.filters.featured === "no" ? "selected" : ""}>Sem destaque/curadoria</option>
          </select>
          <select data-filter="hours">
            <option value="all">Horários: todos</option>
            <option value="structured" ${state.filters.hours === "structured" ? "selected" : ""}>Com horário do app</option>
            <option value="missing" ${state.filters.hours === "missing" ? "selected" : ""}>Sem horário do app</option>
          </select>
          <select data-filter="location">
            <option value="all">Localização: todos</option>
            <option value="complete" ${state.filters.location === "complete" ? "selected" : ""}>Com localização</option>
            <option value="missing" ${state.filters.location === "missing" ? "selected" : ""}>Sem localização</option>
          </select>
        </div>
        <div class="verification-table-wrap">
          <table class="verification-table">
            <thead><tr><th>Cadastro</th><th>Status</th><th>Próxima revisão</th><th>Método</th><th>Ações</th></tr></thead>
            <tbody>${state.filtered.length ? state.filtered.map(renderTourismRow).join("") : `<tr><td colspan="5" class="verification-empty">Nenhum cadastro encontrado com estes filtros.</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    </section>
    ${renderDialog()}`;
}

async function loadItems() {
  app.innerHTML = `<section class="verification-shell loading">Carregando verificação de Turismo…</section>`;
  const { data, error } = await db
    .from("turismo")
    .select("*")
    .order("nome", { ascending: true });
  if (error) throw error;
  state.items = data || [];
  render();
}

async function writeLog(tourismId, action, payload = {}) {
  const actorId = context.access?.user?.id || context.access?.admin?.id || null;
  const { error } = await db.from("tourism_verification_logs").insert({
    tourism_id: tourismId,
    actor_id: actorId,
    action,
    method: payload.method || null,
    result: payload.result || null,
    notes: payload.notes || payload.reason || null,
    metadata: payload.metadata || {}
  });
  if (error) {
    console.warn("Histórico de verificação de Turismo não registrado.", {
      code: error.code,
      message: error.message
    });
    return { ok: false, error };
  }
  return { ok: true };
}

async function updateTourism(id, values, logAction, logPayload = {}) {
  const { error } = await db.from("turismo").update(values).eq("id", id);
  if (error) {
    if (error.code === "42703" || String(error.message || "").includes("verification_status")) {
      throw new Error("A migration de Verificação de Turismo ainda não parece estar aplicada no Supabase. Rode a migration 20260823_tourism_verification_workflow.sql antes de revisar atrativos.");
    }
    throw error;
  }
  const log = await writeLog(id, logAction, logPayload);
  state.message = log.ok
    ? "Cadastro de Turismo atualizado."
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
  await updateTourism(item.id, {
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
  await updateTourism(item.id, {
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
  await updateTourism(item.id, {
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
  if (action === "open-tourism") {
    context.navigate?.("turismo");
    return;
  }
  if (action === "edit-tourism") {
    context.editResource?.("turismo", item.id) || context.navigate?.("turismo");
    return;
  }
  if (action === "needs-update") {
    await updateTourism(item.id, { verification_status: "needs_update" }, "needs_update", { notes: "Marcado pela equipe para atualização." });
    return;
  }
  if (action === "inactive") {
    await updateTourism(item.id, { verification_status: "inactive_suspected" }, "inactive_suspected", { notes: "Marcado pela equipe como possível inativo." });
    return;
  }
  if (action === "restore") {
    await updateTourism(item.id, {
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
      if (button.dataset.action === "open-tourism") return context.navigate?.("turismo");
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
  options.setTitle?.("Verificação de Turismo", "Conferência semestral dos atrativos e experiências.");
  container.innerHTML = `<section id="tourism-verification-app" class="verification-shell loading">Carregando…</section>`;
  app = container.querySelector("#tourism-verification-app");
  state.items = [];
  state.filtered = [];
  state.message = "";
  state.dialog = null;
  Object.assign(state.filters, {
    search: "",
    status: "all",
    category: "all",
    method: "all",
    featured: "all",
    hours: "all",
    location: "all"
  });
  if (!temPermissao(options.access?.admin, "turismo", "ler")) {
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
          <h2>Não foi possível carregar a verificação de Turismo.</h2>
          <p>${escapeHtml(error.message || "Erro inesperado.")}</p>
          <p>Se a migration ainda não foi executada, rode primeiro <code>supabase/migrations/20260823_tourism_verification_workflow.sql</code>.</p>
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
