import { exigirPermissao, sair } from "./auth.js";
import { gerarSlug } from "../assets/js/utils.js";
import { getDefaultMetodologia, getDefaultRegulamento } from "../assets/js/melhoresOfficialTexts.js";
import {
  obterResumoMelhores,
  obterAudienciaMelhores,
  listarEdicoes,
  listarEdicoesParaCopiaCategorias,
  salvarEdicao,
  excluirEdicao,
  listarCategorias,
  salvarCategoria,
  copiarCategoriasEntreEdicoes,
  excluirCategoria,
  listarIndicacoes,
  moderarIndicacao,
  excluirIndicacao,
  listarIndicados,
  salvarIndicado,
  excluirIndicado,
  listarGuiaComercial,
  listarInstagramVotos,
  salvarInstagramVoto,
  excluirInstagramVoto,
  obterApuracao,
  publicarResultado,
  listarResultados,
  listarVotos,
  listarAuditoria,
  limparVotosManual,
  listarCampanhasApp,
  obterCampanhaApp,
  salvarCampanhaApp,
  listarVencedoresApp,
  salvarVencedorApp,
  arquivarVencedorApp,
  listarResultadosPublicadosEdicao,
  importarVencedoresApp
} from "../assets/js/services/melhoresService.js";

const $ = selector => document.querySelector(selector);
const state = { tab: "dashboard", returnTab: "dashboard", edicoes: [], categorias: [], indicacoes: [], indicados: [], guia: [], votos: [], instagram: [], apuracao: [], resultados: [], auditoria: [], appCampanhas: [], appVencedores: [], appPreviewResultados: [] };
const editionStatuses = [
  "planejamento",
  "indicacoes_abertas",
  "indicacoes_encerradas",
  "votacao_aberta",
  "votacao_encerrada",
  "apuracao",
  "resultado_publicado",
  "arquivada"
];
const categoryStatuses = ["ativo", "inativo", "arquivado"];
const nomineeStatuses = ["rascunho", "ativo", "inativo", "reprovado", "arquivado"];
const indicationStatuses = ["pendente", "aprovada", "rejeitada", "convertida", "duplicada", "spam"];
const voteStatuses = ["valido", "suspeito", "bloqueado", "anulado"];
const appCampaignStatuses = ["rascunho", "agendada", "ativa", "inativa", "encerrada", "arquivada"];
const appWinnerStatuses = ["ativo", "oculto", "arquivado"];

function escapeHtml(value = "") {
  const el = document.createElement("div");
  el.textContent = String(value ?? "");
  return el.innerHTML;
}

function toast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  $("#toasts").append(el);
  setTimeout(() => el.remove(), 3800);
}

function fmtDate(value) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Não definido";
}

function fmtDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function validReference(value) {
  return !value || /^(?:https?:\/\/|\/(?!\/)|\.{1,2}\/|assets\/|#)/i.test(value);
}

function optionList(values, selected) {
  return values.map(value => `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(value.replaceAll("_", " "))}</option>`).join("");
}

function statusText(value = "") {
  return String(value || "não definido").replaceAll("_", " ");
}

function phaseLabel(status = "") {
  const labels = {
    planejamento: "Preparação da edição",
    indicacoes_abertas: "Recebendo indicações",
    indicacoes_encerradas: "Revisão das indicações",
    votacao_aberta: "Votação popular aberta",
    votacao_encerrada: "Votação encerrada",
    apuracao: "Apuração dos resultados",
    resultado_publicado: "Resultado publicado",
    arquivada: "Edição arquivada"
  };
  return labels[status] || "Sem edição ativa";
}

function phaseProgress(status = "") {
  const order = ["planejamento", "indicacoes_abertas", "indicacoes_encerradas", "votacao_aberta", "votacao_encerrada", "apuracao", "resultado_publicado"];
  const index = Math.max(0, order.indexOf(status));
  return Math.round(((index + 1) / order.length) * 100);
}

function dateDistance(value) {
  if (!value) return "";
  const target = new Date(value).getTime();
  const diffDays = Math.ceil((target - Date.now()) / 86400000);
  if (Number.isNaN(diffDays)) return "";
  if (diffDays === 0) return "hoje";
  if (diffDays === 1) return "amanhã";
  if (diffDays > 1) return `em ${diffDays} dias`;
  if (diffDays === -1) return "ontem";
  return `há ${Math.abs(diffDays)} dias`;
}

function dashboardTask({ title, text, action, tab, tone = "" }) {
  return `<button class="awards-dashboard-task ${tone}" type="button" data-dashboard-tab="${escapeHtml(tab)}">
    <span>${escapeHtml(title)}</span>
    <small>${escapeHtml(text)}</small>
    <strong>${escapeHtml(action)} →</strong>
  </button>`;
}

function dashboardListRow({ title, detail, badge = "", tab = "" }) {
  return `<button class="awards-dashboard-row" type="button" ${tab ? `data-dashboard-tab="${escapeHtml(tab)}"` : ""}>
    <span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></span>
    ${badge ? `<em>${escapeHtml(badge)}</em>` : ""}
  </button>`;
}

const tabLoaders = {
  dashboard: loadDashboardV2,
  editions: loadEditions,
  categories: loadCategories,
  indications: loadIndications,
  nominees: loadNominees,
  votes: loadVotes,
  instagram: loadInstagram,
  apuration: loadApuration,
  results: loadResults,
  app: loadAppDisplay,
  audience: loadAudience,
  audit: loadAudit,
  settings: loadSettings
};

function currentHashTab() {
  const tab = decodeURIComponent(location.hash.replace(/^#/, ""));
  return tabLoaders[tab] ? tab : "dashboard";
}

function setActiveTab(tab, { persist = true } = {}) {
  state.tab = tab;
  document.querySelectorAll(".awards-tab").forEach(button => button.classList.toggle("active", button.dataset.tab === tab));
  document.querySelectorAll(".awards-view").forEach(view => view.classList.toggle("active", view.id === `${tab}-view`));
  if (persist && tabLoaders[tab]) history.replaceState(null, "", `#${tab}`);
}

function loadTab(tab) {
  return (tabLoaders[tab] || loadDashboard)();
}

function showError(error) {
  const message = String(error?.message || error || "Erro inesperado.");
  const hint = message.includes("melhores_")
    ? "A migração inicial do módulo Melhores de Urânia precisa estar executada no Supabase antes de usar este módulo."
    : message;
  $(".awards-view.active").innerHTML = `<div class="awards-error"><strong>Não foi possível carregar o módulo.</strong><p>${escapeHtml(hint)}</p></div>`;
}

async function loadDashboard() {
  setActiveTab("dashboard");
  $("#dashboard-view").innerHTML = '<div class="loading">Carregando visão geral…</div>';
  try {
    const resumo = await obterResumoMelhores();
    const edicao = resumo.edicaoAtiva;
    $("#dashboard-view").innerHTML = `
      <div class="awards-grid">
        ${[
          ["Edições", resumo.edicoes],
          ["Categorias", resumo.categorias],
          ["Indicados", resumo.indicados],
          ["Indicados ativos", resumo.indicadosAtivos],
          ["Indicações pendentes", resumo.indicacoesPendentes]
        ].map(([label, value]) => `<article class="metric-card"><span>${label}</span><strong>${value}</strong></article>`).join("")}
      </div>
      <div class="awards-layout">
        <article class="awards-card">
          <h3>Edição ativa</h3>
          ${edicao ? `
            <div class="awards-name">
              ${edicao.imagem_capa_url ? `<img class="awards-thumb" src="${escapeHtml(edicao.imagem_capa_url)}" alt="">` : '<span class="awards-thumb"></span>'}
              <div>
                <strong>${escapeHtml(edicao.nome)}</strong>
                <small>${escapeHtml(String(edicao.ano))} · <span class="awards-status ${escapeHtml(edicao.status)}">${escapeHtml(edicao.status.replaceAll("_", " "))}</span></small>
              </div>
            </div>
            <div class="awards-kv" style="margin-top:1rem">
              <div><span>Indicações</span><strong>${fmtDate(edicao.indicacoes_inicio)} — ${fmtDate(edicao.indicacoes_fim)}</strong></div>
              <div><span>Votação</span><strong>${fmtDate(edicao.votacao_inicio)} — ${fmtDate(edicao.votacao_fim)}</strong></div>
              <div><span>Pesos</span><strong>Site ${edicao.peso_site}% · Instagram ${edicao.peso_instagram}%</strong></div>
            </div>
          ` : '<div class="awards-empty">Nenhuma edição ativa. Crie uma edição ou altere o status de uma existente.</div>'}
        </article>
        <article class="awards-card">
          <h3>Fase atual</h3>
          <p class="awards-note">
            Fluxo completo ativo: edições, categorias, indicações públicas, indicados,
            votação, Instagram, apuração e resultados oficiais.
          </p>
        </article>
        <article class="awards-card">
          <h3>Estatísticas do Melhores</h3>
          <p class="awards-note">
            Os votos e auditoria ficam nas abas <strong>Votação</strong>, <strong>Apuração</strong> e <strong>Resultados</strong>.
            A audiência pública, como visualizações, cliques, compartilhamentos e abandono de voto, fica em
            <strong>Painel principal &gt; Audiência</strong>.
          </p>
          <div class="awards-actions" style="margin-top:1rem">
            <button type="button" onclick="location.href='index.html#audiencia'">Abrir audiência</button>
            <button type="button" onclick="location.href='melhores.html#votes'">Ver votos</button>
          </div>
        </article>
      </div>`;
  } catch (error) {
    showError(error);
  }
}

async function loadDashboardV2() {
  setActiveTab("dashboard");
  $("#dashboard-view").innerHTML = '<div class="loading">Carregando visão geral…</div>';
  try {
    const [resumo, edicoes, audiencia] = await Promise.all([
      obterResumoMelhores(),
      listarEdicoes(),
      obterAudienciaMelhores({ dias: 7 }).catch(() => null)
    ]);
    state.edicoes = edicoes;
    const edicao = resumo.edicaoAtiva;
    const status = edicao?.status || "";
    const progress = edicao ? phaseProgress(status) : 0;
    const recentes = edicoes.slice(0, 4);
    const tasks = [];

    if (!edicao) {
      tasks.push({ title: "Criar edição ativa", text: "Nenhuma edição em andamento aparece para operação.", action: "Nova edição", tab: "editions", tone: "warning" });
    } else {
      if (!resumo.categorias) tasks.push({ title: "Adicionar categorias", text: "A edição ativa ainda não tem categorias cadastradas.", action: "Abrir categorias", tab: "categories", tone: "warning" });
      if (!resumo.indicadosAtivos) tasks.push({ title: "Cadastrar indicados", text: "Sem indicados ativos para exibir ou votar nesta edição.", action: "Abrir indicados", tab: "nominees", tone: "warning" });
      if (resumo.indicacoesPendentes) tasks.push({ title: "Revisar indicações", text: `${resumo.indicacoesPendentes} indicação${resumo.indicacoesPendentes === 1 ? "" : "ões"} aguardando moderação.`, action: "Moderar", tab: "indications", tone: "attention" });
      if (status === "votacao_encerrada") tasks.push({ title: "Iniciar apuração", text: "A votação foi encerrada e os resultados podem ser revisados.", action: "Apurar", tab: "apuration", tone: "attention" });
      if (status === "apuracao") tasks.push({ title: "Publicar resultado", text: "Revise a apuração e publique o snapshot oficial.", action: "Publicar", tab: "apuration", tone: "attention" });
      if (status === "resultado_publicado") tasks.push({ title: "Preparar exibição", text: "Resultado publicado. Organize a vitrine do app/site se desejar.", action: "Exibição", tab: "app" });
    }
    if (!tasks.length) tasks.push({ title: "Operação em ordem", text: "Nenhuma pendência crítica encontrada na edição ativa.", action: "Ver edição", tab: "editions" });

    const timeline = edicao ? [
      ["Indicações", edicao.indicacoes_inicio, edicao.indicacoes_fim],
      ["Votação", edicao.votacao_inicio, edicao.votacao_fim],
      ["Divulgação", edicao.divulgacao_em || edicao.resultado_publicado_em, ""]
    ].filter(([, start, end]) => start || end) : [];

    $("#dashboard-view").innerHTML = `
      <section class="awards-dashboard-hero">
        <div>
          <p class="eyebrow">Operação do prêmio</p>
          <h2>${escapeHtml(edicao ? edicao.nome : "Melhores de Urânia")}</h2>
          <p>${escapeHtml(edicao ? `Edição ${edicao.ano} em ${phaseLabel(status).toLowerCase()}.` : "Crie ou ative uma edição para iniciar a operação do prêmio.")}</p>
          <div class="awards-phase-track" aria-label="Progresso da edição"><span style="width:${progress}%"></span></div>
        </div>
        <div class="awards-dashboard-status">
          <span class="awards-status ${escapeHtml(status)}">${escapeHtml(statusText(status))}</span>
          <strong>${escapeHtml(phaseLabel(status))}</strong>
          <small>${edicao?.atualizado_em ? `Atualizado ${escapeHtml(dateDistance(edicao.atualizado_em))}` : "Sem edição ativa"}</small>
        </div>
      </section>
      <div class="awards-grid awards-dashboard-metrics">
        ${[
          ["Edições", resumo.edicoes, "Total visível"],
          ["Categorias", resumo.categorias],
          ["Indicados", resumo.indicados],
          ["Indicados ativos", resumo.indicadosAtivos],
          ["Indicações pendentes", resumo.indicacoesPendentes],
          ["Views 7 dias", audiencia?.views ?? "—"],
          ["Inícios de voto", audiencia?.voteStart ?? "—"],
          ["Conclusão de voto", audiencia ? `${audiencia.completionRate}%` : "—"]
        ].map(([label, value, hint]) => `<article class="metric-card"><span>${label}</span><strong>${value}</strong>${hint ? `<small>${escapeHtml(hint)}</small>` : ""}</article>`).join("")}
      </div>
      <div class="awards-dashboard-layout">
        <article class="awards-card awards-dashboard-main">
          <div class="awards-panel-head">
            <div><h3>Edição ativa</h3><p>Resumo da configuração principal da edição em andamento.</p></div>
            <div class="awards-actions">
              <button type="button" data-dashboard-tab="editions">Editar edição</button>
              <button type="button" data-dashboard-tab="settings">Checklist</button>
            </div>
          </div>
          ${edicao ? `
            <div class="awards-name">
              ${edicao.imagem_capa_url ? `<img class="awards-thumb" src="${escapeHtml(edicao.imagem_capa_url)}" alt="">` : '<span class="awards-thumb"></span>'}
              <div>
                <strong>${escapeHtml(edicao.nome)}</strong>
                <small>${escapeHtml(String(edicao.ano))} · <span class="awards-status ${escapeHtml(edicao.status)}">${escapeHtml(statusText(edicao.status))}</span></small>
              </div>
            </div>
            <div class="awards-kv awards-dashboard-kv" style="margin-top:1rem">
              <div><span>Indicações</span><strong>${fmtDate(edicao.indicacoes_inicio)} — ${fmtDate(edicao.indicacoes_fim)}</strong></div>
              <div><span>Votação</span><strong>${fmtDate(edicao.votacao_inicio)} — ${fmtDate(edicao.votacao_fim)}</strong></div>
              <div><span>Pesos</span><strong>Site ${edicao.peso_site}% · Instagram ${edicao.peso_instagram}%</strong></div>
              <div><span>Retenção de votos</span><strong>7 dias após encerramento</strong></div>
            </div>
          ` : '<div class="awards-empty">Nenhuma edição ativa. Crie uma edição ou altere o status de uma existente.</div>'}
        </article>
        <article class="awards-card awards-dashboard-side">
          <h3>Próximas ações</h3>
          <div class="awards-dashboard-tasks">${tasks.map(dashboardTask).join("")}</div>
        </article>
      </div>
      <div class="awards-dashboard-layout compact">
        <article class="awards-card">
          <h3>Linha do tempo</h3>
          <div class="awards-dashboard-rows">
            ${timeline.length ? timeline.map(([label, start, end]) => dashboardListRow({
              title: label,
              detail: `${start ? fmtDate(start) : "início a definir"}${end ? ` até ${fmtDate(end)}` : ""}`,
              badge: dateDistance(end || start)
            })).join("") : '<div class="awards-empty">Defina datas de indicação, votação e divulgação.</div>'}
          </div>
        </article>
        <article class="awards-card">
          <h3>Últimas edições</h3>
          <div class="awards-dashboard-rows">
            ${recentes.length ? recentes.map(item => dashboardListRow({
              title: item.nome || `Melhores ${item.ano}`,
              detail: `${item.ano} · atualizado em ${fmtDate(item.atualizado_em)}`,
              badge: statusText(item.status),
              tab: "editions"
            })).join("") : '<div class="awards-empty">Nenhuma edição cadastrada.</div>'}
          </div>
        </article>
        <article class="awards-card">
          <h3>Audiência rápida</h3>
          <div class="awards-dashboard-audience">
            ${audiencia ? `
              <div><span>Eventos</span><strong>${audiencia.total}</strong></div>
              <div><span>Visualizações</span><strong>${audiencia.views}</strong></div>
              <div><span>Compartilhamentos</span><strong>${audiencia.shares}</strong></div>
              <button type="button" class="admin-button secondary" data-open-audience>Abrir audiência completa</button>
            ` : '<div class="awards-empty">Audiência indisponível no momento.</div>'}
          </div>
        </article>
      </div>`;
  } catch (error) {
    showError(error);
  }
}

async function loadEditions() {
  setActiveTab("editions");
  $("#editions-view").innerHTML = '<div class="loading">Carregando edições…</div>';
  try {
    state.edicoes = await listarEdicoes();
    $("#editions-view").innerHTML = `
      <article class="awards-card">
        <div class="awards-panel-head">
          <div><h3>Edições</h3><p>Crie uma edição por ano e configure períodos, pesos e regulamento.</p></div>
          <button class="admin-button" data-new-edition>Nova edição</button>
        </div>
        <div class="awards-table-wrap">
          <table class="awards-table">
            <thead><tr><th>Edição</th><th>Status</th><th>Votação</th><th>Pesos</th><th>Ações</th></tr></thead>
            <tbody>${state.edicoes.length ? state.edicoes.map(editionRow).join("") : '<tr><td colspan="5"><div class="awards-empty">Nenhuma edição cadastrada.</div></td></tr>'}</tbody>
          </table>
        </div>
      </article>`;
  } catch (error) {
    showError(error);
  }
}

function editionRow(item) {
  return `<tr>
    <td><div class="awards-name">${item.imagem_capa_url ? `<img class="awards-thumb" src="${escapeHtml(item.imagem_capa_url)}" alt="">` : '<span class="awards-thumb"></span>'}<div><strong>${escapeHtml(item.nome)}</strong><small>${escapeHtml(item.slug)} · ${item.ano}</small></div></div></td>
    <td><span class="awards-status ${escapeHtml(item.status)}">${escapeHtml(item.status.replaceAll("_", " "))}</span></td>
    <td>${fmtDate(item.votacao_inicio)}<br><small>${fmtDate(item.votacao_fim)}</small></td>
    <td>Site ${item.peso_site}%<br><small>Instagram ${item.peso_instagram}%</small></td>
    <td><div class="awards-actions"><button data-edit-edition="${item.id}">Editar</button><button class="danger" data-delete-edition="${item.id}">Excluir</button></div></td>
  </tr>`;
}

async function loadCategories() {
  setActiveTab("categories");
  $("#categories-view").innerHTML = '<div class="loading">Carregando categorias…</div>';
  try {
    if (!state.edicoes.length) state.edicoes = await listarEdicoes();
    const selected = $("#category-edition-filter")?.value || state.edicoes[0]?.id || "";
    state.categorias = await listarCategorias(selected);
    $("#categories-view").innerHTML = `
      <article class="awards-card">
        <div class="awards-panel-head">
          <div><h3>Categorias</h3><p>As categorias não ficam fixas no código: tudo é administrável por edição.</p></div>
          <div class="awards-actions">
            <button class="admin-button secondary" data-copy-categories="${escapeHtml(selected)}" ${selected ? "" : "disabled"}>Copiar de outra edição</button>
            <button class="admin-button" data-new-category>Nova categoria</button>
          </div>
        </div>
        <div class="awards-toolbar">
          <input id="category-search" type="search" placeholder="Pesquisar categoria…">
          <select id="category-edition-filter">${state.edicoes.map(e => `<option value="${e.id}" ${e.id === selected ? "selected" : ""}>${e.ano} · ${escapeHtml(e.nome)}</option>`).join("")}</select>
          <select id="category-status-filter"><option value="">Todos os status</option>${optionList(categoryStatuses, "")}</select>
          <button class="admin-button secondary" data-refresh-categories>Atualizar</button>
        </div>
        <div class="awards-table-wrap">
          <table class="awards-table">
            <thead><tr><th>Categoria</th><th>Status</th><th>Ordem</th><th>Regras</th><th>Ações</th></tr></thead>
            <tbody id="category-rows">${state.categorias.length ? state.categorias.map(categoryRow).join("") : '<tr><td colspan="5"><div class="awards-empty">Nenhuma categoria nesta edição.</div></td></tr>'}</tbody>
          </table>
        </div>
      </article>`;
    bindFilter("category");
  } catch (error) {
    showError(error);
  }
}

function categoryRow(item) {
  return `<tr data-search="${escapeHtml(`${item.nome} ${item.slug}`.toLowerCase())}" data-status="${escapeHtml(item.status)}">
    <td><div class="awards-name">${item.imagem_url ? `<img class="awards-thumb" src="${escapeHtml(item.imagem_url)}" alt="">` : '<span class="awards-thumb"></span>'}<div><strong>${escapeHtml(item.nome)}</strong><small>${escapeHtml(item.slug)}</small></div></div></td>
    <td><span class="awards-status ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span></td>
    <td>${Number(item.ordem || 0)}</td>
    <td><small>${item.permite_multiplos_votos ? `${item.max_escolhas} escolhas` : "1 voto"} · ${item.permite_indicacao_publica ? "indicação pública" : "sem indicação pública"}</small></td>
    <td><div class="awards-actions"><button data-edit-category="${item.id}">Editar</button><button class="danger" data-delete-category="${item.id}">Excluir</button></div></td>
  </tr>`;
}

async function loadIndications() {
  setActiveTab("indications");
  $("#indications-view").innerHTML = '<div class="loading">Carregando indicações…</div>';
  try {
    if (!state.edicoes.length) state.edicoes = await listarEdicoes();
    const edicaoId = $("#indication-edition-filter")?.value || state.edicoes[0]?.id || "";
    const status = $("#indication-status-filter")?.value || "";
    state.indicacoes = await listarIndicacoes({ edicaoId, status });
    $("#indications-view").innerHTML = `
      <article class="awards-card">
        <div class="awards-panel-head">
          <div><h3>Indicações públicas</h3><p>Analise sugestões enviadas pela comunidade antes de transformar em indicado oficial.</p></div>
        </div>
        <div class="awards-toolbar">
          <input id="indication-search" type="search" placeholder="Pesquisar indicação…">
          <select id="indication-edition-filter">${state.edicoes.map(e => `<option value="${e.id}" ${e.id === edicaoId ? "selected" : ""}>${e.ano} · ${escapeHtml(e.nome)}</option>`).join("")}</select>
          <select id="indication-status-filter"><option value="">Todos os status</option>${optionList(indicationStatuses, status)}</select>
          <button class="admin-button secondary" data-refresh-indications>Atualizar</button>
        </div>
        <div class="awards-table-wrap">
          <table class="awards-table">
            <thead><tr><th>Indicação</th><th>Categoria</th><th>Responsável</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody id="indication-rows">${state.indicacoes.length ? state.indicacoes.map(indicationRow).join("") : '<tr><td colspan="5"><div class="awards-empty">Nenhuma indicação encontrada.</div></td></tr>'}</tbody>
          </table>
        </div>
      </article>`;
    bindSimpleSearch("indication", "indication-rows");
  } catch (error) {
    showError(error);
  }
}

function indicationRow(item) {
  return `<tr data-search="${escapeHtml(`${item.nome_indicado} ${item.justificativa || ""} ${item.nome_responsavel || ""} ${item.melhores_categorias?.nome || ""}`.toLowerCase())}" data-status="${escapeHtml(item.status)}">
    <td><strong>${escapeHtml(item.nome_indicado)}</strong><br><small>${escapeHtml((item.justificativa || "Sem justificativa").slice(0, 180))}</small>${item.contato_indicado ? `<br><small>Contato indicado: ${escapeHtml(item.contato_indicado)}</small>` : ""}</td>
    <td>${escapeHtml(item.melhores_categorias?.nome || "Categoria")}</td>
    <td>${escapeHtml(item.nome_responsavel || "Não informado")}<br><small>${escapeHtml(item.contato_responsavel || "Sem contato")} · ${fmtDate(item.criado_em)}</small></td>
    <td><span class="awards-status ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>${item.melhores_indicados?.nome ? `<br><small>Gerou: ${escapeHtml(item.melhores_indicados.nome)}</small>` : ""}</td>
    <td><div class="awards-actions">
      <button data-convert-indication="${item.id}">Converter</button>
      <button data-approve-indication="${item.id}">Aprovar</button>
      <button data-reject-indication="${item.id}">Rejeitar</button>
      <button data-duplicate-indication="${item.id}">Duplicada</button>
      <button class="danger" data-spam-indication="${item.id}">Spam</button>
      <button class="danger" data-delete-indication="${item.id}">Excluir</button>
    </div></td>
  </tr>`;
}

async function updateIndicationStatus(id, status) {
  const note = ["rejeitada", "duplicada", "spam"].includes(status)
    ? prompt("Observação interna da moderação:", status === "rejeitada" ? "Não atende aos critérios da edição." : "")
    : "";
  if (note === null) return;
  await moderarIndicacao(id, { status, observacao_interna: note || null });
  toast("Indicação atualizada.");
  state.indicacoes = [];
  await loadIndications();
}

async function convertIndication(id) {
  const item = state.indicacoes.find(indicacao => indicacao.id === id);
  if (!item) return toast("Indicação não encontrada.", "error");
  if (!confirm(`Converter "${item.nome_indicado}" em indicado oficial?`)) return;
  const slugBase = gerarSlug(item.nome_indicado || "indicado");
  const nominee = await salvarIndicado({
    edicao_id: item.edicao_id,
    categoria_id: item.categoria_id,
    nome: item.nome_indicado,
    slug: `${slugBase}-${String(Date.now()).slice(-5)}`,
    status: "rascunho",
    ordem: 0,
    descricao_curta: item.justificativa || null,
    observacao_interna: `Criado a partir da indicação pública ${item.id}. Responsável: ${item.nome_responsavel || "não informado"} (${item.contato_responsavel || "sem contato"}).`,
    aprovado: false,
    consentimento: false
  });
  await moderarIndicacao(item.id, {
    status: "convertida",
    indicado_gerado_id: nominee.id,
    observacao_interna: "Convertida em indicado oficial em rascunho. Revise consentimento, imagem e dados antes de publicar."
  });
  toast("Indicação convertida em indicado rascunho.");
  state.indicacoes = [];
  state.indicados = [];
  await loadIndications();
}

async function loadNominees() {
  setActiveTab("nominees");
  $("#nominees-view").innerHTML = '<div class="loading">Carregando indicados…</div>';
  try {
    if (!state.edicoes.length) state.edicoes = await listarEdicoes();
    const edicaoId = $("#nominee-edition-filter")?.value || state.edicoes[0]?.id || "";
    if (!state.categorias.length || !state.categorias.some(c => c.edicao_id === edicaoId)) state.categorias = await listarCategorias(edicaoId);
    const categoriaId = $("#nominee-category-filter")?.value || "";
    state.indicados = await listarIndicados({ edicaoId, categoriaId });
    $("#nominees-view").innerHTML = `
      <article class="awards-card">
        <div class="awards-panel-head">
          <div><h3>Indicados</h3><p>Cadastre manualmente ou vincule a uma empresa já existente no Guia Comercial.</p></div>
          <button class="admin-button" data-new-nominee>Novo indicado</button>
        </div>
        <div class="awards-toolbar">
          <input id="nominee-search" type="search" placeholder="Pesquisar indicado…">
          <select id="nominee-edition-filter">${state.edicoes.map(e => `<option value="${e.id}" ${e.id === edicaoId ? "selected" : ""}>${e.ano} · ${escapeHtml(e.nome)}</option>`).join("")}</select>
          <select id="nominee-category-filter"><option value="">Todas as categorias</option>${state.categorias.map(c => `<option value="${c.id}" ${c.id === categoriaId ? "selected" : ""}>${escapeHtml(c.nome)}</option>`).join("")}</select>
          <button class="admin-button secondary" data-refresh-nominees>Atualizar</button>
        </div>
        <div class="awards-table-wrap">
          <table class="awards-table">
            <thead><tr><th>Indicado</th><th>Status</th><th>Categoria</th><th>Guia</th><th>Ações</th></tr></thead>
            <tbody id="nominee-rows">${state.indicados.length ? state.indicados.map(nomineeRow).join("") : '<tr><td colspan="5"><div class="awards-empty">Nenhum indicado cadastrado.</div></td></tr>'}</tbody>
          </table>
        </div>
      </article>`;
    bindFilter("nominee");
  } catch (error) {
    showError(error);
  }
}

function nomineeRow(item) {
  return `<tr data-search="${escapeHtml(`${item.nome} ${item.slug} ${item.melhores_categorias?.nome || ""}`.toLowerCase())}" data-status="${escapeHtml(item.status)}">
    <td><div class="awards-name">${item.imagem_url ? `<img class="awards-thumb" src="${escapeHtml(item.imagem_url)}" alt="">` : '<span class="awards-thumb"></span>'}<div><strong>${escapeHtml(item.nome)}</strong><small>${escapeHtml(item.slug)} ${item.aprovado ? "· aprovado" : ""}</small></div></div></td>
    <td><span class="awards-status ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span></td>
    <td>${escapeHtml(item.melhores_categorias?.nome || "Sem categoria")}</td>
    <td>${item.guia_comercial?.nome ? escapeHtml(item.guia_comercial.nome) : "—"}</td>
    <td><div class="awards-actions"><button data-edit-nominee="${item.id}">Editar</button><button class="danger" data-delete-nominee="${item.id}">Excluir</button></div></td>
  </tr>`;
}

async function loadVotes() {
  setActiveTab("votes");
  $("#votes-view").innerHTML = '<div class="loading">Carregando votos…</div>';
  try {
    if (!state.edicoes.length) state.edicoes = await listarEdicoes();
    const edicaoId = $("#votes-edition-filter")?.value || state.edicoes[0]?.id || "";
    const status = $("#votes-status-filter")?.value || "";
    state.votos = await listarVotos({ edicaoId, status });
    const totals = voteStatuses.map(s => [s, state.votos.filter(v => v.status === s).length]);
    $("#votes-view").innerHTML = `
      <article class="awards-card">
        <div class="awards-panel-head">
          <div><h3>Votação</h3><p>Acompanhe votos individuais enquanto estiverem dentro do período de auditoria. Dados pessoais não são exibidos.</p></div>
          <button class="admin-button secondary" data-manual-cleanup-votes>Limpeza manual Super Admin</button>
        </div>
        <div class="awards-grid">${totals.map(([label, value]) => `<article class="metric-card"><span>${label}</span><strong>${value}</strong></article>`).join("")}</div>
        <div class="awards-toolbar" style="margin-top:1rem">
          <input id="votes-search" type="search" placeholder="Pesquisar voto…">
          <select id="votes-edition-filter">${state.edicoes.map(e => `<option value="${e.id}" ${e.id === edicaoId ? "selected" : ""}>${e.ano} · ${escapeHtml(e.nome)}</option>`).join("")}</select>
          <select id="votes-status-filter"><option value="">Todos os status</option>${optionList(voteStatuses, status)}</select>
          <button class="admin-button secondary" data-refresh-votes>Atualizar</button>
        </div>
        <div class="awards-table-wrap">
          <table class="awards-table">
            <thead><tr><th>Voto</th><th>Categoria</th><th>Indicado</th><th>Status</th><th>Data</th></tr></thead>
            <tbody id="votes-rows">${state.votos.length ? state.votos.map(voteRow).join("") : '<tr><td colspan="5"><div class="awards-empty">Nenhum voto encontrado.</div></td></tr>'}</tbody>
          </table>
        </div>
      </article>`;
    bindSimpleSearch("votes", "votes-rows");
  } catch (error) {
    showError(error);
  }
}

function voteRow(item) {
  return `<tr data-search="${escapeHtml(`${item.id} ${item.melhores_categorias?.nome || ""} ${item.melhores_indicados?.nome || ""} ${item.status}`.toLowerCase())}">
    <td><strong>${escapeHtml(item.id.slice(0, 8))}</strong><br><small>${escapeHtml(item.origem || "site")}</small></td>
    <td>${escapeHtml(item.melhores_categorias?.nome || "Categoria")}</td>
    <td>${escapeHtml(item.melhores_indicados?.nome || "Indicado")}</td>
    <td><span class="awards-status ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>${item.motivo_bloqueio ? `<br><small>${escapeHtml(item.motivo_bloqueio)}</small>` : ""}</td>
    <td>${fmtDate(item.criado_em)}</td>
  </tr>`;
}

async function loadInstagram() {
  setActiveTab("instagram");
  $("#instagram-view").innerHTML = '<div class="loading">Carregando votos do Instagram…</div>';
  try {
    if (!state.edicoes.length) state.edicoes = await listarEdicoes();
    const edicaoId = $("#instagram-edition-filter")?.value || state.edicoes[0]?.id || "";
    if (!state.categorias.length || !state.categorias.some(c => c.edicao_id === edicaoId)) state.categorias = await listarCategorias(edicaoId);
    state.indicados = await listarIndicados({ edicaoId });
    state.instagram = await listarInstagramVotos(edicaoId);
    $("#instagram-view").innerHTML = `
      <article class="awards-card">
        <div class="awards-panel-head">
          <div><h3>Votos do Instagram</h3><p>Lance manualmente os votos coletados nas enquetes. O sistema normaliza por percentual na apuração.</p></div>
          <button class="admin-button" data-new-instagram>Adicionar votos</button>
        </div>
        <div class="awards-toolbar">
          <input id="instagram-search" type="search" placeholder="Pesquisar indicado ou categoria…">
          <select id="instagram-edition-filter">${state.edicoes.map(e => `<option value="${e.id}" ${e.id === edicaoId ? "selected" : ""}>${e.ano} · ${escapeHtml(e.nome)}</option>`).join("")}</select>
          <select id="instagram-category-filter"><option value="">Todas as categorias</option>${state.categorias.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join("")}</select>
          <button class="admin-button secondary" data-refresh-instagram>Atualizar</button>
        </div>
        <div class="awards-table-wrap">
          <table class="awards-table">
            <thead><tr><th>Indicado</th><th>Categoria</th><th>Votos</th><th>Coleta</th><th>Ações</th></tr></thead>
            <tbody id="instagram-rows">${state.instagram.length ? state.instagram.map(instagramRow).join("") : '<tr><td colspan="5"><div class="awards-empty">Nenhum voto do Instagram lançado.</div></td></tr>'}</tbody>
          </table>
        </div>
      </article>`;
    bindSimpleSearch("instagram", "instagram-rows");
  } catch (error) {
    showError(error);
  }
}

function instagramRow(item) {
  return `<tr data-search="${escapeHtml(`${item.melhores_indicados?.nome || ""} ${item.melhores_categorias?.nome || ""}`.toLowerCase())}" data-category="${escapeHtml(item.categoria_id)}">
    <td><strong>${escapeHtml(item.melhores_indicados?.nome || "Indicado")}</strong>${item.comprovante_url ? `<br><small><a class="awards-link" href="${escapeHtml(item.comprovante_url)}" target="_blank" rel="noopener">Ver comprovante</a></small>` : ""}</td>
    <td>${escapeHtml(item.melhores_categorias?.nome || "Categoria")}</td>
    <td><strong>${Number(item.votos || 0).toLocaleString("pt-BR")}</strong></td>
    <td>${fmtDate(item.coletado_em)}</td>
    <td><div class="awards-actions"><button data-edit-instagram="${item.id}">Editar</button><button class="danger" data-delete-instagram="${item.id}">Excluir</button></div></td>
  </tr>`;
}

async function loadApuration() {
  setActiveTab("apuration");
  $("#apuration-view").innerHTML = '<div class="loading">Calculando apuração…</div>';
  try {
    if (!state.edicoes.length) state.edicoes = await listarEdicoes();
    const edicaoId = $("#apuration-edition-filter")?.value || state.edicoes[0]?.id || "";
    state.apuracao = edicaoId ? await obterApuracao(edicaoId) : [];
    const grouped = groupBy(state.apuracao, "categoria_id");
    $("#apuration-view").innerHTML = `
      <article class="awards-card">
        <div class="awards-panel-head">
          <div><h3>Apuração</h3><p>Prévia ponderada por percentuais: site e Instagram são normalizados antes de aplicar os pesos.</p></div>
        </div>
        <div class="awards-toolbar">
          <input id="apuration-search" type="search" placeholder="Pesquisar categoria ou indicado…">
          <select id="apuration-edition-filter">${state.edicoes.map(e => `<option value="${e.id}" ${e.id === edicaoId ? "selected" : ""}>${e.ano} · ${escapeHtml(e.nome)}</option>`).join("")}</select>
          <button class="admin-button secondary" data-refresh-apuration>Atualizar</button>
          <button class="admin-button" data-publish-results>Revisar e publicar resultado</button>
        </div>
        ${state.apuracao.length ? [...grouped.entries()].map(([categoriaId, rows]) => apurationGroup(categoriaId, rows)).join("") : '<div class="awards-empty">Sem dados suficientes para apuração.</div>'}
      </article>`;
    bindSimpleSearch("apuration", "apuration-view");
  } catch (error) {
    showError(error);
  }
}

function apurationGroup(_categoriaId, rows) {
  const title = rows[0]?.categoria_nome || "Categoria";
  return `<section class="awards-apuration-group" data-search="${escapeHtml(rows.map(r => `${r.categoria_nome} ${r.indicado_nome}`).join(" ").toLowerCase())}">
    <h4>${escapeHtml(title)}</h4>
    <div class="awards-table-wrap">
      <table class="awards-table">
        <thead><tr><th>Colocação</th><th>Indicado</th><th>Site</th><th>Instagram</th><th>Pontuação</th><th>Observação</th></tr></thead>
        <tbody>${rows.map(row => `<tr>
          <td><strong>${Number(row.colocacao || 0)}º</strong></td>
          <td>${escapeHtml(row.indicado_nome)}</td>
          <td>${Number(row.votos_site || 0).toLocaleString("pt-BR")} <small>(${Number(row.percentual_site || 0).toFixed(2)}%)</small></td>
          <td>${Number(row.votos_instagram || 0).toLocaleString("pt-BR")} <small>(${Number(row.percentual_instagram || 0).toFixed(2)}%)</small></td>
          <td><strong>${Number(row.pontuacao_final || 0).toFixed(4)}</strong></td>
          <td>${row.empate ? '<span class="awards-status planejamento">empate</span>' : row.colocacao === 1 ? '<span class="awards-status ativo">vencedor prévio</span>' : ""}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>
  </section>`;
}

async function loadResults() {
  setActiveTab("results");
  $("#results-view").innerHTML = '<div class="loading">Carregando resultados…</div>';
  try {
    if (!state.edicoes.length) state.edicoes = await listarEdicoes();
    const edicaoId = $("#results-edition-filter")?.value || state.edicoes[0]?.id || "";
    state.resultados = edicaoId ? await listarResultados(edicaoId) : [];
    const grouped = groupBy(state.resultados, "categoria_id");
    $("#results-view").innerHTML = `
      <article class="awards-card">
        <div class="awards-panel-head">
          <div><h3>Resultados oficiais</h3><p>Snapshot publicado da edição. Estes dados não são recalculados automaticamente.</p></div>
        </div>
        <div class="awards-toolbar">
          <input id="results-search" type="search" placeholder="Pesquisar resultado…">
          <select id="results-edition-filter">${state.edicoes.map(e => `<option value="${e.id}" ${e.id === edicaoId ? "selected" : ""}>${e.ano} · ${escapeHtml(e.nome)}</option>`).join("")}</select>
          <button class="admin-button secondary" data-refresh-results>Atualizar</button>
        </div>
        ${state.resultados.length ? [...grouped.entries()].map(([, rows]) => resultGroup(rows)).join("") : '<div class="awards-empty">Nenhum resultado oficial publicado ainda.</div>'}
      </article>`;
    bindSimpleSearch("results", "results-view");
  } catch (error) {
    showError(error);
  }
}

function audienceRank(title, rows, labelKey = "label") {
  return `<article class="awards-card"><h3>${escapeHtml(title)}</h3><div class="awards-kv">${
    rows.length
      ? rows.map(item => `<div><span>${escapeHtml(item[labelKey] || "Não informado")}</span><strong>${item.total}</strong></div>`).join("")
      : '<div><span>Nenhum dado no período</span><strong>0</strong></div>'
  }</div></article>`;
}

async function loadAudience() {
  setActiveTab("audience");
  $("#audience-view").innerHTML = '<div class="loading">Carregando audiência do Melhores…</div>';
  try {
    if (!state.edicoes.length) state.edicoes = await listarEdicoes();
    const edicaoId = $("#audience-edition-filter")?.value || state.edicoes[0]?.id || "";
    const dias = $("#audience-period-filter")?.value || "30";
    const data = await obterAudienciaMelhores({ edicaoId, dias });
    $("#audience-view").innerHTML = `
      <article class="awards-card">
        <div class="awards-panel-head">
          <div><h3>Audiência do Melhores de Urânia</h3><p>Dados próprios do módulo: visualizações, intenção de voto, conclusão, origem, dispositivo e páginas mais acessadas.</p></div>
        </div>
        <div class="awards-toolbar">
          <input type="search" value="" placeholder="Dados automáticos do prêmio" disabled>
          <select id="audience-edition-filter">${state.edicoes.map(e => `<option value="${e.id}" ${e.id === edicaoId ? "selected" : ""}>${e.ano} · ${escapeHtml(e.nome)}</option>`).join("")}</select>
          <select id="audience-period-filter"><option value="7" ${dias === "7" ? "selected" : ""}>Últimos 7 dias</option><option value="30" ${dias === "30" ? "selected" : ""}>Últimos 30 dias</option><option value="90" ${dias === "90" ? "selected" : ""}>Últimos 90 dias</option></select>
          <button class="admin-button secondary" data-refresh-audience>Atualizar</button>
        </div>
        <div class="awards-grid">
          ${[
            ["Eventos registrados", data.total],
            ["Visualizações", data.views],
            ["Inícios de voto", data.voteStart],
            ["Votos concluídos", data.voteComplete],
            ["Taxa de conclusão", `${data.completionRate}%`],
            ["Compartilhamentos", data.shares],
            ["Cliques em CTAs", data.ctas],
            ["Indicações enviadas", data.indications]
          ].map(([label, value]) => `<article class="metric-card"><span>${label}</span><strong>${value}</strong></article>`).join("")}
        </div>
      </article>
      <div class="awards-layout">
        ${audienceRank("Acessos por dispositivo", data.byDevice)}
        ${audienceRank("Origem dos acessos", data.byOrigin)}
      </div>
      <div class="awards-layout">
        ${audienceRank("Páginas mais acessadas", data.pages, "pagina")}
        ${audienceRank("Acessos por dia", data.daily, "dia")}
      </div>`;
  } catch (error) {
    showError(error);
  }
}

async function loadAudit() {
  setActiveTab("audit");
  $("#audit-view").innerHTML = '<div class="loading">Carregando auditoria…</div>';
  try {
    if (!state.edicoes.length) state.edicoes = await listarEdicoes();
    const edicaoId = $("#audit-edition-filter")?.value || state.edicoes[0]?.id || "";
    state.auditoria = await listarAuditoria(edicaoId);
    $("#audit-view").innerHTML = `
      <article class="awards-card">
        <div class="awards-panel-head">
          <div><h3>Auditoria</h3><p>Histórico interno de mudanças, moderação, apuração, publicação e limpeza de votos.</p></div>
        </div>
        <div class="awards-toolbar">
          <input id="audit-search" type="search" placeholder="Pesquisar auditoria…">
          <select id="audit-edition-filter">${state.edicoes.map(e => `<option value="${e.id}" ${e.id === edicaoId ? "selected" : ""}>${e.ano} · ${escapeHtml(e.nome)}</option>`).join("")}</select>
          <button class="admin-button secondary" data-refresh-audit>Atualizar</button>
        </div>
        <div class="awards-table-wrap">
          <table class="awards-table">
            <thead><tr><th>Ação</th><th>Entidade</th><th>Usuário</th><th>Data</th><th>Resumo</th></tr></thead>
            <tbody id="audit-rows">${state.auditoria.length ? state.auditoria.map(auditRow).join("") : '<tr><td colspan="5"><div class="awards-empty">Nenhum registro de auditoria.</div></td></tr>'}</tbody>
          </table>
        </div>
      </article>`;
    bindSimpleSearch("audit", "audit-rows");
  } catch (error) {
    showError(error);
  }
}

function auditRow(item) {
  const resumo = JSON.stringify(item.valores_posteriores || item.valores_anteriores || {}).slice(0, 180);
  return `<tr data-search="${escapeHtml(`${item.acao} ${item.entidade} ${resumo}`.toLowerCase())}">
    <td><strong>${escapeHtml(item.acao)}</strong></td>
    <td>${escapeHtml(item.entidade)}<br><small>${escapeHtml(item.entidade_id || "")}</small></td>
    <td>${escapeHtml(item.usuario_id || "sistema")}</td>
    <td>${fmtDate(item.criado_em)}</td>
    <td><small>${escapeHtml(resumo || "Sem detalhes")}</small></td>
  </tr>`;
}

async function loadSettings() {
  setActiveTab("settings");
  $("#settings-view").innerHTML = '<div class="loading">Carregando configurações…</div>';
  try {
    if (!state.edicoes.length) state.edicoes = await listarEdicoes();
    const rows = state.edicoes;
    $("#settings-view").innerHTML = `
      <article class="awards-card">
        <div class="awards-panel-head">
          <div><h3>Configurações e operação</h3><p>Checklist operacional por edição. Ajustes finos continuam na aba Edições.</p></div>
        </div>
        <div class="awards-table-wrap">
          <table class="awards-table">
            <thead><tr><th>Edição</th><th>Pesos</th><th>Indicações</th><th>Votação</th><th>Retenção</th></tr></thead>
            <tbody>${rows.length ? rows.map(settingsRow).join("") : '<tr><td colspan="5"><div class="awards-empty">Nenhuma edição cadastrada.</div></td></tr>'}</tbody>
          </table>
        </div>
        <p class="awards-note" style="margin-top:1rem">Subdomínio <strong>melhores.euamourania.com.br</strong> redireciona (301) para <strong>euamourania.com.br/melhores-de-urania/</strong>. Mantenha o domínio na Vercel e o CNAME no DNS para as artes e links antigos continuarem funcionando.</p>
      </article>`;
  } catch (error) {
    showError(error);
  }
}

function settingsRow(item) {
  return `<tr>
    <td><strong>${escapeHtml(item.nome)}</strong><br><small>${item.ano} · ${escapeHtml(item.status)}</small></td>
    <td>Site ${Number(item.peso_site || 0)}%<br><small>Instagram ${Number(item.peso_instagram || 0)}%</small></td>
    <td>${fmtDate(item.indicacoes_inicio)}<br><small>${fmtDate(item.indicacoes_fim)}</small></td>
    <td>${fmtDate(item.votacao_inicio)}<br><small>${fmtDate(item.votacao_fim)}</small></td>
    <td>${item.votos_individuais_limpos_em ? `Limpos em ${fmtDate(item.votos_individuais_limpos_em)}` : "7 dias após publicação oficial"}</td>
  </tr>`;
}

function resultGroup(rows) {
  const title = rows[0]?.melhores_categorias?.nome || "Categoria";
  return `<section class="awards-apuration-group" data-search="${escapeHtml(rows.map(r => `${title} ${r.melhores_indicados?.nome || ""}`).join(" ").toLowerCase())}">
    <h4>${escapeHtml(title)}</h4>
    <div class="awards-table-wrap">
      <table class="awards-table">
        <thead><tr><th>Colocação</th><th>Indicado</th><th>Selo</th><th>Pontuação</th><th>Publicado</th></tr></thead>
        <tbody>${rows.map(row => `<tr>
          <td><strong>${Number(row.colocacao || 0)}º</strong></td>
          <td>${escapeHtml(row.melhores_indicados?.nome || "Indicado")}</td>
          <td><span class="awards-status ${row.vencedor ? "ativo" : ""}">${escapeHtml(row.selo || "indicado")}</span></td>
          <td>${Number(row.pontuacao_final || 0).toFixed(4)}</td>
          <td>${fmtDate(row.publicado_em)}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>
  </section>`;
}

function appStatus(campaign) {
  if (!campaign) return "rascunho";
  if (campaign.status === "arquivada") return "arquivada";
  const now = Date.now();
  const start = campaign.exibir_inicio ? new Date(campaign.exibir_inicio).getTime() : null;
  const end = campaign.exibir_fim ? new Date(campaign.exibir_fim).getTime() : null;
  if (!campaign.ativo) return campaign.status || "inativa";
  if (start && start > now) return "agendada";
  if (end && end < now) return "encerrada";
  return "ativa";
}

function appInconsistencias(campaign, winners, categories = []) {
  const alerts = [];
  if (!campaign?.edicao_id) alerts.push("Edição não vinculada.");
  if (!campaign?.exibir_inicio || !campaign?.exibir_fim) alerts.push("Período de exibição incompleto.");
  if (campaign?.exibir_inicio && campaign?.exibir_fim && new Date(campaign.exibir_inicio) >= new Date(campaign.exibir_fim)) alerts.push("Data final precisa ser posterior ao início.");
  if (campaign?.melhores_edicoes?.status !== "resultado_publicado") alerts.push("Edição ainda não está com resultado oficialmente publicado.");
  if (!winners.length) alerts.push("Nenhum vencedor cadastrado/importado.");
  const activeWinners = winners.filter(winner => winner.status === "ativo");
  const byCategory = activeWinners.reduce((acc, winner) => {
    acc[winner.categoria_id] = (acc[winner.categoria_id] || 0) + 1;
    return acc;
  }, {});
  if (activeWinners.some(winner => !winner.categoria_id)) alerts.push("Há vencedor ativo sem categoria.");
  if (Object.values(byCategory).some(total => total > 1)) alerts.push("Há duplicidade de vencedor na mesma categoria.");
  const winnerCategories = new Set(activeWinners.map(winner => winner.categoria_id).filter(Boolean));
  const missingCategories = categories.filter(category => category.status === "ativo" && !winnerCategories.has(category.id));
  return { alerts, missingCategories };
}

async function loadAppDisplay() {
  setActiveTab("app");
  $("#app-view").innerHTML = '<div class="loading">Carregando exibição no aplicativo…</div>';
  try {
    if (!state.edicoes.length) state.edicoes = await listarEdicoes();
    state.appCampanhas = await listarCampanhasApp();
    const selectedId = $("#app-campaign-filter")?.value || state.appCampanhas[0]?.id || "";
    const selected = selectedId ? state.appCampanhas.find(item => item.id === selectedId) || await obterCampanhaApp(selectedId) : null;
    state.appVencedores = selected?.id ? await listarVencedoresApp(selected.id) : [];
    const categories = selected?.edicao_id ? await listarCategorias(selected.edicao_id) : [];
    const officialPreview = selected?.edicao_id ? await listarResultadosPublicadosEdicao(selected.edicao_id) : [];
    const inconsistencias = appInconsistencias(selected, state.appVencedores, categories);
    const activeStatus = appStatus(selected);

    $("#app-view").innerHTML = `
      <article class="awards-card">
        <div class="awards-panel-head">
          <div><h3>Exibição no aplicativo</h3><p>Controle a campanha temporária do Viva Urânia sem publicar uma nova versão do app.</p></div>
          <div class="awards-actions">
            <button class="admin-button" data-new-app-campaign>Nova campanha do app</button>
            ${selected ? `<button class="admin-button secondary" data-edit-app-campaign="${selected.id}">Editar campanha</button>` : ""}
          </div>
        </div>
        <div class="awards-toolbar">
          <input id="app-search" type="search" placeholder="Pesquisar vencedor…">
          <select id="app-campaign-filter"><option value="">Selecione uma campanha</option>${state.appCampanhas.map(campaign => `<option value="${campaign.id}" ${campaign.id === selectedId ? "selected" : ""}>${escapeHtml(campaign.titulo)} · ${escapeHtml(campaign.melhores_edicoes?.ano || "")}</option>`).join("")}</select>
          <button class="admin-button secondary" data-refresh-app-display>Atualizar</button>
        </div>
        ${state.appCampanhas.length ? "" : '<div class="awards-note">A migração ainda não foi aplicada ou não existe campanha do app. O aplicativo continuará funcionando e ocultará essa área até a ativação.</div>'}
        ${selected ? `
          <div class="awards-grid app-metrics">
            <article class="metric-card"><span>Status atual</span><strong>${escapeHtml(activeStatus)}</strong></article>
            <article class="metric-card"><span>Vencedores</span><strong>${state.appVencedores.filter(w => w.status === "ativo").length}</strong></article>
            <article class="metric-card"><span>Categorias sem vencedor</span><strong>${inconsistencias.missingCategories.length}</strong></article>
            <article class="metric-card"><span>Inconsistências</span><strong>${inconsistencias.alerts.length}</strong></article>
          </div>
          <div class="app-layout">
            <section class="awards-card app-review-card">
              <h3>Revisão antes da publicação</h3>
              ${inconsistencias.alerts.length ? `<div class="awards-error"><strong>Corrija antes de ativar:</strong><ul>${inconsistencias.alerts.map(alert => `<li>${escapeHtml(alert)}</li>`).join("")}</ul></div>` : '<div class="awards-note">Tudo certo para publicação. A visibilidade final também é protegida por RLS e datas no banco.</div>'}
              ${inconsistencias.missingCategories.length ? `<p class="awards-note"><strong>Categorias sem vencedor:</strong> ${escapeHtml(inconsistencias.missingCategories.map(c => c.nome).join(", "))}</p>` : ""}
              <div class="awards-actions" style="margin-top:1rem">
                <button class="admin-button" data-import-app-winners="${selected.id}">Importar vencedores da edição</button>
                <button class="admin-button secondary" data-new-app-winner="${selected.id}">Adicionar vencedor avulso</button>
                <button class="admin-button secondary" data-app-action="schedule" data-id="${selected.id}">Agendar</button>
                <button class="admin-button" data-app-action="activate" data-id="${selected.id}" ${inconsistencias.alerts.length ? "disabled" : ""}>Ativar agora</button>
                <button class="admin-button secondary" data-app-action="deactivate" data-id="${selected.id}">Desativar</button>
                <button class="admin-button secondary" data-app-action="close" data-id="${selected.id}">Encerrar</button>
                <button class="admin-button secondary danger" data-app-action="archive" data-id="${selected.id}">Arquivar</button>
              </div>
            </section>
            <section class="awards-card app-preview-card"><h3>Preview no app</h3>${appPreview(selected, state.appVencedores)}</section>
          </div>
          <article class="awards-card">
            <div class="awards-panel-head"><div><h3>Vencedores exibidos</h3><p>Vincule ao Guia quando existir. Vencedores sem Guia aparecem apenas na página do prêmio.</p></div></div>
            <div class="awards-table-wrap">
              <table class="awards-table">
                <thead><tr><th>Categoria</th><th>Vencedor</th><th>Guia</th><th>Status</th><th>Alertas</th><th>Ações</th></tr></thead>
                <tbody id="app-winner-rows">${state.appVencedores.length ? state.appVencedores.map(appWinnerRow).join("") : '<tr><td colspan="6"><div class="awards-empty">Nenhum vencedor importado ainda.</div></td></tr>'}</tbody>
              </table>
            </div>
          </article>
          <article class="awards-card">
            <h3>Prévia da importação oficial</h3>
            <p class="awards-note">Somente resultados publicados, vencedores e colocação 1 são considerados.</p>
            <div class="awards-table-wrap">
              <table class="awards-table">
                <thead><tr><th>Categoria</th><th>Vencedor oficial</th><th>Guia detectado</th><th>Imagem</th></tr></thead>
                <tbody>${officialPreview.length ? officialPreview.map(appImportPreviewRow).join("") : '<tr><td colspan="4"><div class="awards-empty">Nenhum resultado oficial publicado para importar.</div></td></tr>'}</tbody>
              </table>
            </div>
          </article>
          <article class="awards-card">
            <h3>Analytics do app</h3>
            <p class="awards-note">O app ainda não envia todos os eventos específicos desta campanha. Futuramente adicionar: app_bestof_banner_view, app_bestof_banner_click, app_bestof_campaign_view, app_bestof_winner_click, app_bestof_whatsapp_click, app_bestof_instagram_click e app_bestof_official_result_click.</p>
          </article>
        ` : '<div class="awards-empty">Crie ou selecione uma campanha para configurar a exibição no aplicativo.</div>'}
      </article>`;
    bindSimpleSearch("app", "app-winner-rows");
  } catch (error) {
    showError(error);
  }
}

function appWinnerRow(item) {
  const alerts = Array.isArray(item.alertas) ? item.alertas : [];
  return `<tr data-search="${escapeHtml(`${item.categoria_nome} ${item.nome_exibido} ${item.guia_comercial?.nome || ""}`.toLowerCase())}">
    <td><strong>${escapeHtml(item.categoria_nome)}</strong><br><small>${escapeHtml(item.selo || "Vencedor")}</small></td>
    <td><div class="awards-name">${item.imagem_url ? `<img class="awards-thumb" src="${escapeHtml(item.imagem_url)}" alt="">` : '<span class="awards-thumb"></span>'}<div><strong>${escapeHtml(item.nome_exibido)}</strong><small>${escapeHtml(item.descricao_curta || "Sem descrição curta")}</small></div></div></td>
    <td>${item.guia_comercial_id ? `<span class="awards-status ativo">vinculado</span><br><small>${escapeHtml(item.guia_comercial?.nome || item.guia_comercial_id)}</small>` : '<span class="awards-status planejamento">avulso</span>'}</td>
    <td><span class="awards-status ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span></td>
    <td>${alerts.length ? alerts.map(alert => `<span class="awards-status planejamento">${escapeHtml(alert)}</span>`).join(" ") : '<small>Sem alertas</small>'}</td>
    <td><div class="awards-actions"><button data-edit-app-winner="${item.id}">Editar</button><button class="danger" data-archive-app-winner="${item.id}">Arquivar</button></div></td>
  </tr>`;
}

function appImportPreviewRow(item) {
  const nominee = item.melhores_indicados || {};
  const guide = nominee.guia_comercial;
  return `<tr>
    <td>${escapeHtml(item.melhores_categorias?.nome || "Categoria")}</td>
    <td><strong>${escapeHtml(nominee.nome || "Vencedor")}</strong><br><small>${escapeHtml(nominee.descricao_curta || "")}</small></td>
    <td>${guide?.id ? `<span class="awards-status ativo">detectado</span><br><small>${escapeHtml(guide.nome || "")}</small>` : '<span class="awards-status planejamento">sem correspondência</span>'}</td>
    <td>${nominee.imagem_url || guide?.imagem_url ? "com imagem" : "sem imagem"}</td>
  </tr>`;
}

function appPreview(campaign, winners) {
  const first = winners.find(winner => winner.status === "ativo");
  return `<div class="app-phone-preview">
    <div class="app-home-banner"><span>Melhores do Ano</span><strong>${escapeHtml(campaign.titulo || "Melhores de Urânia 2026")}</strong><p>${escapeHtml(campaign.subtitulo || "Conheça os vencedores da primeira edição.")}</p><button>${escapeHtml(campaign.texto_botao || "Ver vencedores")}</button></div>
    <div class="app-winner-preview"><small>${escapeHtml(first?.categoria_nome || "Categoria")}</small><strong>${escapeHtml(first?.nome_exibido || "Nome do vencedor")}</strong><span>${escapeHtml(first?.selo || "Vencedor 2026")}</span></div>
    <p class="awards-note">Preview textual aproximado para iPhone e Android usando os dados reais. O visual final é renderizado pelo app.</p>
  </div>`;
}

function groupBy(rows, field) {
  const map = new Map();
  rows.forEach(row => {
    const key = row[field] || "sem-chave";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return map;
}

function bindSimpleSearch(prefix, rootId) {
  const input = $(`#${prefix}-search`);
  const category = $(`#${prefix}-category-filter`);
  const filter = () => {
    const term = (input?.value || "").toLowerCase();
    const cat = category?.value || "";
    document.querySelectorAll(`#${rootId} [data-search]`).forEach(row => {
      row.hidden = !row.dataset.search.includes(term) || (cat && row.dataset.category !== cat);
    });
  };
  input?.addEventListener("input", filter);
  category?.addEventListener("input", filter);
}

function bindFilter(type) {
  const input = $(`#${type}-search`);
  const status = $(`#${type}-status-filter`);
  const rowsId = type === "category" ? "category-rows" : "nominee-rows";
  const filter = () => {
    const term = (input?.value || "").toLowerCase();
    const selectedStatus = status?.value || "";
    document.querySelectorAll(`#${rowsId} tr[data-search]`).forEach(row => {
      row.hidden = !row.dataset.search.includes(term) || (selectedStatus && row.dataset.status !== selectedStatus);
    });
  };
  input?.addEventListener("input", filter);
  status?.addEventListener("input", filter);
}

function field(name, label, value = "", attrs = "") {
  return `<label class="awards-field"><span>${label}</span><input name="${name}" value="${escapeHtml(value ?? "")}" ${attrs}></label>`;
}

function textarea(name, label, value = "", attrs = "") {
  return `<label class="awards-field full"><span>${label}</span><textarea name="${name}" ${attrs}>${escapeHtml(value ?? "")}</textarea></label>`;
}

function selectField(name, label, html, className = "") {
  return `<label class="awards-field ${className}"><span>${label}</span><select name="${name}">${html}</select></label>`;
}

function showForm(title, html, onSubmit, { submitLabel = "Salvar" } = {}) {
  if (state.tab !== "form") state.returnTab = state.tab || "dashboard";
  setActiveTab("form", { persist: false });
  $("#form-view").innerHTML = `<article class="awards-card awards-form-card"><div class="awards-panel-head"><div><h3>${escapeHtml(title)}</h3><p>Preencha com atenção. Slugs, pesos e períodos têm validação no banco.</p></div></div><form class="awards-form" id="awards-form">${html}<div class="awards-form-actions"><button type="button" class="admin-button secondary" data-cancel-form>Cancelar</button><button class="admin-button" type="submit">${escapeHtml(submitLabel)}</button></div></form></article>`;
  $("#awards-form").addEventListener("submit", onSubmit);
}

function wireSlug(form, sourceName = "nome") {
  const source = form.elements[sourceName];
  const slug = form.elements.slug;
  source?.addEventListener("input", () => {
    if (slug && !slug.dataset.manual) slug.value = gerarSlug(source.value);
  });
  slug?.addEventListener("input", () => slug.dataset.manual = "1");
}

async function editionForm(id) {
  const currentYear = new Date().getFullYear();
  const item = id
    ? state.edicoes.find(x => x.id === id) || (await listarEdicoes()).find(x => x.id === id)
    : {
      ano: currentYear,
      nome: `Melhores de Urânia ${currentYear}`,
      slug: `melhores-de-urania-${currentYear}`,
      peso_site: currentYear === 2026 ? 60 : 50,
      peso_instagram: currentYear === 2026 ? 40 : 50,
      status: "planejamento",
      regulamento: getDefaultRegulamento(currentYear),
      metodologia: getDefaultMetodologia(currentYear)
    };
  const regulamento = item.regulamento || getDefaultRegulamento(item.ano);
  const metodologia = item.metodologia || getDefaultMetodologia(item.ano);
  showForm(id ? "Editar edição" : "Nova edição", `
    <input type="hidden" name="id" value="${escapeHtml(id || "")}">
    ${field("nome", "Nome *", item.nome || "", "required maxlength='140'")}
    ${field("ano", "Ano *", item.ano || "", "type='number' min='2024' max='2100' required")}
    ${field("slug", "Slug *", item.slug || "", "required")}
    ${selectField("status", "Status", optionList(editionStatuses, item.status || "planejamento"))}
    ${field("imagem_capa_url", "Imagem de capa", item.imagem_capa_url || "", "placeholder='https://... ou /assets/...'")}
    ${field("criterio_desempate", "Critério de desempate", item.criterio_desempate || "")}
    ${field("indicacoes_inicio", "Início das indicações", fmtDateInput(item.indicacoes_inicio), "type='datetime-local'")}
    ${field("indicacoes_fim", "Fim das indicações", fmtDateInput(item.indicacoes_fim), "type='datetime-local'")}
    ${field("votacao_inicio", "Início da votação", fmtDateInput(item.votacao_inicio), "type='datetime-local'")}
    ${field("votacao_fim", "Fim da votação", fmtDateInput(item.votacao_fim), "type='datetime-local'")}
    ${field("divulgacao_em", "Data de divulgação", fmtDateInput(item.divulgacao_em), "type='datetime-local'")}
    ${field("peso_site", "Peso do site (%)", item.peso_site ?? 50, "type='number' min='0' max='100' step='0.01' required")}
    ${field("peso_instagram", "Peso do Instagram (%)", item.peso_instagram ?? 50, "type='number' min='0' max='100' step='0.01' required")}
    ${textarea("descricao", "Descrição", item.descricao || "")}
    <div class="awards-official-texts">
      <div>
        <strong>Textos oficiais da edição</strong>
        <span>O regulamento e a metodologia abaixo aparecem no site e continuam editáveis pelo painel.</span>
      </div>
      <button class="admin-button secondary" type="button" data-fill-official-texts>Preencher modelo oficial 2026</button>
    </div>
    ${textarea("regulamento", "Regulamento", regulamento, "rows='18'")}
    ${textarea("metodologia", "Metodologia de apuração", metodologia, "rows='16'")}
    <div class="awards-checks"><label><input name="mostrar_votos_publicamente" type="checkbox" ${item.mostrar_votos_publicamente ? "checked" : ""}> Mostrar votos publicamente após publicação</label></div>
  `, async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const pesoSite = Number(form.elements.peso_site.value || 0);
    const pesoInstagram = Number(form.elements.peso_instagram.value || 0);
    if (Math.round((pesoSite + pesoInstagram) * 100) / 100 !== 100) return toast("Os pesos do site e Instagram precisam somar 100%.", "error");
    if (!validReference(form.elements.imagem_capa_url.value)) return toast("Use URL válida ou caminho interno em imagem de capa.", "error");
    await salvarEdicao({
      id: form.elements.id.value || undefined,
      nome: form.elements.nome.value.trim(),
      ano: Number(form.elements.ano.value),
      slug: form.elements.slug.value.trim(),
      status: form.elements.status.value,
      imagem_capa_url: form.elements.imagem_capa_url.value.trim() || null,
      criterio_desempate: form.elements.criterio_desempate.value.trim() || null,
      indicacoes_inicio: toIso(form.elements.indicacoes_inicio.value),
      indicacoes_fim: toIso(form.elements.indicacoes_fim.value),
      votacao_inicio: toIso(form.elements.votacao_inicio.value),
      votacao_fim: toIso(form.elements.votacao_fim.value),
      divulgacao_em: toIso(form.elements.divulgacao_em.value),
      peso_site: pesoSite,
      peso_instagram: pesoInstagram,
      descricao: form.elements.descricao.value.trim() || null,
      regulamento: form.elements.regulamento.value.trim() || null,
      metodologia: form.elements.metodologia.value.trim() || null,
      mostrar_votos_publicamente: form.elements.mostrar_votos_publicamente.checked
    });
    toast("Edição salva.");
    state.edicoes = [];
    await loadEditions();
  });
  wireSlug($("#awards-form"));
}

async function categoryForm(id) {
  if (!state.edicoes.length) state.edicoes = await listarEdicoes();
  const item = id ? state.categorias.find(x => x.id === id) || {} : { status: "ativo", ordem: 0, max_escolhas: 1, permite_indicacao_publica: true };
  showForm(id ? "Editar categoria" : "Nova categoria", `
    <input type="hidden" name="id" value="${escapeHtml(id || "")}">
    ${selectField("edicao_id", "Edição *", state.edicoes.map(e => `<option value="${e.id}" ${e.id === item.edicao_id ? "selected" : ""}>${e.ano} · ${escapeHtml(e.nome)}</option>`).join(""), "")}
    ${field("nome", "Nome *", item.nome || "", "required maxlength='140'")}
    ${field("slug", "Slug *", item.slug || "", "required")}
    ${selectField("status", "Status", optionList(categoryStatuses, item.status || "ativo"))}
    ${field("ordem", "Ordem", item.ordem || 0, "type='number' min='0'")}
    ${field("imagem_url", "Imagem", item.imagem_url || "", "placeholder='https://... ou /assets/...'")}
    ${field("icone", "Ícone opcional", item.icone || "")}
    ${field("limite_indicados", "Limite de indicados", item.limite_indicados || "", "type='number' min='1'")}
    ${field("max_escolhas", "Máximo de escolhas", item.max_escolhas || 1, "type='number' min='1'")}
    ${textarea("descricao", "Descrição", item.descricao || "")}
    ${textarea("criterios_especificos", "Critérios específicos", item.criterios_especificos || "")}
    ${field("regra_desempate", "Regra de desempate", item.regra_desempate || "")}
    <div class="awards-checks">
      <label><input name="permite_indicacao_publica" type="checkbox" ${item.permite_indicacao_publica !== false ? "checked" : ""}> Permitir indicação pública</label>
      <label><input name="permite_multiplos_votos" type="checkbox" ${item.permite_multiplos_votos ? "checked" : ""}> Permitir múltiplos votos</label>
      <label><input name="visibilidade_publica" type="checkbox" ${item.visibilidade_publica !== false ? "checked" : ""}> Visível publicamente</label>
    </div>
  `, async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!validReference(form.elements.imagem_url.value)) return toast("Use URL válida ou caminho interno em imagem.", "error");
    await salvarCategoria({
      id: form.elements.id.value || undefined,
      edicao_id: form.elements.edicao_id.value,
      nome: form.elements.nome.value.trim(),
      slug: form.elements.slug.value.trim(),
      status: form.elements.status.value,
      ordem: Number(form.elements.ordem.value || 0),
      imagem_url: form.elements.imagem_url.value.trim() || null,
      icone: form.elements.icone.value.trim() || null,
      limite_indicados: form.elements.limite_indicados.value ? Number(form.elements.limite_indicados.value) : null,
      max_escolhas: Number(form.elements.max_escolhas.value || 1),
      descricao: form.elements.descricao.value.trim() || null,
      criterios_especificos: form.elements.criterios_especificos.value.trim() || null,
      regra_desempate: form.elements.regra_desempate.value.trim() || null,
      permite_indicacao_publica: form.elements.permite_indicacao_publica.checked,
      permite_multiplos_votos: form.elements.permite_multiplos_votos.checked,
      visibilidade_publica: form.elements.visibilidade_publica.checked
    });
    toast("Categoria salva.");
    state.categorias = [];
    await loadCategories();
  });
  wireSlug($("#awards-form"));
}

async function copyCategoriesForm(destinoEdicaoId) {
  const edicoesParaCopia = await listarEdicoesParaCopiaCategorias();
  const destino = edicoesParaCopia.find(item => item.id === destinoEdicaoId);
  const origens = edicoesParaCopia.filter(item => item.id !== destinoEdicaoId);
  if (!destino || !origens.length) return toast("Cadastre outra edição antes de copiar categorias.", "error");

  showForm("Copiar categorias", `
    <input type="hidden" name="destino_edicao_id" value="${escapeHtml(destinoEdicaoId)}">
    ${selectField("origem_edicao_id", "Copiar da edição *", origens.map(item => `<option value="${item.id}">${item.ano} · ${escapeHtml(item.nome)}${item.status === "arquivada" ? " · arquivada" : ""}</option>`).join(""))}
    ${field("destino_edicao", "Para a edição", `${destino.ano} · ${destino.nome}`, "readonly")}
    <div class="awards-note awards-field full">
      Serão copiadas as configurações das categorias, incluindo ordem, regras, imagens e status.
      Indicados, indicações e votos não serão copiados. Categorias já existentes com o mesmo slug serão mantidas sem alterações.
    </div>
  `, async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const origem = edicoesParaCopia.find(item => item.id === form.elements.origem_edicao_id.value);
    if (!confirm(`Copiar as categorias de ${origem?.nome || "outra edição"} para ${destino.nome}?`)) return;
    const resultado = await copiarCategoriasEntreEdicoes({
      origemEdicaoId: form.elements.origem_edicao_id.value,
      destinoEdicaoId: form.elements.destino_edicao_id.value
    });
    const resumoIgnoradas = resultado.ignoradas ? ` ${resultado.ignoradas} já existente(s) foi/foram mantida(s).` : "";
    toast(`${resultado.copiadas} categoria(s) copiada(s).${resumoIgnoradas}`);
    state.categorias = [];
    await loadCategories();
  }, { submitLabel: "Copiar categorias" });
}

async function nomineeForm(id) {
  if (!state.edicoes.length) state.edicoes = await listarEdicoes();
  const edicaoId = state.edicoes[0]?.id || "";
  if (!state.categorias.length) state.categorias = await listarCategorias(edicaoId);
  if (!state.guia.length) state.guia = await listarGuiaComercial();
  const item = id ? state.indicados.find(x => x.id === id) || {} : { status: "rascunho", ordem: 0 };
  const categories = item.edicao_id ? await listarCategorias(item.edicao_id) : state.categorias;
  showForm(id ? "Editar indicado" : "Novo indicado", `
    <input type="hidden" name="id" value="${escapeHtml(id || "")}">
    ${selectField("edicao_id", "Edição *", state.edicoes.map(e => `<option value="${e.id}" ${e.id === (item.edicao_id || edicaoId) ? "selected" : ""}>${e.ano} · ${escapeHtml(e.nome)}</option>`).join(""))}
    ${selectField("categoria_id", "Categoria *", categories.map(c => `<option value="${c.id}" ${c.id === item.categoria_id ? "selected" : ""}>${escapeHtml(c.nome)}</option>`).join(""))}
    ${selectField("guia_comercial_id", "Vincular ao Guia Comercial", `<option value="">Sem vínculo</option>${state.guia.map(g => `<option value="${g.id}" ${g.id === item.guia_comercial_id ? "selected" : ""}>${escapeHtml(g.nome)}</option>`).join("")}`)}
    ${field("nome", "Nome *", item.nome || "", "required maxlength='160'")}
    ${field("slug", "Slug *", item.slug || "", "required")}
    ${selectField("status", "Status", optionList(nomineeStatuses, item.status || "rascunho"))}
    ${field("ordem", "Ordem", item.ordem || 0, "type='number' min='0'")}
    ${field("imagem_url", "Imagem", item.imagem_url || "", "placeholder='https://... ou /assets/...'")}
    ${field("instagram", "Instagram", item.instagram || "")}
    ${field("whatsapp", "WhatsApp", item.whatsapp || "")}
    ${field("site", "Site", item.site || "")}
    ${field("endereco", "Endereço", item.endereco || "")}
    ${textarea("descricao_curta", "Descrição curta", item.descricao_curta || "", "maxlength='260'")}
    ${textarea("descricao_completa", "Descrição completa", item.descricao_completa || "")}
    ${textarea("motivo_reprovacao", "Motivo interno de reprovação", item.motivo_reprovacao || "")}
    ${textarea("observacao_interna", "Observação interna", item.observacao_interna || "")}
    <div class="awards-checks">
      <label><input name="aprovado" type="checkbox" ${item.aprovado ? "checked" : ""}> Aprovado para participar</label>
      <label><input name="consentimento" type="checkbox" ${item.consentimento ? "checked" : ""}> Consentimento/autorização registrado</label>
    </div>
  `, async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!validReference(form.elements.imagem_url.value) || !validReference(form.elements.site.value)) return toast("Use URL válida ou caminho interno nos campos de link/imagem.", "error");
    await salvarIndicado({
      id: form.elements.id.value || undefined,
      edicao_id: form.elements.edicao_id.value,
      categoria_id: form.elements.categoria_id.value,
      guia_comercial_id: form.elements.guia_comercial_id.value || null,
      nome: form.elements.nome.value.trim(),
      slug: form.elements.slug.value.trim(),
      status: form.elements.status.value,
      ordem: Number(form.elements.ordem.value || 0),
      imagem_url: form.elements.imagem_url.value.trim() || null,
      instagram: form.elements.instagram.value.trim() || null,
      whatsapp: form.elements.whatsapp.value.trim() || null,
      site: form.elements.site.value.trim() || null,
      endereco: form.elements.endereco.value.trim() || null,
      descricao_curta: form.elements.descricao_curta.value.trim() || null,
      descricao_completa: form.elements.descricao_completa.value.trim() || null,
      motivo_reprovacao: form.elements.motivo_reprovacao.value.trim() || null,
      observacao_interna: form.elements.observacao_interna.value.trim() || null,
      aprovado: form.elements.aprovado.checked,
      consentimento: form.elements.consentimento.checked
    });
    toast("Indicado salvo.");
    state.indicados = [];
    await loadNominees();
  });
  const form = $("#awards-form");
  wireSlug(form);
  form.elements.edicao_id.addEventListener("change", async () => {
    const cats = await listarCategorias(form.elements.edicao_id.value);
    form.elements.categoria_id.innerHTML = cats.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join("");
  });
  form.elements.guia_comercial_id.addEventListener("change", () => {
    const guide = state.guia.find(g => g.id === form.elements.guia_comercial_id.value);
    if (!guide) return;
    if (!form.elements.nome.value) form.elements.nome.value = guide.nome || "";
    if (!form.elements.slug.value) form.elements.slug.value = gerarSlug(guide.nome || "");
    if (!form.elements.imagem_url.value) form.elements.imagem_url.value = guide.imagem_url || "";
    if (!form.elements.whatsapp.value) form.elements.whatsapp.value = guide.whatsapp || "";
    if (!form.elements.instagram.value) form.elements.instagram.value = guide.instagram || "";
    if (!form.elements.site.value) form.elements.site.value = guide.site || "";
    if (!form.elements.endereco.value) form.elements.endereco.value = guide.endereco || "";
    if (!form.elements.descricao_curta.value) form.elements.descricao_curta.value = guide.descricao || "";
  });
}

async function instagramForm(id) {
  if (!state.edicoes.length) state.edicoes = await listarEdicoes();
  const selectedEdition = $("#instagram-edition-filter")?.value || state.edicoes[0]?.id || "";
  if (!state.categorias.length || !state.categorias.some(c => c.edicao_id === selectedEdition)) state.categorias = await listarCategorias(selectedEdition);
  if (!state.indicados.length || !state.indicados.some(i => i.edicao_id === selectedEdition)) state.indicados = await listarIndicados({ edicaoId: selectedEdition });
  const item = id ? state.instagram.find(x => x.id === id) || {} : { edicao_id: selectedEdition, votos: 0 };
  const categories = item.edicao_id ? await listarCategorias(item.edicao_id) : state.categorias;
  const nominees = item.edicao_id ? await listarIndicados({ edicaoId: item.edicao_id, categoriaId: item.categoria_id || categories[0]?.id }) : state.indicados;
  showForm(id ? "Editar votos do Instagram" : "Adicionar votos do Instagram", `
    <input type="hidden" name="id" value="${escapeHtml(id || "")}">
    ${selectField("edicao_id", "Edição *", state.edicoes.map(e => `<option value="${e.id}" ${e.id === (item.edicao_id || selectedEdition) ? "selected" : ""}>${e.ano} · ${escapeHtml(e.nome)}</option>`).join(""))}
    ${selectField("categoria_id", "Categoria *", categories.map(c => `<option value="${c.id}" ${c.id === item.categoria_id ? "selected" : ""}>${escapeHtml(c.nome)}</option>`).join(""))}
    ${selectField("indicado_id", "Indicado *", nominees.map(n => `<option value="${n.id}" ${n.id === item.indicado_id ? "selected" : ""}>${escapeHtml(n.nome)}</option>`).join(""))}
    ${field("votos", "Votos no Instagram *", item.votos || 0, "type='number' min='0' required")}
    ${field("coletado_em", "Data da coleta", fmtDateInput(item.coletado_em), "type='datetime-local'")}
    ${field("comprovante_url", "Comprovante/print", item.comprovante_url || "", "placeholder='https://... ou /assets/...'")}
    ${textarea("observacao", "Observação", item.observacao || "")}
  `, async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!validReference(form.elements.comprovante_url.value)) return toast("Use URL válida ou caminho interno no comprovante.", "error");
    await salvarInstagramVoto({
      edicao_id: form.elements.edicao_id.value,
      categoria_id: form.elements.categoria_id.value,
      indicado_id: form.elements.indicado_id.value,
      votos: Number(form.elements.votos.value || 0),
      coletado_em: toIso(form.elements.coletado_em.value),
      comprovante_url: form.elements.comprovante_url.value.trim() || null,
      observacao: form.elements.observacao.value.trim() || null
    });
    toast("Votos do Instagram salvos.");
    state.instagram = [];
    await loadInstagram();
  });
  const form = $("#awards-form");
  form.elements.edicao_id.addEventListener("change", async () => {
    const cats = await listarCategorias(form.elements.edicao_id.value);
    form.elements.categoria_id.innerHTML = cats.map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join("");
    const noms = await listarIndicados({ edicaoId: form.elements.edicao_id.value, categoriaId: cats[0]?.id });
    form.elements.indicado_id.innerHTML = noms.map(n => `<option value="${n.id}">${escapeHtml(n.nome)}</option>`).join("");
  });
  form.elements.categoria_id.addEventListener("change", async () => {
    const noms = await listarIndicados({ edicaoId: form.elements.edicao_id.value, categoriaId: form.elements.categoria_id.value });
    form.elements.indicado_id.innerHTML = noms.map(n => `<option value="${n.id}">${escapeHtml(n.nome)}</option>`).join("");
  });
}

