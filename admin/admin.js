import { exigirAdministrador, sair } from "./auth.js";
import { getSupabase } from "../assets/js/services/supabaseClient.js";
import { listarTabela, salvarRegistro, excluirRegistro } from "../assets/js/services/baseService.js";
import { gerarSlug } from "../assets/js/utils.js";
import { adminPathForModule, adminPathForView, adminViewFromLocation, normalizeLegacyAdminRoute } from "./admin-routes.js";

const app = document.getElementById("app-content");
const title = document.getElementById("page-title");
const sidebar = document.getElementById("sidebar");
const shell = document.querySelector(".admin-shell");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
const mobileMenuButton = document.getElementById("mobile-menu");
const pageHint = document.getElementById("page-hint");
let currentView = "dashboard";
let quill;
let currentResourceTable = null;
let currentResourceId = null;
let painelAccess = null;
let activeMountedModule = null;

const moduleRoutes = {
  comunicacao: {
    label: "ComunicaÃ§Ã£o",
    hint: "Assinantes, newsletters e resultados em um sÃ³ lugar.",
    module: () => import("./comunicacao.js")
  },
  notificacoes: {
    label: "NotificaÃ§Ãµes do Viva UrÃ¢nia",
    hint: "Envios push, aparelhos cadastrados e histÃ³rico do aplicativo Viva UrÃ¢nia.",
    module: () => import("./notificacoes-app.js")
  },
  submissoes: {
    label: "SubmissÃµes pÃºblicas",
    hint: "Revise empresas e eventos enviados pelo pÃºblico antes de publicar no portal.",
    module: () => import("./submissoes.js")
  },
  publicidade: {
    label: "Publicidade",
    hint: "Campanhas, posiÃ§Ãµes, mÃ­dia e mÃ©tricas dos anÃºncios internos do portal.",
    module: () => import("./publicidade.js")
  }
};

const sidebarIconMap = {
  "Visão geral": "H",
  "Notícias": "N",
  "Aprovações": "A",
  "Guia comercial": "G",
  "Turismo": "T",
  "Links": "L",
  "Colaborações": "C",
  "Submissões públicas": "S",
  "Agenda simples": "A",
  "Eventos principais": "E",
  "Edições": "Ed",
  "Publicidade": "P",
  "Comunicação": "C",
  "Notificações do app": "N",
  "Melhores de Urânia": "M",
  "Categorias": "#",
  "Audiência": "A",
  "Configurações": "C",
  "Usuários": "U",
  "Importar JSON": "{}"
};

const sidebarIconSvg = paths => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" focusable="false">${paths}</svg>`;
const sidebarIconSvgMap = {
  "VisÃ£o geral": sidebarIconSvg(`<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-5h5v5"/>`),
  "NotÃ­cias": sidebarIconSvg(`<path d="M4 5.5h11.5a2.5 2.5 0 0 1 2.5 2.5v10.5H6.5A2.5 2.5 0 0 1 4 16V5.5Z"/><path d="M18 8h2v8.5a2 2 0 0 1-2 2"/><path d="M7.5 9h6"/><path d="M7.5 12h6"/><path d="M7.5 15h4"/>`),
  "AprovaÃ§Ãµes": sidebarIconSvg(`<path d="M20 7 10 17l-5-5"/><path d="M4 5.5h9"/><path d="M4 18.5h12"/>`),
  "Guia comercial": sidebarIconSvg(`<path d="M4 10h16"/><path d="M5 10l1-5h12l1 5"/><path d="M6 10v9h12v-9"/><path d="M9 19v-5h6v5"/>`),
  "Turismo": sidebarIconSvg(`<path d="M12 21s7-5.2 7-11a7 7 0 0 0-14 0c0 5.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/>`),
  "Links": sidebarIconSvg(`<path d="M10 13a5 5 0 0 0 7.1 0l1.4-1.4a5 5 0 0 0-7.1-7.1L10.6 5"/><path d="M14 11a5 5 0 0 0-7.1 0l-1.4 1.4a5 5 0 0 0 7.1 7.1l.8-.8"/>`),
  "ColaboraÃ§Ãµes": sidebarIconSvg(`<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M20.5 8v6"/><path d="M17.5 11h6"/>`),
  "SubmissÃµes pÃºblicas": sidebarIconSvg(`<path d="M4 4h16v12H5.5L4 19.5V4Z"/><path d="M8 8h8"/><path d="M8 11.5h5"/>`),
  "Agenda simples": sidebarIconSvg(`<path d="M7 3v4"/><path d="M17 3v4"/><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/>`),
  "Eventos principais": sidebarIconSvg(`<path d="M7 3v4"/><path d="M17 3v4"/><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16"/><path d="m12 13 1.1 2.2 2.4.35-1.75 1.7.42 2.4L12 18.5l-2.17 1.15.42-2.4-1.75-1.7 2.4-.35L12 13Z"/>`),
  "EdiÃ§Ãµes": sidebarIconSvg(`<path d="M7 7h13v13H7z"/><path d="M4 4h13v13"/><path d="M10 11h7"/><path d="M10 15h5"/>`),
  "Publicidade": sidebarIconSvg(`<path d="m4 14 4-2 9-5v10l-9-5-4-2v4Z"/><path d="M8 14v5"/><path d="M18 9.5c1 .8 1.5 1.7 1.5 2.5s-.5 1.7-1.5 2.5"/>`),
  "ComunicaÃ§Ã£o": sidebarIconSvg(`<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4.5 7 7.5 6 7.5-6"/>`),
  "NotificaÃ§Ãµes do app": sidebarIconSvg(`<path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>`),
  "Melhores de UrÃ¢nia": sidebarIconSvg(`<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M5 6H3v2a4 4 0 0 0 4 4"/><path d="M19 6h2v2a4 4 0 0 1-4 4"/>`),
  "Categorias": sidebarIconSvg(`<path d="M20.5 10.5 13.5 3.5H6l-2.5 2.5v7.5l7 7a2 2 0 0 0 2.8 0l7.2-7.2a2 2 0 0 0 0-2.8Z"/><circle cx="8.5" cy="8.5" r="1"/>`),
  "AudiÃªncia": sidebarIconSvg(`<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5"/><path d="M12 16V8"/><path d="M16 16v-3"/>`),
  "ConfiguraÃ§Ãµes": sidebarIconSvg(`<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.9l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.9-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.9.34l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.9 1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.9l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.9.34h.02A1.7 1.7 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.02a1.7 1.7 0 0 0 1.9-.34l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.9v.02A1.7 1.7 0 0 0 20.91 10H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z"/>`),
  "UsuÃ¡rios": sidebarIconSvg(`<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M17 11l2 2 4-4"/>`),
  "Importar JSON": sidebarIconSvg(`<path d="M14 3v5h5"/><path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5Z"/><path d="M12 12v5"/><path d="m9.5 14.5 2.5-2.5 2.5 2.5"/>`)
};

