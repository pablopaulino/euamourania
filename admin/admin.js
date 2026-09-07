import { exigirAdministrador, sair } from "./auth.js";
import { getSupabase } from "../assets/js/services/supabaseClient.js";
import { listarTabela, salvarRegistro, excluirRegistro } from "../assets/js/services/baseService.js";
import { gerarSlug } from "../assets/js/utils.js";
import { adminPathForModule, adminPathForView, adminViewFromLocation, normalizeLegacyAdminRoute } from "./admin-routes.js";
import { summarizeBusinessQuality } from "./business-quality.js";
import { ADMIN_MODULE_LIST, adminModulesForNavigation, getAdminModule, renderAdminModuleIcon } from "./admin-modules.js?v=20260907-media-gallery";

const app = document.getElementById("app-content");
const title = document.getElementById("page-title");
const sidebar = document.getElementById("sidebar");
const shell = document.querySelector(".admin-shell");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
const mobileMenuButton = document.getElementById("mobile-menu");
const pageHint = document.getElementById("page-hint");
const pageTitleIcon = document.getElementById("page-title-icon");
const pageContext = document.getElementById("page-context");
const pagePrimaryAction = document.getElementById("page-primary-action");
let currentView = "dashboard";
let activeModuleKey = "dashboard";
let quill;
let currentResourceTable = null;
let currentResourceId = null;
let painelAccess = null;
let activeMountedModule = null;

const moduleRoutes = {
  comunicacao: {
    label: "Comunicação",
    hint: "Assinantes, newsletters e resultados em um só lugar.",
    module: () => import("./comunicacao.js")
  },
  notificacoes: {
    label: "Notificações do Viva Urânia",
    hint: "Envios push, aparelhos cadastrados e histórico do aplicativo Viva Urânia.",
    module: () => import("./notificacoes-app.js")
  },
  submissoes: {
    label: "Submissões públicas",
    hint: "Revise empresas e eventos enviados pelo público antes de publicar no portal.",
    module: () => import("./submissoes.js")
  },
  guia_verificacao: {
    label: "Verificação do Guia",
    hint: "Acompanhe cadastros comerciais que precisam ser conferidos periodicamente.",
    module: () => import("./guia-verificacao.js")
  },
  turismo_verificacao: {
    label: "Verificação de Turismo",
    hint: "Acompanhe atrativos que precisam de conferência semestral.",
    module: () => import("./turismo-verificacao.js")
  },
  telefones_uteis: {
    label: "Telefones úteis",
    hint: "Organize contatos importantes, urgências e serviços exibidos no aplicativo.",
    module: () => import("./telefones-uteis.js")
  },
  motoristas: {
    label: "Motoristas",
    hint: "Contatos de motoristas particulares para corridas locais e viagens.",
    module: () => import("./motoristas.js")
  },
  vantagens: {
    label: "Viva Vantagens",
    hint: "Cupons, ofertas e benefícios dos parceiros do Viva.",
    module: () => import("./vantagens.js")
  },
  iniciativas: {
    label: "Iniciativas da Comunidade",
    hint: "Projetos, ações e formas de ajuda divulgadas pelo Viva Urânia.",
    module: () => import("./iniciativas.js")
  },
  publicidade: {
    label: "Publicidade",
    hint: "Campanhas, posições, mídia e métricas dos anúncios internos do portal.",
    module: () => import("./publicidade.js")
  },
  usuarios: {
    label: "Usuários administrativos",
    hint: "Equipe, papéis e permissões de acesso ao CMS.",
    module: () => import("./usuarios.js")
  },
  importacao: {
    label: "Migrar conteúdo antigo",
    hint: "Importação segura de arquivos legados e lotes do Guia Comercial.",
    module: () => import("./migrar.js")
  },
  melhores: {
    label: "Melhores de Urânia",
    hint: "Edições, categorias, indicados, votos, apuração e resultados da premiação.",
    module: () => import("./melhores.js")
  }
};

const adminNavigationGroups = adminModulesForNavigation();
const adminNavigationItems = ADMIN_MODULE_LIST;

function getSidebarButtonLabel(button) {
  const key = button.dataset.view || button.dataset.module || button.id || "";
  const currentLabel = button.querySelector(".admin-nav-label")?.textContent?.trim();
  const moduleMeta = getAdminModule(key);
  return moduleMeta.label || button.dataset.label || currentLabel || button.textContent.trim().replace(/\s+/g, " ");
}

function decorateSidebarButton(button) {
  const label = getSidebarButtonLabel(button);
  if (!label) return;
  button.dataset.label = label;
  button.title = label;
  if (button.querySelector(".admin-nav-icon") && button.querySelector(".admin-nav-label")?.textContent?.trim() === label) return;
  const view = button.dataset.view
    || (button.id === "audience-nav" ? "audiencia" : "")
    || (button.id === "editorial-approvals-nav" ? "aprovacoes" : "")
    || "dashboard";
  button.innerHTML = `${renderAdminModuleIcon(view, "admin-nav-icon")}<span class="admin-nav-label">${escapeHtml(label)}</span>`;
}

function refreshSidebarNavigation() {
  document.querySelectorAll(".admin-nav button").forEach(decorateSidebarButton);
}

function renderAdminNavigation() {
  const nav = document.querySelector(".admin-nav");
  if (!nav) return;
  nav.dataset.fixed = "1";
  nav.dataset.grouped = "1";
  nav.innerHTML = adminNavigationGroups.map(group => `
    <section class="admin-nav-group" aria-label="${escapeHtml(group.label)}">
      <p class="admin-nav-group-label">${escapeHtml(group.label)}</p>
      <div class="admin-nav-group-items">
        ${group.items.map(item => {
          const attrs = [`type="button"`, `data-module="${escapeHtml(item.module)}"`, `data-label="${escapeHtml(item.label)}"`, `data-group="${escapeHtml(group.label)}"`];
          attrs.push(`data-view="${escapeHtml(item.view)}"`);
          if (item.view === "audiencia") attrs.push(`id="audience-nav"`);
          if (item.view === "aprovacoes") attrs.push(`id="editorial-approvals-nav"`);
          if (item.view === "midia") attrs.push(`id="media-library-nav"`);
          return `<button ${attrs.join(" ")}>${escapeHtml(item.label)}</button>`;
        }).join("")}
      </div>
    </section>
  `).join("");
  refreshSidebarNavigation();
}