async function appCampaignForm(id) {
  if (!state.edicoes.length) state.edicoes = await listarEdicoes();
  const item = id ? await obterCampanhaApp(id) : {
    titulo: "Melhores de Urânia 2026",
    subtitulo: "Conheça os vencedores da primeira edição.",
    texto_botao: "Ver vencedores",
    status: "rascunho",
    ativo: false,
    ordem_home: 0,
    exibir_selo_cards: true,
    exibir_bloco_empresa: true,
    exibir_avulsos: true
  };
  showForm(id ? "Editar exibição no aplicativo" : "Nova exibição no aplicativo", `
    <input type="hidden" name="id" value="${escapeHtml(id || "")}">
    ${selectField("edicao_id", "Edição vinculada *", `<option value="">Selecione</option>${state.edicoes.map(e => `<option value="${e.id}" ${e.id === item?.edicao_id ? "selected" : ""}>${e.ano} · ${escapeHtml(e.nome)} · ${escapeHtml(e.status)}</option>`).join("")}`)}
    ${field("titulo", "Título *", item?.titulo || "", "required maxlength='120'")}
    ${field("subtitulo", "Subtítulo", item?.subtitulo || "", "maxlength='180'")}
    ${field("texto_botao", "Texto do botão", item?.texto_botao || "Ver vencedores", "maxlength='40'")}
    ${field("link_oficial", "Link oficial", item?.link_oficial || "", "placeholder='https://... ou /melhores-de-urania/resultados.html'")}
    ${selectField("status", "Status", optionList(appCampaignStatuses, item?.status || "rascunho"))}
    ${field("exibir_inicio", "Início da exibição", fmtDateInput(item?.exibir_inicio), "type='datetime-local'")}
    ${field("exibir_fim", "Fim da exibição", fmtDateInput(item?.exibir_fim), "type='datetime-local'")}
    ${field("ordem_home", "Ordem na Home", item?.ordem_home || 0, "type='number' min='0'")}
    ${textarea("observacao_interna", "Observação interna", item?.observacao_interna || "")}
    <div class="awards-checks">
      <label><input name="ativo" type="checkbox" ${item?.ativo ? "checked" : ""}> Disponível para o aplicativo quando estiver no período</label>
      <label><input name="exibir_selo_cards" type="checkbox" ${item?.exibir_selo_cards !== false ? "checked" : ""}> Exibir selo nos cards</label>
      <label><input name="exibir_bloco_empresa" type="checkbox" ${item?.exibir_bloco_empresa !== false ? "checked" : ""}> Exibir bloco na página da empresa</label>
      <label><input name="exibir_avulsos" type="checkbox" ${item?.exibir_avulsos !== false ? "checked" : ""}> Exibir vencedores sem Guia</label>
    </div>
  `, async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!validReference(form.elements.link_oficial.value)) return toast("Use URL válida ou caminho interno em link oficial.", "error");
    await salvarCampanhaApp({
      id: form.elements.id.value || undefined,
      edicao_id: form.elements.edicao_id.value || null,
      titulo: form.elements.titulo.value.trim(),
      subtitulo: form.elements.subtitulo.value.trim() || null,
      texto_botao: form.elements.texto_botao.value.trim() || "Ver vencedores",
      link_oficial: form.elements.link_oficial.value.trim() || null,
      status: form.elements.status.value,
      ativo: form.elements.ativo.checked,
      exibir_inicio: toIso(form.elements.exibir_inicio.value),
      exibir_fim: toIso(form.elements.exibir_fim.value),
      ordem_home: Number(form.elements.ordem_home.value || 0),
      exibir_selo_cards: form.elements.exibir_selo_cards.checked,
      exibir_bloco_empresa: form.elements.exibir_bloco_empresa.checked,
      exibir_avulsos: form.elements.exibir_avulsos.checked,
      observacao_interna: form.elements.observacao_interna.value.trim() || null
    });
    toast("Exibição no aplicativo salva.");
    state.appCampanhas = [];
    await loadAppDisplay();
  });
}