const resources = {
  noticias: { label:"NotÃ­cias", title:"titulo", order:"atualizado_em", fields:[
    ["titulo","TÃ­tulo","text",true],["slug","Slug","text",true],["subtitulo","SubtÃ­tulo","text"],["resumo","Resumo","textarea"],["categoria_nome","Categoria","text"],["autor","Autor","text"],["imagem_url","URL da imagem","url"],["legenda_imagem","Legenda da imagem","text"],["status","Status","status"],["destaque","Destaque","boolean"],["publicado_em","PublicaÃ§Ã£o","datetime-local"],["seo_titulo","TÃ­tulo SEO","text"],["seo_descricao","DescriÃ§Ã£o SEO","textarea"],["seo_imagem","Imagem SEO","url"],["conteudo_html","ConteÃºdo","editor"]]},
  guia_comercial: { label:"Guia comercial", title:"nome", order:"atualizado_em", fields:[
    ["nome","Nome","text",true],["slug","Slug","text",true],["categoria_nome","Categoria","text"],["descricao","DescriÃ§Ã£o","textarea"],["imagem_url","URL da imagem","url"],["whatsapp","WhatsApp","text"],["telefone","Telefone","text"],["instagram","Instagram","url"],["facebook","Facebook","url"],["site","Site","url"],["endereco","EndereÃ§o","text"],["horario","HorÃ¡rio do site","text"],["opening_hours","HorÃ¡rios para o aplicativo","weekly-hours"],["opening_hours_note","ObservaÃ§Ã£o do horÃ¡rio no app","text"],["mapa_url","Mapa","url"],["recomendado","Recomendado","boolean"],["recomendado_editorial","Recomendado pelo Eu Amo UrÃ¢nia","boolean"],["status","Status","status"],["seo_titulo","TÃ­tulo SEO","text"],["seo_descricao","DescriÃ§Ã£o SEO","textarea"]]},
  turismo: { label:"Turismo", title:"nome", order:"atualizado_em", fields:[["nome","Nome","text",true],["slug","Slug","text",true],["descricao","DescriÃ§Ã£o","textarea"],["conteudo_html","ConteÃºdo","editor"],["imagem_url","Imagem","url"],["endereco","EndereÃ§o","text"],["horario","HorÃ¡rio do site","text"],["opening_hours","HorÃ¡rios para o aplicativo","weekly-hours"],["opening_hours_note","ObservaÃ§Ã£o do horÃ¡rio no app","text"],["whatsapp","WhatsApp","text"],["mapa_url","Mapa","url"],["latitude","Latitude","number"],["longitude","Longitude","number"],["curadoria_euamourania","Curadoria Eu Amo UrÃ¢nia","boolean"],["destaque","Destaque","boolean"],["status","Status","status"],["seo_titulo","TÃ­tulo SEO","text"],["seo_descricao","DescriÃ§Ã£o SEO","textarea"]]},
  links: { label:"Links", title:"titulo", order:"ordem", ascending:true, fields:[["titulo","TÃ­tulo","text",true],["url","URL","url",true],["icone","Ãcone/emoji","text"],["ordem","Ordem","number"],["status","Status","active-status"]]},
  colaboradores_voluntarios: { label:"ColaboraÃ§Ãµes voluntÃ¡rias", title:"nome", order:"criado_em", fields:[["nome","Nome","text",true],["whatsapp","WhatsApp","text",true],["email","E-mail","email"],["cidade","Cidade","text"],["interesses","Interesses","tags"],["mensagem","Mensagem","textarea"],["status","Status","volunteer-status"],["observacoes_internas","ObservaÃ§Ãµes internas","textarea"],["aceite_voluntario","Aceite voluntÃ¡rio","boolean"]]},
  eventos: { label:"Eventos", title:"titulo", order:"atualizado_em", fields:[["titulo","TÃ­tulo","text",true],["slug","Slug","text",true],["descricao","DescriÃ§Ã£o","textarea"],["imagem_url","Imagem","url"],["data_inicio","InÃ­cio","datetime-local"],["data_fim","Fim","datetime-local"],["local","Local","text"],["endereco","EndereÃ§o","text"],["organizador","Organizador","text"],["whatsapp","WhatsApp","text"],["destaque","Destaque","boolean"],["status","Status","status"]]},
  banners: { label:"Banners", title:"titulo", order:"ordem", ascending:true, fields:[["titulo","TÃ­tulo","text"],["subtitulo","SubtÃ­tulo","text"],["imagem_url","Imagem","url"],["link_url","Link","url"],["posicao","PosiÃ§Ã£o","text"],["ordem","Ordem","number"],["status","Status","active-status"]]},
  categorias: { label:"Categorias", title:"nome", order:"ordem", ascending:true, fields:[["nome","Nome","text",true],["slug","Slug","text",true],["tipo","Tipo","category-type",true],["ordem","Ordem","number"],["status","Status","active-status"]]},
  configuracoes_site: { label:"ConfiguraÃ§Ãµes", title:"chave", order:"chave", ascending:true, fields:[["chave","Chave","text",true],["valor","Valor","textarea"],["tipo","Tipo","text"]]}
};

resources.eventos_principais = { label:"Eventos principais", title:"nome", order:"atualizado_em", fields:[["nome","Nome do evento","text",true],["slug","Slug","text",true],["descricao_curta","DescriÃ’Â§Ã’Â£o curta","textarea"],["historia_html","HistÃ’Â³ria do evento","editor"],["imagem_capa_url","Imagem de capa","url"],["galeria_historica","Galeria histÃ’Â³rica (JSON)","textarea"],["categoria","Categoria","text"],["local_tradicional","Local tradicional","text"],["recorrencia","RecorrÃ’Âªncia","event-recurrence"],["periodo_aproximado","PerÃ’Â­odo aproximado","text"],["organizador","Organizador","text"],["telefone","Telefone","text"],["email","E-mail","email"],["website","Website","url"],["instagram","Instagram","url"],["facebook","Facebook","url"],["ativo","Ativo","boolean"],["destaque","Destaque","boolean"],["seo_titulo","TÃ’Â­tulo SEO","text"],["seo_descricao","DescriÃ’Â§Ã’Â£o SEO","textarea"],["palavras_chave","Palavras-chave","text"]] };
resources.eventos_edicoes = { label:"EdiÃ’Â§Ã’Âµes de eventos", title:"titulo", order:"ano", ascending:false, fields:[["evento_id","ID do evento principal","text",true],["ano","Ano","number",true],["slug","Slug da ediÃ’Â§Ã’Â£o","text"],["titulo","TÃ’Â­tulo da ediÃ’Â§Ã’Â£o","text",true],["subtitulo","SubtÃ’Â­tulo","text"],["data_inicio","InÃ’Â­cio","datetime-local"],["data_fim","Fim","datetime-local"],["programacao_html","ProgramaÃ’Â§Ã’Â£o","editor"],["atracoes_html","AtraÃ’Â§Ã’Âµes","textarea"],["cartaz_url","Cartaz oficial","url"],["banner_url","Banner","url"],["galeria","Galeria (JSON)","textarea"],["videos","VÃ’Â­deos (JSON)","textarea"],["local","Local","text"],["mapa_url","Mapa","url"],["links_uteis","Links Ã’Âºteis (JSON)","textarea"],["patrocinadores","Patrocinadores (JSON)","textarea"],["status","Status da ediÃ’Â§Ã’Â£o","event-edition-status"],["resumo_pos_evento_html","Resumo pÃ’Â³s-evento","textarea"],["publico_estimado","PÃ’Âºblico estimado","number"],["observacoes","ObservaÃ’Â§Ã’Âµes","textarea"],["destaque","Destaque","boolean"]] };

resources.eventos_principais = { label:"Eventos principais", title:"nome", order:"atualizado_em", fields:[["nome","Nome do evento","text",true],["slug","Slug","text",true],["descricao_curta","DescriÃ§Ã£o curta","textarea"],["historia_html","HistÃ³ria do evento","editor"],["imagem_capa_url","Imagem de capa","url"],["galeria_historica","Galeria histÃ³rica","url-list"],["categoria","Categoria","text"],["local_tradicional","Local tradicional","text"],["recorrencia","RecorrÃªncia","event-recurrence"],["periodo_aproximado","PerÃ­odo aproximado","text"],["organizador","Organizador","text"],["telefone","Telefone","text"],["email","E-mail","email"],["website","Website","url"],["instagram","Instagram","url"],["facebook","Facebook","url"],["ativo","Ativo","boolean"],["destaque","Destaque","boolean"],["seo_titulo","TÃ­tulo SEO","text"],["seo_descricao","DescriÃ§Ã£o SEO","textarea"],["palavras_chave","Palavras-chave","text"]] };
resources.eventos_edicoes = { label:"EdiÃ§Ãµes de eventos", title:"titulo", order:"ano", ascending:false, fields:[["evento_id","Evento principal","event-principal-select",true],["ano","Ano","number",true],["slug","Slug da ediÃ§Ã£o","text"],["titulo","TÃ­tulo da ediÃ§Ã£o","text",true],["subtitulo","SubtÃ­tulo","text"],["data_inicio","InÃ­cio","datetime-local"],["data_fim","Fim","datetime-local"],["programacao_html","ProgramaÃ§Ã£o","editor"],["atracoes_html","AtraÃ§Ãµes","textarea"],["cartaz_url","Cartaz oficial","url"],["banner_url","Banner","url"],["galeria","Galeria da ediÃ§Ã£o","url-list"],["videos","VÃ­deos","line-list"],["local","Local","text"],["mapa_url","Mapa","url"],["links_uteis","Links Ãºteis","line-list"],["patrocinadores","Patrocinadores","line-list"],["status","Status da ediÃ§Ã£o","event-edition-status"],["resumo_pos_evento_html","Resumo pÃ³s-evento","textarea"],["publico_estimado","PÃºblico estimado","number"],["observacoes","ObservaÃ§Ãµes","textarea"],["destaque","Destaque","boolean"]] };

resources.eventos_principais = { label:"Eventos principais", title:"nome", order:"atualizado_em", fields:[["nome","Nome do evento","text",true],["slug","Slug","text",true],["descricao_curta","DescriÃ§Ã£o curta","textarea"],["historia_html","HistÃ³ria do evento","editor"],["imagem_capa_url","Imagem de capa","url"],["galeria_historica","Galeria histÃ³rica","url-list"],["categoria","Categoria","text"],["local_tradicional","Local tradicional","text"],["recorrencia","RecorrÃªncia","event-recurrence"],["periodo_aproximado","PerÃ­odo aproximado","text"],["organizador","Organizador","text"],["telefone","Telefone","text"],["email","E-mail","email"],["website","Website","url"],["instagram","Instagram","url"],["facebook","Facebook","url"],["ativo","Ativo","boolean"],["destaque","Destaque","boolean"],["seo_titulo","TÃ­tulo SEO","text"],["seo_descricao","DescriÃ§Ã£o SEO","textarea"],["palavras_chave","Palavras-chave","text"]] };
resources.eventos_edicoes = { label:"EdiÃ§Ãµes de eventos", title:"titulo", order:"ano", ascending:false, fields:[["evento_id","Evento principal","event-principal-select",true],["ano","Ano","number",true],["slug","Slug da ediÃ§Ã£o","text"],["titulo","TÃ­tulo da ediÃ§Ã£o","text",true],["subtitulo","SubtÃ­tulo","text"],["data_inicio","InÃ­cio","datetime-local"],["data_fim","Fim","datetime-local"],["programacao_html","ProgramaÃ§Ã£o","editor"],["atracoes_html","AtraÃ§Ãµes","textarea"],["cartaz_url","Cartaz oficial","url"],["banner_url","Banner","url"],["galeria","Galeria da ediÃ§Ã£o","url-list"],["videos","VÃ­deos","line-list"],["local","Local","text"],["mapa_url","Mapa","url"],["links_uteis","Links Ãºteis","line-list"],["patrocinadores","Patrocinadores","line-list"],["status","Status da ediÃ§Ã£o","event-edition-status"],["resumo_pos_evento_html","Resumo pÃ³s-evento","textarea"],["publico_estimado","PÃºblico estimado","number"],["observacoes","ObservaÃ§Ãµes","textarea"],["destaque","Destaque","boolean"],["seo_titulo","TÃ­tulo SEO","text"],["seo_descricao","DescriÃ§Ã£o SEO","textarea"],["palavras_chave","Palavras-chave","text"]] };

