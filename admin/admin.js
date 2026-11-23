import { audienceChart, sparkline } from "./dashboard-chart.js";
import { bindResourceTable } from "./table.js";
import { allowedSections } from "./navigation.js";
import { adminApiFetch, invalidateAdminData, revision, setReadSignal, ttl } from "./data-cache.js";
import { exigirAdministrador, sair, temPermissao } from "./auth.js";
import { getSupabase } from "../assets/js/services/supabaseClient.js";
import { listarTabela, salvarRegistro, excluirRegistro } from "../assets/js/services/baseService.js";
import { gerarSlug } from "../assets/js/utils.js";
import { eventDateInput, normalizeEventDates } from "../assets/js/eventDateTime.js";
import { adminPathForView, adminViewFromLocation, normalizeLegacyAdminRoute } from "./admin-routes.js";
import { summarizeBusinessQuality } from "./business-quality.js";
import { ADMIN_MODULE_LIST, adminModulesForNavigation, getAdminModule, renderAdminModuleIcon } from "./admin-modules.js";

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
let resourceDirty = false;
function canLeaveResource() {
  if (resourceDirty && !confirm("Existem alterações não salvas. Deseja sair mesmo assim?")) return false;
  resourceDirty = false;
  return true;
}
window.addEventListener("beforeunload", event => { if (resourceDirty) event.preventDefault(); });
let currentResourceTable = null;
let painelAccess = null;
let activeMountedModule = null;
let shellPrimaryActionCleanup = null;

const unifiedModuleViews = new Set([
  "publicidade",
  "viva_assinaturas",
  "melhores",
  "comunicacao",
  "notificacoes",
  "colaboradores_voluntarios",
  "submissoes",
  "midia",
  "configuracoes_site",
  "usuarios",
  "importacao"
]);

function setUnifiedModuleScope(view) {
  if (unifiedModuleViews.has(view)) app.dataset.module = view;
  else delete app.dataset.module;
}