async function appWinnerForm(id, campanhaId) {
  const campaign = state.appCampanhas.find(item => item.id === campanhaId) || state.appCampanhas[0] || await obterCampanhaApp(campanhaId);
  if (!campaign) return toast("Selecione uma campanha.", "error");
  const winners = state.appVencedores.length ? state.appVencedores : await listarVencedoresApp(campaign.id);
  const item = id ? winners.find(winner => winner.id === id) || {} : { campanha_id: campaign.id, status: "ativo", selo: `Vencedor ${campaign.melhores_edicoes?.ano || new Date().getFullYear()}`, ordem: 0 };
  const categories = await listarCategorias(campaign.edicao_id);
  if (!state.guia.length) state.guia = await listarGuiaComercial();
  showForm(id ? "Editar vencedor no app" : "Adicionar vencedor avulso", `
    <input type="hidden" name="id" value="${escapeHtml(id || "")}">
    <input type="hidden" name="campanha_id" value="${escapeHtml(campaign.id)}">
    ${selectField("categoria_id", "Categoria *", categories.map(c => `<option value="${c.id}" ${c.id === item.categoria_id ? "selected" : ""}>${escapeHtml(c.nome)}</option>`).join(""))}
    ${selectField("guia_comercial_id", "Vincular ao Guia Comercial", `<option value="">Sem vínculo</option>${state.guia.map(g => `<option value="${g.id}" ${g.id === item.guia_comercial_id ? "selected" : ""}>${escapeHtml(g.nome)} · ${escapeHtml(g.status || "")}</option>`).join("")}`)}
    ${field("nome_exibido", "Nome exibido *", item.nome_exibido || "", "required maxlength='160'")}
    ${field("imagem_url", "Imagem", item.imagem_url || "", "placeholder='https://... ou /assets/...'")}
    ${field("selo", "Selo", item.selo || "Vencedor 2026", "maxlength='60'")}
    ${field("ordem", "Ordem", item.ordem || 0, "type='number' min='0'")}
    ${selectField("status", "Status", optionList(appWinnerStatuses, item.status || "ativo"))}
    ${field("instagram", "Instagram", item.instagram || "")}
    ${field("whatsapp", "WhatsApp", item.whatsapp || "")}
    ${field("site", "Site", item.site || "")}
    ${field("endereco", "Endereço", item.endereco || "")}
    ${textarea("descricao_curta", "Descrição curta", item.descricao_curta || "", "maxlength='260'")}
  `, async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const category = categories.find(c => c.id === form.elements.categoria_id.value);
    if (!validReference(form.elements.imagem_url.value) || !validReference(form.elements.site.value)) return toast("Use URL válida ou caminho interno nos campos de link/imagem.", "error");
    await salvarVencedorApp({
      id: form.elements.id.value || undefined,
      campanha_id: form.elements.campanha_id.value,
      categoria_id: form.elements.categoria_id.value,
      guia_comercial_id: form.elements.guia_comercial_id.value || null,
      categoria_nome: category?.nome || "Categoria",
      nome_exibido: form.elements.nome_exibido.value.trim(),
      imagem_url: form.elements.imagem_url.value.trim() || null,
      descricao_curta: form.elements.descricao_curta.value.trim() || null,
      selo: form.elements.selo.value.trim() || "Vencedor",
      ordem: Number(form.elements.ordem.value || 0),
      instagram: form.elements.instagram.value.trim() || null,
      whatsapp: form.elements.whatsapp.value.trim() || null,
      site: form.elements.site.value.trim() || null,
      endereco: form.elements.endereco.value.trim() || null,
      status: form.elements.status.value,
      origem: form.elements.guia_comercial_id.value ? "ajuste_admin" : "manual"
    });
    toast("Vencedor do app salvo.");
    state.appVencedores = [];
    await loadAppDisplay();
  });
  const form = $("#awards-form");
  form.elements.guia_comercial_id.addEventListener("change", () => {
    const guide = state.guia.find(g => g.id === form.elements.guia_comercial_id.value);
    if (!guide) return;
    if (!form.elements.nome_exibido.value) form.elements.nome_exibido.value = guide.nome || "";
    if (!form.elements.imagem_url.value) form.elements.imagem_url.value = guide.imagem_url || "";
    if (!form.elements.whatsapp.value) form.elements.whatsapp.value = guide.whatsapp || "";
    if (!form.elements.instagram.value) form.elements.instagram.value = guide.instagram || "";
    if (!form.elements.site.value) form.elements.site.value = guide.site || "";
    if (!form.elements.endereco.value) form.elements.endereco.value = guide.endereco || "";
    if (!form.elements.descricao_curta.value) form.elements.descricao_curta.value = guide.descricao || "";
  });
}