Object.assign(resources, {
  noticias: { label:"NotÃ­cias", title:"titulo", order:"atualizado_em", fields:[
    ["titulo","TÃ­tulo","text",true],["slug","Slug","text",true],["subtitulo","SubtÃ­tulo","text"],["resumo","Resumo","textarea"],["categoria_nome","Categoria","text"],["autor","Autor","text"],["imagem_url","URL da imagem","url"],["legenda_imagem","Legenda da imagem","text"],["status","Status","status"],["destaque","Destaque","boolean"],["publicado_em","PublicaÃ§Ã£o","datetime-local"],["seo_titulo","TÃ­tulo SEO","text"],["seo_descricao","DescriÃ§Ã£o SEO","textarea"],["seo_imagem","Imagem SEO","url"],["conteudo_html","ConteÃºdo","editor"]]},
  guia_comercial: { label:"Guia comercial", title:"nome", order:"atualizado_em", fields:[
    ["nome","Nome","text",true],["slug","Slug","text",true],["categoria_nome","Categoria","text"],["descricao","DescriÃ§Ã£o","textarea"],["imagem_url","URL da imagem","url"],["whatsapp","WhatsApp","text"],["telefone","Telefone","text"],["instagram","Instagram","url"],["facebook","Facebook","url"],["site","Site","url"],["endereco","EndereÃ§o","text"],["horario","HorÃ¡rio do site","text"],["opening_hours","HorÃ¡rios para o aplicativo","weekly-hours"],["opening_hours_note","ObservaÃ§Ã£o do horÃ¡rio no app","text"],["mapa_url","Mapa","url"],["recomendado","Recomendado","boolean"],["recomendado_editorial","Recomendado pelo Eu Amo UrÃ¢nia","boolean"],["status","Status","status"],["seo_titulo","TÃ­tulo SEO","text"],["seo_descricao","DescriÃ§Ã£o SEO","textarea"]]},
  turismo: { label:"Turismo", title:"nome", order:"atualizado_em", fields:[["nome","Nome","text",true],["slug","Slug","text",true],["descricao","DescriÃ§Ã£o","textarea"],["conteudo_html","ConteÃºdo","editor"],["imagem_url","Imagem","url"],["endereco","EndereÃ§o","text"],["horario","HorÃ¡rio do site","text"],["opening_hours","HorÃ¡rios para o aplicativo","weekly-hours"],["opening_hours_note","ObservaÃ§Ã£o do horÃ¡rio no app","text"],["whatsapp","WhatsApp","text"],["mapa_url","Mapa","url"],["latitude","Latitude","number"],["longitude","Longitude","number"],["curadoria_euamourania","Curadoria Eu Amo UrÃ¢nia","boolean"],["destaque","Destaque","boolean"],["status","Status","status"],["seo_titulo","TÃ­tulo SEO","text"],["seo_descricao","DescriÃ§Ã£o SEO","textarea"]]},
  links: { label:"Links", title:"titulo", order:"ordem", ascending:true, fields:[["titulo","TÃ­tulo","text",true],["url","URL","url",true],["icone","Ãcone/emoji","text"],["ordem","Ordem","number"],["status","Status","active-status"]]},
  colaboradores_voluntarios: { label:"ColaboraÃ§Ãµes voluntÃ¡rias", title:"nome", order:"criado_em", fields:[["nome","Nome","text",true],["whatsapp","WhatsApp","text",true],["email","E-mail","email"],["cidade","Cidade","text"],["interesses","Interesses","tags"],["mensagem","Mensagem","textarea"],["status","Status","volunteer-status"],["observacoes_internas","ObservaÃ§Ãµes internas","textarea"],["aceite_voluntario","Aceite voluntÃ¡rio","boolean"]]},
  eventos: { label:"Agenda simples", title:"titulo", order:"atualizado_em", fields:[["titulo","TÃ­tulo","text",true],["slug","Slug","text",true],["descricao","DescriÃ§Ã£o","textarea"],["imagem_url","Imagem","url"],["data_inicio","InÃ­cio","datetime-local"],["data_fim","Fim","datetime-local"],["recorrencia_tipo","RepetiÃ§Ã£o","event-simple-recurrence"],["recorrencia_ate","Repetir atÃ©","datetime-local"],["local","Local","text"],["endereco","EndereÃ§o","text"],["organizador","Organizador","text"],["whatsapp","WhatsApp","text"],["destaque","Destaque","boolean"],["status","Status","status"]]},
  banners: { label:"Banners", title:"titulo", order:"ordem", ascending:true, fields:[["titulo","TÃ­tulo","text"],["subtitulo","SubtÃ­tulo","text"],["imagem_url","Imagem","url"],["link_url","Link","url"],["posicao","PosiÃ§Ã£o","text"],["ordem","Ordem","number"],["status","Status","active-status"]]},
  categorias: { label:"Categorias", title:"nome", order:"ordem", ascending:true, fields:[["nome","Nome","text",true],["slug","Slug","text",true],["tipo","Tipo","category-type",true],["ordem","Ordem","number"],["status","Status","active-status"]]},
  configuracoes_site: { label:"ConfiguraÃ§Ãµes", title:"chave", order:"chave", ascending:true, fields:[["chave","Chave","text",true],["valor","Valor","textarea"],["tipo","Tipo","text"]]},
  eventos_principais: { label:"Eventos principais", title:"nome", order:"atualizado_em", fields:[["nome","Nome do evento","text",true],["slug","Slug","text",true],["descricao_curta","DescriÃ§Ã£o curta","textarea"],["historia_html","HistÃ³ria do evento","editor"],["imagem_capa_url","Imagem de capa","url"],["galeria_historica","Galeria histÃ³rica","url-list"],["categoria","Categoria","text"],["local_tradicional","Local tradicional","text"],["recorrencia","RecorrÃªncia","event-recurrence"],["periodo_aproximado","PerÃ­odo aproximado","text"],["organizador","Organizador","text"],["telefone","Telefone","text"],["email","E-mail","email"],["website","Website","url"],["instagram","Instagram","url"],["facebook","Facebook","url"],["ativo","Ativo","boolean"],["destaque","Destaque","boolean"],["seo_titulo","TÃ­tulo SEO","text"],["seo_descricao","DescriÃ§Ã£o SEO","textarea"],["palavras_chave","Palavras-chave","text"]]},
  eventos_edicoes: { label:"EdiÃ§Ãµes de eventos", title:"titulo", order:"ano", ascending:false, fields:[["evento_id","Evento principal","event-principal-select",true],["ano","Ano","number",true],["slug","Slug da ediÃ§Ã£o","text"],["titulo","TÃ­tulo da ediÃ§Ã£o","text",true],["subtitulo","SubtÃ­tulo","text"],["data_inicio","InÃ­cio","datetime-local"],["data_fim","Fim","datetime-local"],["programacao_html","ProgramaÃ§Ã£o","editor"],["atracoes_html","AtraÃ§Ãµes","textarea"],["cartaz_url","Cartaz oficial","url"],["banner_url","Banner","url"],["galeria","Galeria da ediÃ§Ã£o","url-list"],["videos","VÃ­deos","line-list"],["local","Local","text"],["mapa_url","Mapa","url"],["links_uteis","Links Ãºteis","line-list"],["patrocinadores","Patrocinadores","line-list"],["status","Status da ediÃ§Ã£o","event-edition-status"],["resumo_pos_evento_html","Resumo pÃ³s-evento","textarea"],["publico_estimado","PÃºblico estimado","number"],["observacoes","ObservaÃ§Ãµes","textarea"],["destaque","Destaque","boolean"],["seo_titulo","TÃ­tulo SEO","text"],["seo_descricao","DescriÃ§Ã£o SEO","textarea"],["palavras_chave","Palavras-chave","text"]]}
});