const cmsModule = () => import("./cms-v2.js");
const editorialModule = () => import("./editorial-audience.js");
const communicationModule = () => import("./comunicacao.js");
const moduleRoutes = {
  natal_premiado: { label: "Natal Premiado", hint: "Prêmios, apoiadores e resultados por edição.", module: () => import("./natal-premiado.js") },
  noticias: { module: cmsModule },
  noticia_editor: { module: cmsModule },
  categorias: { module: cmsModule },
  aprovacoes: { module: editorialModule },
  audiencia: { module: editorialModule },
  newsletters: { module: communicationModule },
  assinantes: { module: communicationModule },
  configuracoes_site: { module: () => import("./site-settings.js") },
  midia: { module: () => import("./media-upload.js") },
  automacao_editorial: { module: () => import("./automacao-editorial.js") },
  parceiros_log: { module: () => import("./parceiros-log.js") },
  achados_perdidos: { label: "Achados e Perdidos", hint: "Revise os anúncios enviados pelo aplicativo.", module: () => import("./achados-perdidos.js") },
  catalogos: {
    label: "Catálogos",
    hint: "Produtos, categorias e opções das empresas do Guia Comercial.",
    module: () => import("./catalogos.js")
  },
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
  viva_assinaturas: {
    label: "Assinaturas Viva",
    hint: "Planos, vigência, pagamentos e ativação dos parceiros do Guia e App.",
    module: () => import("./viva-assinaturas.js")
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

let navigation = [];
function canOpen(view, search = "") {
  const meta = adminNavigationItems.find(item => item.view === view);
  if (!meta || !painelAccess?.admin) return false;
  if (view === "midia") return painelAccess.admin.funcao === "super_admin";
  const editingNews = view === "noticia_editor" && new URLSearchParams(search).has("id");
  return temPermissao(painelAccess.admin, meta.permission || view, editingNews ? "editar" : meta.action || "acessar");
}
function renderAdminNavigation() {
  navigation = allowedSections(canOpen);
  const nav = document.querySelector(".admin-nav");
  nav.replaceChildren();
  for (const group of new Set(navigation.map(section => section.group))) {
    const wrapper = document.createElement("section");
    wrapper.className = "admin-nav-group";
    wrapper.innerHTML = '<p class="admin-nav-group-label"></p><div class="admin-nav-group-items"></div>';
    wrapper.firstChild.textContent = group;
    for (const section of navigation.filter(item => item.group === group)) {
      const view = section.tabs[0].view;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.view = view;
      button.title = section.label;
      button.innerHTML = renderAdminModuleIcon(view, "admin-nav-icon") + '<span class="admin-nav-label"></span>';
      button.lastChild.textContent = section.label;
      wrapper.lastChild.append(button);
    }
    nav.append(wrapper);
  }
}

const resources = {
  noticias: { label:"Notícias", title:"titulo", order:"atualizado_em", fields:[
    ["titulo","Título","text",true],["slug","Slug","text",true],["subtitulo","Subtítulo","text"],["resumo","Resumo","textarea"],["categoria_nome","Categoria","text"],["autor","Autor","text"],["imagem_url","URL da imagem","url"],["legenda_imagem","Legenda da imagem","text"],["status","Status","status"],["destaque","Destaque","boolean"],["publicado_em","Publicação","datetime-local"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"],["seo_imagem","Imagem SEO","url"],["conteudo_html","Conteúdo","editor"]]},
  guia_comercial: { label:"Guia comercial", title:"nome", order:"atualizado_em", fields:[
    ["nome","Nome","text",true],["slug","Slug","text",true],["categoria_nome","Categoria","text"],["descricao","Descrição","textarea"],["imagem_url","URL da imagem","url"],["galeria_urls","Galeria do app (4 fotos extras)","gallery-urls"],["whatsapp","WhatsApp","text"],["telefone","Telefone","text"],["instagram","Instagram","url"],["facebook","Facebook","url"],["site","Site","url"],["endereco","Endereço","text"],["horario","Horário do site","text"],["opening_hours","Horários para o aplicativo","weekly-hours"],["opening_hours_note","Observação do horário no app","text"],["mapa_url","Mapa","url"],["recomendado","Recomendado","boolean"],["recomendado_editorial","Recomendado pelo Eu Amo Urânia","boolean"],["status","Status","status"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"]]},
  turismo: { label:"Turismo", title:"nome", order:"atualizado_em", fields:[["nome","Nome","text",true],["slug","Slug","text",true],["descricao","Descrição","textarea"],["conteudo_html","Conteúdo","editor"],["imagem_url","Imagem","url"],["galeria_urls","Galeria do app (4 fotos extras)","gallery-urls"],["endereco","Endereço","text"],["horario","Horário do site","text"],["opening_hours","Horários para o aplicativo","weekly-hours"],["opening_hours_note","Observação do horário no app","text"],["whatsapp","WhatsApp","text"],["instagram","Instagram","url"],["facebook","Facebook","url"],["site","Site oficial","url"],["mapa_url","Mapa","url"],["latitude","Latitude","number"],["longitude","Longitude","number"],["curadoria_euamourania","Curadoria Eu Amo Urânia","boolean"],["destaque","Destaque","boolean"],["status","Status","status"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"]]},
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
  turismo: { label:"Turismo", title:"nome", order:"atualizado_em", fields:[["nome","Nome","text",true],["slug","Slug","text",true],["descricao","Descrição","textarea"],["conteudo_html","Conteúdo","editor"],["imagem_url","Imagem","url"],["galeria_urls","Galeria do app (4 fotos extras)","gallery-urls"],["endereco","Endereço","text"],["horario","Horário do site","text"],["opening_hours","Horários para o aplicativo","weekly-hours"],["opening_hours_note","Observação do horário no app","text"],["whatsapp","WhatsApp","text"],["instagram","Instagram","url"],["facebook","Facebook","url"],["site","Site oficial","url"],["mapa_url","Mapa","url"],["latitude","Latitude","number"],["longitude","Longitude","number"],["curadoria_euamourania","Curadoria Eu Amo Urânia","boolean"],["destaque","Destaque","boolean"],["status","Status","status"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"]]},
  links: { label:"Links", title:"titulo", order:"ordem", ascending:true, fields:[["titulo","Título","text",true],["url","URL","url",true],["icone","Ícone/emoji","text"],["rotulo","Rótulo do destaque","text"],["descricao","Descrição do destaque","textarea"],["tipo_destaque","Tipo de destaque","link-feature-type"],["ordem","Ordem","number"],["status","Status","active-status"]]},
  colaboradores_voluntarios: { label:"Colaborações voluntárias", title:"nome", order:"criado_em", fields:[["nome","Nome","text",true],["whatsapp","WhatsApp","text",true],["email","E-mail","email"],["cidade","Cidade","text"],["interesses","Interesses","tags"],["mensagem","Mensagem","textarea"],["status","Status","volunteer-status"],["observacoes_internas","Observações internas","textarea"],["aceite_voluntario","Aceite voluntário","boolean"]]},
  eventos: { label:"Agenda simples", title:"titulo", order:"atualizado_em", fields:[["titulo","Título","text",true],["titulo_curto","Título curto no app","text"],["slug","Slug","text",true],["descricao","Descrição","textarea"],["imagem_url","Imagem","url"],["data_inicio","Início","datetime-local"],["data_fim","Fim","datetime-local"],["recorrencia_tipo","Repetição","event-simple-recurrence"],["recorrencia_ate","Repetir até","datetime-local"],["local","Local","text"],["endereco","Endereço","text"],["organizador","Organizador","text"],["whatsapp","WhatsApp","text"],["destaque","Destaque","boolean"],["status","Status","status"]]},
  banners: { label:"Banners", title:"titulo", order:"ordem", ascending:true, fields:[["titulo","Título","text"],["subtitulo","Subtítulo","text"],["imagem_url","Imagem","url"],["link_url","Link","url"],["posicao","Posição","text"],["ordem","Ordem","number"],["status","Status","active-status"]]},
  categorias: { label:"Categorias", title:"nome", order:"ordem", ascending:true, fields:[["nome","Nome","text",true],["slug","Slug","text",true],["tipo","Tipo","category-type",true],["ordem","Ordem","number"],["status","Status","active-status"]]},
  configuracoes_site: { label:"Configurações", title:"chave", order:"chave", ascending:true, fields:[["chave","Chave","text",true],["valor","Valor","textarea"],["tipo","Tipo","text"]]},
  sugestoes_momento: { table:"home_sugestoes_momento", label:"Sugestões do momento", title:"titulo", order:"prioridade", fields:[["titulo","Nome interno","text",true],["tipo_conteudo","Tipo de conteúdo","home-suggestion-type",true],["conteudo_id","Conteúdo vinculado","home-suggestion-target",true],["titulo_override","Título exibido (opcional)","text"],["descricao_override","Texto exibido (opcional)","textarea"],["imagem_url_override","Imagem exibida (opcional)","url"],["status","Status","home-suggestion-status"],["prioridade","Prioridade","number"],["inicio_em","Início","datetime-local"],["fim_em","Fim","datetime-local"],["recorrencia_tipo","Repetição","home-suggestion-recurrence"],["dia_semana","Dia da semana","home-suggestion-weekday"],["hora_inicio","Hora inicial","time"],["hora_fim","Hora final","time"],["recorrencia_ate","Repetir até","date"]]},
  eventos_principais: { label:"Eventos principais", title:"nome", order:"atualizado_em", fields:[["nome","Nome do evento","text",true],["slug","Slug","text",true],["descricao_curta","Descrição curta","textarea"],["historia_html","História do evento","editor"],["imagem_capa_url","Imagem de capa","url"],["galeria_historica","Galeria histórica","url-list"],["categoria","Categoria","text"],["local_tradicional","Local tradicional","text"],["recorrencia","Recorrência","event-recurrence"],["periodo_aproximado","Período aproximado","text"],["organizador","Organizador","text"],["telefone","Telefone","text"],["email","E-mail","email"],["website","Website","url"],["instagram","Instagram","url"],["facebook","Facebook","url"],["ativo","Ativo","boolean"],["destaque","Destaque","boolean"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"],["palavras_chave","Palavras-chave","text"]]},
  eventos_edicoes: { label:"Edições de eventos", title:"titulo", order:"ano", ascending:false, fields:[["evento_id","Evento principal","event-principal-select",true],["ano","Ano","number",true],["edicao_label","Rótulo da edição","text"],["slug","Slug da edição","text"],["titulo","Título da edição","text",true],["titulo_curto","Título curto no app","text"],["subtitulo","Subtítulo","text"],["organizador","Organização da edição","text"],["data_inicio","Início","datetime-local"],["data_fim","Fim","datetime-local"],["programacao_html","Programação","editor"],["atracoes_html","Atrações","textarea"],["cartaz_url","Cartaz oficial","url"],["banner_url","Banner","url"],["galeria","Galeria da edição","url-list"],["videos","Vídeos","line-list"],["local","Local","text"],["endereco","Endereço","text"],["mapa_url","Link do mapa","url"],["latitude","Latitude","number"],["longitude","Longitude","number"],["links_uteis","Links úteis","line-list"],["patrocinadores","Patrocinadores","line-list"],["status","Status da edição","event-edition-status"],["resumo_pos_evento_html","Resumo pós-evento","textarea"],["publico_estimado","Público estimado","number"],["observacoes","Observações","textarea"],["destaque","Destaque","boolean"],["seo_titulo","Título SEO","text"],["palavras_chave","Palavras-chave","text"],["seo_descricao","Descrição SEO","textarea"]]}
});

function databaseTable(table) {
  return resources[table]?.table || table;
}

const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const inputValue = (value, type) => type === "datetime-local" && value
  ? (["eventos", "eventos_edicoes"].includes(currentResourceTable) ? eventDateInput(value) : new Date(value).toISOString().slice(0,16))
  : value ?? "";
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
  return `<fieldset class="full-row cms-gallery-field" data-gallery-field="${name}"><legend>${label}</legend><div class="cms-gallery-head"><span>Imagem principal + extras</span><strong data-gallery-count>${urls.length}/${EXTRA_GALLERY_LIMIT}</strong></div><p class="field-hint">A imagem principal já conta como a primeira foto. Adicione até 4 fotos extras para o carrossel do aplicativo.</p><label class="cms-gallery-picker"><span>Adicionar foto extra</span><input type="text" inputmode="url" data-type="url" data-cms-image="true" data-gallery-picker data-media-folder="${escapeHtml(folder)}" data-media-preset="card" name="${name}_picker" placeholder="Escolher da biblioteca ou colar URL"></label><ol class="cms-gallery-list">${Array.from({length:EXTRA_GALLERY_LIMIT},(_,index)=>{const url=urls[index]||"";return `<li data-gallery-slot="${index}" ${url?"":"hidden"}><img ${url?`src="${escapeHtml(url)}"`:""} alt="" data-gallery-thumb><span><small>Foto extra ${index+1}</small><strong data-gallery-url>${escapeHtml(url)}</strong></span><input type="hidden" name="${name}_${index}" value="${escapeHtml(url)}"><button type="button" class="admin-button secondary" data-gallery-remove="${index}">Remover</button></li>`}).join("")}</ol><p class="cms-gallery-empty" data-gallery-empty ${urls.length?"hidden":""}>Nenhuma foto extra adicionada.</p></fieldset>`;
}
function collectGalleryUrls(form,name){
  return Array.from({length:EXTRA_GALLERY_LIMIT},(_,index)=>String(form.get(`${name}_${index}`)||"").trim()).filter(Boolean).filter((url,index,array)=>array.indexOf(url)===index);
}
function setupGalleryFields(container){
  container.querySelectorAll("[data-gallery-field]").forEach(fieldset=>{
    const name=fieldset.dataset.galleryField;
    const picker=fieldset.querySelector("[data-gallery-picker]");
    const slots=Array.from({length:EXTRA_GALLERY_LIMIT},(_,index)=>fieldset.querySelector(`[name="${name}_${index}"]`));
    const refresh=()=>{
      const values=slots.map(input=>String(input?.value||"").trim());
      fieldset.querySelector("[data-gallery-count]").textContent=`${values.filter(Boolean).length}/${EXTRA_GALLERY_LIMIT}`;
      fieldset.querySelector("[data-gallery-empty]").hidden=values.some(Boolean);
      values.forEach((url,index)=>{
        const row=fieldset.querySelector(`[data-gallery-slot="${index}"]`);
        if(!row)return;
        row.hidden=!url;
        const thumbnail=row.querySelector("[data-gallery-thumb]");
        if(url)thumbnail.src=url;else thumbnail.removeAttribute("src");
        row.querySelector("[data-gallery-url]").textContent=url;
      });
    };
    picker?.addEventListener("change",()=>{
      const url=String(picker.value||"").trim();
      if(!url)return;
      const existing=slots.find(input=>input.value===url);
      const target=slots.find(input=>!String(input.value||"").trim());
      const message=()=>fieldset.querySelector(".cms-media-state");
      if(!existing&&target){target.value=url;target.dispatchEvent(new Event("input",{bubbles:true}));}
      picker.value="";
      refresh();
      setTimeout(()=>{
        const status=message();
        const preview=fieldset.querySelector(".cms-media-preview");
        if(preview)preview.innerHTML="";
        if(status){status.className=`cms-media-state ${target&&!existing?"success":"error"}`;status.textContent=existing?"Essa foto já está na galeria.":target?"Foto adicionada à galeria.":"A galeria já possui 4 fotos extras.";}
      },0);
    });
    fieldset.addEventListener("click",event=>{
      const button=event.target.closest("[data-gallery-remove]");
      if(!button)return;
      const index=Number(button.dataset.galleryRemove);
      slots[index].value="";
      const compacted=slots.map(input=>input.value).filter(Boolean);
      slots.forEach((input,slotIndex)=>{input.value=compacted[slotIndex]||"";});
      refresh();
    });
    refresh();
  });
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

let dashboardReadController;

function dashboard() {
  activeModuleKey = "dashboard";
  app.dataset.layout = "dashboard";
  setShellTitle("Visão geral", "Operação, audiência e gestão de Urânia", { moduleKey: "dashboard" });

  const root = document.createElement("section");
  root.className = "ops-dashboard cockpit";
  app.replaceChildren(root);

  const db = getSupabase(), now = new Date(), iso = now.toISOString();
  const zone = "America/Sao_Paulo", dayMs = 86400000;
  const dateKey = new Intl.DateTimeFormat("sv-SE", { timeZone: zone });
  const today = dateKey.format(now);
  const day = offset => new Date(Date.parse(today + "T12:00:00Z") + offset * dayMs).toISOString().slice(0, 10);
  const since = day(-59) + "T00:00:00-03:00";
  const week = day(-6) + "T00:00:00-03:00";
  let controller = dashboardReadController = new AbortController();
  const querySignal = () => AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);

  async function safeList(table, build, paged = false) {
    try {
      const all = [];
      const signal = querySignal();
      for (let offset = 0; ; offset += 500) {
        const query = build().abortSignal(signal);
        const { data, error } = await (paged ? query.range(offset, offset + 499) : query);
        if (error) throw error;
        all.push(...(data || []));
        if (!paged || !data || data.length < 500) return all;
      }
    } catch {
      return null;
    }
  }

  async function safeCount(table, filter = q => q) {
    try {
      const { count, error } = await filter(db.from(table).select("*", { count: "exact", head: true })).abortSignal(querySignal());
      if (error) throw error;
      return count;
    } catch {
      return null;
    }
  }

  const rows = (table, cols, order, filter = q => q) => safeList(table, () => filter(db.from(table).select(cols)).order(order), true);
  const countWhere = (table, key, value) => safeCount(table, q => q.eq(key, value));

  const data = {};
  const ready = new Set();
  const failed = new Set();
  const bands = new Map();
  const boundaries = [0, 14, 28, 60];
  let period = 7;
  let scheduledPaint = false;

  function schedulePaint() {
    if (scheduledPaint || !root.isConnected) return;
    scheduledPaint = true;
    requestAnimationFrame(() => {
      scheduledPaint = false;
      if (root.isConnected) paint();
    });
  }

  async function loadGroup(key, fields) {
    const entries = await Promise.all(Object.entries(fields).map(async ([name, result]) => [name, await result]));
    Object.assign(data, Object.fromEntries(entries));
    if (entries.some(([, value]) => value == null)) failed.add(key);
    ready.add(key);
    schedulePaint();
  }

  // Days buckets for analytics
  const audienceDays = Array.from({ length: 60 }, (_, i) => ({
    key: day(i - 59),
    views: 0,
    clicks: 0,
    partners: 0,
    devices: 0,
    requests: 0,
    reach: 0,
    sessions: new Set(),
    channels: [0, 0, 0, 0],
    sources: new Map(),
    pages: new Map()
  }));

  const buckets = new Map(audienceDays.map(d => [d.key, d]));
  function dayForValue(value) {
    if (!value) return;
    return value.length === 10 ? value : dateKey.format(new Date(value));
  }

  function addEvents(events) {
    for (const e of events || []) {
      const d = buckets.get(dayForValue(e.criado_em));
      if (!d) continue;
      if (e.tipo === "page_view" || e.tipo === "app_screen_view") {
        d.views++;
        if (e.sessao_hash) d.sessions.add(e.sessao_hash);
        const isApp = ["ios", "android"].includes(e.dispositivo) || e.tipo === "app_screen_view" || e.origem === "app" || /^\/app(?:\/|$)/.test(e.pagina || "");
        const channel = isApp ? 0 : e.dispositivo === "mobile" ? 1 : e.dispositivo === "desktop" ? 2 : 3;
        d.channels[channel]++;
        const source = e.origem || "Não informada";
        d.sources.set(source, (d.sources.get(source) || 0) + 1);
        if (e.pagina) {
          const path = e.pagina.split("?")[0].replace(/\/index\.html$/, "/").replace(/\/$/, "") || "/";
          d.pages.set(path, (d.pages.get(path) || 0) + 1);
        }
      } else if (e.tipo === "empresa_whatsapp_click") {
        d.clicks++;
      } else if (["whatsapp_click", "external_click"].includes(e.tipo) && (["guia", "guia_comercial", "empresa"].includes(e.recurso_tipo) || /^\/guia(?:\/|\.html)/.test(e.pagina || ""))) {
        d.clicks++;
      }
    }
  }

  function loadAudience() {
    for (let i = 1; i < boundaries.length && boundaries[i - 1] < period * 2; i++) {
      if (bands.has(i)) continue;
      bands.set(i, undefined);
      const start = day(1 - boundaries[i]);
      const end = day(-boundaries[i - 1]);
      rows("analytics_eventos", "criado_em,tipo,pagina,recurso_tipo,origem,dispositivo,sessao_hash", "id",
        q => q.gte("dia", start).lte("dia", end).lte("criado_em", iso)
          .in("tipo", ["page_view", "app_screen_view", "whatsapp_click", "external_click", "empresa_whatsapp_click"]))
        .then(events => {
          addEvents(events);
          bands.set(i, events !== null);
          schedulePaint();
        });
    }
  }

  loadAudience();
  loadGroup("partners", {
    plans: rows("viva_assinaturas", "guia_id,status,inicio,validade", "guia_id"),
    guide: rows("guia_comercial", "*,verificado", "id", q => q.eq("status", "publicado")),
    campaigns: safeCount("campanhas_publicitarias", q => q.eq("status", "ativo").or(`data_inicio.is.null,data_inicio.lte.${iso}`).or(`data_fim.is.null,data_fim.gte.${iso}`)),
    expiring: safeCount("campanhas_publicitarias", q => q.eq("status", "ativo").gte("data_fim", iso).lte("data_fim", new Date(+now + 7 * dayMs).toISOString()))
  });
  loadGroup("community", {
    push: rows("app_push_tokens", "criado_em", "id", q => q.eq("ativo", true)),
    sends: rows("app_notificacoes", "enviado_em,total_destinatarios", "id", q => q.eq("status", "enviado").gte("enviado_em", since).lte("enviado_em", iso)),
    coupons: safeCount("vantagens", q => q.eq("ativo", true).or(`data_inicio.is.null,data_inicio.lte.${iso}`).or(`data_fim.is.null,data_fim.gte.${iso}`))
  });
  loadGroup("editorial", {
    weekly: safeCount("noticias", q => q.eq("status", "publicado").gte("publicado_em", week).lte("publicado_em", iso)),
    scheduled: safeCount("noticias", q => q.eq("status", "publicado").gt("publicado_em", iso)),
    drafts: countWhere("noticias", "status", "rascunho"),
    stale: safeCount("noticias", q => q.eq("status", "rascunho").lt("atualizado_em", day(-7) + "T00:00:00-03:00")),
    review: countWhere("noticias", "status_editorial", "em_revisao"),
    published: safeCount("noticias", q => q.eq("status", "publicado").lte("publicado_em", iso)),
    recentNews: safeList("noticias", () => db.from("noticias").select("id,titulo,categoria_nome,autor,publicado_em,atualizado_em,status,status_editorial").eq("status", "publicado").lte("publicado_em", iso).order("publicado_em", { ascending: false }).limit(3)),
    scheduledNews: safeList("noticias", () => db.from("noticias").select("id,titulo,categoria_nome,publicado_em").eq("status", "publicado").gt("publicado_em", iso).order("publicado_em", { ascending: true }).limit(2))
  });
  loadGroup("moderation", {
    approvals: rows("solicitacoes_aprovacao", "enviado_em", "id", q => q.eq("status", "pendente")),
    lost: rows("achados_perdidos", "criado_em", "id", q => q.eq("status", "pendente")),
    business: rows("business_submissions", "created_at", "id", q => q.eq("status", "pending")),
    eventSubs: rows("event_submissions", "created_at", "id", q => q.eq("status", "pending")),
    recentCollaborators: rows("colaboradores_voluntarios", "criado_em", "id", q => q.eq("status", "novo"))
  });
  loadGroup("city", {
    nextEvents: safeList("eventos", () => db.from("eventos").select("id,titulo,data_inicio,data_fim,local,categoria_nome").eq("status", "publicado").gte("data_inicio", iso).order("data_inicio").limit(3)),
    future: safeCount("eventos", q => q.eq("status", "publicado").gte("data_inicio", iso)),
    eventosPrincipais: countWhere("eventos_principais", "ativo", true),
    eventosEdicoes: safeCount("eventos_edicoes"),
    tourism: countWhere("turismo", "status", "publicado")
  });
  async function loadAwards() {
    const editions = await safeList("melhores_edicoes", () => db.from("melhores_edicoes").select("*").order("ano", { ascending: false }).limit(10));
    const edition = editions?.find(e => ["votacao_aberta", "indicacoes_abertas", "apuracao"].includes(e.status)) || editions?.[0];
    data.edition = edition;
    loadGroup("awards", {
      editions,
      votes: edition ? safeCount("melhores_votos", q => q.eq("edicao_id", edition.id).eq("status", "valido")) : 0,
      ballots: edition ? countWhere("melhores_votos", "edicao_id", edition.id) : 0,
      nominees: edition ? safeCount("melhores_indicados", q => q.eq("edicao_id", edition.id).eq("status", "ativo")) : 0
    });
  }
  async function loadActivities() {
    const activities = await safeList("cms_atividades", () => db.from("cms_atividades").select("titulo,acao,tabela,usuario_id,criado_em").order("criado_em", { ascending: false }).limit(6));
    const actorIds = [...new Set((activities || []).map(a => a.usuario_id).filter(Boolean))];
    loadGroup("activities", { activities, users: actorIds.length ? safeList("usuarios_admin", () => db.from("usuarios_admin").select("id,nome").in("id", actorIds)) : [] });
  }
  loadAwards();
  loadActivities();

  function paint() {
    const frame = document.createElement("div");
    const { plans, guide, push, sends, coupons, weekly, scheduled, drafts, stale, review, published, recentNews, scheduledNews, approvals, lost, business, eventSubs, recentCollaborators, campaigns, expiring, nextEvents, future, eventosPrincipais, eventosEdicoes, tourism, activities, edition, votes, ballots, nominees, users } = data;
    const required = boundaries.slice(1, boundaries.indexOf(period * 2) + 1).map((_, index) => bands.get(index + 1));
    const waitingAudience = required.includes(undefined);
    const events = required.every(value => value === true);
    const n = value => (value == null ? "—" : Number(value).toLocaleString("pt-BR"));
    const esc = escapeHtml;

    const days = audienceDays.map(d => ({ ...d }));
    const buckets = new Map(days.map(d => [d.key, d]));
    const bucket = value => buckets.get(dayForValue(value));

    for (const send of sends || []) {
      const d = bucket(send.enviado_em);
      if (d) d.reach += Number(send.total_destinatarios) || 0;
    }

    const guideMap = new Map((guide || []).map(g => [g.id, g]));
    const activePlans = plans?.filter(p => p.status === "ativa" && p.inicio <= today && p.validade >= today) || [];
    const due = offset => activePlans.filter(p => p.validade >= today && p.validade <= day(offset)).length;

    function addStarts(list, key, metric) {
      for (const row of list || []) {
        const d = bucket(row[key]);
        if (d) d[metric]++;
      }
    }
    addStarts(activePlans, "inicio", "partners");
    addStarts(push, "criado_em", "devices");

    const expiringSubs = activePlans.filter(p => p.validade >= today && p.validade <= day(15));
    const delayedSubs = plans?.filter(p => p.status === "atrasada" || (p.status === "ativa" && p.validade < today)) || [];

    const colaboradoresNovos = recentCollaborators?.length;
    const queueSources = [
      [approvals, "enviado_em", "aprovacoes"],
      [lost, "criado_em", "achados_perdidos"],
      [business, "created_at", "submissoes"],
      [eventSubs, "created_at", "submissoes"],
      [recentCollaborators, "criado_em", "colaboradores_voluntarios"]
    ].filter(([, , view]) => canOpen(view));

    for (const [list, key] of queueSources) addStarts(list, key, "requests");

    const inbox = [
      ["Notícias aguardando aprovação", approvals?.length, "aprovacoes"],
      ["Achados e Perdidos enviados", lost?.length, "achados_perdidos"],
      ["Empresas enviadas pelo público", business?.length, "submissoes"],
      ["Eventos sugeridos pelo público", eventSubs?.length, "submissoes"],
      ["Novos voluntários inscritos", colaboradoresNovos, "colaboradores_voluntarios"],
      ["Campanhas vencendo em 7 dias", expiring, "publicidade"],
      ["Assinaturas vencendo em 7 dias", due(7), "viva_assinaturas"]
    ].filter(([, , view]) => canOpen(view));

    const completeInbox = inbox.every(([, total]) => total != null);
    const attention = inbox.reduce((sum, [, total]) => sum + (total || 0), 0);

    const hour = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: zone, hour: "numeric", hourCycle: "h23" }).format(now));
    const rawAdminName = (painelAccess?.admin?.nome || "").trim().split(/\s+/)[0];
    const adminName = ["admin", "usuario", "usuário"].includes(rawAdminName.toLowerCase()) ? "" : rawAdminName;

    const quality = guide ? (data.quality ??= summarizeBusinessQuality(guide)) : null;
    const percent = quality?.total ? Math.round((100 * quality.complete) / quality.total) : 0;

    const actors = new Map((users || []).map(u => [u.id, u.nome]));
    const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

    function ago(time) {
      if (!time) return "sem data";
      const minutes = Math.max(0, Math.floor((now - new Date(time)) / 60000));
      return minutes < 60 ? relative.format(-minutes, "minute") : minutes < 1440 ? relative.format(-Math.floor(minutes / 60), "hour") : relative.format(-Math.floor(minutes / 1440), "day");
    }

    function formatPageTitle(path) {
      if (path === "/" || path === "") return "Página Inicial (Home)";
      if (path.includes("/guia")) return "Guia Comercial & Empresas";
      if (path.includes("/turismo")) return "Turismo & Atrativos";
      if (path.includes("/news") || path.includes("/noticia")) return "Portal de Notícias";
      if (path.includes("/melhores")) return "Melhores de Urânia";
      if (path.includes("/eventos") || path.includes("/agenda")) return "Agenda de Eventos";
      if (path.includes("/parceiro")) return "Painel do Parceiro Viva";
      if (path.includes("/links")) return "Urânia Links";
      return path;
    }

    const windows = edition ? [[edition.votacao_inicio, edition.votacao_fim], [edition.votacao_inicio_site, edition.votacao_fim_site || edition.votacao_fim]].filter(([a, b]) => a && b && new Date(a) <= now && now <= new Date(b)) : [];
    const remaining = edition?.status === "votacao_aberta" && windows.length ? Math.ceil((Math.max(...windows.map(([, b]) => Date.parse(b))) - now) / dayMs) : 0;

    const editionStatusLabels = {
      indicacoes_abertas: "Indicações Abertas",
      indicacoes_encerradas: "Indicações Encerradas",
      votacao_aberta: "Votação em Andamento",
      votacao_encerrada: "Votação Encerrada",
      apuracao: "Apuração Oficial",
      resultado_publicado: "Resultados Publicados",
      arquivada: "Edição Concluída"
    };

    frame.innerHTML = `
      <!-- Header Executivo -->
      <header class="cock-header">
        <div class="cock-header-title">
          <h2>${hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"}${adminName ? ", " + esc(adminName) : ""}.</h2>
          <div class="cock-header-status">
            <span class="cock-status-dot ${attention > 0 ? "has-issue" : ""}" aria-hidden="true"></span>
            <span>${!ready.has("moderation") || !ready.has("partners") ? "Atualizando pendências" : !completeInbox || failed.has("partners") ? "Pendências parcialmente disponíveis" : attention > 0 ? `${attention} item(ns) requerem ação` : "Todos os serviços e portais operando normalmente"} · Urânia, SP</span>
          </div>
        </div>
        <div class="cock-controls">
          <div class="cock-range-picker" role="group" aria-label="Janela temporal de análise">
            ${[7, 14, 30].map(v => `<button type="button" class="cock-range-btn" data-period="${v}">${v} dias</button>`).join("")}
          </div>
          <button type="button" class="admin-button secondary cock-btn-refresh" data-retry-module title="Recarregar dados">
            <span aria-hidden="true">↻</span>
            <span>Atualizar dados</span>
          </button>
        </div>
      </header>

      <!-- Top 5 KPI Cards -->
      <section class="cock-kpis" aria-label="Indicadores chave"></section>

      <!-- Visual Data Center: Gráfico de Audiência + Top Páginas & Canais -->
      <section class="cock-analytics-grid">
        <!-- Painel Gráfico Principal -->
        <article class="cock-panel cock-plot-panel">
          <div class="cock-panel-head">
            <div>
              <h3>${renderAdminModuleIcon("audience")} Audiência & Conversão Comercial</h3>
              <p class="cock-panel-subtitle">Visualizações totais comparadas a cliques diretos em WhatsApp e links do comércio local</p>
            </div>
            <div class="cock-legend">
              <span class="cock-legend-item"><span class="cock-legend-dot views" aria-hidden="true"></span>Visualizações</span>
              <span class="cock-legend-item"><span class="cock-legend-dot clicks" aria-hidden="true"></span>Cliques no Comércio</span>
            </div>
          </div>
          <div class="cock-chart-wrap cock-plot"></div>
        </article>

        <!-- Painel Lateral: Páginas Mais Lidas & Canais -->
        <article class="cock-panel cock-side-stack">
          <!-- Top Páginas -->
          <div>
            <div class="cock-subhead">
              <span>Páginas & Notícias mais acessadas</span>
              <small style="color:var(--admin-text-secondary);font-size:0.75rem;">no período</small>
            </div>
            <div class="cock-top-pages"></div>
          </div>

          <hr style="border:0;border-top:1px solid var(--admin-border);margin:2px 0;" />

          <!-- Canais de Acesso -->
          <div>
            <div class="cock-subhead">
              <span>Origem & Dispositivos</span>
            </div>
            <div class="cock-channel-list cock-distribution"></div>
          </div>
        </article>
      </section>

      <!-- Central de Ação Imediata (Inbox Zero) -->
      <section class="cock-panel cock-inbox-panel" aria-label="Fila de Ação Imediata">
        <div class="cock-panel-head">
          <div>
            <h3 style="color: ${attention > 0 ? "var(--chart-orange)" : "var(--chart-green)"};">
              ${renderAdminModuleIcon("approval")} Central de Ação Imediata
            </h3>
            <p class="cock-panel-subtitle">Submissões públicas, moderação do app, aprovações editoriais e vencimentos comerciais</p>
          </div>
          ${attention > 0 ? `<span class="cock-inbox-badge" style="background:#fde8dc;color:#9c3c1a;font-size:0.85rem;padding:4px 10px;">${attention} pendência(s)</span>` : ""}
        </div>
        ${
          inbox.filter(([, v]) => v > 0).length > 0
            ? `<div class="cock-inbox-grid">${inbox
                .filter(([, v]) => v > 0)
                .map(
                  ([label, v, view]) => `
                  <button type="button" class="cock-inbox-btn" data-view="${view}">
                    <span>${label}</span>
                    <span class="cock-inbox-badge">${n(v)}</span>
                  </button>
                `
                )
                .join("")}</div>`
            : `<div class="cock-inbox-empty">
                <span style="font-size:1.3rem;">✨</span>
                <div>
                  <strong>Tudo em dia!</strong>
                  <p style="font-size:0.8rem;color:inherit;opacity:0.9;">Nenhuma submissão pública, aprovação ou anúncio de Achados e Perdidos aguardando moderação.</p>
                </div>
              </div>`
        }
      </section>

      <!-- Os 4 Grandes Pilares em Grid 2x2 com Conteúdo Real -->
      <section class="cock-pillars" aria-label="Pilares do Ecossistema">

        <!-- Pilar 1: Negócios & Parceiros Viva -->
        <article class="cock-panel cock-pillar">
          <div class="cock-panel-head">
            <h3>${renderAdminModuleIcon("guide")} Negócios & Parceiros Viva</h3>
            <span class="cock-tag" style="background:#e4f3ed;color:#136244;">${n(activePlans.length)} planos ativos</span>
          </div>

          <div class="cock-stats-row">
            <div class="cock-stat-item">
              <span class="cock-stat-val">${n(guide?.length)}</span>
              <span class="cock-stat-label">Empresas Guia</span>
            </div>
            <div class="cock-stat-item">
              <span class="cock-stat-val">${n(guide?.filter(g => g.verificado).length)}</span>
              <span class="cock-stat-label">Verificadas</span>
            </div>
            <div class="cock-stat-item">
              <span class="cock-stat-val" style="color:${delayedSubs.length > 0 ? "var(--chart-orange)" : "inherit"};">${n(delayedSubs.length)}</span>
              <span class="cock-stat-label">Atrasadas</span>
            </div>
          </div>

          <div class="cock-pillar-body">
            <!-- Vencimentos de assinaturas -->
            <div>
              <div class="cock-subhead" style="margin-bottom:6px;">
                <span>Assinaturas com atenção</span>
                <small style="color:var(--admin-text-secondary);font-size:0.75rem;">próximos 15 dias</small>
              </div>
              ${
                expiringSubs.length > 0 || delayedSubs.length > 0
                  ? `<div class="cock-expiring-list">
                      ${[...delayedSubs, ...expiringSubs].slice(0, 3).map(p => {
                        const comp = guideMap.get(p.guia_id);
                        const compName = comp?.nome_fantasia || comp?.nome || comp?.razao_social || "Empresa parceira";
                        const isDelayed = p.status === "atrasada" || (p.status === "ativa" && p.validade < today);
                        return `
                          <div class="cock-expiring-item">
                            <span class="cock-expiring-name">${esc(compName)}</span>
                            <span class="cock-expiring-date" style="color:${isDelayed ? "#b12d18" : "#a44816"};">
                              ${isDelayed ? "Atrasada" : `Vence ${new Date(p.validade).toLocaleDateString("pt-BR")}`}
                            </span>
                          </div>
                        `;
                      }).join("")}
                    </div>`
                  : `<p class="cock-panel-subtitle" style="color:var(--chart-green);font-weight:600;">● Nenhuma assinatura vencendo nos próximos 15 dias.</p>`
              }
            </div>

            <!-- Saúde do Catálogo & Chips de Diagnóstico -->
            <div class="cock-quality-box">
              <div class="cock-quality-meta">
                <span>Saúde do Catálogo Comercial</span>
                <strong>${percent}% preenchidos</strong>
              </div>
              <div class="cock-bar-track">
                <div class="cock-bar-fill" style="width:${percent}%;"></div>
              </div>
              <div class="cock-quality-chips">
                ${quality?.missingImage ? `<button type="button" class="cock-chip-btn" data-view="guia_verificacao" data-quality-filter="missing_image">📷 ${quality.missingImage} sem foto</button>` : ""}
                ${quality?.missingHours ? `<button type="button" class="cock-chip-btn" data-view="guia_verificacao" data-quality-filter="missing_hours">⏰ ${quality.missingHours} sem horário</button>` : ""}
                ${quality?.missingWhatsapp ? `<button type="button" class="cock-chip-btn" data-view="guia_verificacao" data-quality-filter="missing_whatsapp">💬 ${quality.missingWhatsapp} sem WhatsApp</button>` : ""}
                ${quality?.missingAddress ? `<button type="button" class="cock-chip-btn" data-view="guia_verificacao" data-quality-filter="missing_address">📍 ${quality.missingAddress} sem endereço</button>` : ""}
              </div>
            </div>
          </div>

          <div class="cock-pillar-actions">
            <button type="button" class="admin-button secondary" data-new="guia_comercial">+ Cadastrar empresa</button>
            <button type="button" class="admin-button secondary" data-view="guia_comercial">Abrir Guia</button>
          </div>
        </article>

        <!-- Pilar 2: Editorial & Pauta -->
        <article class="cock-panel cock-pillar">
          <div class="cock-panel-head">
            <h3>${renderAdminModuleIcon("news")} Editorial & Jornalismo</h3>
            <span class="cock-tag">${n(published)} publicadas no portal</span>
          </div>

          <div class="cock-stats-row">
            <div class="cock-stat-item">
              <span class="cock-stat-val">${n(weekly)}</span>
              <span class="cock-stat-label">Últimos 7 dias</span>
            </div>
            <div class="cock-stat-item">
              <span class="cock-stat-val">${n(scheduled)}</span>
              <span class="cock-stat-label">Agendadas</span>
            </div>
            <div class="cock-stat-item">
              <span class="cock-stat-val">${n(drafts)}</span>
              <span class="cock-stat-label">Rascunhos</span>
            </div>
          </div>

          <div class="cock-pillar-body">
            <!-- Últimas publicações reais -->
            <div>
              <div class="cock-subhead" style="margin-bottom:6px;">
                <span>Últimas matérias no ar</span>
                <small style="color:var(--admin-text-secondary);font-size:0.75rem;">clique para editar</small>
              </div>
              ${
                recentNews && recentNews.length > 0
                  ? `<div class="cock-news-list">
                      ${recentNews.map(item => `
                        <a href="#" class="cock-news-item" data-edit="noticias" data-id="${item.id}">
                          <strong class="cock-news-title">${esc(item.titulo || "Notícia sem título")}</strong>
                          <div class="cock-news-meta">
                            <span class="cock-tag">${esc(item.categoria_nome || "Geral")}</span>
                            <span>${esc(item.autor || "Redação")}</span>
                            <span>·</span>
                            <span>${ago(item.publicado_em || item.atualizado_em)}</span>
                          </div>
                        </a>
                      `).join("")}
                    </div>`
                  : `<p class="cock-panel-subtitle">Nenhuma notícia publicada recentemente.</p>`
              }
            </div>

            <!-- Próxima Agendada -->
            ${
              scheduledNews && scheduledNews.length > 0
                ? `<div class="cock-scheduled-box">
                    <span aria-hidden="true">⏱️</span>
                    <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;">
                      <strong>Programada:</strong> ${esc(scheduledNews[0].titulo)}
                      <small>(${new Date(scheduledNews[0].publicado_em).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: zone })})</small>
                    </div>
                  </div>`
                : ""
            }
          </div>

          <div class="cock-pillar-actions">
            <button type="button" class="admin-button" data-new="noticias">+ Nova notícia</button>
            <button type="button" class="admin-button secondary" data-view="noticias">Ver todas</button>
          </div>
        </article>

        <!-- Pilar 3: Cidade, Turismo & Agenda -->
        <article class="cock-panel cock-pillar">
          <div class="cock-panel-head">
            <h3>${renderAdminModuleIcon("event")} Cidade, Turismo & Agenda</h3>
            <span class="cock-tag" style="background:#eaf2f8;color:#18537a;">${n(future)} eventos futuros</span>
          </div>

          <div class="cock-stats-row">
            <div class="cock-stat-item">
              <span class="cock-stat-val">${n(future)}</span>
              <span class="cock-stat-label">Na Agenda</span>
            </div>
            <div class="cock-stat-item">
              <span class="cock-stat-val">${n(tourism)}</span>
              <span class="cock-stat-label">Atrativos</span>
            </div>
            <div class="cock-stat-item">
              <span class="cock-stat-val">${n(eventosPrincipais)}</span>
              <span class="cock-stat-label">Grandes Festas</span>
            </div>
          </div>

          <div class="cock-pillar-body">
            <div class="cock-subhead" style="margin-bottom:6px;">
              <span>Próximos eventos na cidade</span>
            </div>
            ${
              nextEvents && nextEvents.length > 0
                ? `<div class="cock-events-list">
                    ${nextEvents.map(e => {
                      const evtDate = new Date(e.data_inicio);
                      const dayNum = evtDate.getDate();
                      const monthName = evtDate.toLocaleDateString("pt-BR", { month: "short", timeZone: zone }).replace(".", "").slice(0, 3).toUpperCase();
                      return `
                        <div class="cock-event-item">
                          <div class="cock-date-badge">
                            <span class="cock-date-day">${dayNum}</span>
                            <span class="cock-date-month">${monthName}</span>
                          </div>
                          <div class="cock-event-details">
                            <strong class="cock-event-title">${esc(e.titulo || "Evento")}</strong>
                            <span class="cock-event-venue">${esc(e.local || "Urânia, SP")}${e.categoria_nome ? " · " + esc(e.categoria_nome) : ""}</span>
                          </div>
                        </div>
                      `;
                    }).join("")}
                  </div>`
                : `<p class="cock-panel-subtitle">Nenhum evento agendado para os próximos dias.</p>`
            }
          </div>

          <div class="cock-pillar-actions">
            <button type="button" class="admin-button secondary" data-new="eventos">+ Novo evento</button>
            <button type="button" class="admin-button secondary" data-view="eventos">Ver agenda completa</button>
          </div>
        </article>

        <!-- Pilar 4: Prêmio Melhores de Urânia -->
        <article class="cock-panel cock-pillar">
          <div class="cock-panel-head">
            <h3>${renderAdminModuleIcon("award")} Melhores de Urânia</h3>
            ${edition ? `<span class="cock-tag" style="background:#fef3e7;color:#8a4714;">${edition.ano}</span>` : ""}
          </div>

          <div class="cock-pillar-body">
            ${
              edition
                ? `
                  <div class="cock-melhores-box">
                    <div class="cock-melhores-banner">
                      <div>
                        <strong class="cock-melhores-name">${esc(edition.nome || `Edição ${edition.ano}`)}</strong>
                        <p style="font-size:0.78rem;color:var(--admin-text-secondary);margin-top:2px;">
                          ${edition.resultado_publicado_em ? "Resultados consolidados e publicados" : "Ciclo oficial da premiação"}
                        </p>
                      </div>
                      <span class="cock-melhores-status">${esc(editionStatusLabels[edition.status] || edition.status)}</span>
                    </div>

                    <div class="cock-stats-row">
                      <div class="cock-stat-item">
                        <span class="cock-stat-val">${n(votes)}</span>
                        <span class="cock-stat-label">Votos válidos</span>
                      </div>
                      <div class="cock-stat-item">
                        <span class="cock-stat-val">${n(nominees)}</span>
                        <span class="cock-stat-label">Indicados</span>
                      </div>
                      <div class="cock-stat-item">
                        <span class="cock-stat-val">${remaining > 0 ? remaining + "d" : "—"}</span>
                        <span class="cock-stat-label">${remaining > 0 ? "Restantes" : "Fase"}</span>
                      </div>
                    </div>

                    ${
                      remaining > 0
                        ? `
                          <div style="display:flex;flex-direction:column;gap:4px;">
                            <div style="display:flex;justify-content:space-between;font-size:0.78rem;font-weight:600;">
                              <span>Ritmo de votação</span>
                              <span>${n(votes)} votos registrados</span>
                            </div>
                            <div class="cock-bar-track">
                              <div class="cock-bar-fill" style="width:${ballots ? Math.min(100, Math.round((100 * votes) / ballots)) : 100}%;"></div>
                            </div>
                          </div>
                        `
                        : `<p class="cock-panel-subtitle">Consulte o ranking, histórico de vencedores e certificados emitidos.</p>`
                    }
                  </div>
                `
                : `<p class="cock-panel-subtitle">Nenhuma edição ativa cadastrada no momento.</p>`
            }
          </div>

          <div class="cock-pillar-actions">
            <button type="button" class="admin-button secondary" data-view="melhores">Acessar Melhores de Urânia</button>
          </div>
        </article>

      </section>

      <!-- Timeline de Atividades Recentes -->
      <section class="cock-panel" aria-label="Histórico de Ações">
        <div class="cock-panel-head">
          <h3>${renderAdminModuleIcon("media")} Atividades Recentes da Equipe</h3>
          <span class="cock-panel-subtitle">Registro de auditoria e alterações recentes no CMS</span>
        </div>
        ${
          activities && activities.length > 0
            ? `
              <ol class="cock-log-list">
                ${activities.map(a => `
                  <li class="cock-log-item">
                    <span class="cock-log-title">${esc(a.titulo || a.tabela || "Alteração no sistema")}</span>
                    <span class="cock-log-meta">${esc(actors.get(a.usuario_id) || "Equipe Editorial")} · ${esc(a.acao || "atualizou")} · <strong style="text-transform:uppercase;font-size:0.7rem;">${esc(a.tabela || "")}</strong></span>
                    <time class="cock-log-time">${esc(ago(a.criado_em))}</time>
                  </li>
                `).join("")}
              </ol>
            `
            : `<p class="cock-panel-subtitle">Nenhuma atividade recente registrada.</p>`
        }
      </section>
    `;

    // Renderizador reativo por período (7d, 14d, 30d)
    function renderPeriod(period) {
      const current = days.slice(-period);
      const previous = days.slice(-2 * period, -period);

      function sum(list, key) {
        return list.reduce((s, d) => s + d[key], 0);
      }

      function kpi(title, value, detail, key, colorClass, warn = false) {
        const a = sum(current, key);
        const b = sum(previous, key);
        let changeText = "Sem base";
        let trendClass = "neutral";

        if (b > 0) {
          const pct = Math.round((100 * (a - b)) / b);
          changeText = (pct > 0 ? "+" : "") + pct + "% vs anterior";
          trendClass = pct > 0 ? "positive" : pct < 0 ? "negative" : "neutral";
        } else if (a > 0) {
          changeText = "Em alta";
          trendClass = "positive";
        }

        return `
          <article class="cock-kpi ${warn ? "attention-active" : ""}">
            <div class="cock-kpi-head">
              <span class="cock-kpi-title">${title}</span>
            </div>
            <strong class="cock-kpi-val">${n(value)}</strong>
            <span class="cock-kpi-sub">${detail}</span>
            <div class="cock-kpi-spark-wrap">
              ${sparkline(current.map(d => d[key]), colorClass)}
            </div>
            <div class="cock-kpi-footer">
              <span class="cock-trend-pill ${trendClass}">${changeText}</span>
              <small style="color:var(--admin-text-secondary);font-size:0.72rem;">no período</small>
            </div>
          </article>
        `;
      }

      const views = sum(current, "views");
      const clicks = sum(current, "clicks");
      const visitors = new Set(current.flatMap(d => [...d.sessions])).size;

      // Atualiza os 5 KPIs do topo
      frame.querySelector(".cock-kpis").innerHTML = [
        kpi("Audiência Geral", events ? views : null, `${n(events ? visitors : null)} sessões únicas`, "views", "blue"),
        kpi("Impacto Comercial", events ? clicks : null, "Cliques no WhatsApp e links", "clicks", "green"),
        kpi("Parceiros Viva", activePlans.length, `${n(guide?.length)} empresas no Guia`, "partners", "purple"),
        kpi("Comunidade & App", push?.length, `${n(coupons)} vantagens · ${n(sends ? sum(current, "reach") : null)} alcance`, "devices", "orange"),
        kpi("Atenção & Moderação", completeInbox ? attention : null, attention > 0 ? "Itens aguardando ação" : "Tudo resolvido", "requests", "orange", attention > 0)
      ].join("");

      // Atualiza Gráfico de Linha SVG Principal
      frame.querySelector(".cock-plot").innerHTML = events ? audienceChart(current) : '<div class="cock-empty-chart">Dados de audiência indisponíveis.</div>';

      // Agrega Top 5 Páginas do período
      const pageAgg = new Map();
      for (const d of current) {
        for (const [p, count] of d.pages) {
          pageAgg.set(p, (pageAgg.get(p) || 0) + count);
        }
      }
      const topPages = [...pageAgg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

      frame.querySelector(".cock-top-pages").innerHTML =
        topPages.length > 0
          ? topPages
              .map(([path, count], idx) => `
                <div class="cock-page-row">
                  <span class="cock-page-rank">#${idx + 1}</span>
                  <div class="cock-page-info">
                    <span class="cock-page-name">${esc(formatPageTitle(path))}</span>
                    <span class="cock-page-path">${esc(path)}</span>
                  </div>
                  <span class="cock-page-views">${n(count)} views</span>
                </div>
              `)
              .join("")
          : '<p class="cock-panel-subtitle" style="padding:4px 0;">Sem visualizações registradas no período.</p>';

      // Agrega Canais & Dispositivos
      const channelLabels = ["App Viva Urânia", "Web Mobile", "Web Desktop", "Outros"];
      const channelClasses = ["app", "mobile", "desktop", "other"];

      frame.querySelector(".cock-distribution").innerHTML = channelLabels
        .map((label, i) => {
          const total = current.reduce((s, d) => s + d.channels[i], 0);
          const share = views > 0 ? Math.round((total * 100) / views) : 0;
          return `
            <div class="cock-channel-item">
              <div class="cock-channel-meta">
                <span class="cock-channel-name">${label}</span>
                <span class="cock-channel-val">${events ? share + "%" : "—"} (${n(total)})</span>
              </div>
              <div class="cock-bar-track">
                <div class="cock-bar-fill ${channelClasses[i]}" style="width: ${share}%;"></div>
              </div>
            </div>
          `;
        })
        .join("");

      // Atualiza estado visual dos botões de período
      for (const b of frame.querySelectorAll("[data-period]")) {
        b.setAttribute("aria-pressed", String(+b.dataset.period === period));
      }
    }

    renderPeriod(period);
    const state = (...keys) => keys.some(key => !ready.has(key)) ? "Carregando…" :
      keys.some(key => failed.has(key)) ? "Dados indisponíveis." : "";
    function showStatus(node, message, headingSelector) {
      if (!message) return;
      const heading = headingSelector && node.querySelector(headingSelector);
      const notice = document.createElement("p");
      notice.className = "cock-panel-subtitle";
      notice.textContent = message;
      const actions = node.querySelector(".cock-pillar-actions");
      node.replaceChildren(...[heading, notice, actions].filter(Boolean));
    }
    const audienceStatus = waitingAudience ? "Carregando audiência…" : events ? "" : "Audiência indisponível.";
    for (const area of frame.querySelectorAll(".cock-plot, .cock-distribution, .cock-top-pages")) showStatus(area, audienceStatus);
    const inboxStatus = state("partners", "moderation");
    const statuses = [audienceStatus, audienceStatus, state("partners"), state("community"), inboxStatus];
    frame.querySelectorAll(".cock-kpi").forEach((node, i) => showStatus(node, statuses[i], ".cock-kpi-head"));
    const pillars = ["partners", "editorial", "city", "awards"];
    frame.querySelectorAll(".cock-pillar").forEach((node, i) => showStatus(node, state(pillars[i]), "h3"));
    showStatus(frame.querySelector(".cock-inbox-panel"), inboxStatus, "h3");
    showStatus(frame.lastElementChild, state("activities"), "h3");
    root.setAttribute("aria-busy", String(ready.size < 7 || waitingAudience));
    const focusedPeriod = root.contains(document.activeElement) && document.activeElement.dataset.period;
    Array.from(frame.children).forEach((child, index) => {
      const previous = root.children[index];
      if (!previous) root.append(child);
      else if (!previous.isEqualNode(child)) previous.replaceWith(child);
    });
    if (focusedPeriod) root.querySelector(`[data-period="${focusedPeriod}"]`).focus({ preventScroll: true });
  }

  paint();
  root.addEventListener("click", event => {
    const button = event.target.closest("[data-period]");
    if (!button || period === Number(button.dataset.period)) return;
    if (controller.signal.aborted) controller = dashboardReadController = new AbortController();
    period = Number(button.dataset.period);
    loadAudience();
    paint();
  });
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
    const rows=await listarTabela(databaseTable(table),{ordem:config.order,crescente:config.ascending||false});
    const statuses = [...new Set(rows.map(resourceRowStatus).filter(Boolean))].sort((a,b) => a.localeCompare(b, "pt-BR"));
    const partnerRows = table === 'guia_comercial' ? await getSupabase().from('parceiros').select('guia_id,ativo').eq('ativo',true) : {data:[]};
    const partnerIds = new Set((partnerRows.data || []).map(item => item.guia_id));
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
              <table class="admin-table admin-data-table">
                <thead><tr><th>Registro</th><th>Status</th>${table==='guia_comercial'?'<th>Parceiro</th>':''}<th>Atualização</th><th>Ações</th></tr></thead>
                <tbody>
                  ${rows.map(row=>{
                    const status = resourceRowStatus(row);
                    const titleValue = row[config.title] || "Sem título";
                    const subtitle = [row.categoria_nome, row.slug, row.local, row.cidade].filter(Boolean).slice(0, 2).join(" · ");
                    return `<tr data-admin-row data-search="${escapeHtml(resourceRowSearch(row, config))}" data-status="${escapeHtml(status)}">
                      <td class="admin-title-cell"><strong>${escapeHtml(titleValue)}</strong>${subtitle ?`<small>${escapeHtml(subtitle)}</small>` : ""}</td>
                      <td><span class="status-pill ${escapeHtml(status)}">${escapeHtml(status || "—")}</span></td>
                      ${table==='guia_comercial'?`<td title="${partnerIds.has(row.id)?'Parceiro ativo':'Sem parceiro'}">${partnerIds.has(row.id)?'🟢':'⚪'}</td>`:''}
                      <td data-sort="${escapeHtml(row.atualizado_em || row.criado_em || "")}">${resourceUpdatedAt(row)}</td>
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
    bindResourceTable(app.querySelector(".admin-list-panel"));
  } catch(error) { app.innerHTML=`<p class="form-message">${escapeHtml(error.message)}</p>`; }
}

function selectOptionLabel(option, type) {
  if (type === "event-simple-recurrence") {
    return {
      nenhuma: "Não se repete",
      semanal: "Semanal",
      mensal: "Mensal",
      anual: "Anual"
    }[option] || option;
  }
  if (type === "link-feature-type") {
    return {
      normal: "Normal",
      grupo_whatsapp: "Grupo do WhatsApp",
      app: "Bloco do app"
    }[option] || option;
  }
  if (type === "home-suggestion-type") return ({ empresa: "Comércio", turismo: "Turismo", evento: "Evento", noticia: "Notícia", iniciativa: "Iniciativa", vantagem: "Viva Vantagem" })[option] || option;
  if (type === "home-suggestion-status") return ({ rascunho: "Rascunho", agendado: "Agendado", ativo: "Ativo", pausado: "Pausado", encerrado: "Encerrado" })[option] || option;
  if (type === "home-suggestion-recurrence") return ({ nenhuma: "Não se repete", semanal: "Toda semana" })[option] || option;
  if (type === "home-suggestion-weekday") return (["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"])[Number(option)] || option;
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
      .select("id,nome,slug,ativo,categoria")
      .order("nome", { ascending: true });
    if (error) throw error;
    select.innerHTML = `<option value="">Selecione um evento principal</option>${data.map(item => `<option value="${escapeHtml(item.id)}" ${item.id===current?"selected":""}>${escapeHtml(item.nome)}${item.ativo===false?" (inativo)":""}</option>`).join("")}`;
    if (!data.length) select.innerHTML = '<option value="">Cadastre um evento principal primeiro</option>';
    const inheritedCategory = app.querySelector("[data-event-edition-category]");
    const syncInheritedCategory = () => {
      const event = data.find(item => item.id === select.value);
      if (inheritedCategory) inheritedCategory.value = event?.categoria || (select.value ? "Sem categoria" : "Selecione o evento principal");
    };
    select.addEventListener("change", syncInheritedCategory);
    syncInheritedCategory();
  } catch (error) {
    select.innerHTML = '<option value="">Não foi possível carregar os eventos</option>';
    const inheritedCategory = app.querySelector("[data-event-edition-category]");
    if (inheritedCategory) inheritedCategory.value = "Não foi possível carregar";
  }
}

const HOME_SUGGESTION_TARGETS = {
  empresa: { table: "guia_comercial", fields: "id,nome", title: item => item.nome, filter: query => query.eq("status", "publicado") },
  turismo: { table: "turismo", fields: "id,nome", title: item => item.nome, filter: query => query.eq("status", "publicado") },
  evento: { table: "eventos", fields: "id,titulo,data_inicio", title: item => `${item.titulo}${item.data_inicio ? ` — ${new Date(item.data_inicio).toLocaleDateString("pt-BR")}` : ""}`, filter: query => query.eq("status", "publicado") },
  noticia: { table: "noticias", fields: "id,titulo", title: item => item.titulo, filter: query => query.eq("status", "publicado") },
  iniciativa: { table: "iniciativas_comunitarias", fields: "id,titulo", title: item => item.titulo, filter: query => query.eq("status", "publicado").eq("exibir_na_listagem", true) },
  vantagem: { table: "vantagens", fields: "id,titulo", title: item => item.titulo, filter: query => query.eq("ativo", true) }
};

async function carregarSelectSugestaoMomento() {
  const target = app.querySelector("[data-home-suggestion-target]");
  const type = app.querySelector('[name="tipo_conteudo"]');
  if (!target || !type) return;
  const load = async () => {
    const config = HOME_SUGGESTION_TARGETS[type.value];
    const current = target.dataset.current || target.value || "";
    if (!config) {
      target.innerHTML = '<option value="">Escolha primeiro o tipo de conteúdo</option>';
      return;
    }
    target.innerHTML = '<option value="">Carregando conteúdos...</option>';
    try {
      let query = getSupabase().from(config.table).select(config.fields).order("id", { ascending: false }).limit(300);
      query = config.filter(query);
      const { data = [], error } = await query;
      if (error) throw error;
      target.innerHTML = `<option value="">Selecione um conteúdo</option>${data.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === current ? "selected" : ""}>${escapeHtml(config.title(item))}</option>`).join("")}`;
      if (!data.length) target.innerHTML = '<option value="">Nenhum conteúdo público disponível</option>';
    } catch {
      target.innerHTML = '<option value="">Não foi possível carregar os conteúdos</option>';
    }
  };
  type.addEventListener("change", () => { target.dataset.current = ""; void load(); });
  await load();
}

function setupHomeSuggestionSchedule(container) {
  if (currentResourceTable !== "sugestoes_momento") return;
  const form = container.querySelector("#resource-form");
  const recurrence = form?.elements.recorrencia_tipo;
  if (!form || !recurrence) return;
  const fields = ["dia_semana", "hora_inicio", "hora_fim", "recorrencia_ate"]
    .map(name => form.elements[name]?.closest("label"))
    .filter(Boolean);
  const apply = () => fields.forEach(field => { field.hidden = recurrence.value !== "semanal"; });
  recurrence.addEventListener("change", apply);
  apply();
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
  const recurrenceField = recurrenceInput.closest("label");
  const startField = startInput.closest("label");
  const endField = endInput.closest("label");
  recurrenceField?.classList.add("event-recurrence-field", "event-schedule-field");
  startField?.classList.add("event-date-field", "event-schedule-field");
  endField?.classList.add("event-date-field", "event-schedule-field");
  if (recurrenceField && startField?.parentElement === recurrenceField.parentElement) {
    startField.parentElement.insertBefore(recurrenceField, startField);
  }
  repeatUntilInput?.closest("label")?.classList.add("event-repeat-until-field");

  const apply = () => {
    const recurring = simpleEventIsRecurring(recurrenceInput.value);
    form.classList.toggle("is-recurring-event", recurring);
    setFieldCaption(recurrenceInput, "Tipo de repetição");
    setFieldHint(recurrenceInput, recurring ? "O evento será repetido automaticamente nessa frequência." : "Escolha primeiro se este evento se repete.");
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
      setFieldHint(startInput, "Data e horário em que o evento começa.");
      setFieldCaption(endInput, "Fim");
      setFieldHint(endInput, "Data e horário em que o evento termina.");
      if (endInput.type !== "datetime-local") {
        const datePart = String(startInput.value || "").slice(0, 10);
        const timePart = extractTimeFromDateTime(endInput.value);
        endInput.type = "datetime-local";
        endInput.value = endInput.dataset.datetimeValue || (datePart && timePart ? `${datePart}T${timePart}` : "");
      }
      if (repeatUntilInput) {
        setFieldCaption(repeatUntilInput, "Repetir até");
        setFieldHint(repeatUntilInput, "");
        repeatUntilInput.closest("label")?.classList.add("hidden");
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

function fieldHtmlCorrigido([name,label,type,required], value) {
  const isPrimaryMediaField = type === "url" && /^(imagem_url|imagem_capa_url)$/.test(String(name || ""));
  const isEditionMediaField = currentResourceTable === "eventos_edicoes" && type === "url" && /^(cartaz_url|banner_url)$/.test(String(name || ""));
  const req=required?"required":"", full=["textarea","editor","url-list","line-list","weekly-hours","gallery-urls"].includes(type)||isPrimaryMediaField||isEditionMediaField?`full-row${isEditionMediaField?" event-edition-media-field":""}`:"";
  if(type==="editor") return `<label class="${full}">${label}<div id="editor"></div><input type="hidden" name="${name}"></label>`;
  if(type==="weekly-hours") return weeklyHoursHtml(name,label,value);
  if(type==="gallery-urls") return galleryUrlsHtml(name,label,value);
  if(type==="textarea") return `<label class="${full}">${label}<textarea name="${name}" ${req}>${escapeHtml(inputValue(value,type))}</textarea></label>`;
  if(type==="url-list") return `<label class="${full}">${label}<textarea name="${name}" placeholder="Cole uma URL de imagem por linha" data-cms-gallery="true" data-media-folder="${escapeHtml(mediaFolderForTable(currentResourceTable))}" data-media-preset="card">${escapeHtml(listValue(value))}</textarea><small>Use uma imagem por linha para montar a galeria.</small></label>`;
  if(type==="line-list") return `<label class="${full}">${label}<textarea name="${name}" placeholder="Digite um item por linha">${escapeHtml(listValue(value))}</textarea><small>Digite um item por linha. Exemplo: nome do patrocinador, link útil ou vídeo.</small></label>`;
  if(type==="boolean"){const checked=value===undefined&&name==="ativo"?true:Boolean(value);return `<label>${label}<select name="${name}"><option value="false" ${!checked?"selected":""}>Não</option><option value="true" ${checked?"selected":""}>Sim</option></select></label>`}
  if(type==="tags") return `<label class="${full}">${label}<input type="text" name="${name}" value="${escapeHtml(Array.isArray(value)?value.join(", "):inputValue(value,type))}" placeholder="pautas, fotos, eventos"><small>Separe por vírgula.</small></label>`;
  if(type==="event-principal-select") return `<label>${label}<select name="${name}" data-event-principal-select data-current="${escapeHtml(inputValue(value,type))}" ${req}><option value="">Carregando eventos principais...</option></select><small>Escolha o evento principal. Não precisa copiar ID.</small></label>`;
  if(type==="home-suggestion-target") return `<label>${label}<select name="${name}" data-home-suggestion-target data-current="${escapeHtml(inputValue(value,type))}" ${req}><option value="">Escolha primeiro o tipo de conteúdo</option></select><small>Somente conteúdo ainda público e válido poderá aparecer na Home.</small></label>`;
  const options=type==="status"?["rascunho","publicado","arquivado"]:type==="active-status"?["ativo","inativo"]:type==="category-type"?["noticias","guia","turismo","eventos"]:type==="link-feature-type"?["normal","grupo_whatsapp","app"]:type==="volunteer-status"?["novo","em_conversa","aprovado","recusado","arquivado"]:type==="event-recurrence"?["anual","mensal","unico","outro"]:type==="event-simple-recurrence"?["nenhuma","semanal","mensal","anual"]:type==="event-edition-status"?["anunciado","confirmado","acontecendo","encerrado","cancelado"]:type==="home-suggestion-type"?["empresa","turismo","evento","noticia","iniciativa","vantagem"]:type==="home-suggestion-status"?["agendado","rascunho","ativo","pausado","encerrado"]:type==="home-suggestion-recurrence"?["nenhuma","semanal"]:type==="home-suggestion-weekday"?["0","1","2","3","4","5","6"]:null;
  if(options) { const current=value ?? (type==="home-suggestion-status"?"agendado":type==="home-suggestion-recurrence"?"nenhuma":""); return `<label>${label}<select name="${name}">${options.map(o=>`<option value="${o}" ${String(current)===o?"selected":""}>${selectOptionLabel(o,type)}</option>`).join("")}</select></label>`; }
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
      <div class="resource-form-grid">${groups[key].map(field=>fieldHtmlCorrigido(field,row[field[0]])).join("")}${table==="eventos_edicoes"&&key==="publication"?'<label>Categoria do evento<input type="text" value="Carregando..." data-event-edition-category readonly><small>Definida no Evento principal.</small></label>':""}</div>
    </section>`;
  }).join("");
}

async function editForm(table,id) {
  const config=resources[table]; let row={};
  currentResourceTable=table;
  activeModuleKey = table;
  app.dataset.layout = "form";
  if(id){const {data,error}=await getSupabase().from(databaseTable(table)).select("*").eq("id",id).single();if(error)throw error;row=data;}
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
        ${table === 'guia_comercial' && id && temPermissao(painelAccess?.admin, 'guia_comercial', 'ler') ? `<section class="admin-form-section"><h3>Catálogos</h3><p data-company-catalog-count>Consulte os catálogos desta empresa.</p><a class="admin-button secondary" href="/admin/catalogos?empresa=${encodeURIComponent(id)}">Gerenciar catálogos</a></section>` : ''}
        <footer class="form-actions admin-form-actions">
          <p id="form-message" class="form-message"></p>
          <div>
            <button type="button" class="admin-button secondary" data-cancel="${table}">Cancelar</button>
            <button class="admin-button" type="submit">Salvar</button>
          </div>
        </footer>
      </form>
      ${table==='guia_comercial' && id && temPermissao(painelAccess?.admin,'guia_comercial','editar')?`<section class="panel admin-form-section" id="partner-access"><header class="admin-form-section-head"><span>↗</span><div><h3>Acesso do Parceiro</h3><p>Convide uma pessoa para cuidar das informações deste estabelecimento.</p></div></header><div class="partner-access-content"><div class="partner-access-current"><span class="partner-access-label">Acesso atual</span><p id="partner-access-status">Carregando...</p></div><div class="partner-access-actions"><button type="button" class="admin-button" id="partner-create" hidden>Criar acesso do parceiro</button><button type="button" class="admin-button secondary" id="partner-resend" hidden>Gerar novo link</button><button type="button" class="admin-button secondary" id="partner-revoke" hidden>Revogar acesso</button><a class="admin-button secondary" href="/admin/parceiros-log?guia_id=${encodeURIComponent(id)}">Ver alterações</a><a class="admin-button secondary" href="/admin/viva-assinaturas?guia_id=${encodeURIComponent(id)}">Plano Viva</a></div><p id="partner-access-message" class="partner-access-message" role="status"></p><div id="partner-invite-result" class="partner-invite-result" hidden><label for="partner-invite-link">Link de acesso</label><div><input id="partner-invite-link" type="text" readonly autocomplete="off"><button type="button" class="admin-button secondary" id="partner-copy-link">Copiar link</button></div><small>Envie este link somente para o parceiro. Você pode gerar outro link depois.</small></div></div><dialog id="partner-dialog" class="partner-dialog"><form id="partner-invite-form"><h3>Convidar parceiro</h3><p>Informe um e-mail diferente do usado pela equipe administrativa.</p><label>E-mail<input type="email" name="email" required autocomplete="email"></label><div class="partner-dialog-actions"><button class="admin-button" type="submit">Criar convite</button><button class="admin-button secondary" type="button" id="partner-cancel">Cancelar</button></div></form></dialog></section>`:''}
    </section>`;
  if(table==='guia_comercial' && id && app.querySelector('#partner-access')){
    const status=app.querySelector('#partner-access-status'),create=app.querySelector('#partner-create'),resend=app.querySelector('#partner-resend'),revoke=app.querySelector('#partner-revoke'),message=app.querySelector('#partner-access-message');
    const resultBox=app.querySelector('#partner-invite-result'),linkInput=app.querySelector('#partner-invite-link');
    const clearLink=()=>{linkInput.value='';resultBox.hidden=true;};
    const showLink=link=>{linkInput.value=link;resultBox.hidden=false;message.textContent='Link pronto. Copie e envie ao parceiro.';};
    const request=async payload=>{const {data:{session}}=await getSupabase().auth.getSession();if(!session)throw Error('Sua sessão expirou. Entre novamente no CMS.');const response=await adminApiFetch('/api/admin-criar-parceiro',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({guia_id:id,...payload})});const result=await response.json();if(!response.ok)throw Error(result.error||'Não foi possível concluir a operação.');return result;};
    const refresh=async()=>{const {data,error}=await getSupabase().from('parceiros').select('id,email,criado_em').eq('guia_id',id).eq('ativo',true).maybeSingle();if(error){status.textContent=error.message;return;}status.textContent=data?`${data.email} · criado em ${new Date(data.criado_em).toLocaleDateString('pt-BR')}`:'Nenhum parceiro ativo';create.hidden=!!data;resend.hidden=!data;revoke.hidden=!data;};
    const dialog=app.querySelector('#partner-dialog');
    create.addEventListener('click',()=>dialog.showModal());
    app.querySelector('#partner-cancel').addEventListener('click',()=>dialog.close());
    app.querySelector('#partner-invite-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]');button.disabled=true;clearLink();try{const result=await request({action:'invite',email:new FormData(form).get('email')});dialog.close();form.reset();await refresh();showLink(result.invite_link);}catch(error){message.textContent=error.message;dialog.close();await refresh();}finally{button.disabled=false;}});
    resend.addEventListener('click',async()=>{resend.disabled=true;clearLink();try{const result=await request({action:'resend'});showLink(result.invite_link);}catch(error){message.textContent=error.message;await refresh();}finally{resend.disabled=false;}});
    revoke.addEventListener('click',async()=>{if(!confirm('Revogar o acesso deste parceiro?'))return;revoke.disabled=true;try{await request({action:'revoke'});clearLink();message.textContent='Acesso revogado. Você já pode convidar outro e-mail ou reativar este.';await refresh();}catch(error){message.textContent=error.message;await refresh();}finally{revoke.disabled=false;}});
    app.querySelector('#partner-copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(linkInput.value);message.textContent='Link copiado.';}catch{linkInput.select();message.textContent='Selecione o link e copie com Ctrl+C.';}});
    refresh();
  }
  app.querySelector("#resource-form").addEventListener("input", () => { resourceDirty = true; });
  const resourceForm = app.querySelector("#resource-form");
  resourceForm.addEventListener("click",handleWeeklyHoursAction);
  resourceForm.addEventListener("input",handleWeeklyHoursChange);
  resourceForm.addEventListener("change",handleWeeklyHoursChange);
  normalizeCoordinateInputs(app);
  if (table === 'guia_comercial' && id) {
    const countElement = app.querySelector('[data-company-catalog-count]');
    if (countElement) getSupabase().from('catalogos').select('id', { count: 'exact', head: true }).eq('empresa_id', id).eq('status', 'ativo').then(({count,error}) => {
      if (countElement.isConnected && !error) countElement.textContent = `${count || 0} catálogo(s) ativo(s)`;
    }).catch(() => {});
  }
  setupGalleryFields(app);
  const editorField=config.fields.find(f=>f[2]==="editor");
  if(editorField){quill=new Quill("#editor",{theme:"snow",modules:{toolbar:[["bold","italic","blockquote"],[{header:[2,3,false]}],[{list:"ordered"},{list:"bullet"}],["link","image","video"],["clean"]]}});quill.root.innerHTML=row[editorField[0]]||"";}
  const categories = await import("./category-fields.js");
  await categories.enhanceCategoryField(app.querySelector("#resource-form"),row);
  await carregarSelectEventosPrincipais();
  await carregarSelectSugestaoMomento();
  setupSimpleEventRecurrenceForm(app);
  setupHomeSuggestionSchedule(app);
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
      } else if (type === "url-list") {
        payload[name] = parseUrlList(form.get(name));
      } else if (type === "line-list") {
        payload[name] = parseLineList(form.get(name));
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
      Object.assign(payload, categories.categoryValues(event.currentTarget));
      normalizeEventDates(table, payload);
      await salvarRegistro(databaseTable(table), payload);
      resourceDirty = false;
      if (currentView === table) await navigateToView(table, {replace:true});
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
  shellPrimaryActionCleanup?.();
  shellPrimaryActionCleanup = null;
  if (pagePrimaryAction) pagePrimaryAction.innerHTML = options.actionHtml || "";
  if (pageHint) {
    pageHint.textContent = hintText || "Acompanhe os principais dados do portal e escolha um módulo no menu para gerenciar conteúdo, publicidade, comunicação e configurações.";
  }
  document.title = `${label || "Painel"} | Eu Amo Urânia`;
}

function setShellPrimaryAction(label, handler) {
  shellPrimaryActionCleanup?.();
  shellPrimaryActionCleanup = null;
  if (!pagePrimaryAction) return;
  pagePrimaryAction.innerHTML = "";
  if (!label || typeof handler !== "function") return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "admin-button";
  button.textContent = label;
  button.addEventListener("click", handler);
  pagePrimaryAction.append(button);
  shellPrimaryActionCleanup = () => button.removeEventListener("click", handler);
}

// Dashboard and table-backed views share their renderer and form lifecycle.
export async function mount(container, {view, restored, edit, id}) {
  if (edit) await editForm(view,id);
  else if (!restored) await (view === "dashboard" ? dashboard() : resourceList(view));
}

export function unmount() {
  dashboardReadController?.abort();
  dashboardReadController = null;
  quill?.disable();
  quill = null;
  currentResourceTable = null;
}

const resourceModule = { mount, unmount, canLeave: canLeaveResource };
const snapshots = new Map();
let mountedAt = 0;
let renderedRevision = -1;
let mountedUrl = "";
let navigationQueue = Promise.resolve();
let latestRequest = 0;
let bindMediaFields;
let releaseMediaFields;
let loadingController;

function setActiveNav(view) {
  const section = navigation.find(item => item.tabs.some(tab => tab.view === view)) ||
    (view === "noticia_editor" && navigation.find(item => item.tabs.some(tab => tab.view === "noticias")));
  document.querySelectorAll(".admin-nav button,.admin-nav a").forEach(button => {
    const selected = button.dataset.view === section?.tabs[0].view;
    button.classList.toggle("active", selected);
    if (selected) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  const tabs = document.getElementById("section-tabs");
  tabs.replaceChildren();
  tabs.hidden = !section || section.tabs.length < 2;
  if (tabs.hidden) return;
  for (const tab of section.tabs) {
    const link = document.createElement("a");
    link.href = adminPathForView(tab.view);
    link.dataset.view = tab.view;
    link.textContent = tab.label;
    if (tab.view === view) link.setAttribute("aria-current", "page");
    tabs.append(link);
  }
}

function rememberList() {
  if (app.querySelector('.cockpit[aria-busy="true"]')) return;
  if (renderedRevision !== revision || Date.now() - mountedAt >= ttl) return;
  if (!app.querySelector(".ops-dashboard, #news-rows, .admin-list-panel, #cat-rows")) return;
  snapshots.set(mountedUrl, {
    nodes: [...app.childNodes], time: mountedAt, revision,
    title: title.textContent, hint: pageHint.textContent, actionHtml: pagePrimaryAction.innerHTML,
    layout: app.dataset.layout
  });
}

async function openView(view, options) {
  const params = new URLSearchParams(options.search);
  if (options.edit && resources[view]) {
    if (options.id) params.set("editar", options.id);
    else params.set("novo", "1");
  }
  const editing = resources[view] && (params.has("editar") || params.has("novo"));
  const search = params.size ? "?" + params.toString() : "";
  if (!canOpen(view, search) || (editing && !temPermissao(painelAccess.admin, getAdminModule(view).permission || view, params.has("editar") ? "editar" : "criar"))) {
    shellToast("Seu perfil não tem acesso a esta seção.", "error");
    if (!mountedUrl || options.pop) {
      const fallback = navigation[0]?.tabs[0].view;
      if (fallback && fallback !== view) return openView(fallback, {replace:true});
      app.textContent = "Nenhuma seção disponível para este perfil.";
    }
    return;
  }
  const url = adminPathForView(view) + search + (options.hash || "");
  if (mountedUrl === url && renderedRevision !== -1 && !options.refresh && !options.edit && app.dataset.layout !== "form") return;
  if (activeMountedModule?.canLeave?.() === false) {
    if (options.pop) history.pushState({adminView:currentView}, "", mountedUrl);
    return;
  }
  if (options.refresh) {
    invalidateAdminData();
    snapshots.clear();
  }
  rememberList();
  releaseMediaFields?.();
  activeMountedModule?.unmount?.(app);
  activeMountedModule = null;
  renderedRevision = -1;
  currentView = activeModuleKey = view;
  currentResourceTable = null;
  mountedUrl = url;
  if (location.pathname + location.search + location.hash !== url) {
    history[options.replace || options.pop ? "replaceState" : "pushState"]({adminView:view}, "", url);
  }
  const meta = getAdminModule(view);
  setShellTitle(meta.label, meta.description, {moduleKey:view});
  setActiveNav(view);
  sidebar.classList.remove("open");
  document.body.classList.remove("sidebar-drawer-open");
  for (const [key, snapshot] of snapshots) {
    if (snapshot.revision !== revision || Date.now() - snapshot.time >= ttl) snapshots.delete(key);
  }
  const saved = snapshots.get(url);
  const restore = saved && saved.revision === revision && Date.now() - saved.time < ttl && !options.edit;
  snapshots.delete(url);
  mountedAt = restore ? saved.time : Date.now();
  const startRevision = revision;
  const controller = new AbortController();
  loadingController = controller;
  setReadSignal(controller.signal);
  setUnifiedModuleScope(view);
  app.dataset.layout = restore ? saved.layout : view === "dashboard" ? "dashboard" : "module";
  if (restore) {
    app.replaceChildren(...saved.nodes);
    setShellTitle(saved.title, saved.hint, {actionHtml:saved.actionHtml});
  } else {
    app.innerHTML = '<div class="loading" role="status">Carregando…</div>';
  }
  releaseMediaFields = bindMediaFields(app);
  try {
    const styleFiles = {
      noticias: ["cms-v2"], noticia_editor: ["cms-v2","news-editor","editorial-audience"],
      categorias: ["cms-v2"], configuracoes_site: ["cms-v2"], audiencia: ["editorial-audience"], aprovacoes: ["editorial-audience"]
    };
    for (const name of styleFiles[view] || []) {
      const href = "/admin/" + name + ".css";
      if (!document.querySelector('link[href="' + href + '"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.append(link);
      }
    }
    const module = moduleRoutes[view] ? await moduleRoutes[view].module() : resourceModule;
    if (controller.signal.aborted) return;
    activeMountedModule = module;
    await module.mount(app, {
      view, restored: restore, edit: editing, id: params.get("editar"), db: getSupabase(), access: painelAccess, toast: shellToast,
      setTitle: setShellTitle, setPrimaryAction: setShellPrimaryAction,
      navigate: navigateToView, apiFetch: adminApiFetch, editResource: (table,id) => navigateToView(table,{edit:true,id}),
      can: (permission,action) => temPermissao(painelAccess.admin,permission,action)
    });
    if (!controller.signal.aborted) renderedRevision = startRevision;
  } catch (error) {
    if (controller.signal.aborted) return;
    console.error("Falha ao abrir " + view, error);
    app.innerHTML = '<section class="admin-panel"><h2>Não foi possível carregar a seção</h2><p class="form-message"></p><button type="button" class="admin-button" data-retry-module>Tentar novamente</button></section>';
    app.querySelector("p").textContent = error.message;
  } finally {
    loadingController = null;
    setReadSignal(null);
  }
}

// Legacy mounts use shared element IDs. Finish a mount before handing those IDs to another view.
function navigateToView(view, options = {}) {
  if (loadingController && canOpen(view, options.search)) {
    if (!loadingController.signal.aborted && view === currentView && !options.refresh && !options.edit && !options.pop && (options.search || "") === location.search) return navigationQueue;
    loadingController.abort();
  }
  const request = ++latestRequest;
  navigationQueue = navigationQueue.catch(console.error).then(() => {
    if (request === latestRequest) return openView(view, options);
  });
  return navigationQueue;
}

async function handleClick(event) {
  if(event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest("a[href]");
  if (link && (!link.target || link.target === "_self") && !link.hasAttribute("download")) {
    const url = new URL(link.href);
    const view = adminViewFromLocation(url);
    if (url.origin === location.origin && view) {
      event.preventDefault();
      return navigateToView(view, {search:url.search, hash:url.hash});
    }
  }
  const button=event.target.closest("button,[data-view]");if(!button)return;
  if(button.hasAttribute("data-open-command-palette")) return openCommandPalette();
  if(button.id==="refresh-data" || button.hasAttribute("data-retry-module"))
    return navigateToView(currentView,{refresh:true, search:location.search});
  if(button.dataset.view){
    event.preventDefault();
    if (button.dataset.qualityFilter) sessionStorage.setItem("euamourania:guide-quality-filter", button.dataset.qualityFilter);
    return navigateToView(button.dataset.view);
  }
  if(button.dataset.new==="noticias") return navigateToView("noticia_editor");
  if(button.dataset.new && resources[button.dataset.new]) return navigateToView(button.dataset.new,{edit:true});
  if(activeMountedModule !== resourceModule) return;
  if(button.dataset.edit && resources[button.dataset.edit])return navigateToView(button.dataset.edit,{edit:true,id:button.dataset.id});
  if(button.dataset.cancel) return navigateToView(button.dataset.cancel);
  if(button.dataset.delete){
    const table=databaseTable(button.dataset.delete);
    if(table==="guia_comercial"){
      const {count,error}=await getSupabase().from("catalogos").select("id",{count:"exact",head:true}).eq("empresa_id",button.dataset.id);
      if(error && !["42P01","PGRST205"].includes(error.code)){
        shellToast("Não foi possível verificar os catálogos desta empresa. Tente novamente.","error");
        return;
      }
      if(count>0){
        shellToast(`Esta empresa possui ${count} catálogo(s). Exclua os catálogos primeiro ou mantenha a empresa inativa.`,"error");
        return;
      }
    }
    if(!confirm("Excluir este registro? Esta ação não pode ser desfeita."))return;
    try { await excluirRegistro(table,button.dataset.id); }
    catch(error){
      if(table!=="guia_comercial")throw error;
      shellToast(error.code==="23503"?"Esta empresa ainda está vinculada a catálogos ou outros registros. Remova os vínculos antes de excluir.":"Não foi possível excluir a empresa. Tente novamente.","error");
      return;
    }
    return resourceList(button.dataset.delete);
  }
}

let commandPalette = null;
let commandSearch = null;
let commandResults = null;
let commandSelectedIndex = 0;

function adminCommandItems() {
  const navigation = adminNavigationItems
    .filter(item => canOpen(item.view))
    .map(item => ({
      type: "Módulo",
      title: item.label,
      detail: item.description || item.group,
      group: item.group,
      icon: renderAdminModuleIcon(item.view),
      searchable: [item.label, item.group, item.description, ...(item.keywords || [])].filter(Boolean).join(" "),
      run: () => navigateToView(item.view)
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
  const access=await exigirAdministrador();if(!access)return;
  painelAccess = access;
  if(!access.configurado){app.innerHTML='<p class="form-message">Configure assets/js/supabase-config.js para ativar o painel.</p>';return;}
  document.getElementById("admin-user").textContent=access.admin.nome||access.user.email;
  document.getElementById("logout").addEventListener("click",sair);
  setupSidebarControls();
  setupCommandPalette();
  document.addEventListener("click",handleClick);
  ({ bindMediaFields } = await import("./media-upload.js"));
  currentView=normalizeLegacyAdminRoute()||"dashboard";
  await navigateToView(currentView,{replace:true,search:location.search,hash:location.hash});
  window.addEventListener("popstate",()=>navigateToView(adminViewFromLocation()||"dashboard",{pop:true,search:location.search,hash:location.hash}));
}
init().catch(error => { app.textContent = "Não foi possível abrir o painel. " + error.message; });