async function init() {
  const access = await exigirPermissao("melhores", "acessar");
  if (!access) return;
  $("#admin-user").textContent = access.admin.nome || access.user.email;
  $("#logout").addEventListener("click", sair);
  $("#mobile-menu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));

  document.addEventListener("click", async event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("data-fill-official-texts")) {
      const form = $("#awards-form");
      const ano = Number(form?.elements?.ano?.value || 2026);
      const regulamento = getDefaultRegulamento(ano) || getDefaultRegulamento(2026);
      const metodologia = getDefaultMetodologia(ano) || getDefaultMetodologia(2026);
      const shouldReplace = !form.elements.regulamento.value.trim()
        || confirm("Substituir o regulamento e a metodologia atuais pelo modelo oficial?");
      if (!shouldReplace) return;
      form.elements.regulamento.value = regulamento;
      form.elements.metodologia.value = metodologia;
      toast("Modelo oficial aplicado. Revise e salve a edição.");
      return;
    }
    if (button.dataset.tab) {
      return loadTab(button.dataset.tab);
    }
    if (button.dataset.dashboardTab) {
      return loadTab(button.dataset.dashboardTab);
    }
    if (button.id === "new-edition" || button.hasAttribute("data-new-edition")) return editionForm();
    if (button.dataset.editEdition) return editionForm(button.dataset.editEdition);
    if (button.dataset.deleteEdition && confirm("Excluir esta edição? Categorias e indicados vinculados também serão removidos.")) {
      await excluirEdicao(button.dataset.deleteEdition);
      toast("Edição excluída.");
      state.edicoes = [];
      return loadEditions();
    }
    if (button.hasAttribute("data-new-category")) return categoryForm();
    if (button.dataset.copyCategories) return copyCategoriesForm(button.dataset.copyCategories);
    if (button.dataset.editCategory) return categoryForm(button.dataset.editCategory);
    if (button.dataset.deleteCategory && confirm("Excluir esta categoria? Indicados vinculados também serão removidos.")) {
      await excluirCategoria(button.dataset.deleteCategory);
      toast("Categoria excluída.");
      state.categorias = [];
      return loadCategories();
    }
    if (button.hasAttribute("data-new-nominee")) return nomineeForm();
    if (button.dataset.editNominee) return nomineeForm(button.dataset.editNominee);
    if (button.dataset.deleteNominee && confirm("Excluir este indicado?")) {
      await excluirIndicado(button.dataset.deleteNominee);
      toast("Indicado excluído.");
      state.indicados = [];
      return loadNominees();
    }
    if (button.hasAttribute("data-refresh-categories")) return loadCategories();
    if (button.hasAttribute("data-refresh-indications")) return loadIndications();
    if (button.dataset.convertIndication) return convertIndication(button.dataset.convertIndication);
    if (button.dataset.approveIndication) return updateIndicationStatus(button.dataset.approveIndication, "aprovada");
    if (button.dataset.rejectIndication) return updateIndicationStatus(button.dataset.rejectIndication, "rejeitada");
    if (button.dataset.duplicateIndication) return updateIndicationStatus(button.dataset.duplicateIndication, "duplicada");
    if (button.dataset.spamIndication) return updateIndicationStatus(button.dataset.spamIndication, "spam");
    if (button.dataset.deleteIndication && confirm("Excluir esta indicação?")) {
      await excluirIndicacao(button.dataset.deleteIndication);
      toast("Indicação excluída.");
      state.indicacoes = [];
      return loadIndications();
    }
    if (button.hasAttribute("data-refresh-nominees")) return loadNominees();
    if (button.hasAttribute("data-refresh-votes")) return loadVotes();
    if (button.hasAttribute("data-manual-cleanup-votes")) {
      const edicaoId = $("#votes-edition-filter")?.value || state.edicoes[0]?.id;
      if (!edicaoId) return toast("Selecione uma edição.", "error");
      if (!confirm("Executar limpeza manual dos votos individuais desta edição? Use somente após auditoria e publicação oficial.")) return;
      const total = await limparVotosManual(edicaoId);
      toast(`${total || 0} voto(s) individual(is) removido(s) após consolidação.`);
      return loadVotes();
    }
    if (button.hasAttribute("data-new-instagram")) return instagramForm();
    if (button.dataset.editInstagram) return instagramForm(button.dataset.editInstagram);
    if (button.dataset.deleteInstagram && confirm("Excluir este lançamento do Instagram?")) {
      await excluirInstagramVoto(button.dataset.deleteInstagram);
      toast("Lançamento excluído.");
      state.instagram = [];
      return loadInstagram();
    }
    if (button.hasAttribute("data-refresh-instagram")) return loadInstagram();
    if (button.hasAttribute("data-refresh-apuration")) return loadApuration();
    if (button.hasAttribute("data-refresh-results")) return loadResults();
    if (button.hasAttribute("data-refresh-app-display")) return loadAppDisplay();
    if (button.hasAttribute("data-new-app-campaign")) return appCampaignForm();
    if (button.dataset.editAppCampaign) return appCampaignForm(button.dataset.editAppCampaign);
    if (button.dataset.newAppWinner) return appWinnerForm(null, button.dataset.newAppWinner);
    if (button.dataset.editAppWinner) return appWinnerForm(button.dataset.editAppWinner, $("#app-campaign-filter")?.value);
    if (button.dataset.archiveAppWinner && confirm("Arquivar este vencedor apenas na exibição do aplicativo?")) {
      await arquivarVencedorApp(button.dataset.archiveAppWinner);
      toast("Vencedor arquivado na exibição do app.");
      state.appVencedores = [];
      return loadAppDisplay();
    }
    if (button.dataset.importAppWinners) {
      if (!confirm("Importar vencedores oficiais publicados desta edição para o aplicativo? Vencedores existentes da mesma categoria serão atualizados.")) return;
      const total = await importarVencedoresApp(button.dataset.importAppWinners);
      toast(`${total || 0} vencedor(es) importado(s) para o aplicativo.`);
      state.appVencedores = [];
      return loadAppDisplay();
    }
    if (button.dataset.appAction) {
      const campaign = state.appCampanhas.find(item => item.id === button.dataset.id) || await obterCampanhaApp(button.dataset.id);
      if (!campaign) return toast("Campanha não encontrada.", "error");
      const now = new Date();
      const payloadByAction = {
        schedule: { status: "agendada", ativo: true },
        activate: { status: "ativa", ativo: true, exibir_inicio: campaign.exibir_inicio || now.toISOString() },
        deactivate: { status: "inativa", ativo: false },
        close: { status: "encerrada", ativo: false, exibir_fim: now.toISOString() },
        archive: { status: "arquivada", ativo: false, arquivado_em: now.toISOString() }
      };
      if (button.dataset.appAction === "archive" && !confirm("Arquivar esta campanha do aplicativo? O histórico será mantido no banco.")) return;
      await salvarCampanhaApp({ id: campaign.id, ...payloadByAction[button.dataset.appAction] });
      toast("Status da exibição no app atualizado.");
      state.appCampanhas = [];
      return loadAppDisplay();
    }
    if (button.hasAttribute("data-refresh-audience")) return loadAudience();
    if (button.hasAttribute("data-open-audience")) return loadAudience();
    if (button.hasAttribute("data-refresh-audit")) return loadAudit();
    if (button.hasAttribute("data-publish-results")) {
      const edicaoId = $("#apuration-edition-filter")?.value || state.edicoes[0]?.id;
      if (!edicaoId) return toast("Selecione uma edição.", "error");
      const methodology = prompt("Descreva a metodologia resumida que ficará gravada no resultado oficial:", "Resultado calculado por percentual de votos no site e no Instagram, conforme pesos da edição.");
      if (methodology === null) return;
      if (!confirm("Publicar resultado oficial agora? Esta ação cria um snapshot histórico da edição.")) return;
      const total = await publicarResultado(edicaoId, methodology);
      toast(`${total || 0} resultado(s) publicado(s).`);
      state.resultados = [];
      return loadResults();
    }
    if (button.hasAttribute("data-cancel-form")) {
      if (state.tab === "form") return loadTab(state.returnTab || "dashboard");
    }
  });

  document.addEventListener("change", event => {
    if (event.target.id === "category-edition-filter") loadCategories();
    if (event.target.id === "indication-edition-filter" || event.target.id === "indication-status-filter") loadIndications();
    if (event.target.id === "nominee-edition-filter" || event.target.id === "nominee-category-filter") {
      if (event.target.id === "nominee-edition-filter") state.categorias = [];
      loadNominees();
    }
    if (event.target.id === "votes-edition-filter" || event.target.id === "votes-status-filter") loadVotes();
    if (event.target.id === "instagram-edition-filter" || event.target.id === "instagram-category-filter") {
      if (event.target.id === "instagram-edition-filter") state.categorias = [];
      loadInstagram();
    }
    if (event.target.id === "apuration-edition-filter") loadApuration();
    if (event.target.id === "results-edition-filter") loadResults();
    if (event.target.id === "app-campaign-filter") loadAppDisplay();
    if (event.target.id === "audience-edition-filter" || event.target.id === "audience-period-filter") loadAudience();
    if (event.target.id === "audit-edition-filter") loadAudit();
  });

  window.addEventListener("hashchange", () => {
    const tab = currentHashTab();
    if (tab !== state.tab) loadTab(tab);
  });

  await loadTab(currentHashTab());
}

init();