function adicionarCamposDestaqueHome() {
  const campos = [
    ["destaque_home", "â­ Destaque da Home", "boolean"],
    ["destaque_home_inicio", "InÃ­cio do destaque", "datetime-local"],
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
const WEEK_DAYS = [["mon","Segunda-feira"],["tue","TerÃ§a-feira"],["wed","Quarta-feira"],["thu","Quinta-feira"],["fri","Sexta-feira"],["sat","SÃ¡bado"],["sun","Domingo"]];
const weeklyHourValue = (value, day, key) => escapeHtml(value && typeof value === "object" && !Array.isArray(value) ?value?.[day]?.[key] || "" : "");
const weeklyHourChecked = (value, day) => value && typeof value === "object" && !Array.isArray(value) && value?.[day]?.closed ?"checked" : "";
function weeklyHoursHtml(name,label,value){
  const data=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
  return `<fieldset class="full-row weekly-hours" data-weekly-hours="${name}"><legend>${label}</legend><div class="weekly-hours-head"><p>Use estes horÃ¡rios no aplicativo. O site continua usando o campo ï¿½SHorÃ¡rio do siteâ¬.</p><div class="weekly-hours-actions"><button type="button" data-weekly-copy-weekdays>Segï¿½sex = segunda</button><button type="button" data-weekly-copy-sat>SÃ¡bado = sexta</button><button type="button" data-weekly-copy-sun>Domingo = sÃ¡bado</button><button type="button" data-weekly-clear>Limpar</button></div></div>${WEEK_DAYS.map(([key,day],index)=>`<details class="weekly-day" data-weekly-day="${key}"><summary><strong>${day}</strong><span data-weekly-summary="${key}">${weeklyHourSummary(data,key)}</span></summary><div class="weekly-day-body"><label>Abre<input type="time" name="${name}_${key}_open" value="${weeklyHourValue(data,key,"open")}" aria-label="${day} abre"></label><label>Fecha<input type="time" name="${name}_${key}_close" value="${weeklyHourValue(data,key,"close")}" aria-label="${day} fecha"></label><label class="weekly-closed"><input type="checkbox" name="${name}_${key}_closed" value="true" ${weeklyHourChecked(data,key)}> Fechado</label>${index?`<button type="button" class="weekly-copy-prev" data-weekly-copy-prev="${key}">Usar dia anterior</button>`:""}</div></details>`).join("")}</fieldset>`;
}
function weeklyHourSummary(data,key){
  const item=data?.[key]||{};
  if(item.closed)return "Fechado";
  if(item.open&&item.close)return `${item.open}ï¿½${item.close}`;
  if(item.open)return `Abre ${item.open}`;
  if(item.close)return `Fecha ${item.close}`;
  return "NÃ£o configurado";
}
function collectWeeklyHours(form,name){
  const result={};let hasValue=false;
  for(const [key] of WEEK_DAYS){
    const open=String(form.get(`${name}_${key}_open`)||"").trim();
    const close=String(form.get(`${name}_${key}_close`)||"").trim();
    const closed=form.get(`${name}_${key}_closed`) === "true";
    if(open||close||closed){result[key]={open:open||null,close:close||null,closed};hasValue=true;}
  }
  return hasValue?result:null;
}
function weeklyDayData(root,name,key){
  const open=root.querySelector(`[name="${name}_${key}_open"]`)?.value||"";
  const close=root.querySelector(`[name="${name}_${key}_close"]`)?.value||"";
  const closed=Boolean(root.querySelector(`[name="${name}_${key}_closed"]`)?.checked);
  return {open,close,closed};
}
function setWeeklyDay(root,name,key,data){
  const open=root.querySelector(`[name="${name}_${key}_open"]`);
  const close=root.querySelector(`[name="${name}_${key}_close"]`);
  const closed=root.querySelector(`[name="${name}_${key}_closed"]`);
  if(open)open.value=data.open||"";
  if(close)close.value=data.close||"";
  if(closed)closed.checked=Boolean(data.closed);
  updateWeeklySummary(root,name,key);
}
function updateWeeklySummary(root,name,key){
  const summary=root.querySelector(`[data-weekly-summary="${key}"]`);
  if(!summary)return;
  summary.textContent=weeklyHourSummary({[key]:weeklyDayData(root,name,key)},key);
}
function handleWeeklyHoursAction(event){
  const button=event.target.closest("[data-weekly-copy-weekdays],[data-weekly-copy-sat],[data-weekly-copy-sun],[data-weekly-clear],[data-weekly-copy-prev]");
  if(!button)return;
  const root=button.closest(".weekly-hours");
  if(!root)return;
  event.preventDefault();
  const name=root.dataset.weeklyHours;
  if(button.hasAttribute("data-weekly-clear")){
    for(const [key] of WEEK_DAYS)setWeeklyDay(root,name,key,{open:"",close:"",closed:false});
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
  updateWeeklySummary(root,name,key);
}
document.addEventListener("click",handleWeeklyHoursAction);
document.addEventListener("input",handleWeeklyHoursChange);
document.addEventListener("change",handleWeeklyHoursChange);
async function legacyDashboard() {
  title.textContent = "VisÃ£o geral";
  app.innerHTML = '<div class="loading">Carregando indicadoresâ¬¦</div>';
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
      ["NotÃ­cias",noticias,`${publicadas} publicadas Â· ${rascunhos} rascunhos`],
      ["Empresas",empresas,`${empresasAtivas} publicadas no guia`],
      ["Turismo",pontos,"pontos turÃ­sticos cadastrados"],
      ["Eventos",eventos,`${eventosAtivos} publicados`],
      ["Publicidade",campanhas,`${campanhasAtivas} campanhas ativas`],
      ["ComunicaÃ§Ã£o",newsletters,`${assinantes} assinantes ativos`],
      ["Melhores de UrÃ¢nia",melhoresEdicoes,`${melhoresIndicados} indicados ativos`],
      ["Links ativos",links,"canais e links publicados"]
    ];
    app.innerHTML=`
      <section class="dashboard-welcome panel">
        <div>
          <p class="eyebrow">Painel Eu Amo UrÃ¢nia</p>
          <h2>VisÃ£o geral do portal</h2>
          <p>Acompanhe conteÃºdo, audiÃªncia, campanhas, comunicaÃ§Ã£o e a operaÃ§Ã£o do Melhores de UrÃ¢nia em um sÃ³ lugar.</p>
        </div>
        ${aprovacoes?`<button class="admin-button" id="dashboard-approvals">${aprovacoes} aprovaÃ§Ã£o(Ãµes) pendente(s)</button>`:""}
      </section>
      <div class="dashboard-grid">${metrics.map(([label,value,detail])=>`<article class="metric-card"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join("")}</div>
      <div class="dashboard-grid dashboard-actions">
        <button class="metric-card" data-view="noticias"><span>Editorial</span><strong>NotÃ­cias</strong><small>Criar, revisar e publicar</small></button>
        <button class="metric-card" onclick="location.href='/admin/melhores'"><span>PrÃªmio</span><strong>Melhores de UrÃ¢nia</strong><small>VotaÃ§Ã£o, apuraÃ§Ã£o e resultados</small></button>
        <button class="metric-card" id="dashboard-audience"><span>Dados</span><strong>AudiÃªncia</strong><small>VisualizaÃ§Ãµes, cliques e buscas</small></button>
        <button class="metric-card" data-view="publicidade"><span>Receita</span><strong>Publicidade</strong><small>Campanhas e desempenho</small></button>
      </div>
      <section class="panel">
        <header class="panel-header"><h2>NotÃ­cias recentes</h2></header>
        ${recentNews.length?recentNews.map(item=>`<div class="rank-item"><strong>${escapeHtml(item.titulo)}</strong><small>${escapeHtml(item.status||"")} Â· ${item.atualizado_em?new Date(item.atualizado_em).toLocaleDateString("pt-BR"):"sem data"}</small></div>`).join(""):'<div class="empty-state">Nenhuma notÃ­cia recente.</div>'}
      </section>`;
  } catch(error) { app.innerHTML=`<p class="form-message">${escapeHtml(error.message)}</p>`; }
}

async function dashboardBase() {
  title.textContent = "VisÃ£o geral";
  app.innerHTML = '<div class="loading">Carregando indicadoresâ¬¦</div>';
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
      ["Editorial", publicadas, "NotÃ­cias publicadas", `${rascunhos} rascunho(s) Â· ${noticias} no total`],
      ["Fluxo", aprovacoes, "AprovaÃ§Ãµes pendentes", aprovacoes ?"Precisa de revisÃ£o editorial" : "Fila editorial em dia"],
      ["Dados reais", views7d, "AudiÃªncia 7 dias", `${whatsapp7d} clique(s) no WhatsApp`],
      ["Publicidade", campanhasAtivas, "Campanhas ativas", `${campanhas} campanha(s) cadastrada(s)`]
    ];
    const secondaryMetrics = [
      ["Guia", empresas, `${empresasAtivas} empresas publicadas`],
      ["Turismo", pontos, `${pontosAtivos} pontos publicados`],
      ["Eventos", eventos, `${eventosAtivos} publicados`],
      ["ComunicaÃ§Ã£o", assinantes, "assinantes ativos"],
      ["Melhores de UrÃ¢nia", melhoresEdicoes, `${melhoresIndicados} indicados ativos`],
      ["Links", links, "links ativos"]
    ];
    const pendingTasks = [
      aprovacoes ?[`${aprovacoes} matÃ©ria(s) aguardando aprovaÃ§Ã£o`, "Abrir fila", "aprovacoes"] : null,
      rascunhos ?[`${rascunhos} notÃ­cia(s) em rascunho`, "Ver notÃ­cias", "noticias"] : null,
      campanhasAtivas ?null : ["Nenhuma campanha publicitÃ¡ria ativa", "Criar campanha", "publicidade"],
      melhoresEdicoes ?null : ["Nenhuma ediÃ§Ã£o ativa do Melhores cadastrada", "Abrir Melhores", "melhores"]
    ].filter(Boolean);

    app.innerHTML = `
      <section class="dashboard-hero panel">
        <div>
          <p class="eyebrow">Painel Eu Amo UrÃ¢nia</p>
          <h2>Central de controle do portal</h2>
          <p>Resumo operacional com conteÃºdo, aprovaÃ§Ãµes, audiÃªncia, publicidade e Melhores de UrÃ¢nia em um sÃ³ lugar.</p>
        </div>
        <div class="dashboard-hero-actions">
          <button class="admin-button" data-new="noticias">Nova notÃ­cia</button>
          <button class="admin-button secondary" id="dashboard-audience">Ver audiÃªncia</button>
        </div>
      </section>
      <div class="dashboard-primary-grid">
        ${primaryMetrics.map(([kicker, value, label, detail]) => `<article class="dashboard-kpi"><span>${kicker}</span><strong>${value}</strong><h3>${label}</h3><p>${detail}</p></article>`).join("")}
      </div>
      <div class="dashboard-layout">
        <section class="panel dashboard-section">
          <header class="panel-header"><div><h2>O que precisa de atenÃ§Ã£o</h2><p>Atalhos para as prÃ³ximas aÃ§Ãµes do painel.</p></div></header>
          <div class="dashboard-task-list">
            ${pendingTasks.length ?pendingTasks.map(([text, action, target]) => `<button class="dashboard-task" ${target === "melhores" ?"onclick=\"location.href='/admin/melhores'\"" : target === "aprovacoes" ?"id=\"dashboard-approvals\"" : `data-view="${target}"`}><span>${escapeHtml(text)}</span><strong>${escapeHtml(action)} ï¿½ </strong></button>`).join("") : '<div class="dashboard-empty-good">Tudo certo por aqui. Nenhuma pendÃªncia importante agora.</div>'}
          </div>
        </section>
        <section class="panel dashboard-section">
          <header class="panel-header"><div><h2>Estrutura do portal</h2><p>Dados gerais de conteÃºdo publicado e mÃ³dulos ativos.</p></div></header>
          <div class="dashboard-mini-grid">
            ${secondaryMetrics.map(([label, value, detail]) => `<article class="dashboard-mini-card"><strong>${value}</strong><span>${label}</span><small>${detail}</small></article>`).join("")}
          </div>
        </section>
      </div>
      <div class="dashboard-layout dashboard-bottom">
        <section class="panel dashboard-section">
          <header class="panel-header"><div><h2>ï¿½altimas notÃ­cias</h2><p>ConteÃºdos editados recentemente.</p></div><button class="admin-button secondary" data-view="noticias">Ver todas</button></header>
          <div class="dashboard-list">
            ${recentNews.length ?recentNews.map(item => `<article class="dashboard-list-row"><div><strong>${escapeHtml(item.titulo)}</strong><small>${escapeHtml(item.status_editorial || item.status || "")} Â· ${fmtDate(item.publicado_em || item.atualizado_em)}</small></div><span class="status-pill ${escapeHtml(item.status || "")}">${escapeHtml(item.status || "ï¿½")}</span></article>`).join("") : '<div class="empty-state">Nenhuma notÃ­cia recente.</div>'}
          </div>
        </section>
        <section class="panel dashboard-section">
          <header class="panel-header"><div><h2>AprovaÃ§Ãµes e ediÃ§Ãµes</h2><p>Fila editorial e Ãºltimas ediÃ§Ãµes do prÃªmio.</p></div></header>
          <div class="dashboard-list">
            ${pendingApprovals.length ?pendingApprovals.map(item => `<article class="dashboard-list-row"><div><strong>${escapeHtml(item.noticias?.titulo || "NotÃ­cia em revisÃ£o")}</strong><small>Enviada em ${fmtDate(item.enviado_em)}</small></div><span class="status-pill">${escapeHtml(item.status)}</span></article>`).join("") : '<div class="dashboard-empty-good compact">Sem aprovaÃ§Ãµes pendentes.</div>'}
            ${recentEditions.length ?recentEditions.map(item => `<article class="dashboard-list-row"><div><strong>${escapeHtml(item.nome || `Melhores ${item.ano}`)}</strong><small>${item.ano} Â· ${fmtDate(item.atualizado_em)}</small></div><span class="status-pill">${escapeHtml(item.status || "ï¿½")}</span></article>`).join("") : '<div class="empty-state">Nenhuma ediÃ§Ã£o do Melhores cadastrada.</div>'}
          </div>
        </section>
      </div>
      <div class="dashboard-quick-actions">
        <button class="metric-card" data-view="noticias"><span>Editorial</span><strong>NotÃ­cias</strong><small>Criar, revisar e publicar</small></button>
        <button class="metric-card" onclick="location.href='/admin/melhores'"><span>PrÃªmio</span><strong>Melhores de UrÃ¢nia</strong><small>VotaÃ§Ã£o, apuraÃ§Ã£o e resultados</small></button>
        <button class="metric-card" data-view="publicidade"><span>Receita</span><strong>Publicidade</strong><small>Campanhas e desempenho</small></button>
        <button class="metric-card" onclick="location.href='/admin/comunicacao'"><span>Relacionamento</span><strong>ComunicaÃ§Ã£o</strong><small>Newsletter e assinantes</small></button>
      </div>`;
  } catch(error) {
    app.innerHTML = `<p class="form-message">${escapeHtml(error.message)}</p>`;
  }
}

async function dashboard() {
  title.textContent = "VisÃ£o geral";
  app.innerHTML = '<div class="loading">Carregando central de operaÃ§Ã£oâ¬¦</div>';
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
  const rawName = painelAccess?.admin?.nome || painelAccess?.user?.user_metadata?.name || painelAccess?.user?.email || "";
  const firstName = String(rawName).split(/\s|@/).filter(Boolean)[0] || "";
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
    const label = item?.[key] || "NÃ£o informado";
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

    const uniqueVisitors = new Set(analyticsEvents.map(item => item.sessao_hash).filter(Boolean)).size;
    const topPages = rank(analyticsEvents, "pagina", 6);
    const topDevices = rank(analyticsEvents, "dispositivo", 4);
    const topOrigins = rank(analyticsEvents, "origem", 4);
    const importantAlerts = [
      aprovacoes ?[`${aprovacoes} notÃ­cia(s) aguardando aprovaÃ§Ã£o`, "Abrir aprovaÃ§Ãµes", "aprovacoes", "warning"] : null,
      colaboradoresNovos ?[`${colaboradoresNovos} colaborador(es) voluntÃ¡rio(s) aguardando contato`, "Ver colaboraÃ§Ãµes", "colaboradores_voluntarios", "info"] : null,
      eventSubmissionsPending ?[`${eventSubmissionsPending} sugestÃ£o(Ãµes) de evento aguardando anÃ¡lise`, "Ver agenda", "eventos", "info"] : null,
      businessSubmissionsPending ?[`${businessSubmissionsPending} cadastro(s) do guia aguardando anÃ¡lise`, "Ver guia", "guia_comercial", "info"] : null,
      emRevisao ?[`${emRevisao} notÃ­cia(s) em revisÃ£o editorial`, "Ver notÃ­cias", "noticias", "info"] : null,
      rascunhos ?[`${rascunhos} rascunho(s) parado(s) no editorial`, "Organizar pauta", "noticias", "warning"] : null,
      agendadas ?[`${agendadas} notÃ­cia(s) agendada(s) para o futuro`, "Conferir agenda", "noticias", "info"] : null,
      campanhasVencendo ?[`${campanhasVencendo} campanha(s) vencendo em atÃ© 7 dias`, "Abrir publicidade", "publicidade", "danger"] : null,
      campanhasAtivas ?null : ["Nenhuma campanha publicitÃ¡ria ativa", "Criar campanha", "publicidade", "warning"],
      eventosProximos ?[`${eventosProximos} evento(s) futuro(s) publicado(s)`, "Ver agenda", "eventos", "success"] : null,
      eventosPrincipais && !eventosEdicoes ?["Eventos principais sem ediÃ§Ãµes cadastradas", "Abrir ediÃ§Ãµes", "eventos_edicoes", "warning"] : null,
      melhoresEdicoes ?null : ["Nenhuma ediÃ§Ã£o ativa do Melhores", "Abrir Melhores", "melhores", "warning"]
    ].filter(Boolean);
    const attentionTotal = importantAlerts.reduce((sum, item) => sum + Math.max(1, Number(String(item[0]).match(/^\d+/)?.[0] || 1)), 0);
    const portalScore = Math.max(0, 100 - (aprovacoes * 8) - (rascunhos * 3) - (campanhasVencendo * 6) - (colaboradoresNovos * 4) - (eventSubmissionsPending * 3) - (businessSubmissionsPending * 3) - (campanhasAtivas ?0 : 10));
    const targetAttrs = target => {
      if (target === "publicidade") return 'data-view="publicidade"';
      if (target === "comunicacao") return "onclick=\"location.href='/admin/comunicacao'\"";
      if (target === "melhores") return "onclick=\"location.href='/admin/melhores'\"";
      if (target === "notificacoes") return `data-view="${target}"`;
      if (target === "aprovacoes") return "id=\"dashboard-approvals\"";
      if (target === "audiencia") return "id=\"dashboard-audience\"";
      return `data-view="${target}"`;
    };
    const primaryMetrics = [
      ["Hoje", fmtNumber(viewsHoje), "interaÃ§Ãµes registradas", "Fonte: analytics_eventos"],
      ["7 dias", fmtNumber(views7d), "movimento recente", `${fmtNumber(uniqueVisitors)} visitante(s) identificÃ¡veis`],
      ["Editorial", fmtNumber(publicadas), "notÃ­cias publicadas", `${rascunhos} rascunho(s) Â· ${agendadas} agendada(s)`],
      ["AtenÃ§Ã£o", fmtNumber(attentionTotal), "itens acionÃ¡veis", importantAlerts.length ?"Veja a fila principal abaixo" : "Rotina sem alerta importante"]
    ];
    const ecosystemCards = [
      ["Portal editorial", `${publicadas} notÃ­cias`, `${aprovacoes} aprovaÃ§Ã£o(Ãµes) Â· ${agendadas} agendada(s)`, "noticias"],
      ["Viva UrÃ¢nia", `${empresasAtivas} empresas Â· ${pontosAtivos} atrativos`, `${eventosAtivos} evento(s) simples publicado(s)`, "guia_comercial"],
      ["Publicidade", `${campanhasAtivas} campanhas ativas`, `${campanhasVencendo} vencendo em atÃ© 7 dias`, "publicidade"],
      ["ComunicaÃ§Ã£o", `${assinantes} assinantes`, `${colaboradoresNovos} colaborador(es) novo(s)`, "comunicacao"],
      ["Melhores", `${melhoresEdicoes} ediÃ§Ã£o(Ãµes)`, `${melhoresIndicados} indicado(s) ativos`, "melhores"]
    ];
    const newsRows = recentNews.map(item => ({ title: item.titulo || "NotÃ­cia sem tÃ­tulo", detail: `${item.categoria_nome || "Sem editoria"} Â· ${item.autor || "Eu Amo UrÃ¢nia"} Â· ${item.publicado_em ?`publicada em ${fmtDate(item.publicado_em)}` : `editada em ${fmtDate(item.atualizado_em)}`}`, badge: item.status_editorial || item.status || "ï¿½", badgeClass: item.status || "" }));
    const scheduledRows = scheduledNews.map(item => ({ title: item.titulo || "NotÃ­cia agendada", detail: `PublicaÃ§Ã£o prevista para ${fmtDate(item.publicado_em)}`, badge: "agendada", badgeClass: "info" }));
    const approvalRows = pendingApprovals.map(item => ({ title: item.noticias?.titulo || "NotÃ­cia em revisÃ£o", detail: `Enviada em ${fmtDate(item.enviado_em)}`, badge: item.status || "pendente" }));
    const editionRows = recentEditions.map(item => ({ title: item.nome || `Melhores ${item.ano}`, detail: `${item.ano} Â· atualizado em ${fmtDate(item.atualizado_em)}`, badge: item.status || "ï¿½" }));
    const activityRows = recentActivities.map(item => ({ title: item.titulo || item.tabela || "Atividade", detail: `${item.acao || "aÃ§Ã£o"} Â· ${fmtDate(item.criado_em)}`, badge: item.tabela || "" }));
    const eventRows = upcomingEvents.map(item => ({ title: item.titulo || "Evento", detail: `${fmtDate(item.data_inicio)}${item.local ?` Â· ${item.local}` : ""}`, badge: item.status || "" }));
    const mainEventRows = recentMainEvents.map(item => ({ title: item.nome || "Evento principal", detail: `${item.categoria || "Acervo permanente"} Â· atualizado em ${fmtDate(item.atualizado_em)}`, badge: item.ativo ?"ativo" : "inativo", badgeClass: item.ativo ?"ativo" : "" }));
    const eventEditionRows = recentEventEditions.map(item => ({ title: item.titulo || `EdiÃ§Ã£o ${item.ano}`, detail: `${item.eventos_principais?.nome || "Evento"} Â· ${item.ano} Â· ${fmtDate(item.data_inicio || item.atualizado_em)}`, badge: item.status || "ediÃ§Ã£o" }));
    const campaignRows = endingCampaigns.map(item => ({ title: item.nome || "Campanha", detail: `${item.empresa_anunciante || "Anunciante"} Â· vence em ${fmtDate(item.data_fim)}`, badge: item.status || "ativo", badgeClass: "ativo" }));
    const collaboratorRows = recentCollaborators.map(item => ({ title: item.nome || "Colaborador voluntÃ¡rio", detail: `${item.cidade || "Cidade nÃ£o informada"} Â· ${(item.interesses || []).slice(0, 3).join(", ") || "sem interesses"} Â· ${fmtDate(item.criado_em)}`, badge: item.status || "novo", badgeClass: item.status || "" }));

    app.innerHTML = `
      <section class="ops-dashboard">
        <section class="ops-hero panel">
          <div class="ops-hero-copy">
            <p class="eyebrow">Central de operaÃ§Ã£o</p>
            <h2>${saudacao}${firstName ?`, ${escapeHtml(firstName)}` : ""}.</h2>
            <p>Um resumo limpo do que precisa de atenÃ§Ã£o, do que estÃ¡ acontecendo agora e de como o portal estÃ¡ performando.</p>
            <div class="ops-hero-actions">
              <button class="admin-button" data-new="noticias">Nova notÃ­cia</button>
              <button class="admin-button secondary" ${targetAttrs("audiencia")}>Ver audiÃªncia</button>
            </div>
          </div>
          <div class="ops-health-card" aria-label="SaÃºde operacional">
            <span>SaÃºde da operaÃ§Ã£o</span>
            <strong>${portalScore}%</strong>
            <small>${importantAlerts.length ?`${importantAlerts.length} Ã¡rea(s) pedindo atenÃ§Ã£o` : "Rotina sem alerta importante"}</small>
          </div>
        </section>

        <section class="ops-kpi-grid" aria-label="Indicadores principais">
          ${primaryMetrics.map(([kicker, value, label, detail]) => `<article class="ops-kpi"><span>${kicker}</span><strong>${value}</strong><h3>${label}</h3><p>${detail}</p></article>`).join("")}
        </section>

        <section class="ops-section panel ops-attention">
          <header class="ops-section-header">
            <div>
              <p class="eyebrow">Prioridade</p>
              <h2>Precisa da sua atenÃ§Ã£o</h2>
            </div>
            <span>${fmtNumber(attentionTotal)} item(ns)</span>
          </header>
          <div class="ops-attention-list">
            ${importantAlerts.length ?importantAlerts.map(([text, action, target, tone]) => `<button class="ops-attention-item ${tone || ""}" ${targetAttrs(target)}><span>${escapeHtml(text)}</span><strong>${escapeHtml(action)} ï¿½ </strong></button>`).join("") : '<div class="ops-empty">Tudo certo por aqui. Nenhuma pendÃªncia importante agora.</div>'}
          </div>
        </section>

        <section class="ops-two-columns">
          <div class="ops-section panel">
            <header class="ops-section-header">
              <div>
                <p class="eyebrow">Rotina</p>
                <h2>OperaÃ§Ã£o</h2>
              </div>
            </header>
            <div class="ops-inline-summary">
              <span>${fmtNumber(recentNews.length)} notÃ­cias recentes</span>
              <span>${fmtNumber(scheduledRows.length)} agendadas</span>
              <span>${fmtNumber(eventRows.length)} eventos prÃ³ximos</span>
              <span>${fmtNumber(campaignRows.length)} campanhas vencendo</span>
            </div>
            <div class="ops-stack">
              <div class="ops-subsection"><h3>NotÃ­cias recentes</h3><div class="dashboard-list">${listRows(newsRows.slice(0, 4))}</div></div>
              <div class="ops-subsection"><h3>Agendadas</h3><div class="dashboard-list">${listRows(scheduledRows)}</div></div>
              <div class="ops-subsection"><h3>PrÃ³ximos eventos e campanhas</h3><div class="dashboard-list">${listRows([...eventRows, ...campaignRows].slice(0, 6))}</div></div>
            </div>
          </div>

          <div class="ops-section panel">
            <header class="ops-section-header">
              <div>
                <p class="eyebrow">Leitura rÃ¡pida</p>
                <h2>ï¿½altimas atividades</h2>
              </div>
            </header>
            <div class="ops-inline-summary">
              <span>${fmtNumber(colaboradoresNovos)} novos colaboradores</span>
              <span>${fmtNumber(recentActivities.length)} aÃ§Ãµes recentes</span>
            </div>
            <div class="dashboard-list">${listRows([...collaboratorRows, ...activityRows].slice(0, 8))}</div>
          </div>
        </section>

        <section class="ops-section panel">
          <header class="ops-section-header">
            <div>
              <p class="eyebrow">Desempenho</p>
              <h2>AudiÃªncia do portal</h2>
              <small>Fonte Ãºnica nesta visÃ£o: eventos internos registrados em analytics_eventos.</small>
            </div>
            <button class="admin-button secondary" onclick="document.getElementById('dashboard-audience')?.click()">Abrir anÃ¡lise completa</button>
          </header>
          <div class="ops-performance-grid">
            <article><strong>${fmtNumber(views30d)}</strong><span>interaÃ§Ãµes em 30 dias</span></article>
            <article><strong>${fmtNumber(whatsapp7d)}</strong><span>cliques no WhatsApp em 7 dias</span></article>
            <article><strong>${fmtNumber(external7d)}</strong><span>cliques externos em 7 dias</span></article>
          </div>
          <div class="dashboard-rank-columns ops-rank-columns">
            <div><h3>PÃ¡ginas mais acessadas</h3>${topPages.length ?topPages.map(item => `<p><span>${escapeHtml(item.label)}</span><strong>${item.total}</strong></p>`).join("") : '<small>Sem dados no perÃ­odo.</small>'}</div>
            <div><h3>Dispositivos</h3>${topDevices.length ?topDevices.map(item => `<p><span>${escapeHtml(item.label)}</span><strong>${item.total}</strong></p>`).join("") : '<small>Sem dados no perÃ­odo.</small>'}</div>
            <div><h3>Origem</h3>${topOrigins.length ?topOrigins.map(item => `<p><span>${escapeHtml(item.label)}</span><strong>${item.total}</strong></p>`).join("") : '<small>Sem dados no perÃ­odo.</small>'}</div>
          </div>
        </section>

        <section class="ops-section panel">
          <header class="ops-section-header">
            <div>
              <p class="eyebrow">Ecossistema</p>
              <h2>Portal, app e mÃ³dulos conectados</h2>
            </div>
          </header>
          <div class="ops-ecosystem-grid">
            ${ecosystemCards.map(([label, value, detail, target]) => `<button class="ops-ecosystem-card" ${targetAttrs(target)}><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></button>`).join("")}
          </div>
        </section>

        <section class="ops-two-columns">
          <div class="ops-section panel">
            <header class="ops-section-header"><div><p class="eyebrow">PrÃªmio</p><h2>Melhores de UrÃ¢nia</h2></div><button class="admin-button secondary" onclick="location.href='/admin/melhores'">Abrir mÃ³dulo</button></header>
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
  const config=resources[table]; title.textContent=config.label; app.innerHTML='<div class="loading">Carregandoâ¬¦</div>';
  try {
    const rows=await listarTabela(table,{ordem:config.order,crescente:config.ascending||false});
    app.innerHTML=`<section class="panel"><header class="panel-header"><h2>${config.label}</h2><button class="admin-button" data-new="${table}">Novo cadastro</button></header><div class="table-wrap"><table><thead><tr><th>Nome</th><th>Status</th><th>AtualizaÃ§Ã£o</th><th>AÃ§Ãµes</th></tr></thead><tbody>${rows.length?rows.map(row=>`<tr><td><strong>${escapeHtml(row[config.title]||"Sem tÃ­tulo")}</strong></td><td><span class="status-pill ${escapeHtml(row.status||"")}">${escapeHtml(row.status||"ï¿½")}</span></td><td>${row.atualizado_em?new Date(row.atualizado_em).toLocaleDateString("pt-BR"):"ï¿½"}</td><td><div class="row-actions"><button data-edit="${table}" data-id="${row.id}">Editar</button><button data-delete="${table}" data-id="${row.id}">Excluir</button></div></td></tr>`).join(""):'<tr><td colspan="4">Nenhum registro.</td></tr>'}</tbody></table></div></section>`;
  } catch(error) { app.innerHTML=`<p class="form-message">${escapeHtml(error.message)}</p>`; }
}

function fieldHtml([name,label,type,required], value) {
  const req=required?"required":"", full=["textarea","editor"].includes(type)?"full-row":"";
  if(type==="editor") return `<label class="${full}">${label}<div id="editor"></div><input type="hidden" name="${name}"></label>`;
  if(type==="textarea") return `<label class="${full}">${label}<textarea name="${name}" ${req}>${escapeHtml(inputValue(value,type))}</textarea></label>`;
  if(type==="boolean") return `<label>${label}<select name="${name}"><option value="false" ${!value?"selected":""}>NÃ£o</option><option value="true" ${value?"selected":""}>Sim</option></select></label>`;
  if(type==="tags") return `<label class="${full}">${label}<input type="text" name="${name}" value="${escapeHtml(Array.isArray(value)?value.join(", "):inputValue(value,type))}" placeholder="pautas, fotos, eventos"><small>Separe por vÃ­rgula.</small></label>`;
  if(type==="event-principal-select") return `<label>${label}<select name="${name}" data-event-principal-select data-current="${escapeHtml(inputValue(value,type))}" ${req}><option value="">Carregando eventos principais...</option></select><small>Escolha o evento principal. NÃ£o precisa copiar ID.</small></label>`;
  const options=type==="status"?["rascunho","publicado","arquivado"]:type==="active-status"?["ativo","inativo"]:type==="category-type"?["noticias","guia","turismo","eventos"]:type==="volunteer-status"?["novo","em_conversa","aprovado","recusado","arquivado"]:type==="event-recurrence"?["anual","mensal","unico","outro"]:type==="event-simple-recurrence"?["nenhuma","semanal","mensal","anual"]:type==="event-edition-status"?["anunciado","confirmado","acontecendo","encerrado","cancelado"]:null;
  if(options) return `<label>${label}<select name="${name}">${options.map(o=>`<option value="${o}" ${value===o?"selected":""}>${o}</option>`).join("")}</select></label>`;
  const inputType=type==="url"?"text":type,urlAttributes=type==="url"?' inputmode="url" data-type="url" placeholder="https://... ou /assets/..."':"";
  return `<label class="${full}">${label}<input type="${inputType}"${urlAttributes} name="${name}" value="${escapeHtml(inputValue(value,type))}" ${req}></label>`;
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
    select.innerHTML = '<option value="">NÃ£o foi possÃ­vel carregar os eventos</option>';
  }
}