const resources = {
  noticias: { label:"Notícias", title:"titulo", order:"atualizado_em", fields:[
    ["titulo","Título","text",true],["slug","Slug","text",true],["subtitulo","Subtítulo","text"],["resumo","Resumo","textarea"],["categoria_nome","Categoria","text"],["autor","Autor","text"],["imagem_url","URL da imagem","url"],["legenda_imagem","Legenda da imagem","text"],["status","Status","status"],["destaque","Destaque","boolean"],["publicado_em","Publicação","datetime-local"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"],["seo_imagem","Imagem SEO","url"],["conteudo_html","Conteúdo","editor"]]},
  guia_comercial: { label:"Guia comercial", title:"nome", order:"atualizado_em", fields:[
    ["nome","Nome","text",true],["slug","Slug","text",true],["categoria_nome","Categoria","text"],["descricao","Descrição","textarea"],["imagem_url","URL da imagem","url"],["galeria_urls","Galeria do app (4 fotos extras)","gallery-urls"],["whatsapp","WhatsApp","text"],["telefone","Telefone","text"],["instagram","Instagram","url"],["facebook","Facebook","url"],["site","Site","url"],["endereco","Endereço","text"],["horario","Horário do site","text"],["opening_hours","Horários para o aplicativo","weekly-hours"],["opening_hours_note","Observação do horário no app","text"],["mapa_url","Mapa","url"],["recomendado","Recomendado","boolean"],["recomendado_editorial","Recomendado pelo Eu Amo Urânia","boolean"],["status","Status","status"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"]]},
  turismo: { label:"Turismo", title:"nome", order:"atualizado_em", fields:[["nome","Nome","text",true],["slug","Slug","text",true],["descricao","Descrição","textarea"],["conteudo_html","Conteúdo","editor"],["imagem_url","Imagem","url"],["galeria_urls","Galeria do app (4 fotos extras)","gallery-urls"],["endereco","Endereço","text"],["horario","Horário do site","text"],["opening_hours","Horários para o aplicativo","weekly-hours"],["opening_hours_note","Observação do horário no app","text"],["whatsapp","WhatsApp","text"],["mapa_url","Mapa","url"],["latitude","Latitude","number"],["longitude","Longitude","number"],["curadoria_euamourania","Curadoria Eu Amo Urânia","boolean"],["destaque","Destaque","boolean"],["status","Status","status"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"]]},
  links: { label:"Links", title:"titulo", order:"ordem", ascending:true, fields:[["titulo","Título","text",true],["url","URL","url",true],["icone","Ícone/emoji","text"],["rotulo","Rótulo do destaque","text"],["descricao","Descrição do destaque","textarea"],["tipo_destaque","Tipo de destaque","link-feature-type"],["ordem","Ordem","number"],["status","Status","active-status"]]},
  colaboradores_voluntarios: { label:"Colaborações voluntárias", title:"nome", order:"criado_em", fields:[["nome","Nome","text",true],["whatsapp","WhatsApp","text",true],["email","E-mail","email"],["cidade","Cidade","text"],["interesses","Interesses","tags"],["mensagem","Mensagem","textarea"],["status","Status","volunteer-status"],["observacoes_internas","Observações internas","textarea"],["aceite_voluntario","Aceite voluntário","boolean"]]},
  eventos: { label:"Eventos", title:"titulo", order:"atualizado_em", fields:[["titulo","Título","text",true],["titulo_curto","Título curto no app","text"],["slug","Slug","text",true],["descricao","Descrição","textarea"],["imagem_url","Imagem","url"],["data_inicio","Início","datetime-local"],["data_fim","Fim","datetime-local"],["local","Local","text"],["endereco","Endereço","text"],["organizador","Organizador","text"],["whatsapp","WhatsApp","text"],["destaque","Destaque","boolean"],["status","Status","status"]]},
  banners: { label:"Banners", title:"titulo", order:"ordem", ascending:true, fields:[["titulo","Título","text"],["subtitulo","Subtítulo","text"],["imagem_url","Imagem","url"],["link_url","Link","url"],["posicao","Posição","text"],["ordem","Ordem","number"],["status","Status","active-status"]]},
  categorias: { label:"Categorias", title:"nome", order:"ordem", ascending:true, fields:[["nome","Nome","text",true],["slug","Slug","text",true],["tipo","Tipo","category-type",true],["ordem","Ordem","number"],["status","Status","active-status"]]},
  configuracoes_site: { label:"Configurações", title:"chave", order:"chave", ascending:true, fields:[["chave","Chave","text",true],["valor","Valor","textarea"],["tipo","Tipo","text"]]}
};

Object.assign(resources, {
  noticias: { label:"Notícias", title:"titulo", order:"atualizado_em", fields:[
    ["titulo","Título","text",true],["slug","Slug","text",true],["subtitulo","Subtítulo","text"],["resumo","Resumo","textarea"],["categoria_nome","Categoria","text"],["autor","Autor","text"],["imagem_url","URL da imagem","url"],["legenda_imagem","Legenda da imagem","text"],["status","Status","status"],["destaque","Destaque","boolean"],["publicado_em","Publicação","datetime-local"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"],["seo_imagem","Imagem SEO","url"],["conteudo_html","Conteúdo","editor"]]},
  guia_comercial: { label:"Guia comercial", title:"nome", order:"atualizado_em", fields:[
    ["nome","Nome","text",true],["slug","Slug","text",true],["categoria_nome","Categoria","text"],["descricao","Descrição","textarea"],["imagem_url","URL da imagem","url"],["galeria_urls","Galeria do app (4 fotos extras)","gallery-urls"],["whatsapp","WhatsApp","text"],["telefone","Telefone","text"],["instagram","Instagram","url"],["facebook","Facebook","url"],["site","Site","url"],["endereco","Endereço","text"],["horario","Horário do site","text"],["opening_hours","Horários para o aplicativo","weekly-hours"],["opening_hours_note","Observação do horário no app","text"],["mapa_url","Mapa","url"],["recomendado","Recomendado","boolean"],["recomendado_editorial","Recomendado pelo Eu Amo Urânia","boolean"],["status","Status","status"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"]]},
  turismo: { label:"Turismo", title:"nome", order:"atualizado_em", fields:[["nome","Nome","text",true],["slug","Slug","text",true],["descricao","Descrição","textarea"],["conteudo_html","Conteúdo","editor"],["imagem_url","Imagem","url"],["galeria_urls","Galeria do app (4 fotos extras)","gallery-urls"],["endereco","Endereço","text"],["horario","Horário do site","text"],["opening_hours","Horários para o aplicativo","weekly-hours"],["opening_hours_note","Observação do horário no app","text"],["whatsapp","WhatsApp","text"],["mapa_url","Mapa","url"],["latitude","Latitude","number"],["longitude","Longitude","number"],["curadoria_euamourania","Curadoria Eu Amo Urânia","boolean"],["destaque","Destaque","boolean"],["status","Status","status"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"]]},
  links: { label:"Links", title:"titulo", order:"ordem", ascending:true, fields:[["titulo","Título","text",true],["url","URL","url",true],["icone","Ícone/emoji","text"],["rotulo","Rótulo do destaque","text"],["descricao","Descrição do destaque","textarea"],["tipo_destaque","Tipo de destaque","link-feature-type"],["ordem","Ordem","number"],["status","Status","active-status"]]},
  colaboradores_voluntarios: { label:"Colaborações voluntárias", title:"nome", order:"criado_em", fields:[["nome","Nome","text",true],["whatsapp","WhatsApp","text",true],["email","E-mail","email"],["cidade","Cidade","text"],["interesses","Interesses","tags"],["mensagem","Mensagem","textarea"],["status","Status","volunteer-status"],["observacoes_internas","Observações internas","textarea"],["aceite_voluntario","Aceite voluntário","boolean"]]},
  eventos: { label:"Agenda simples", title:"titulo", order:"atualizado_em", fields:[["titulo","Título","text",true],["titulo_curto","Título curto no app","text"],["slug","Slug","text",true],["descricao","Descrição","textarea"],["imagem_url","Imagem","url"],["data_inicio","Início","datetime-local"],["data_fim","Fim","datetime-local"],["recorrencia_tipo","Repetição","event-simple-recurrence"],["recorrencia_ate","Repetir até","datetime-local"],["local","Local","text"],["endereco","Endereço","text"],["organizador","Organizador","text"],["whatsapp","WhatsApp","text"],["destaque","Destaque","boolean"],["status","Status","status"]]},
  banners: { label:"Banners", title:"titulo", order:"ordem", ascending:true, fields:[["titulo","Título","text"],["subtitulo","Subtítulo","text"],["imagem_url","Imagem","url"],["link_url","Link","url"],["posicao","Posição","text"],["ordem","Ordem","number"],["status","Status","active-status"]]},
  categorias: { label:"Categorias", title:"nome", order:"ordem", ascending:true, fields:[["nome","Nome","text",true],["slug","Slug","text",true],["tipo","Tipo","category-type",true],["ordem","Ordem","number"],["status","Status","active-status"]]},
  configuracoes_site: { label:"Configurações", title:"chave", order:"chave", ascending:true, fields:[["chave","Chave","text",true],["valor","Valor","textarea"],["tipo","Tipo","text"]]},
  eventos_principais: { label:"Eventos principais", title:"nome", order:"atualizado_em", fields:[["nome","Nome do evento","text",true],["slug","Slug","text",true],["descricao_curta","Descrição curta","textarea"],["historia_html","História do evento","editor"],["imagem_capa_url","Imagem de capa","url"],["galeria_historica","Galeria histórica","url-list"],["categoria","Categoria","text"],["local_tradicional","Local tradicional","text"],["recorrencia","Recorrência","event-recurrence"],["periodo_aproximado","Período aproximado","text"],["organizador","Organizador","text"],["telefone","Telefone","text"],["email","E-mail","email"],["website","Website","url"],["instagram","Instagram","url"],["facebook","Facebook","url"],["ativo","Ativo","boolean"],["destaque","Destaque","boolean"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"],["palavras_chave","Palavras-chave","text"]]},
  eventos_edicoes: { label:"Edições de eventos", title:"titulo", order:"ano", ascending:false, fields:[["evento_id","Evento principal","event-principal-select",true],["ano","Ano","number",true],["edicao_label","Rótulo da edição","text"],["slug","Slug da edição","text"],["titulo","Título da edição","text",true],["titulo_curto","Título curto no app","text"],["subtitulo","Subtítulo","text"],["organizador","Organização da edição","text"],["data_inicio","Início","datetime-local"],["data_fim","Fim","datetime-local"],["programacao_html","Programação","editor"],["atracoes_html","Atrações","textarea"],["cartaz_url","Cartaz oficial","url"],["banner_url","Banner","url"],["galeria","Galeria da edição","url-list"],["videos","Vídeos","line-list"],["local","Local","text"],["endereco","Endereço","text"],["mapa_url","Link do mapa","url"],["latitude","Latitude","number"],["longitude","Longitude","number"],["links_uteis","Links úteis","line-list"],["patrocinadores","Patrocinadores","line-list"],["status","Status da edição","event-edition-status"],["resumo_pos_evento_html","Resumo pós-evento","textarea"],["publico_estimado","Público estimado","number"],["observacoes","Observações","textarea"],["destaque","Destaque","boolean"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"],["palavras_chave","Palavras-chave","text"]]}
});

function adicionarCamposDestaqueHome() {
  const campos = [
    ["destaque_home", "Destaque da Home", "boolean"],
    ["destaque_home_inicio", "Início do destaque", "datetime-local"],
    ["destaque_home_fim", "Fim do destaque", "datetime-local"]
  ];
  for (const tabela of ["noticias", "guia_comercial", "turismo", "eventos"]) {
    const recurso = resources[tabela];
    if (!recurso || recurso.fields.some(([nome]) => nome === "destaque_home")) continue;
    const statusIndex = recurso.fields.findIndex(([nome]) => nome === "status");
    const insertAt = statusIndex >= 0 ?statusIndex : recurso.fields.length;
    recurso.fields.splice(insertAt, 0, ...campos);
  }
}

adicionarCamposDestaqueHome();

const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const inputValue = (value, type) => type === "datetime-local" && value ?new Date(value).toISOString().slice(0,16) : value ?? "";
const validSiteReference = value => !value || /^(?:https?:\/\/|mailto:|tel:|\/(?!\/)|\.{1,2}\/|#)/i.test(value) || (/^[\w.-]+(?:\/[\w\-./%~:+?#[\]@!$&'()*+,;=]*)?$/u.test(value) && !/^javascript:/i.test(value));
const listValue = value => Array.isArray(value) ?value.map(item => item?.url || item?.nome || item?.titulo || item).filter(Boolean).join("\n") : "";
const parseUrlList = value => String(value || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean).map(url => ({ url }));
const parseLineList = value => String(value || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean).map(nome => ({ nome }));
const EXTRA_GALLERY_LIMIT = 4;
function adminModuleMeta(view) {
  return adminNavigationItems.find(item => item.view === view)
    || { label: resources[view]?.label || "Módulo", group: "Painel" };
}
function resourceDescription(table) {
  return {
    noticias: "Gerencie matérias, rascunhos, SEO e publicação editorial do portal.",
    guia_comercial: "Organize empresas do Guia Comercial e os dados exibidos no Viva Urânia.",
    turismo: "Gerencie atrativos, imagens, localização e informações turísticas públicas.",
    links: "Edite a vitrine de links oficiais, destaques e atalhos exibidos ao público.",
    colaboradores_voluntarios: "Acompanhe pessoas interessadas em colaborar com iniciativas locais.",
    eventos: "Cadastre eventos simples exibidos na agenda pública e no aplicativo.",
    eventos_principais: "Organize eventos tradicionais, recorrentes e permanentes da cidade.",
    eventos_edicoes: "Gerencie edições, programação, cartazes e histórico dos eventos principais.",
    categorias: "Padronize categorias usadas em notícias, guia, turismo e eventos.",
    configuracoes_site: "Ajuste configurações globais, textos e chaves usadas pelo portal.",
    banners: "Gerencie banners e chamadas visuais usadas nos espaços públicos."
  }[table] || `Gerencie os registros de ${resources[table]?.label || table}.`;
}
function resourceActionLabel(table) {
  return {
    noticias: "Nova notícia",
    guia_comercial: "Cadastrar empresa",
    turismo: "Adicionar local",
    links: "Novo link",
    colaboradores_voluntarios: "Nova colaboração",
    eventos: "Novo evento",
    eventos_principais: "Novo evento principal",
    eventos_edicoes: "Nova edição",
    categorias: "Nova categoria",
    configuracoes_site: "Nova configuração",
    banners: "Novo banner"
  }[table] || "Novo cadastro";
}
function resourceRowSearch(row, config) {
  return [
    row?.[config.title],
    row?.status,
    row?.categoria_nome,
    row?.autor,
    row?.slug,
    row?.local,
    row?.nome,
    row?.titulo,
    row?.cidade
  ].filter(Boolean).join(" ").toLowerCase();
}
function resourceRowStatus(row) {
  if (row?.status) return row.status;
  if (row?.ativo === true) return "ativo";
  if (row?.ativo === false) return "inativo";
  return "";
}
function resourceUpdatedAt(row) {
  const value = row?.atualizado_em || row?.criado_em || row?.publicado_em || row?.data_inicio;
  return value ?new Date(value).toLocaleDateString("pt-BR") : "—";
}
const normalizeGalleryUrls = value => Array.isArray(value) ?value.map(item => typeof item === "string" ?item : item?.url || item?.imagem_url).filter(Boolean).slice(0,EXTRA_GALLERY_LIMIT) : [];
function galleryUrlsHtml(name,label,value){
  const urls=normalizeGalleryUrls(value);
  const folder=currentResourceTable==="turismo"?"turismo/galeria":currentResourceTable==="guia_comercial"?"guia/galeria":`galerias/${name}`;
  return `<fieldset class="full-row cms-gallery-field" data-gallery-field="${name}"><legend>${label}</legend><div class="cms-gallery-head"><span>Imagem principal + extras</span><strong>${urls.length}/${EXTRA_GALLERY_LIMIT}</strong></div><p class="field-hint">A imagem principal já conta como a primeira foto. Adicione aqui só até 4 fotos extras para o carrossel do aplicativo.</p><div class="cms-gallery-list">${Array.from({length:EXTRA_GALLERY_LIMIT},(_,index)=>`<label><span>Foto extra ${index+1}</span><input type="text" inputmode="url" data-type="url" data-cms-image="true" data-media-folder="${escapeHtml(folder)}" data-media-preset="card" name="${name}_${index}" value="${escapeHtml(urls[index]||"")}" placeholder="Escolher da biblioteca ou colar URL"></label>`).join("")}</div></fieldset>`;
}
function collectGalleryUrls(form,name){
  return Array.from({length:EXTRA_GALLERY_LIMIT},(_,index)=>String(form.get(`${name}_${index}`)||"").trim()).filter(Boolean).filter((url,index,array)=>array.indexOf(url)===index);
}
const WEEK_DAYS = [["mon","Segunda-feira"],["tue","Terça-feira"],["wed","Quarta-feira"],["thu","Quinta-feira"],["fri","Sexta-feira"],["sat","Sábado"],["sun","Domingo"]];
const weeklyDayRecord = (value, day) => value && typeof value === "object" && !Array.isArray(value) ? value?.[day] || {} : {};
function weeklyHourPeriods(value, day) {
  const item = weeklyDayRecord(value, day);
  const periods = Array.isArray(item.periods) ? item.periods : [];
  const normalized = periods
    .map(period => ({ open: String(period?.open || "").trim(), close: String(period?.close || "").trim() }))
    .filter(period => period.open || period.close);
  if (!normalized.length && (item.open || item.close)) normalized.push({ open: item.open || "", close: item.close || "" });
  return [normalized[0] || { open: "", close: "" }, normalized[1] || { open: "", close: "" }];
}
const weeklyPeriodValue = (value, day, index, key) => escapeHtml(weeklyHourPeriods(value, day)[index]?.[key] || "");
const weeklyHourChecked = (value, day) => value && typeof value === "object" && !Array.isArray(value) && value?.[day]?.closed ?"checked" : "";
const weeklyHourIs24 = (value, day) => {
  const item = weeklyDayRecord(value, day);
  return Boolean(item.twenty_four_hours || item.open_24h || item.is_24h || item.all_day || (!item.closed && item.open === "00:00" && ["23:59","24:00","00:00"].includes(item.close)));
};
const weeklyHour24Checked = (value, day) => weeklyHourIs24(value, day) ? "checked" : "";
const weeklyHourDisabled = (value, day) => weeklyHourChecked(value, day) || weeklyHourIs24(value, day) ? "disabled" : "";
function weeklyPeriodHtml(name, key, day, index, data) {
  const label = index ? "2º turno" : "1º turno";
  return `<div class="weekly-period" data-weekly-period="${index}"><span>${label}</span><label>Abre<input type="time" name="${name}_${key}_open_${index}" value="${weeklyPeriodValue(data,key,index,"open")}" aria-label="${day} ${label} abre" ${weeklyHourDisabled(data,key)}></label><label>Fecha<input type="time" name="${name}_${key}_close_${index}" value="${weeklyPeriodValue(data,key,index,"close")}" aria-label="${day} ${label} fecha" ${weeklyHourDisabled(data,key)}></label></div>`;
}
function weeklyHoursHtml(name,label,value){
  const data=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
  return `<fieldset class="full-row weekly-hours" data-weekly-hours="${name}"><legend>${label}</legend><div class="weekly-hours-head"><p>Use estes horários no aplicativo. O site continua usando o campo “Horário do site”.</p><div class="weekly-hours-actions"><button type="button" data-weekly-all-24>Todos 24h</button><button type="button" data-weekly-copy-weekdays>Seg–sex = segunda</button><button type="button" data-weekly-copy-sat>Sábado = sexta</button><button type="button" data-weekly-copy-sun>Domingo = sábado</button><button type="button" data-weekly-clear>Limpar</button></div></div>${WEEK_DAYS.map(([key,day],index)=>`<details class="weekly-day" data-weekly-day="${key}"><summary><strong>${day}</strong><span data-weekly-summary="${key}">${weeklyHourSummary(data,key)}</span></summary><div class="weekly-day-body"><div class="weekly-periods">${weeklyPeriodHtml(name,key,day,0,data)}${weeklyPeriodHtml(name,key,day,1,data)}</div><div class="weekly-day-options"><label class="weekly-24h"><input type="checkbox" name="${name}_${key}_24h" value="true" ${weeklyHour24Checked(data,key)}> 24h</label><label class="weekly-closed"><input type="checkbox" name="${name}_${key}_closed" value="true" ${weeklyHourChecked(data,key)}> Fechado</label>${index?`<button type="button" class="weekly-copy-prev" data-weekly-copy-prev="${key}">Usar dia anterior</button>`:""}</div></div></details>`).join("")}</fieldset>`;
}
function weeklyHourSummary(data,key){
  const item=data?.[key]||{};
  if(item.closed)return "Fechado";
  if(item.twenty_four_hours || item.open_24h || item.is_24h || item.all_day)return "Aberto 24 horas";
  const periods=weeklyHourPeriods(data,key).filter(period=>period.open||period.close);
  if(periods.length)return periods.map(period=>period.open&&period.close?`${period.open}–${period.close}`:period.open?`Abre ${period.open}`:`Fecha ${period.close}`).join(" / ");
  return "Não configurado";
}
function collectWeeklyHours(form,name){
  const result={};let hasValue=false;
  for(const [key] of WEEK_DAYS){
    const periods=[0,1].map(index=>({
      open:String(form.get(`${name}_${key}_open_${index}`)||"").trim(),
      close:String(form.get(`${name}_${key}_close_${index}`)||"").trim()
    })).filter(period=>period.open||period.close);
    const [firstPeriod={open:"",close:""}]=periods;
    const closed=form.get(`${name}_${key}_closed`) === "true";
    const twentyFourHours=form.get(`${name}_${key}_24h`) === "true";
    if(periods.length||closed||twentyFourHours){result[key]=twentyFourHours?{open:"00:00",close:"23:59",closed:false,twenty_four_hours:true,periods:[{open:"00:00",close:"23:59"}]}:{open:firstPeriod.open||null,close:firstPeriod.close||null,closed,periods};hasValue=true;}
  }
  return hasValue?result:null;
}
function weeklyDayData(root,name,key){
  const periods=[0,1].map(index=>({
    open:root.querySelector(`[name="${name}_${key}_open_${index}"]`)?.value||"",
    close:root.querySelector(`[name="${name}_${key}_close_${index}"]`)?.value||""
  })).filter(period=>period.open||period.close);
  const [firstPeriod={open:"",close:""}]=periods;
  const closed=Boolean(root.querySelector(`[name="${name}_${key}_closed"]`)?.checked);
  const twenty_four_hours=Boolean(root.querySelector(`[name="${name}_${key}_24h"]`)?.checked);
  return {open:firstPeriod.open,close:firstPeriod.close,closed,twenty_four_hours,periods};
}
function setWeeklyDay(root,name,key,data){
  const periods=Array.isArray(data.periods)&&data.periods.length?data.periods:[{open:data.open||"",close:data.close||""}];
  for(const index of [0,1]){
    const open=root.querySelector(`[name="${name}_${key}_open_${index}"]`);
    const close=root.querySelector(`[name="${name}_${key}_close_${index}"]`);
    if(open)open.value=periods[index]?.open||"";
    if(close)close.value=periods[index]?.close||"";
  }
  const closed=root.querySelector(`[name="${name}_${key}_closed"]`);
  const twentyFourHours=root.querySelector(`[name="${name}_${key}_24h"]`);
  if(closed)closed.checked=Boolean(data.closed);
  if(twentyFourHours)twentyFourHours.checked=Boolean(data.twenty_four_hours || data.open_24h || data.is_24h || data.all_day);
  applyWeeklyDayState(root,name,key);
  updateWeeklySummary(root,name,key);
}
function applyWeeklyDayState(root,name,key){
  const closed=root.querySelector(`[name="${name}_${key}_closed"]`);
  const twentyFourHours=root.querySelector(`[name="${name}_${key}_24h"]`);
  const disabled=Boolean(twentyFourHours?.checked||closed?.checked);
  for(const input of root.querySelectorAll(`[name^="${name}_${key}_open_"],[name^="${name}_${key}_close_"]`))input.disabled=disabled;
}
function updateWeeklySummary(root,name,key){
  const summary=root.querySelector(`[data-weekly-summary="${key}"]`);
  if(!summary)return;
  applyWeeklyDayState(root,name,key);
  summary.textContent=weeklyHourSummary({[key]:weeklyDayData(root,name,key)},key);
}
function handleWeeklyHoursAction(event){
  const button=event.target.closest("[data-weekly-all-24],[data-weekly-copy-weekdays],[data-weekly-copy-sat],[data-weekly-copy-sun],[data-weekly-clear],[data-weekly-copy-prev]");
  if(!button)return;
  const root=button.closest(".weekly-hours");
  if(!root)return;
  event.preventDefault();
  const name=root.dataset.weeklyHours;
  if(button.hasAttribute("data-weekly-clear")){
    for(const [key] of WEEK_DAYS)setWeeklyDay(root,name,key,{open:"",close:"",closed:false,twenty_four_hours:false});
    return;
  }
  if(button.hasAttribute("data-weekly-all-24")){
    for(const [key] of WEEK_DAYS)setWeeklyDay(root,name,key,{open:"",close:"",closed:false,twenty_four_hours:true});
    return;
  }
  if(button.hasAttribute("data-weekly-copy-weekdays")){
    const source=weeklyDayData(root,name,"mon");
    for(const key of ["tue","wed","thu","fri"])setWeeklyDay(root,name,key,source);
    return;
  }
  if(button.hasAttribute("data-weekly-copy-sat"))return setWeeklyDay(root,name,"sat",weeklyDayData(root,name,"fri"));
  if(button.hasAttribute("data-weekly-copy-sun"))return setWeeklyDay(root,name,"sun",weeklyDayData(root,name,"sat"));
  const key=button.dataset.weeklyCopyPrev;
  const index=WEEK_DAYS.findIndex(([dayKey])=>dayKey===key);
  if(index>0)setWeeklyDay(root,name,key,weeklyDayData(root,name,WEEK_DAYS[index-1][0]));
}
function handleWeeklyHoursChange(event){
  const root=event.target.closest?.(".weekly-hours");
  if(!root)return;
  const name=root.dataset.weeklyHours;
  const prefix=`${name}_`;
  const inputName=event.target.name||"";
  if(!inputName.startsWith(prefix))return;
  const key=inputName.slice(prefix.length).split("_")[0];
  if(inputName.endsWith("_24h")&&event.target.checked){
    const closed=root.querySelector(`[name="${name}_${key}_closed"]`);
    if(closed)closed.checked=false;
  }
  if(inputName.endsWith("_closed")&&event.target.checked){
    const twentyFourHours=root.querySelector(`[name="${name}_${key}_24h"]`);
    if(twentyFourHours)twentyFourHours.checked=false;
  }
  updateWeeklySummary(root,name,key);
}
document.addEventListener("click",handleWeeklyHoursAction);
document.addEventListener("input",handleWeeklyHoursChange);
document.addEventListener("change",handleWeeklyHoursChange);
async function legacyDashboard() {
  title.textContent = "Visão geral";
  app.innerHTML = '<div class="loading">Carregando indicadores...</div>';
  const supabase = getSupabase();
  const count = async (table, filters={}) => { let q=supabase.from(table).select("*",{count:"exact",head:true}); Object.entries(filters).forEach(([k,v])=>q=q.eq(k,v)); const {count,error}=await q; if(error) throw error; return count||0; };
  const safeCount = async (table, filters={}) => { try { return await count(table, filters); } catch { return 0; } };
  try {
    const [
      noticias,publicadas,rascunhos,empresas,empresasAtivas,pontos,eventos,eventosAtivos,links,
      campanhas,campanhasAtivas,newsletters,assinantes,melhoresEdicoes,melhoresIndicados,aprovacoes
    ] = await Promise.all([
      safeCount("noticias"),
      safeCount("noticias",{status:"publicado"}),
      safeCount("noticias",{status:"rascunho"}),
      safeCount("guia_comercial"),
      safeCount("guia_comercial",{status:"publicado"}),
      safeCount("turismo"),
      safeCount("eventos"),
      safeCount("eventos",{status:"publicado"}),
      safeCount("links",{status:"ativo"}),
      safeCount("campanhas_publicitarias"),
      safeCount("campanhas_publicitarias",{status:"ativo"}),
      safeCount("newsletters"),
      safeCount("newsletter_assinantes",{status:"ativo"}),
      safeCount("melhores_edicoes"),
      safeCount("melhores_indicados",{status:"ativo"}),
      safeCount("solicitacoes_aprovacao",{status:"pendente"})
    ]);
    const { data: recentNews = [] } = await supabase
      .from("noticias")
      .select("titulo,status,atualizado_em")
      .order("atualizado_em",{ascending:false})
      .limit(5);
    const metrics=[
      ["Notícias",noticias,`${publicadas} publicadas · ${rascunhos} rascunhos`],
      ["Empresas",empresas,`${empresasAtivas} publicadas no guia`],
      ["Turismo",pontos,"pontos turísticos cadastrados"],
      ["Eventos",eventos,`${eventosAtivos} publicados`],
      ["Publicidade",campanhas,`${campanhasAtivas} campanhas ativas`],
      ["Comunicação",newsletters,`${assinantes} assinantes ativos`],
      ["Melhores de Urânia",melhoresEdicoes,`${melhoresIndicados} indicados ativos`],
      ["Links ativos",links,"canais e links publicados"]
    ];
    app.innerHTML=`
      <section class="dashboard-welcome panel">
        <div>
          <p class="eyebrow">Painel Eu Amo Urânia</p>
          <h2>Visão geral do portal</h2>
          <p>Acompanhe conteúdo, audiência, campanhas, comunicação e a operação do Melhores de Urânia em um só lugar.</p>
        </div>
        ${aprovacoes?`<button class="admin-button" id="dashboard-approvals">${aprovacoes} aprovação(ões) pendente(s)</button>`:""}
      </section>
      <div class="dashboard-grid">${metrics.map(([label,value,detail])=>`<article class="metric-card"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join("")}</div>
      <div class="dashboard-grid dashboard-actions">
        <button class="metric-card" data-view="noticias"><span>Editorial</span><strong>Notícias</strong><small>Criar, revisar e publicar</small></button>
        <button class="metric-card" data-view="melhores"><span>Prêmio</span><strong>Melhores de Urânia</strong><small>Votação, apuração e resultados</small></button>
        <button class="metric-card" id="dashboard-audience"><span>Dados</span><strong>Audiência</strong><small>Visualizações, cliques e buscas</small></button>
        <button class="metric-card" data-view="publicidade"><span>Receita</span><strong>Publicidade</strong><small>Campanhas e desempenho</small></button>
      </div>
      <section class="panel">
        <header class="panel-header"><h2>Notícias recentes</h2></header>
        ${recentNews.length?recentNews.map(item=>`<div class="rank-item"><strong>${escapeHtml(item.titulo)}</strong><small>${escapeHtml(item.status||"")} · ${item.atualizado_em?new Date(item.atualizado_em).toLocaleDateString("pt-BR"):"sem data"}</small></div>`).join(""):'<div class="empty-state">Nenhuma notícia recente.</div>'}
      </section>`;
  } catch(error) { app.innerHTML=`<p class="form-message">${escapeHtml(error.message)}</p>`; }
}

async function dashboardBase() {
  title.textContent = "Visão geral";
  app.innerHTML = '<div class="loading">Carregando indicadores...</div>';
  const supabase = getSupabase();
  const count = async (table, filters = {}) => {
    let query = supabase.from(table).select("*", { count: "exact", head: true });
    Object.entries(filters).forEach(([field, value]) => {
      if (value && typeof value === "object" && "op" in value) query = query[value.op](field, value.value);
      else query = query.eq(field, value);
    });
    const { count: total, error } = await query;
    if (error) throw error;
    return total || 0;
  };
  const safeCount = async (table, filters = {}) => {
    try { return await count(table, filters); } catch { return 0; }
  };
  const safeList = async builder => {
    try {
      const { data, error } = await builder();
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  };
  const fmtDate = value => value ?new Date(value).toLocaleDateString("pt-BR") : "sem data";
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [
      noticias, publicadas, rascunhos, empresas, empresasAtivas, pontos, pontosAtivos,
      eventos, eventosAtivos, links, campanhas, campanhasAtivas, assinantes,
      melhoresEdicoes, melhoresIndicados, aprovacoes, views7d, whatsapp7d
    ] = await Promise.all([
      safeCount("noticias"),
      safeCount("noticias", { status: "publicado" }),
      safeCount("noticias", { status: "rascunho" }),
      safeCount("guia_comercial"),
      safeCount("guia_comercial", { status: "publicado" }),
      safeCount("turismo"),
      safeCount("turismo", { status: "publicado" }),
      safeCount("eventos"),
      safeCount("eventos", { status: "publicado" }),
      safeCount("links", { status: "ativo" }),
      safeCount("campanhas_publicitarias"),
      safeCount("campanhas_publicitarias", { status: "ativo" }),
      safeCount("newsletter_assinantes", { status: "ativo" }),
      safeCount("melhores_edicoes", { status: { op: "neq", value: "arquivada" } }),
      safeCount("melhores_indicados", { status: "ativo" }),
      safeCount("solicitacoes_aprovacao", { status: "pendente" }),
      safeCount("analytics_eventos", { criado_em: { op: "gte", value: sevenDaysAgo } }),
      safeCount("analytics_eventos", { tipo: "whatsapp_click", criado_em: { op: "gte", value: sevenDaysAgo } })
    ]);

    const [recentNews, pendingApprovals, recentEditions] = await Promise.all([
      safeList(() => supabase.from("noticias").select("titulo,status,status_editorial,publicado_em,atualizado_em").order("atualizado_em", { ascending: false }).limit(5)),
      safeList(() => supabase.from("solicitacoes_aprovacao").select("id,status,enviado_em,noticias(titulo,status,status_editorial)").eq("status", "pendente").order("enviado_em", { ascending: false }).limit(5)),
      safeList(() => supabase.from("melhores_edicoes").select("nome,ano,status,atualizado_em").neq("status", "arquivada").order("ano", { ascending: false }).limit(4))
    ]);

    const primaryMetrics = [
      ["Editorial", publicadas, "Notícias publicadas", `${rascunhos} rascunho(s) · ${noticias} no total`],
      ["Fluxo", aprovacoes, "Aprovações pendentes", aprovacoes ?"Precisa de revisão editorial" : "Fila editorial em dia"],
      ["Dados reais", views7d, "Audiência 7 dias", `${whatsapp7d} clique(s) no WhatsApp`],
      ["Publicidade", campanhasAtivas, "Campanhas ativas", `${campanhas} campanha(s) cadastrada(s)`]
    ];
    const secondaryMetrics = [
      ["Guia", empresas, `${empresasAtivas} empresas publicadas`],
      ["Turismo", pontos, `${pontosAtivos} pontos publicados`],
      ["Eventos", eventos, `${eventosAtivos} publicados`],
      ["Comunicação", assinantes, "assinantes ativos"],
      ["Melhores de Urânia", melhoresEdicoes, `${melhoresIndicados} indicados ativos`],
      ["Links", links, "links ativos"]
    ];
    const pendingTasks = [
      aprovacoes ?[`${aprovacoes} matéria(s) aguardando aprovação`, "Abrir fila", "aprovacoes"] : null,
      rascunhos ?[`${rascunhos} notícia(s) em rascunho`, "Ver notícias", "noticias"] : null,
      campanhasAtivas ?null : ["Nenhuma campanha publicitária ativa", "Criar campanha", "publicidade"],
      melhoresEdicoes ?null : ["Nenhuma edição ativa do Melhores cadastrada", "Abrir Melhores", "melhores"]
    ].filter(Boolean);

    app.innerHTML = `
      <section class="dashboard-hero panel">
        <div>
          <p class="eyebrow">Painel Eu Amo Urânia</p>
          <h2>Central de controle do portal</h2>
          <p>Resumo operacional com conteúdo, aprovações, audiência, publicidade e Melhores de Urânia em um só lugar.</p>
        </div>
        <div class="dashboard-hero-actions">
          <button class="admin-button" data-new="noticias">Nova notícia</button>
          <button class="admin-button secondary" id="dashboard-audience">Ver audiência</button>
        </div>
      </section>
      <div class="dashboard-primary-grid">
        ${primaryMetrics.map(([kicker, value, label, detail]) => `<article class="dashboard-kpi"><span>${kicker}</span><strong>${value}</strong><h3>${label}</h3><p>${detail}</p></article>`).join("")}
      </div>
      <div class="dashboard-layout">
        <section class="panel dashboard-section">
          <header class="panel-header"><div><h2>O que precisa de atenção</h2><p>Atalhos para as próximas ações do painel.</p></div></header>
          <div class="dashboard-task-list">
            ${pendingTasks.length ?pendingTasks.map(([text, action, target]) => `<button class="dashboard-task" ${target === "aprovacoes" ?"id=\"dashboard-approvals\"" : `data-view="${target}"`}><span>${escapeHtml(text)}</span><strong>${escapeHtml(action)} →</strong></button>`).join("") : '<div class="dashboard-empty-good">Tudo certo por aqui. Nenhuma pendência importante agora.</div>'}
          </div>
        </section>
        <section class="panel dashboard-section">
          <header class="panel-header"><div><h2>Estrutura do portal</h2><p>Dados gerais de conteúdo publicado e módulos ativos.</p></div></header>
          <div class="dashboard-mini-grid">
            ${secondaryMetrics.map(([label, value, detail]) => `<article class="dashboard-mini-card"><strong>${value}</strong><span>${label}</span><small>${detail}</small></article>`).join("")}
          </div>
        </section>
      </div>
      <div class="dashboard-layout dashboard-bottom">
        <section class="panel dashboard-section">
          <header class="panel-header"><div><h2>Últimas notícias</h2><p>Conteúdos editados recentemente.</p></div><button class="admin-button secondary" data-view="noticias">Ver todas</button></header>
          <div class="dashboard-list">
            ${recentNews.length ?recentNews.map(item => `<article class="dashboard-list-row"><div><strong>${escapeHtml(item.titulo)}</strong><small>${escapeHtml(item.status_editorial || item.status || "")} · ${fmtDate(item.publicado_em || item.atualizado_em)}</small></div><span class="status-pill ${escapeHtml(item.status || "")}">${escapeHtml(item.status || "—")}</span></article>`).join("") : '<div class="empty-state">Nenhuma notícia recente.</div>'}
          </div>
        </section>
        <section class="panel dashboard-section">
          <header class="panel-header"><div><h2>Aprovações e edições</h2><p>Fila editorial e últimas edições do prêmio.</p></div></header>
          <div class="dashboard-list">
            ${pendingApprovals.length ?pendingApprovals.map(item => `<article class="dashboard-list-row"><div><strong>${escapeHtml(item.noticias?.titulo || "Notícia em revisão")}</strong><small>Enviada em ${fmtDate(item.enviado_em)}</small></div><span class="status-pill">${escapeHtml(item.status)}</span></article>`).join("") : '<div class="dashboard-empty-good compact">Sem aprovações pendentes.</div>'}
            ${recentEditions.length ?recentEditions.map(item => `<article class="dashboard-list-row"><div><strong>${escapeHtml(item.nome || `Melhores ${item.ano}`)}</strong><small>${item.ano} · ${fmtDate(item.atualizado_em)}</small></div><span class="status-pill">${escapeHtml(item.status || "—")}</span></article>`).join("") : '<div class="empty-state">Nenhuma edição do Melhores cadastrada.</div>'}
          </div>
        </section>
      </div>
      <div class="dashboard-quick-actions">
        <button class="metric-card" data-view="noticias"><span>Editorial</span><strong>Notícias</strong><small>Criar, revisar e publicar</small></button>
        <button class="metric-card" data-view="melhores"><span>Prêmio</span><strong>Melhores de Urânia</strong><small>Votação, apuração e resultados</small></button>
        <button class="metric-card" data-view="publicidade"><span>Receita</span><strong>Publicidade</strong><small>Campanhas e desempenho</small></button>
        <button class="metric-card" data-view="comunicacao"><span>Relacionamento</span><strong>Comunicação</strong><small>Newsletter e assinantes</small></button>
      </div>`;
  } catch(error) {
    app.innerHTML = `<p class="form-message">${escapeHtml(error.message)}</p>`;
  }
}

async function dashboard() {
  activeModuleKey = "dashboard";
  app.dataset.layout = "dashboard";
  setShellTitle("Visão geral", getAdminModule("dashboard").description, { moduleKey: "dashboard" });
  app.innerHTML = '<div class="loading">Carregando central de operação...</div>';
  const supabase = getSupabase();
  const now = new Date();
  const isoNow = now.toISOString();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const nextSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const hour = now.getHours();
  const saudacao = hour < 12 ?"Bom dia" : hour < 18 ?"Boa tarde" : "Boa noite";
  const rawName = painelAccess?.admin?.nome || painelAccess?.user?.user_metadata?.name || "";
  const firstNameCandidate = String(rawName).split(/\s|@/).filter(Boolean)[0] || "";
  const firstName = ["eu", "admin", "usuario", "usuário"].includes(firstNameCandidate.toLowerCase()) ? "" : firstNameCandidate;
  const fmtDate = value => value ?new Date(value).toLocaleDateString("pt-BR") : "sem data";
  const fmtNumber = value => Number(value || 0).toLocaleString("pt-BR");
  const pct = (part, total) => total ?`${Math.round((Number(part || 0) / Number(total || 1)) * 100)}%` : "0%";
  const applyFilter = (query, field, value) => {
    if (value && typeof value === "object" && "op" in value) return query[value.op](field, value.value);
    return query.eq(field, value);
  };
  const count = async (table, filters = {}) => {
    let query = supabase.from(table).select("*", { count: "exact", head: true });
    Object.entries(filters).forEach(([field, value]) => { query = applyFilter(query, field, value); });
    const { count: total, error } = await query;
    if (error) throw error;
    return total || 0;
  };
  const safeCount = async (table, filters = {}) => {
    try { return await count(table, filters); } catch { return 0; }
  };
  const safeList = async builder => {
    try {
      const { data, error } = await builder();
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  };
  const rank = (rows, key, limit = 5) => Object.entries(rows.reduce((acc, item) => {
    const label = item?.[key] || "Não informado";
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([label, total]) => ({ label, total }));
  const listRows = rows => rows.length ?rows.map(item => `<article class="dashboard-list-row"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail || "")}</small></div>${item.badge ?`<span class="status-pill ${escapeHtml(item.badgeClass || "")}">${escapeHtml(item.badge)}</span>` : ""}</article>`).join("") : '<div class="empty-state">Nenhum registro no momento.</div>';

  try {
    const [
      noticias, publicadas, rascunhos, agendadas, emRevisao,
      empresas, empresasAtivas, pontos, pontosAtivos, eventos, eventosAtivos, eventosProximos, eventosPrincipais, eventosEdicoes,
      links, campanhas, campanhasAtivas, campanhasVencendo, assinantes, melhoresEdicoes, melhoresIndicados,
      aprovacoes, colaboradores, colaboradoresNovos, categorias, usuariosAtivos, viewsHoje, views7d, views30d, whatsapp7d, external7d,
      eventSubmissionsPending, businessSubmissionsPending
    ] = await Promise.all([
      safeCount("noticias"),
      safeCount("noticias", { status: "publicado" }),
      safeCount("noticias", { status: "rascunho" }),
      safeCount("noticias", { status: "publicado", publicado_em: { op: "gt", value: isoNow } }),
      safeCount("noticias", { status_editorial: "em_revisao" }),
      safeCount("guia_comercial"),
      safeCount("guia_comercial", { status: "publicado" }),
      safeCount("turismo"),
      safeCount("turismo", { status: "publicado" }),
      safeCount("eventos"),
      safeCount("eventos", { status: "publicado" }),
      safeCount("eventos", { status: "publicado", data_inicio: { op: "gte", value: isoNow } }),
      safeCount("eventos_principais", { ativo: true }),
      safeCount("eventos_edicoes"),
      safeCount("links", { status: "ativo" }),
      safeCount("campanhas_publicitarias"),
      safeCount("campanhas_publicitarias", { status: "ativo" }),
      safeCount("campanhas_publicitarias", { status: "ativo", data_fim: { op: "lte", value: nextSevenDays } }),
      safeCount("newsletter_assinantes", { status: "ativo" }),
      safeCount("melhores_edicoes", { status: { op: "neq", value: "arquivada" } }),
      safeCount("melhores_indicados", { status: "ativo" }),
      safeCount("solicitacoes_aprovacao", { status: "pendente" }),
      safeCount("colaboradores_voluntarios"),
      safeCount("colaboradores_voluntarios", { status: "novo" }),
      safeCount("categorias", { status: "ativo" }),
      safeCount("usuarios_admin", { ativo: true }),
      safeCount("analytics_eventos", { criado_em: { op: "gte", value: todayStartIso } }),
      safeCount("analytics_eventos", { criado_em: { op: "gte", value: sevenDaysAgo } }),
      safeCount("analytics_eventos", { criado_em: { op: "gte", value: thirtyDaysAgo } }),
      safeCount("analytics_eventos", { tipo: "whatsapp_click", criado_em: { op: "gte", value: sevenDaysAgo } }),
      safeCount("analytics_eventos", { tipo: "external_click", criado_em: { op: "gte", value: sevenDaysAgo } }),
      safeCount("event_submissions", { status: "pending" }),
      safeCount("business_submissions", { status: "pending" })
    ]);

    const [recentNews, scheduledNews, pendingApprovals, recentEditions, recentActivities, analyticsEvents, upcomingEvents, endingCampaigns, recentCollaborators, recentMainEvents, recentEventEditions] = await Promise.all([
      safeList(() => supabase.from("noticias").select("titulo,categoria_nome,autor,status,status_editorial,publicado_em,atualizado_em").order("atualizado_em", { ascending: false }).limit(6)),
      safeList(() => supabase.from("noticias").select("titulo,status,publicado_em").eq("status", "publicado").gt("publicado_em", isoNow).order("publicado_em", { ascending: true }).limit(4)),
      safeList(() => supabase.from("solicitacoes_aprovacao").select("id,status,enviado_em,noticias(titulo,status,status_editorial)").eq("status", "pendente").order("enviado_em", { ascending: false }).limit(5)),
      safeList(() => supabase.from("melhores_edicoes").select("nome,ano,status,atualizado_em").neq("status", "arquivada").order("ano", { ascending: false }).limit(4)),
      safeList(() => supabase.from("cms_atividades").select("titulo,acao,tabela,criado_em").order("criado_em", { ascending: false }).limit(6)),
      safeList(() => supabase.from("analytics_eventos").select("tipo,pagina,dispositivo,origem,sessao_hash,criado_em").gte("criado_em", sevenDaysAgo).order("criado_em", { ascending: false }).limit(900)),
      safeList(() => supabase.from("eventos").select("titulo,status,data_inicio,local").eq("status", "publicado").gte("data_inicio", isoNow).order("data_inicio", { ascending: true }).limit(5)),
      safeList(() => supabase.from("campanhas_publicitarias").select("nome,status,data_fim,empresa_anunciante").eq("status", "ativo").lte("data_fim", nextSevenDays).order("data_fim", { ascending: true }).limit(5)),
      safeList(() => supabase.from("colaboradores_voluntarios").select("nome,cidade,status,interesses,criado_em").order("criado_em", { ascending: false }).limit(5)),
      safeList(() => supabase.from("eventos_principais").select("nome,categoria,ativo,atualizado_em").eq("ativo", true).order("atualizado_em", { ascending: false }).limit(4)),
      safeList(() => supabase.from("eventos_edicoes").select("titulo,ano,status,data_inicio,atualizado_em,eventos_principais(nome)").order("ano", { ascending: false }).limit(4))
    ]);
    const businessQualityRows = await safeList(() => supabase
      .from("guia_comercial")
      .select("*")
      .neq("status", "arquivado")
      .limit(1000));
    const guideQuality = summarizeBusinessQuality(businessQualityRows);

    const uniqueVisitors = new Set(analyticsEvents.map(item => item.sessao_hash).filter(Boolean)).size;
    const topPages = rank(analyticsEvents, "pagina", 6);
    const topDevices = rank(analyticsEvents, "dispositivo", 4);
    const topOrigins = rank(analyticsEvents, "origem", 4);
    const importantAlerts = [
      aprovacoes ?[`${aprovacoes} notícia(s) aguardando aprovação`, "Abrir aprovações", "aprovacoes", "warning"] : null,
      colaboradoresNovos ?[`${colaboradoresNovos} colaborador(es) voluntário(s) aguardando contato`, "Ver colaborações", "colaboradores_voluntarios", "info"] : null,
      eventSubmissionsPending ?[`${eventSubmissionsPending} sugestão(ões) de evento aguardando análise`, "Ver agenda", "eventos", "info"] : null,
      businessSubmissionsPending ?[`${businessSubmissionsPending} cadastro(s) do guia aguardando análise`, "Ver guia", "guia_comercial", "info"] : null,
      emRevisao ?[`${emRevisao} notícia(s) em revisão editorial`, "Ver notícias", "noticias", "info"] : null,
      rascunhos ?[`${rascunhos} rascunho(s) parado(s) no editorial`, "Organizar pauta", "noticias", "warning"] : null,
      agendadas ?[`${agendadas} notícia(s) agendada(s) para o futuro`, "Conferir agenda", "noticias", "info"] : null,
      campanhasVencendo ?[`${campanhasVencendo} campanha(s) vencendo em até 7 dias`, "Abrir publicidade", "publicidade", "danger"] : null,
      campanhasAtivas ?null : ["Nenhuma campanha publicitária ativa", "Criar campanha", "publicidade", "warning"],
      eventosProximos ?[`${eventosProximos} evento(s) futuro(s) publicado(s)`, "Ver agenda", "eventos", "success"] : null,
      eventosPrincipais && !eventosEdicoes ?["Eventos principais sem edições cadastradas", "Abrir edições", "eventos_edicoes", "warning"] : null,
      melhoresEdicoes ?null : ["Nenhuma edição ativa do Melhores", "Abrir Melhores", "melhores", "warning"]
    ].filter(Boolean);
    const attentionTotal = importantAlerts.reduce((sum, item) => sum + Math.max(1, Number(String(item[0]).match(/^\d+/)?.[0] || 1)), 0);
    const portalScore = Math.max(0, 100 - (aprovacoes * 8) - (rascunhos * 3) - (campanhasVencendo * 6) - (colaboradoresNovos * 4) - (eventSubmissionsPending * 3) - (businessSubmissionsPending * 3) - (campanhasAtivas ?0 : 10));
    const targetAttrs = target => `data-view="${escapeHtml(target)}"`;
    const primaryMetrics = [
      ["Saúde", `${portalScore}%`, "saúde da operação", importantAlerts.length ?`${importantAlerts.length} área(s) pedindo atenção` : "Rotina sem alerta importante"],
      ["Hoje", fmtNumber(viewsHoje), "interações registradas", "Fonte: analytics_eventos"],
      ["7 dias", fmtNumber(views7d), "movimento recente", `${fmtNumber(uniqueVisitors)} visitante(s) identificáveis`],
      ["Editorial", fmtNumber(publicadas), "notícias publicadas", `${rascunhos} rascunho(s) · ${agendadas} agendada(s)`],
      ["Atenção", fmtNumber(attentionTotal), "itens acionáveis", importantAlerts.length ?"Veja a fila principal abaixo" : "Rotina sem alerta importante"]
    ];
    const ecosystemCards = [
      ["Portal editorial", `${publicadas} notícias`, `${aprovacoes} aprovação(ões) · ${agendadas} agendada(s)`, "noticias"],
      ["Viva Urânia", `${empresasAtivas} empresas · ${pontosAtivos} atrativos`, `${eventosAtivos} evento(s) simples publicado(s)`, "guia_comercial"],
      ["Publicidade", `${campanhasAtivas} campanhas ativas`, `${campanhasVencendo} vencendo em até 7 dias`, "publicidade"],
      ["Comunicação", `${assinantes} assinantes`, `${colaboradoresNovos} colaborador(es) novo(s)`, "comunicacao"],
      ["Verificação", "Guia 100d · Turismo 180d", "Rotina de revisão dos cadastros publicados", "turismo_verificacao"],
      ["Melhores", `${melhoresEdicoes} edição(ões)`, `${melhoresIndicados} indicado(s) ativos`, "melhores"]
    ];
    const qualityCards = [
      ["missing_hours", "Sem horário", guideQuality.missingHours, "Horário estruturado ausente ou incompleto"],
      ["missing_address", "Sem endereço", guideQuality.missingAddress, "Endereço não informado"],
      ["missing_whatsapp", "Sem WhatsApp", guideQuality.missingWhatsapp, "Contato direto incompleto"],
      ["missing_image", "Sem imagem", guideQuality.missingImage, "Imagem principal ausente"],
      ["missing_category", "Sem categoria", guideQuality.missingCategory, "Categoria não informada"],
      ["missing_description", "Sem descrição", guideQuality.missingDescription, "Texto de apresentação ausente"],
      ["missing_location", "Sem localização", guideQuality.missingLocation, "Sem mapa ou coordenadas"],
      ["complete", "Completos", guideQuality.complete, `${guideQuality.averageScore}% de média geral`]
    ];
    const newsRows = recentNews.map(item => ({ title: item.titulo || "Notícia sem título", detail: `${item.categoria_nome || "Sem editoria"} · ${item.autor || "Eu Amo Urânia"} · ${item.publicado_em ?`publicada em ${fmtDate(item.publicado_em)}` : `editada em ${fmtDate(item.atualizado_em)}`}`, badge: item.status_editorial || item.status || "—", badgeClass: item.status || "" }));
    const scheduledRows = scheduledNews.map(item => ({ title: item.titulo || "Notícia agendada", detail: `Publicação prevista para ${fmtDate(item.publicado_em)}`, badge: "agendada", badgeClass: "info" }));
    const approvalRows = pendingApprovals.map(item => ({ title: item.noticias?.titulo || "Notícia em revisão", detail: `Enviada em ${fmtDate(item.enviado_em)}`, badge: item.status || "pendente" }));
    const editionRows = recentEditions.map(item => ({ title: item.nome || `Melhores ${item.ano}`, detail: `${item.ano} · atualizado em ${fmtDate(item.atualizado_em)}`, badge: item.status || "—" }));
    const activityRows = recentActivities.map(item => ({ title: item.titulo || item.tabela || "Atividade", detail: `${item.acao || "ação"} · ${fmtDate(item.criado_em)}`, badge: item.tabela || "" }));
    const eventRows = upcomingEvents.map(item => ({ title: item.titulo || "Evento", detail: `${fmtDate(item.data_inicio)}${item.local ?` · ${item.local}` : ""}`, badge: item.status || "" }));
    const mainEventRows = recentMainEvents.map(item => ({ title: item.nome || "Evento principal", detail: `${item.categoria || "Acervo permanente"} · atualizado em ${fmtDate(item.atualizado_em)}`, badge: item.ativo ?"ativo" : "inativo", badgeClass: item.ativo ?"ativo" : "" }));
    const eventEditionRows = recentEventEditions.map(item => ({ title: item.titulo || `Edição ${item.ano}`, detail: `${item.eventos_principais?.nome || "Evento"} · ${item.ano} · ${fmtDate(item.data_inicio || item.atualizado_em)}`, badge: item.status || "edição" }));
    const campaignRows = endingCampaigns.map(item => ({ title: item.nome || "Campanha", detail: `${item.empresa_anunciante || "Anunciante"} · vence em ${fmtDate(item.data_fim)}`, badge: item.status || "ativo", badgeClass: "ativo" }));
    const collaboratorRows = recentCollaborators.map(item => ({ title: item.nome || "Colaborador voluntário", detail: `${item.cidade || "Cidade não informada"} · ${(item.interesses || []).slice(0, 3).join(", ") || "sem interesses"} · ${fmtDate(item.criado_em)}`, badge: item.status || "novo", badgeClass: item.status || "" }));
    const quickActions = [
      ["Nova notícia", "Editorial", "Publicar ou salvar rascunho", "noticias", "new"],
      ["Novo evento", "Agenda", "Criar item da agenda pública", "eventos", "new"],
      ["Cadastrar empresa", "Guia", "Adicionar negócio ao ecossistema", "guia_comercial", "new"],
      ["Adicionar local", "Turismo", "Cadastrar ponto turístico", "turismo", "new"],
      ["Enviar notificação", "App", "Abrir comunicação push", "notificacoes", "view"],
      ["Nova publicidade", "Comercial", "Abrir gestão de campanhas", "publicidade", "view"]
    ];
    const moduleIndicators = {
      dashboard: `${fmtNumber(attentionTotal)} atenção`,
      audiencia: `${fmtNumber(views7d)} 7d`,
      noticias: `${fmtNumber(publicadas)} pub.`,
      aprovacoes: `${fmtNumber(aprovacoes)} pend.`,
      eventos: `${fmtNumber(eventosProximos)} próx.`,
      eventos_principais: `${fmtNumber(eventosPrincipais)} ativos`,
      eventos_edicoes: `${fmtNumber(eventosEdicoes)} edições`,
      categorias: `${fmtNumber(categorias)} ativas`,
      guia_comercial: `${fmtNumber(empresasAtivas)} pub.`,
      guia_verificacao: `${fmtNumber(Math.max(0, guideQuality.total - guideQuality.complete))} revisar`,
      turismo: `${fmtNumber(pontosAtivos)} pub.`,
      turismo_verificacao: "180d",
      telefones_uteis: "App",
      motoristas: "App",
      iniciativas: "Comunidade",
      vantagens: "Parceiros",
      links: `${fmtNumber(links)} ativos`,
      publicidade: `${fmtNumber(campanhasAtivas)} ativas`,
      melhores: `${fmtNumber(melhoresEdicoes)} edições`,
      comunicacao: `${fmtNumber(assinantes)} ativos`,
      notificacoes: "Push",
      colaboradores_voluntarios: `${fmtNumber(colaboradoresNovos)} novos`,
      submissoes: `${fmtNumber(eventSubmissionsPending + businessSubmissionsPending)} pend.`,
      configuracoes_site: "Global",
      usuarios: `${fmtNumber(usuariosAtivos)} ativos`,
      importacao: "JSON"
    };
    const domainDescriptions = {
      "Operação": "Leitura geral, audiência e saúde do ecossistema.",
      "Conteúdo": "Editorial, agenda, categorias e acervo público.",
      "Viva Urânia": "Tudo que alimenta o aplicativo e a experiência local.",
      "Comercial": "Publicidade, assinaturas e premiação Melhores de Urânia.",
      "Comunicação": "Relacionamento, push, submissões e comunidade.",
      "Sistema": "Configuração, acesso e ferramentas técnicas."
    };
    const domainHtml = adminNavigationGroups.map(group => `
      <article class="ops-domain">
        <header>
          <h3>${escapeHtml(group.label)}</h3>
          <p>${escapeHtml(domainDescriptions[group.label] || "Módulos administrativos conectados.")}</p>
        </header>
        <div class="ops-domain-modules">
          ${group.items.map(item => `<button class="ops-module-link" data-view="${escapeHtml(item.view)}">
            ${renderAdminModuleIcon(item.view)}
            <strong>${escapeHtml(item.label)}</strong>
            <small>${escapeHtml(moduleIndicators[item.view] || item.dashboard?.indicator || "")}</small>
          </button>`).join("")}
        </div>
      </article>
    `).join("");

    app.innerHTML = `
      <section class="ops-dashboard">
        <section class="ops-hero panel">
          <div class="ops-hero-copy">
            <p class="eyebrow">Central de operação</p>
            <h2>${saudacao}${firstName ?`, ${escapeHtml(firstName)}` : ""}.</h2>
            <p>Um resumo limpo do que precisa de atenção, do que está acontecendo agora e de como o portal está performando.</p>
            <div class="ops-hero-actions">
              <button class="admin-button" data-new="noticias">Nova notícia</button>
              <button class="admin-button secondary" ${targetAttrs("audiencia")}>Ver audiência</button>
            </div>
          </div>
        </section>

        <section class="ops-kpi-grid" aria-label="Indicadores principais">
          ${primaryMetrics.map(([kicker, value, label, detail]) => `<article class="ops-kpi"><span>${kicker}</span><strong>${value}</strong><h3>${label}</h3><p>${detail}</p></article>`).join("")}
        </section>

        <section class="ops-section panel ops-quick-panel">
          <header class="ops-section-header">
            <div>
              <p class="eyebrow">Ações rápidas</p>
              <h2>O que você provavelmente quer fazer agora</h2>
            </div>
          </header>
          <div class="ops-quick-grid">
            ${quickActions.map(([label, group, detail, target, mode]) => `<button class="ops-quick-action" ${mode === "new" ?`data-new="${target}"` :`data-view="${target}"`}>
              <span>${escapeHtml(group)}</span>
              <strong>${escapeHtml(label)}</strong>
              <small>${escapeHtml(detail)}</small>
            </button>`).join("")}
          </div>
        </section>

        <section class="ops-section panel ops-attention">
          <header class="ops-section-header">
            <div>
              <p class="eyebrow">Prioridade</p>
              <h2>Precisa da sua atenção</h2>
            </div>
            <span>${fmtNumber(attentionTotal)} item(ns)</span>
          </header>
          <div class="ops-attention-list">
            ${importantAlerts.length ?importantAlerts.map(([text, action, target, tone]) => `<button class="ops-attention-item ${tone || ""}" ${targetAttrs(target)}><span>${escapeHtml(text)}</span><strong>${escapeHtml(action)} →</strong></button>`).join("") : '<div class="ops-empty">Tudo certo por aqui. Nenhuma pendência importante agora.</div>'}
          </div>
        </section>

        <section class="ops-section panel">
          <header class="ops-section-header">
            <div>
              <p class="eyebrow">Áreas do sistema</p>
              <h2>Todo o ecossistema em um único painel</h2>
              <small>Os módulos abaixo vêm do registry global: sidebar, busca, dashboard e cabeçalhos usam a mesma identidade.</small>
            </div>
          </header>
          <div class="ops-system-domains">
            ${domainHtml}
          </div>
        </section>

        <section class="ops-two-columns">
          <div class="ops-section panel">
            <header class="ops-section-header">
              <div>
                <p class="eyebrow">Rotina</p>
                <h2>Operação</h2>
              </div>
            </header>
            <div class="ops-inline-summary">
              <span>${fmtNumber(recentNews.length)} notícias recentes</span>
              <span>${fmtNumber(scheduledRows.length)} agendadas</span>
              <span>${fmtNumber(eventRows.length)} eventos próximos</span>
              <span>${fmtNumber(campaignRows.length)} campanhas vencendo</span>
            </div>
            <div class="ops-stack">
              <div class="ops-subsection"><h3>Notícias recentes</h3><div class="dashboard-list">${listRows(newsRows.slice(0, 4))}</div></div>
              <div class="ops-subsection"><h3>Agendadas</h3><div class="dashboard-list">${listRows(scheduledRows)}</div></div>
              <div class="ops-subsection"><h3>Próximos eventos e campanhas</h3><div class="dashboard-list">${listRows([...eventRows, ...campaignRows].slice(0, 6))}</div></div>
            </div>
          </div>

          <div class="ops-section panel">
            <header class="ops-section-header">
              <div>
                <p class="eyebrow">Leitura rápida</p>
                <h2>Últimas atividades</h2>
              </div>
            </header>
            <div class="ops-inline-summary">
              <span>${fmtNumber(colaboradoresNovos)} novos colaboradores</span>
              <span>${fmtNumber(recentActivities.length)} ações recentes</span>
            </div>
            <div class="dashboard-list">${listRows([...collaboratorRows, ...activityRows].slice(0, 8))}</div>
          </div>
        </section>

        <section class="ops-section panel">
          <header class="ops-section-header">
            <div>
              <p class="eyebrow">Desempenho</p>
              <h2>Audiência do portal</h2>
              <small>Fonte única nesta visão: eventos internos registrados em analytics_eventos.</small>
            </div>
            <button class="admin-button secondary" onclick="document.getElementById('dashboard-audience')?.click()">Abrir análise completa</button>
          </header>
          <div class="ops-performance-grid">
            <article><strong>${fmtNumber(views30d)}</strong><span>interações em 30 dias</span></article>
            <article><strong>${fmtNumber(whatsapp7d)}</strong><span>cliques no WhatsApp em 7 dias</span></article>
            <article><strong>${fmtNumber(external7d)}</strong><span>cliques externos em 7 dias</span></article>
          </div>
          <div class="dashboard-rank-columns ops-rank-columns">
            <div><h3>Páginas mais acessadas</h3>${topPages.length ?topPages.map(item => `<p><span>${escapeHtml(item.label)}</span><strong>${item.total}</strong></p>`).join("") : '<small>Sem dados no período.</small>'}</div>
            <div><h3>Dispositivos</h3>${topDevices.length ?topDevices.map(item => `<p><span>${escapeHtml(item.label)}</span><strong>${item.total}</strong></p>`).join("") : '<small>Sem dados no período.</small>'}</div>
            <div><h3>Origem</h3>${topOrigins.length ?topOrigins.map(item => `<p><span>${escapeHtml(item.label)}</span><strong>${item.total}</strong></p>`).join("") : '<small>Sem dados no período.</small>'}</div>
          </div>
        </section>

        <section class="ops-section panel">
          <header class="ops-section-header">
            <div>
              <p class="eyebrow">Ecossistema</p>
              <h2>Portal, app e módulos conectados</h2>
            </div>
          </header>
          <div class="ops-ecosystem-grid">
            ${ecosystemCards.map(([label, value, detail, target]) => `<button class="ops-ecosystem-card" ${targetAttrs(target)}><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></button>`).join("")}
          </div>
        </section>

        <section class="ops-section panel">
          <header class="ops-section-header">
            <div>
              <p class="eyebrow">Guia Comercial</p>
              <h2>Qualidade dos cadastros</h2>
              <small>Indicadores derivados dos dados atuais. Não bloqueiam publicação.</small>
            </div>
            <button class="admin-button secondary" data-view="guia_verificacao" data-quality-filter="all">Abrir diagnóstico</button>
          </header>
          <div class="ops-ecosystem-grid">
            ${qualityCards.map(([filter, label, value, detail]) => `<button class="ops-ecosystem-card" data-view="guia_verificacao" data-quality-filter="${escapeHtml(filter)}"><span>${escapeHtml(label)}</span><strong>${fmtNumber(value)}</strong><small>${escapeHtml(detail)}</small></button>`).join("")}
          </div>
        </section>

        <section class="ops-two-columns">
          <div class="ops-section panel">
            <header class="ops-section-header"><div><p class="eyebrow">Prêmio</p><h2>Melhores de Urânia</h2></div><button class="admin-button secondary" data-view="melhores">Abrir módulo</button></header>
            <div class="dashboard-list">${listRows(editionRows)}</div>
          </div>
          <div class="ops-section panel">
            <header class="ops-section-header"><div><p class="eyebrow">Acervo</p><h2>Eventos principais</h2></div><button class="admin-button secondary" data-view="eventos_principais">Ver eventos</button></header>
            <div class="dashboard-list">${listRows([...mainEventRows, ...eventEditionRows].slice(0, 7))}</div>
          </div>
        </section>
      </section>`;
  } catch (error) {
    app.innerHTML = `<p class="form-message">${escapeHtml(error.message)}</p>`;
  }
}

async function resourceList(table) {
  const config=resources[table];
  const meta = adminModuleMeta(table);
  activeModuleKey = table;
  app.dataset.layout = "wide";
  setShellTitle(config.label, meta.description || resourceDescription(table), {
    moduleKey: table,
    contextLabel: meta.group,
    actionHtml: `<button class="admin-button" data-new="${table}">${escapeHtml(resourceActionLabel(table))}</button>`
  });
  app.innerHTML='<div class="loading">Carregando...</div>';
  try {
    const rows=await listarTabela(table,{ordem:config.order,crescente:config.ascending||false});
    const statuses = [...new Set(rows.map(resourceRowStatus).filter(Boolean))].sort((a,b) => a.localeCompare(b, "pt-BR"));
    app.innerHTML=`
      <section class="admin-page admin-page-wide">
        <section class="panel admin-list-panel">
          <div class="admin-filterbar">
            <label class="admin-search-field"><span>Buscar</span><input id="resource-search" type="search" autocomplete="off" placeholder="Nome, status, categoria ou local"></label>
            <label class="admin-status-field"><span>Status</span><select id="resource-status"><option value="">Todos</option>${statuses.map(status => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join("")}</select></label>
            <span class="admin-filter-count" id="resource-count">${rows.length} registro(s)</span>
          </div>
          ${rows.length ?`
            <div class="table-wrap admin-data-table-wrap">
              <table class="admin-data-table">
                <thead><tr><th>Registro</th><th>Status</th><th>Atualização</th><th>Ações</th></tr></thead>
                <tbody>
                  ${rows.map(row=>{
                    const status = resourceRowStatus(row);
                    const titleValue = row[config.title] || "Sem título";
                    const subtitle = [row.categoria_nome, row.slug, row.local, row.cidade].filter(Boolean).slice(0, 2).join(" · ");
                    return `<tr data-admin-row data-search="${escapeHtml(resourceRowSearch(row, config))}" data-status="${escapeHtml(status)}">
                      <td class="admin-title-cell"><strong>${escapeHtml(titleValue)}</strong>${subtitle ?`<small>${escapeHtml(subtitle)}</small>` : ""}</td>
                      <td><span class="status-pill ${escapeHtml(status)}">${escapeHtml(status || "—")}</span></td>
                      <td>${resourceUpdatedAt(row)}</td>
                      <td><div class="admin-row-actions"><button type="button" data-edit="${table}" data-id="${row.id}">Editar</button><button type="button" class="danger" data-delete="${table}" data-id="${row.id}">Excluir</button></div></td>
                    </tr>`;
                  }).join("")}
                </tbody>
              </table>
            </div>
            <div class="admin-empty-state compact" data-filter-empty hidden>
              <strong>Nenhum resultado encontrado.</strong>
              <span>Revise a busca ou remova o filtro de status.</span>
            </div>
          ` :`
            <div class="admin-empty-state">
              <strong>Nenhum registro ainda.</strong>
              <span>Comece criando o primeiro item deste módulo.</span>
              <button class="admin-button" data-new="${table}">${escapeHtml(resourceActionLabel(table))}</button>
            </div>
          `}
        </section>
      </section>`;
    const searchInput = app.querySelector("#resource-search");
    const statusSelect = app.querySelector("#resource-status");
    const countLabel = app.querySelector("#resource-count");
    const filterEmpty = app.querySelector("[data-filter-empty]");
    const applyResourceFilter = () => {
      const term = searchInput?.value.trim().toLowerCase() || "";
      const selectedStatus = statusSelect?.value || "";
      let visible = 0;
      app.querySelectorAll("[data-admin-row]").forEach(row => {
        const matchesTerm = !term || row.dataset.search?.includes(term);
        const matchesStatus = !selectedStatus || row.dataset.status === selectedStatus;
        const show = Boolean(matchesTerm && matchesStatus);
        row.hidden = !show;
        if (show) visible += 1;
      });
      if (countLabel) countLabel.textContent = `${visible} de ${rows.length} registro(s)`;
      if (filterEmpty) filterEmpty.hidden = visible !== 0 || rows.length === 0;
    };
    searchInput?.addEventListener("input", applyResourceFilter);
    statusSelect?.addEventListener("change", applyResourceFilter);
  } catch(error) { app.innerHTML=`<p class="form-message">${escapeHtml(error.message)}</p>`; }
}

function selectOptionLabel(option, type) {
  if (type === "link-feature-type") {
    return {
      normal: "Normal",
      grupo_whatsapp: "Grupo do WhatsApp",
      app: "Bloco do app"
    }[option] || option;
  }
  return option;
}

function fieldHtml([name,label,type,required], value) {
  const req=required?"required":"", full=["textarea","editor"].includes(type)?"full-row":"";
  if(type==="editor") return `<label class="${full}">${label}<div id="editor"></div><input type="hidden" name="${name}"></label>`;
  if(type==="textarea") return `<label class="${full}">${label}<textarea name="${name}" ${req}>${escapeHtml(inputValue(value,type))}</textarea></label>`;
  if(type==="boolean") return `<label>${label}<select name="${name}"><option value="false" ${!value?"selected":""}>Não</option><option value="true" ${value?"selected":""}>Sim</option></select></label>`;
  if(type==="tags") return `<label class="${full}">${label}<input type="text" name="${name}" value="${escapeHtml(Array.isArray(value)?value.join(", "):inputValue(value,type))}" placeholder="pautas, fotos, eventos"><small>Separe por vírgula.</small></label>`;
  if(type==="event-principal-select") return `<label>${label}<select name="${name}" data-event-principal-select data-current="${escapeHtml(inputValue(value,type))}" ${req}><option value="">Carregando eventos principais...</option></select><small>Escolha o evento principal. Não precisa copiar ID.</small></label>`;
  const options=type==="status"?["rascunho","publicado","arquivado"]:type==="active-status"?["ativo","inativo"]:type==="category-type"?["noticias","guia","turismo","eventos"]:type==="link-feature-type"?["normal","grupo_whatsapp","app"]:type==="volunteer-status"?["novo","em_conversa","aprovado","recusado","arquivado"]:type==="event-recurrence"?["anual","mensal","unico","outro"]:type==="event-simple-recurrence"?["nenhuma","semanal","mensal","anual"]:type==="event-edition-status"?["anunciado","confirmado","acontecendo","encerrado","cancelado"]:null;
  if(options) return `<label>${label}<select name="${name}">${options.map(o=>`<option value="${o}" ${value===o?"selected":""}>${selectOptionLabel(o,type)}</option>`).join("")}</select></label>`;
  const inputType=type==="url"||type==="number"?"text":type,urlAttributes=type==="url"?' inputmode="url" data-type="url" placeholder="https://... ou /assets/..."':type==="number"?' inputmode="decimal" data-type="number" placeholder="Ex.: -20.2046718"':"";
  return `<label class="${full}">${label}<input type="${inputType}"${urlAttributes} name="${name}" value="${escapeHtml(inputValue(value,type))}" ${req}></label>`;
}

function parseAdminNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/\s+/g, "").replace(",", ".");
  const number = Number(normalized);
  if (!Number.isFinite(number)) throw new Error("Número inválido");
  return number;
}

function normalizeCoordinateInputs(container = app) {
  container
    .querySelectorAll('input[name="latitude"], input[name="longitude"]')
    .forEach((input) => {
      input.type = "text";
      input.inputMode = "decimal";
      input.dataset.type = "number";
      input.placeholder = "Ex.: -20.2046718";
      input.removeAttribute("step");
      input.removeAttribute("min");
      input.removeAttribute("max");
    });
}

async function carregarSelectEventosPrincipais() {
  const select = app.querySelector("[data-event-principal-select]");
  if (!select) return;
  const current = select.dataset.current || "";
  try {
    const { data = [], error } = await getSupabase()
      .from("eventos_principais")
      .select("id,nome,slug,ativo")
      .order("nome", { ascending: true });
    if (error) throw error;
    select.innerHTML = `<option value="">Selecione um evento principal</option>${data.map(item => `<option value="${escapeHtml(item.id)}" ${item.id===current?"selected":""}>${escapeHtml(item.nome)}${item.ativo===false?" (inativo)":""}</option>`).join("")}`;
    if (!data.length) select.innerHTML = '<option value="">Cadastre um evento principal primeiro</option>';
  } catch (error) {
    select.innerHTML = '<option value="">Não foi possível carregar os eventos</option>';
  }
}

const SIMPLE_EVENT_RECURRENCES = new Set(["semanal", "mensal", "anual"]);

function simpleEventIsRecurring(value) {
  return SIMPLE_EVENT_RECURRENCES.has(String(value || ""));
}

function extractTimeFromDateTime(value) {
  const raw = String(value || "");
  const match = raw.match(/T(\d{2}:\d{2})/);
  if (match) return match[1];
  if (/^\d{2}:\d{2}/.test(raw)) return raw.slice(0, 5);
  return "";
}

function setFieldCaption(input, label) {
  const wrapper = input?.closest?.("label");
  if (!wrapper) return;
  const textNode = Array.from(wrapper.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  if (textNode) textNode.textContent = label;
  else wrapper.insertAdjacentText("afterbegin", label);
}

function setFieldHint(input, text) {
  const wrapper = input?.closest?.("label");
  if (!wrapper) return;
  let hint = wrapper.querySelector("[data-simple-event-hint]");
  if (!text) {
    hint?.remove();
    return;
  }
  if (!hint) {
    hint = document.createElement("small");
    hint.dataset.simpleEventHint = "true";
    wrapper.append(hint);
  }
  hint.textContent = text;
}

function setupSimpleEventRecurrenceForm(container) {
  if (currentResourceTable !== "eventos") return;
  const form = container.querySelector("#resource-form");
  if (!form) return;
  const recurrenceInput = form.elements.recorrencia_tipo;
  const startInput = form.elements.data_inicio;
  const endInput = form.elements.data_fim;
  const repeatUntilInput = form.elements.recorrencia_ate;
  if (!recurrenceInput || !startInput || !endInput) return;

  form.classList.add("simple-event-form");
  endInput.dataset.datetimeValue = endInput.value || "";
  startInput.closest("label")?.classList.add("event-date-field");
  endInput.closest("label")?.classList.add("event-date-field");
  repeatUntilInput?.closest("label")?.classList.add("event-repeat-until-field");

  const apply = () => {
    const recurring = simpleEventIsRecurring(recurrenceInput.value);
    form.classList.toggle("is-recurring-event", recurring);
    setFieldCaption(recurrenceInput, "Tipo de repetição");
    if (recurring) {
      setFieldCaption(startInput, "Primeira data e horário de início");
      setFieldHint(startInput, "Use a primeira ocorrência. O site repete automaticamente conforme a frequência escolhida.");
      setFieldCaption(endInput, "Horário de término");
      setFieldHint(endInput, "Opcional. Informe só a hora em que o evento costuma terminar.");
      if (endInput.type !== "time") {
        endInput.dataset.datetimeValue = endInput.value || endInput.dataset.datetimeValue || "";
        endInput.type = "time";
      }
      endInput.value = extractTimeFromDateTime(endInput.dataset.datetimeValue || endInput.value);
      endInput.removeAttribute("required");
      if (repeatUntilInput) {
        setFieldCaption(repeatUntilInput, "Fim da repetição");
        setFieldHint(repeatUntilInput, "Opcional e normalmente vazio. Use apenas se a repetição tiver prazo para encerrar.");
        repeatUntilInput.closest("label")?.classList.toggle("hidden", !repeatUntilInput.value);
      }
    } else {
      setFieldCaption(startInput, "Início");
      setFieldHint(startInput, "");
      setFieldCaption(endInput, "Fim");
      setFieldHint(endInput, "");
      if (endInput.type !== "datetime-local") {
        const datePart = String(startInput.value || "").slice(0, 10);
        const timePart = extractTimeFromDateTime(endInput.value);
        endInput.type = "datetime-local";
        endInput.value = endInput.dataset.datetimeValue || (datePart && timePart ? `${datePart}T${timePart}` : "");
      }
      if (repeatUntilInput) {
        setFieldCaption(repeatUntilInput, "Repetir até");
        setFieldHint(repeatUntilInput, "");
        repeatUntilInput.closest("label")?.classList.remove("hidden");
      }
    }
  };

  recurrenceInput.addEventListener("change", apply);
  startInput.addEventListener("change", () => {
    if (simpleEventIsRecurring(recurrenceInput.value) && endInput.value) {
      endInput.dataset.datetimeValue = `${String(startInput.value || "").slice(0, 10)}T${endInput.value}`;
    }
  });
  endInput.addEventListener("input", () => {
    if (simpleEventIsRecurring(recurrenceInput.value)) {
      const datePart = String(startInput.value || "").slice(0, 10);
      endInput.dataset.datetimeValue = datePart && endInput.value ? `${datePart}T${endInput.value}` : "";
    }
  });
  apply();
}

function normalizeSimpleEventPayload(form, message) {
  const recurrence = form.elements.recorrencia_tipo?.value || "nenhuma";
  if (!simpleEventIsRecurring(recurrence)) return null;
  const startValue = form.elements.data_inicio?.value || "";
  const endValue = form.elements.data_fim?.value || "";
  const datePart = startValue.slice(0, 10);
  if (endValue && !datePart) {
    message.textContent = "Informe a primeira data do evento antes do horário de término.";
    form.elements.data_inicio?.focus();
    return false;
  }
  const dataFim = endValue ? `${datePart}T${extractTimeFromDateTime(endValue)}` : null;
  return {
    recorrencia_tipo: recurrence,
    data_fim: dataFim,
    recorrencia_ate: form.elements.recorrencia_ate?.value || null
  };
}

async function salvarEvento2Form(event) {
  if(event.target.id!=="resource-form"||!["eventos_principais","eventos_edicoes"].includes(currentResourceTable))return;
  event.preventDefault();event.stopImmediatePropagation();
  const table=currentResourceTable,config=resources[table],message=document.getElementById("form-message");
  message.textContent="Salvando...";
  const form=new FormData(event.target),payload={id:currentResourceId};
  for(const field of config.fields){
    const [name,label,type]=field;
    if(type==="editor")payload[name]=quill.root.innerHTML;
else if(type==="weekly-hours")payload[name]=collectWeeklyHours(form,name);else if(type==="gallery-urls")payload[name]=collectGalleryUrls(form,name);else if(type==="boolean")payload[name]=form.get(name)==="true";
    else if(type==="number"){try{payload[name]=parseAdminNumber(form.get(name))}catch{message.textContent=`Informe um número válido em ${label}.`;event.target.elements[name]?.focus();return}}
    else if(type==="url-list")payload[name]=parseUrlList(form.get(name));
    else if(type==="line-list")payload[name]=parseLineList(form.get(name));
    else{
      const value=form.get(name)||null;
      if(type==="url"&&!validSiteReference(value)){message.textContent=`Informe um link completo ou caminho interno válido em ${label}.`;event.target.elements[name]?.focus();return}
      payload[name]=value;
    }
  }
  try{await salvarRegistro(table,payload);currentResourceId=null;await resourceList(table)}
  catch(error){message.textContent=error.message;}
}
document.addEventListener("submit",salvarEvento2Form,true);

function fieldHtmlCorrigido([name,label,type,required], value) {
  const req=required?"required":"", full=["textarea","editor","url-list","line-list","weekly-hours","gallery-urls"].includes(type)?"full-row":"";
  if(type==="editor") return `<label class="${full}">${label}<div id="editor"></div><input type="hidden" name="${name}"></label>`;
  if(type==="weekly-hours") return weeklyHoursHtml(name,label,value);
  if(type==="gallery-urls") return galleryUrlsHtml(name,label,value);
  if(type==="textarea") return `<label class="${full}">${label}<textarea name="${name}" ${req}>${escapeHtml(inputValue(value,type))}</textarea></label>`;
  if(type==="url-list") return `<label class="${full}">${label}<textarea name="${name}" placeholder="Cole uma URL de imagem por linha" data-cms-gallery="true" data-media-folder="${escapeHtml(mediaFolderForTable(currentResourceTable))}" data-media-preset="card">${escapeHtml(listValue(value))}</textarea><small>Use uma imagem por linha para montar a galeria.</small></label>`;
  if(type==="line-list") return `<label class="${full}">${label}<textarea name="${name}" placeholder="Digite um item por linha">${escapeHtml(listValue(value))}</textarea><small>Digite um item por linha. Exemplo: nome do patrocinador, link útil ou vídeo.</small></label>`;
  if(type==="boolean"){const checked=value===undefined&&name==="ativo"?true:Boolean(value);return `<label>${label}<select name="${name}"><option value="false" ${!checked?"selected":""}>Não</option><option value="true" ${checked?"selected":""}>Sim</option></select></label>`}
  if(type==="tags") return `<label class="${full}">${label}<input type="text" name="${name}" value="${escapeHtml(Array.isArray(value)?value.join(", "):inputValue(value,type))}" placeholder="pautas, fotos, eventos"><small>Separe por vírgula.</small></label>`;
  if(type==="event-principal-select") return `<label>${label}<select name="${name}" data-event-principal-select data-current="${escapeHtml(inputValue(value,type))}" ${req}><option value="">Carregando eventos principais...</option></select><small>Escolha o evento principal. Não precisa copiar ID.</small></label>`;
  const options=type==="status"?["rascunho","publicado","arquivado"]:type==="active-status"?["ativo","inativo"]:type==="category-type"?["noticias","guia","turismo","eventos"]:type==="link-feature-type"?["normal","grupo_whatsapp","app"]:type==="volunteer-status"?["novo","em_conversa","aprovado","recusado","arquivado"]:type==="event-recurrence"?["anual","mensal","unico","outro"]:type==="event-simple-recurrence"?["nenhuma","semanal","mensal","anual"]:type==="event-edition-status"?["anunciado","confirmado","acontecendo","encerrado","cancelado"]:null;
  if(options) return `<label>${label}<select name="${name}">${options.map(o=>`<option value="${o}" ${value===o?"selected":""}>${selectOptionLabel(o,type)}</option>`).join("")}</select></label>`;
  const inputType=type==="url"||type==="number"?"text":type,urlAttributes=type==="url"?` inputmode="url" data-type="url" placeholder="https://... ou /assets/..."${mediaAttributesForField(name)}`:type==="number"?' inputmode="decimal" data-type="number" placeholder="Ex.: -20.2046718"':"";
  return `<label class="${full}">${label}<input type="${inputType}"${urlAttributes} name="${name}" value="${escapeHtml(inputValue(value,type))}" ${req}></label>`;
}

function mediaAttributesForField(name) {
  const fieldName = String(name || "");
  const isMediaField = /(imagem|capa|cartaz|banner|seo_imagem)/.test(fieldName);
  if (!isMediaField) return "";
  const folderBase = {
    noticias: "noticias",
    guia_comercial: "guia",
    turismo: "turismo",
    eventos: "eventos",
    eventos_principais: "eventos/principais",
    eventos_edicoes: "eventos/edicoes",
    banners: "banners"
  }[currentResourceTable] || "configuracoes/imagens";
  const preset = fieldName.includes("seo") ? "social"
    : fieldName.includes("banner") || fieldName.includes("capa") ? "wide"
    : fieldName.includes("cartaz") ? "classic"
    : "card";
  return ` data-cms-image="true" data-media-folder="${escapeHtml(folderBase)}" data-media-preset="${preset}"`;
}

function mediaFolderForTable(table) {
  return {
    noticias: "noticias",
    guia_comercial: "guia",
    turismo: "turismo",
    eventos: "eventos",
    eventos_principais: "eventos/principais",
    eventos_edicoes: "eventos/edicoes",
    banners: "banners"
  }[table] || "configuracoes/imagens";
}

function resourceFieldSection(field) {
  const [name, , type] = field;
  if (["status","active-status","boolean","event-recurrence","event-simple-recurrence","event-edition-status","category-type","link-feature-type"].includes(type) || /^(destaque|ativo|recomendado|status|ordem|publicado|data_|recorrencia|aceite|curadoria)/.test(name)) return "publication";
  if (["url","editor","textarea","gallery-urls","url-list","line-list"].includes(type) || /(imagem|galeria|conteudo|descricao|resumo|seo|legenda|videos|patrocinadores|palavras)/.test(name)) return "content";
  if (/(whatsapp|telefone|email|instagram|facebook|site|endereco|mapa|latitude|longitude|horario|opening_hours|local|organizador|website)/.test(name)) return "contact";
  return "basic";
}

function resourceSectionLabels(table) {
  const defaults = {
    basic: ["Identificação", "Nome, título e dados essenciais do registro."],
    content: ["Conteúdo e mídia", "Textos, imagens, galerias e informações exibidas ao público."],
    contact: ["Contato e localização", "Canais de contato, endereço, mapa e horários."],
    publication: ["Publicação e controle", "Status, destaque, ordem e regras de exibição."]
  };
  if (table === "configuracoes_site") {
    return {
      basic: ["Configuração", "Chave, valor e tipo usados pelo portal."],
      content: ["Conteúdo", "Textos ou valores longos da configuração."],
      contact: defaults.contact,
      publication: defaults.publication
    };
  }
  return defaults;
}

function renderResourceFormSections(config, row, table) {
  const labels = resourceSectionLabels(table);
  const groups = config.fields.reduce((acc, field) => {
    const section = resourceFieldSection(field);
    acc[section] = acc[section] || [];
    acc[section].push(field);
    return acc;
  }, {});
  return ["basic", "content", "contact", "publication"].filter(key => groups[key]?.length).map((key, index) => {
    const [heading, description] = labels[key];
    return `<section class="panel admin-form-section">
      <header class="admin-form-section-head">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <div><h3>${escapeHtml(heading)}</h3><p>${escapeHtml(description)}</p></div>
      </header>
      <div class="resource-form-grid">${groups[key].map(field=>fieldHtmlCorrigido(field,row[field[0]])).join("")}</div>
    </section>`;
  }).join("");
}

async function editForm(table,id) {
  const config=resources[table]; let row={};
  currentResourceTable=table;currentResourceId=id||null;
  activeModuleKey = table;
  app.dataset.layout = "form";
  if(id){const {data,error}=await getSupabase().from(table).select("*").eq("id",id).single();if(error)throw error;row=data;}
  const meta = adminModuleMeta(table);
  const action = id ? "Editar" : "Novo";
  setShellTitle(id ? `Editar ${config.label}` : resourceActionLabel(table), resourceDescription(table), {
    moduleKey: table,
    contextLabel: `${meta.group} / ${config.label}`
  });
  app.innerHTML=`
    <section class="admin-page admin-form-page">
      <form id="resource-form" class="resource-form admin-resource-form" data-resource-table="${escapeHtml(table)}">
        ${renderResourceFormSections(config, row, table)}
        <footer class="form-actions admin-form-actions">
          <p id="form-message" class="form-message"></p>
          <div>
            <button type="button" class="admin-button secondary" data-cancel="${table}">Cancelar</button>
            <button class="admin-button" type="submit">Salvar</button>
          </div>
        </footer>
      </form>
    </section>`;
  normalizeCoordinateInputs(app);
  const editorField=config.fields.find(f=>f[2]==="editor");
  if(editorField){quill=new Quill("#editor",{theme:"snow",modules:{toolbar:[["bold","italic","blockquote"],[{header:[2,3,false]}],[{list:"ordered"},{list:"bullet"}],["link","image","video"],["clean"]]}});quill.root.innerHTML=row[editorField[0]]||"";}
  await carregarSelectEventosPrincipais();
  setupSimpleEventRecurrenceForm(app);
  const sourceName=config.fields.some(f=>f[0]==="titulo")?"titulo":config.fields.some(f=>f[0]==="nome")?"nome":null;
  if(sourceName&&config.fields.some(f=>f[0]==="slug")){const source=app.querySelector(`[name="${sourceName}"]`),slugInput=app.querySelector('[name="slug"]');source.addEventListener("input",()=>{if(!id||!slugInput.dataset.edited)slugInput.value=gerarSlug(source.value)});slugInput.addEventListener("input",()=>slugInput.dataset.edited="true");}
  document.getElementById("resource-form").addEventListener("submit", async event => {
    event.preventDefault();
    const message = document.getElementById("form-message");
    message.textContent = "Salvando...";
    const recurringEventPayload = table === "eventos" ? normalizeSimpleEventPayload(event.currentTarget, message) : null;
    if (recurringEventPayload === false) return;
    const form = new FormData(event.currentTarget);
    const payload = { id };
    for (const field of config.fields) {
      const [name, label, type] = field;
      if (recurringEventPayload && Object.prototype.hasOwnProperty.call(recurringEventPayload, name)) {
        payload[name] = recurringEventPayload[name];
      } else if (type === "editor") {
        payload[name] = quill.root.innerHTML;
      } else if (type === "weekly-hours") {
        payload[name] = collectWeeklyHours(form, name);
      } else if (type === "gallery-urls") {
        payload[name] = collectGalleryUrls(form, name);
      } else if (type === "boolean") {
        payload[name] = form.get(name) === "true";
      } else if (type === "number") {
        try {
          payload[name] = parseAdminNumber(form.get(name));
        } catch {
          message.textContent = `Informe um número válido em ${label}.`;
          event.currentTarget.elements[name]?.focus();
          return;
        }
      } else if (type === "tags") {
        payload[name] = String(form.get(name) || "").split(",").map(item => item.trim()).filter(Boolean);
      } else {
        const value = form.get(name) || null;
        if (type === "url" && !validSiteReference(value)) {
          message.textContent = `Informe um link completo ou caminho interno válido em ${label}.`;
          event.currentTarget.elements[name]?.focus();
          return;
        }
        if (["galeria_historica", "galeria", "videos", "links_uteis", "patrocinadores"].includes(name)) {
          try {
            payload[name] = value ? JSON.parse(value) : [];
          } catch {
            message.textContent = `O campo ${label} precisa ser um JSON válido. Use [] quando não houver itens.`;
            event.currentTarget.elements[name]?.focus();
            return;
          }
        } else {
          payload[name] = value;
        }
      }
    }
    if (table === "noticias" && payload.status === "publicado" && !payload.publicado_em) payload.publicado_em = new Date().toISOString();
    try {
      await salvarRegistro(table, payload);
      await resourceList(table);
    } catch (error) {
      message.textContent = error.message;
    }
  });
}

function shellToast(message, type = "success") {
  const stack = document.getElementById("toasts");
  if (!stack) return;
  const element = document.createElement("div");
  element.className = `toast ${type}`;
  element.textContent = message;
  stack.append(element);
  setTimeout(() => element.remove(), 3500);
}

function setShellTitle(label, hintText, options = {}) {
  const moduleKey = options.moduleKey || activeModuleKey || currentView || "dashboard";
  const moduleMeta = getAdminModule(moduleKey);
  if (title) title.textContent = label || "Painel";
  if (pageTitleIcon) pageTitleIcon.innerHTML = renderAdminModuleIcon(moduleKey);
  if (pageContext) pageContext.textContent = options.contextLabel || moduleMeta.group || "Painel";
  if (pagePrimaryAction) pagePrimaryAction.innerHTML = options.actionHtml || "";
  if (pageHint) {
    pageHint.textContent = hintText || "Acompanhe os principais dados do portal e escolha um módulo no menu para gerenciar conteúdo, publicidade, comunicação e configurações.";
  }
  document.title = `${label || "Painel"} | Eu Amo Urânia`;
}

function clearMountedModule() {
  if (activeMountedModule?.unmount) {
    try { activeMountedModule.unmount(); } catch (error) { console.error("Erro ao desmontar módulo:", error); }
  }
  activeMountedModule = null;
}

function setActiveNav(view) {
  refreshSidebarNavigation();
  activeModuleKey = adminNavigationItems.some(item => item.view === view) ? view : "dashboard";
  document.querySelectorAll(".admin-nav button,.admin-nav a").forEach(button => {
    const isActive = button.dataset.view === activeModuleKey;
    button.classList.toggle("active", isActive);
    if (isActive) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
}

async function mountShellModule(view, options = {}) {
  const route = moduleRoutes[view];
  if (!route) return false;
  const moduleMeta = getAdminModule(view);
  clearMountedModule();
  currentView = view;
  activeModuleKey = view;
  app.dataset.layout = "module";
  currentResourceTable = null;
  currentResourceId = null;
  setShellTitle(moduleMeta.label || route.label, moduleMeta.description || route.hint, { moduleKey: view });
  setActiveNav(view);
  const targetPath = adminPathForView(view);
  if (location.pathname !== targetPath) {
    history[options.replace ?"replaceState" : "pushState"]({ adminView: view }, "", targetPath);
  }
  sidebar.classList.remove("open");
  document.body.classList.remove("sidebar-drawer-open");
  app.innerHTML = '<div class="loading">Carregando módulo...</div>';
  try {
    const module = await route.module();
    activeMountedModule = module;
    await module.mount(app, {
      db: getSupabase(),
      access: painelAccess,
      toast: shellToast,
      setTitle: setShellTitle,
      navigate: nextView => navigateToView(nextView),
      editResource: (table, id) => editForm(table, id)
    });
  } catch (error) {
    console.error(`Falha ao carregar módulo ${view}:`, error);
    app.innerHTML = `<section class="panel"><h2>Não foi possível carregar ${escapeHtml(moduleMeta.label || route.label)}</h2><p class="form-message">${escapeHtml(error.message || "Erro inesperado.")}</p><button class="admin-button" data-retry-module="${escapeHtml(view)}" type="button">Tentar novamente</button></section>`;
  }
  return true;
}

async function navigateToView(view, options = {}) {
  if (view === "midia") {
    clearMountedModule();
    currentView = view;
    activeModuleKey = view;
    app.dataset.layout = "module";
    setActiveNav(view);
    const moduleMeta = getAdminModule(view);
    setShellTitle(moduleMeta.label, moduleMeta.description, { moduleKey: view, contextLabel: moduleMeta.group });
    const targetPath = adminPathForView(view);
    if (location.pathname !== targetPath) {
      history[options.replace ?"replaceState" : "pushState"]({ adminView: view }, "", targetPath);
    }
    app.innerHTML = '<div class="loading">Carregando biblioteca de mídia...</div>';
    window.dispatchEvent(new CustomEvent("admin:open-media-library"));
    return true;
  }
  if (moduleRoutes[view]) return mountShellModule(view, options);
  clearMountedModule();
  currentView = view || "dashboard";
  activeModuleKey = currentView;
  app.dataset.layout = currentView === "dashboard" ? "dashboard" : "wide";
  setActiveNav(currentView);
  const targetPath = adminPathForView(currentView);
  if (location.pathname !== targetPath) {
    history[options.replace ?"replaceState" : "pushState"]({ adminView: currentView }, "", targetPath);
  }
  sidebar.classList.remove("open");
  document.body.classList.remove("sidebar-drawer-open");
  return currentView === "dashboard" ?dashboard() : resourceList(currentView);
}

async function handleClick(event) {
  const button=event.target.closest("button,[data-view]");if(!button)return;
  if(button.dataset.openCommandPalette){event.preventDefault();return openCommandPalette();}
  if(button.dataset.retryModule){event.preventDefault();return mountShellModule(button.dataset.retryModule,{replace:true});}
  if(button.dataset.view){
    event.preventDefault();
    if (button.dataset.qualityFilter) sessionStorage.setItem("euamourania:guide-quality-filter", button.dataset.qualityFilter);
    if (button.dataset.view === "audiencia" && button.id !== "audience-nav") return document.getElementById("audience-nav")?.click();
    if (button.dataset.view === "aprovacoes" && button.id !== "editorial-approvals-nav") return document.getElementById("editorial-approvals-nav")?.click();
    if (button.dataset.view === "audiencia" || button.dataset.view === "aprovacoes") return;
    return navigateToView(button.dataset.view);
  }
  if(button.dataset.new)return editForm(button.dataset.new);
  if(button.dataset.edit)return editForm(button.dataset.edit,button.dataset.id);
  if(button.dataset.cancel)return resourceList(button.dataset.cancel);
  if(button.dataset.delete&&confirm("Excluir este registro?Esta ação não pode ser desfeita.")){await excluirRegistro(button.dataset.delete,button.dataset.id);return resourceList(button.dataset.delete);}
}

let commandPalette = null;
let commandSearch = null;
let commandResults = null;
let commandSelectedIndex = 0;

function adminCommandItems() {
  const visibleTargets = new Set([...document.querySelectorAll(".admin-nav button:not([hidden])")].map(button => button.dataset.view || button.id).filter(Boolean));
  const navigation = adminNavigationItems
    .filter(item => visibleTargets.has(item.view) || (item.id && visibleTargets.has(item.id)))
    .map(item => ({
      type: "Módulo",
      title: item.label,
      detail: item.description || item.group,
      group: item.group,
      icon: renderAdminModuleIcon(item.view),
      searchable: [item.label, item.group, item.description, ...(item.keywords || [])].filter(Boolean).join(" "),
      run: () => ["audiencia", "aprovacoes", "midia"].includes(item.view)
        ? document.querySelector(`.admin-nav button[data-view="${item.view}"]`)?.click()
        : navigateToView(item.view)
    }));
  return navigation;
}

function closeCommandPalette() {
  commandPalette?.setAttribute("hidden", "");
  commandSearch?.blur();
}

function runCommand(index) {
  const item = commandResults?._commands?.[Number(index)];
  if (!item) return;
  closeCommandPalette();
  item.run();
}

function updateCommandSelection(nextIndex) {
  const buttons = [...commandResults?.querySelectorAll("[data-command-index]") || []];
  if (!buttons.length) {
    commandSelectedIndex = 0;
    return;
  }
  commandSelectedIndex = Math.max(0, Math.min(nextIndex, buttons.length - 1));
  buttons.forEach((button, index) => {
    const selected = index === commandSelectedIndex;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-selected", selected ? "true" : "false");
  });
  buttons[commandSelectedIndex]?.scrollIntoView({ block: "nearest" });
}

function renderCommandResults() {
  if (!commandResults || !commandSearch) return;
  const term = commandSearch.value.trim().toLowerCase();
  const items = adminCommandItems().filter(item => `${item.title} ${item.detail} ${item.type} ${item.group || ""} ${item.searchable || ""}`.toLowerCase().includes(term)).slice(0, 10);
  commandResults._commands = items;
  commandResults.innerHTML = items.length ? items.map((item, index) => `
    <button type="button" role="option" data-command-index="${index}" aria-selected="${index === 0 ? "true" : "false"}" class="${index === 0 ? "is-selected" : ""}">
      ${item.icon || renderAdminModuleIcon("dashboard")}
      <strong>${escapeHtml(item.title)}<small>${escapeHtml(item.detail)}</small></strong>
      <span>${escapeHtml(item.group || item.type)}</span>
    </button>
  `).join("") : '<p class="admin-command-empty">Nenhum módulo encontrado.</p>';
  updateCommandSelection(0);
}

function openCommandPalette() {
  if (!commandPalette) setupCommandPalette();
  commandPalette?.removeAttribute("hidden");
  renderCommandResults();
  setTimeout(() => commandSearch?.focus(), 0);
}

function setupCommandPalette() {
  if (commandPalette) return;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="admin-command-palette" id="admin-command-palette" hidden>
      <button class="admin-command-backdrop" type="button" data-close-command aria-label="Fechar busca"></button>
      <section class="admin-command-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-command-title">
        <div class="admin-command-search">
          <span aria-hidden="true">⌘K</span>
          <input id="admin-command-search" type="search" autocomplete="off" placeholder="Buscar módulo..." aria-labelledby="admin-command-title" aria-controls="admin-command-results">
        </div>
        <h2 id="admin-command-title" class="sr-only">Busca rápida do painel</h2>
        <div class="admin-command-results" id="admin-command-results" role="listbox"></div>
      </section>
    </div>
  `);
  commandPalette = document.getElementById("admin-command-palette");
  commandSearch = document.getElementById("admin-command-search");
  commandResults = document.getElementById("admin-command-results");
  commandSearch?.addEventListener("input", () => {
    commandSelectedIndex = 0;
    renderCommandResults();
  });
  commandPalette?.addEventListener("click", event => {
    if (event.target.closest("[data-close-command]")) closeCommandPalette();
    const command = event.target.closest("[data-command-index]");
    if (command) runCommand(command.dataset.commandIndex);
  });
  commandSearch?.addEventListener("keydown", event => {
    if (!commandPalette || commandPalette.hasAttribute("hidden")) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      updateCommandSelection(commandSelectedIndex + 1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      updateCommandSelection(commandSelectedIndex - 1);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      runCommand(commandSelectedIndex);
    }
  });
  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openCommandPalette();
    }
    if (event.key === "Escape" && commandPalette && !commandPalette.hasAttribute("hidden")) closeCommandPalette();
  });
}

function setupSidebarControls() {
  renderAdminNavigation();
  const buttons = [...document.querySelectorAll(".admin-nav button")];
  buttons.forEach(decorateSidebarButton);

  const savedState = localStorage.getItem("euamourania:admin-sidebar");
  const applyCollapsed = collapsed => {
    shell?.classList.toggle("sidebar-collapsed", collapsed);
    sidebarToggle?.setAttribute("aria-expanded", String(!collapsed));
    sidebarToggle?.setAttribute("aria-label", collapsed ? "Expandir menu" : "Recolher menu");
    const icon = sidebarToggle?.querySelector("span");
    if (icon) icon.textContent = collapsed ? "\u203a" : "\u2039";
  };

  applyCollapsed(savedState === "collapsed");

  sidebarToggle?.addEventListener("click", () => {
    const collapsed = !shell?.classList.contains("sidebar-collapsed");
    applyCollapsed(collapsed);
    localStorage.setItem("euamourania:admin-sidebar", collapsed ? "collapsed" : "expanded");
  });

  mobileMenuButton?.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    document.body.classList.toggle("sidebar-drawer-open", sidebar.classList.contains("open"));
  });

  sidebarBackdrop?.addEventListener("click", () => {
    sidebar.classList.remove("open");
    document.body.classList.remove("sidebar-drawer-open");
  });

  sidebar.addEventListener("click", event => {
    if (event.target.closest(".admin-nav button") && window.matchMedia("(max-width: 860px)").matches) {
      sidebar.classList.remove("open");
      document.body.classList.remove("sidebar-drawer-open");
    }
  });
}

async function init(){
  renderAdminNavigation();
  const access=await exigirAdministrador();if(!access)return;
  painelAccess = access;
  if(!access.configurado){app.innerHTML='<p class="form-message">Configure assets/js/supabase-config.js para ativar o painel.</p>';return;}
  document.getElementById("admin-user").textContent=access.admin.nome||access.user.email;
  document.getElementById("logout").addEventListener("click",sair);
  setupSidebarControls();
  setupCommandPalette();
  document.addEventListener("click",handleClick);
  currentView=normalizeLegacyAdminRoute()||"dashboard";
  await navigateToView(currentView,{replace:true});
}
init();
window.addEventListener("popstate",()=>{
  const view=adminViewFromLocation()||"dashboard";
  if(view==="audiencia"||view==="aprovacoes"||view==="midia"){clearMountedModule();return;}
  navigateToView(view,{replace:true});
});
window.addEventListener("admin:external-module",event=>{
  clearMountedModule();
  const view = event.detail?.view || event.detail?.moduleKey;
  if (!view) return;
  currentView = view;
  activeModuleKey = view;
  app.dataset.layout = event.detail?.layout || "module";
  setActiveNav(view);
  const moduleMeta = getAdminModule(view);
  setShellTitle(event.detail?.label || moduleMeta.label || "Painel", event.detail?.hint || moduleMeta.description, {
    moduleKey: view,
    contextLabel: event.detail?.contextLabel || moduleMeta.group
  });
});
import("./editorial-audience.js").catch(error=>console.error("Módulos editorial/audiência:",error));
import("./category-fields.js").catch(error=>console.error("Categorias dos conteúdos:",error));
import("./media-upload.js").catch(error=>console.error("Upload de imagens:",error));