async function salvarEvento2Form(event) {
  if(event.target.id!=="resource-form"||!["eventos_principais","eventos_edicoes"].includes(currentResourceTable))return;
  event.preventDefault();event.stopImmediatePropagation();
  const table=currentResourceTable,config=resources[table],message=document.getElementById("form-message");
  message.textContent="Salvandoâ¬¦";
  const form=new FormData(event.target),payload={id:currentResourceId};
  for(const field of config.fields){
    const [name,label,type]=field;
    if(type==="editor")payload[name]=quill.root.innerHTML;
else if(type==="weekly-hours")payload[name]=collectWeeklyHours(form,name);else if(type==="boolean")payload[name]=form.get(name)==="true";
    else if(type==="number")payload[name]=form.get(name)===""?null:Number(form.get(name)||0);
    else if(type==="url-list")payload[name]=parseUrlList(form.get(name));
    else if(type==="line-list")payload[name]=parseLineList(form.get(name));
    else{
      const value=form.get(name)||null;
      if(type==="url"&&!validSiteReference(value)){message.textContent=`Informe um link completo ou caminho interno vÃ¡lido em ${label}.`;event.target.elements[name]?.focus();return}
      payload[name]=value;
    }
  }
  try{await salvarRegistro(table,payload);currentResourceId=null;await resourceList(table)}
  catch(error){message.textContent=error.message;}
}
document.addEventListener("submit",salvarEvento2Form,true);

function fieldHtmlCorrigido([name,label,type,required], value) {
  const req=required?"required":"", full=["textarea","editor","url-list","line-list","weekly-hours"].includes(type)?"full-row":"";
  if(type==="editor") return `<label class="${full}">${label}<div id="editor"></div><input type="hidden" name="${name}"></label>`;
  if(type==="weekly-hours") return weeklyHoursHtml(name,label,value);
  if(type==="textarea") return `<label class="${full}">${label}<textarea name="${name}" ${req}>${escapeHtml(inputValue(value,type))}</textarea></label>`;
  if(type==="url-list") return `<label class="${full}">${label}<textarea name="${name}" placeholder="Cole uma URL de imagem por linha">${escapeHtml(listValue(value))}</textarea><small>Use uma imagem por linha para montar a galeria.</small></label>`;
  if(type==="line-list") return `<label class="${full}">${label}<textarea name="${name}" placeholder="Digite um item por linha">${escapeHtml(listValue(value))}</textarea><small>Digite um item por linha. Exemplo: nome do patrocinador, link Ãºtil ou vÃ­deo.</small></label>`;
  if(type==="boolean"){const checked=value===undefined&&name==="ativo"?true:Boolean(value);return `<label>${label}<select name="${name}"><option value="false" ${!checked?"selected":""}>NÃ£o</option><option value="true" ${checked?"selected":""}>Sim</option></select></label>`}
  if(type==="tags") return `<label class="${full}">${label}<input type="text" name="${name}" value="${escapeHtml(Array.isArray(value)?value.join(", "):inputValue(value,type))}" placeholder="pautas, fotos, eventos"><small>Separe por vÃ­rgula.</small></label>`;
  if(type==="event-principal-select") return `<label>${label}<select name="${name}" data-event-principal-select data-current="${escapeHtml(inputValue(value,type))}" ${req}><option value="">Carregando eventos principais...</option></select><small>Escolha o evento principal. NÃ£o precisa copiar ID.</small></label>`;
  const options=type==="status"?["rascunho","publicado","arquivado"]:type==="active-status"?["ativo","inativo"]:type==="category-type"?["noticias","guia","turismo","eventos"]:type==="volunteer-status"?["novo","em_conversa","aprovado","recusado","arquivado"]:type==="event-recurrence"?["anual","mensal","unico","outro"]:type==="event-simple-recurrence"?["nenhuma","semanal","mensal","anual"]:type==="event-edition-status"?["anunciado","confirmado","acontecendo","encerrado","cancelado"]:null;
  if(options) return `<label>${label}<select name="${name}">${options.map(o=>`<option value="${o}" ${value===o?"selected":""}>${o}</option>`).join("")}</select></label>`;
  const inputType=type==="url"?"text":type,urlAttributes=type==="url"?' inputmode="url" data-type="url" placeholder="https://... ou /assets/..."':"";
  return `<label class="${full}">${label}<input type="${inputType}"${urlAttributes} name="${name}" value="${escapeHtml(inputValue(value,type))}" ${req}></label>`;
}

async function editForm(table,id) {
  const config=resources[table]; let row={};
  currentResourceTable=table;currentResourceId=id||null;
  if(id){const {data,error}=await getSupabase().from(table).select("*").eq("id",id).single();if(error)throw error;row=data;}
  title.textContent=`${id?"Editar":"Novo"} Â· ${config.label}`;
  app.innerHTML=`<section class="panel"><form id="resource-form" class="resource-form">${config.fields.map(field=>fieldHtmlCorrigido(field,row[field[0]])).join("")}<div class="form-actions"><button type="button" class="admin-button secondary" data-cancel="${table}">Cancelar</button><button class="admin-button" type="submit">Salvar</button></div><p id="form-message" class="form-message full-row"></p></form></section>`;
  const editorField=config.fields.find(f=>f[2]==="editor");
  if(editorField){quill=new Quill("#editor",{theme:"snow",modules:{toolbar:[["bold","italic","blockquote"],[{header:[2,3,false]}],[{list:"ordered"},{list:"bullet"}],["link","image","video"],["clean"]]}});quill.root.innerHTML=row[editorField[0]]||"";}
  await carregarSelectEventosPrincipais();
  const sourceName=config.fields.some(f=>f[0]==="titulo")?"titulo":config.fields.some(f=>f[0]==="nome")?"nome":null;
  if(sourceName&&config.fields.some(f=>f[0]==="slug")){const source=app.querySelector(`[name="${sourceName}"]`),slugInput=app.querySelector('[name="slug"]');source.addEventListener("input",()=>{if(!id||!slugInput.dataset.edited)slugInput.value=gerarSlug(source.value)});slugInput.addEventListener("input",()=>slugInput.dataset.edited="true");}
  document.getElementById("resource-form").addEventListener("submit",async event=>{event.preventDefault();const message=document.getElementById("form-message");message.textContent="Salvandoâ¬¦";const form=new FormData(event.currentTarget),payload={id};for(const field of config.fields){const [name,label,type]=field;if(type==="editor")payload[name]=quill.root.innerHTML;else if(type==="weekly-hours")payload[name]=collectWeeklyHours(form,name);else if(type==="boolean")payload[name]=form.get(name)==="true";else if(type==="number")payload[name]=form.get(name)===""?null:Number(form.get(name)||0);else if(type==="tags")payload[name]=String(form.get(name)||"").split(",").map(item=>item.trim()).filter(Boolean);else{const value=form.get(name)||null;if(type==="url"&&!validSiteReference(value)){message.textContent=`Informe um link completo ou caminho interno vÃ¡lido em ${label}.`;event.currentTarget.elements[name]?.focus();return}if(["galeria_historica","galeria","videos","links_uteis","patrocinadores"].includes(name)){try{payload[name]=value?JSON.parse(value):[]}catch{message.textContent=`O campo ${label} precisa ser um JSON vÃ¡lido. Use [] quando nÃ£o houver itens.`;event.currentTarget.elements[name]?.focus();return}}else payload[name]=value}}if(table==="noticias"&&payload.status==="publicado"&&!payload.publicado_em)payload.publicado_em=new Date().toISOString();try{await salvarRegistro(table,payload);await resourceList(table)}catch(error){message.textContent=error.message;}});
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

function setShellTitle(label, hintText) {
  if (title) title.textContent = label || "Painel";
  if (pageHint) {
    pageHint.textContent = hintText || "Acompanhe os principais dados do portal e escolha um mÃ³dulo no menu para gerenciar conteÃºdo, publicidade, comunicaÃ§Ã£o e configuraÃ§Ãµes.";
  }
  document.title = `${label || "Painel"} | Eu Amo UrÃ¢nia`;
}

function clearMountedModule() {
  if (activeMountedModule?.unmount) {
    try { activeMountedModule.unmount(); } catch (error) { console.error("Erro ao desmontar mÃ³dulo:", error); }
  }
  activeMountedModule = null;
}

function setActiveNav(view) {
  document.querySelectorAll(".admin-nav button,.admin-nav a").forEach(button => {
    button.classList.toggle("active", button.dataset.view === view || button.dataset.module === view);
  });
}

async function mountShellModule(view, options = {}) {
  const route = moduleRoutes[view];
  if (!route) return false;
  clearMountedModule();
  currentView = view;
  currentResourceTable = null;
  currentResourceId = null;
  setShellTitle(route.label, route.hint);
  setActiveNav(view);
  const targetPath = adminPathForView(view);
  if (location.pathname !== targetPath) {
    history[options.replace ?"replaceState" : "pushState"]({ adminView: view }, "", targetPath);
  }
  sidebar.classList.remove("open");
  document.body.classList.remove("sidebar-drawer-open");
  app.innerHTML = '<div class="loading">Carregando mÃ³duloâ¬¦</div>';
  try {
    const module = await route.module();
    activeMountedModule = module;
    await module.mount(app, {
      db: getSupabase(),
      access: painelAccess,
      toast: shellToast,
      setTitle: setShellTitle,
      navigate: nextView => navigateToView(nextView)
    });
  } catch (error) {
    console.error(`Falha ao carregar mÃ³dulo ${view}:`, error);
    app.innerHTML = `<section class="panel"><h2>NÃ£o foi possÃ­vel carregar ${escapeHtml(route.label)}</h2><p class="form-message">${escapeHtml(error.message || "Erro inesperado.")}</p><button class="admin-button" data-retry-module="${escapeHtml(view)}" type="button">Tentar novamente</button></section>`;
  }
  return true;
}

async function navigateToView(view, options = {}) {
  if (moduleRoutes[view]) return mountShellModule(view, options);
  clearMountedModule();
  currentView = view || "dashboard";
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
  if(button.dataset.retryModule){event.preventDefault();return mountShellModule(button.dataset.retryModule,{replace:true});}
  if(button.dataset.view){event.preventDefault();return navigateToView(button.dataset.view);}
  if(button.dataset.new)return editForm(button.dataset.new);
  if(button.dataset.edit)return editForm(button.dataset.edit,button.dataset.id);
  if(button.dataset.cancel)return resourceList(button.dataset.cancel);
  if(button.dataset.delete&&confirm("Excluir este registro?Esta aÃ§Ã£o nÃ£o pode ser desfeita.")){await excluirRegistro(button.dataset.delete,button.dataset.id);return resourceList(button.dataset.delete);}
}

function setupSidebarControls() {
  const buttons = [...document.querySelectorAll(".admin-nav button")];
  buttons.forEach(button => {
    if (button.dataset.navReady) return;
    const label = button.textContent.trim().replace(/\s+/g, " ");
    button.dataset.label = label;
    button.title = label;
    button.dataset.navReady = "true";
    button.innerHTML = `<span class="admin-nav-icon" aria-hidden="true">${sidebarIconSvgMap[label] || sidebarIconSvgMap["VisÃ£o geral"]}</span><span class="admin-nav-label">${escapeHtml(label)}</span>`;
  });

  const savedState = localStorage.getItem("euamourania:admin-sidebar");
  const applyCollapsed = collapsed => {
    shell?.classList.toggle("sidebar-collapsed", collapsed);
    sidebarToggle?.setAttribute("aria-expanded", String(!collapsed));
    sidebarToggle?.setAttribute("aria-label", collapsed ?"Expandir menu" : "Recolher menu");
    const icon = sidebarToggle?.querySelector("span");
    if (icon) icon.textContent = collapsed ?"â¬º" : "â¬¹";
  };

  applyCollapsed(savedState === "collapsed");

  sidebarToggle?.addEventListener("click", () => {
    const collapsed = !shell?.classList.contains("sidebar-collapsed");
    applyCollapsed(collapsed);
    localStorage.setItem("euamourania:admin-sidebar", collapsed ?"collapsed" : "expanded");
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
  document.addEventListener("click",handleClick);
  currentView=normalizeLegacyAdminRoute()||"dashboard";
  await navigateToView(currentView,{replace:true});
}
init();
window.addEventListener("popstate",()=>{
  const view=adminViewFromLocation()||"dashboard";
  if(view==="audiencia"||view==="aprovacoes"){clearMountedModule();return;}
  navigateToView(view,{replace:true});
});
window.addEventListener("admin:external-module",()=>clearMountedModule());
import("./editorial-audience.js").catch(error=>console.error("MÃ³dulos editorial/audiÃªncia:",error));
import("./category-fields.js").catch(error=>console.error("Categorias dos conteÃºdos:",error));
import("./media-upload.js").catch(error=>console.error("Upload de imagens:",error));
