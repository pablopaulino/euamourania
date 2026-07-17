import { exigirAdministrador, sair } from "./auth.js";
import { getSupabase } from "../assets/js/services/supabaseClient.js";
import { listarTabela, salvarRegistro, excluirRegistro } from "../assets/js/services/baseService.js";
import { gerarSlug } from "../assets/js/utils.js";

const app = document.getElementById("app-content");
const title = document.getElementById("page-title");
const sidebar = document.getElementById("sidebar");
let currentView = "dashboard";
let quill;
let currentResourceTable = null;
let currentResourceId = null;

const resources = {
  noticias: { label:"Notícias", title:"titulo", order:"atualizado_em", fields:[
    ["titulo","Título","text",true],["slug","Slug","text",true],["subtitulo","Subtítulo","text"],["resumo","Resumo","textarea"],["categoria_nome","Categoria","text"],["autor","Autor","text"],["imagem_url","URL da imagem","url"],["legenda_imagem","Legenda da imagem","text"],["status","Status","status"],["destaque","Destaque","boolean"],["publicado_em","Publicação","datetime-local"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"],["seo_imagem","Imagem SEO","url"],["conteudo_html","Conteúdo","editor"]]},
  guia_comercial: { label:"Guia comercial", title:"nome", order:"atualizado_em", fields:[
    ["nome","Nome","text",true],["slug","Slug","text",true],["categoria_nome","Categoria","text"],["descricao","Descrição","textarea"],["imagem_url","URL da imagem","url"],["whatsapp","WhatsApp","text"],["telefone","Telefone","text"],["instagram","Instagram","url"],["facebook","Facebook","url"],["site","Site","url"],["endereco","Endereço","text"],["horario","Horário","text"],["mapa_url","Mapa","url"],["recomendado","Recomendado","boolean"],["status","Status","status"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"]]},
  turismo: { label:"Turismo", title:"nome", order:"atualizado_em", fields:[["nome","Nome","text",true],["slug","Slug","text",true],["descricao","Descrição","textarea"],["conteudo_html","Conteúdo","editor"],["imagem_url","Imagem","url"],["endereco","Endereço","text"],["horario","Horário","text"],["whatsapp","WhatsApp","text"],["mapa_url","Mapa","url"],["destaque","Destaque","boolean"],["status","Status","status"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"]]},
  links: { label:"Links", title:"titulo", order:"ordem", ascending:true, fields:[["titulo","Título","text",true],["url","URL","url",true],["icone","Ícone/emoji","text"],["ordem","Ordem","number"],["status","Status","active-status"]]},
  colaboradores_voluntarios: { label:"Colaborações voluntárias", title:"nome", order:"criado_em", fields:[["nome","Nome","text",true],["whatsapp","WhatsApp","text",true],["email","E-mail","email"],["cidade","Cidade","text"],["interesses","Interesses","tags"],["mensagem","Mensagem","textarea"],["status","Status","volunteer-status"],["observacoes_internas","Observações internas","textarea"],["aceite_voluntario","Aceite voluntário","boolean"]]},
  eventos: { label:"Eventos", title:"titulo", order:"atualizado_em", fields:[["titulo","Título","text",true],["slug","Slug","text",true],["descricao","Descrição","textarea"],["imagem_url","Imagem","url"],["data_inicio","Início","datetime-local"],["data_fim","Fim","datetime-local"],["local","Local","text"],["endereco","Endereço","text"],["organizador","Organizador","text"],["whatsapp","WhatsApp","text"],["destaque","Destaque","boolean"],["status","Status","status"]]},
  banners: { label:"Banners", title:"titulo", order:"ordem", ascending:true, fields:[["titulo","Título","text"],["subtitulo","Subtítulo","text"],["imagem_url","Imagem","url"],["link_url","Link","url"],["posicao","Posição","text"],["ordem","Ordem","number"],["status","Status","active-status"]]},
  categorias: { label:"Categorias", title:"nome", order:"ordem", ascending:true, fields:[["nome","Nome","text",true],["slug","Slug","text",true],["tipo","Tipo","category-type",true],["ordem","Ordem","number"],["status","Status","active-status"]]},
  configuracoes_site: { label:"Configurações", title:"chave", order:"chave", ascending:true, fields:[["chave","Chave","text",true],["valor","Valor","textarea"],["tipo","Tipo","text"]]}
};

resources.eventos_principais = { label:"Eventos principais", title:"nome", order:"atualizado_em", fields:[["nome","Nome do evento","text",true],["slug","Slug","text",true],["descricao_curta","DescriÃ§Ã£o curta","textarea"],["historia_html","HistÃ³ria do evento","editor"],["imagem_capa_url","Imagem de capa","url"],["galeria_historica","Galeria histÃ³rica (JSON)","textarea"],["categoria","Categoria","text"],["local_tradicional","Local tradicional","text"],["recorrencia","RecorrÃªncia","event-recurrence"],["periodo_aproximado","PerÃ­odo aproximado","text"],["organizador","Organizador","text"],["telefone","Telefone","text"],["email","E-mail","email"],["website","Website","url"],["instagram","Instagram","url"],["facebook","Facebook","url"],["ativo","Ativo","boolean"],["destaque","Destaque","boolean"],["seo_titulo","TÃ­tulo SEO","text"],["seo_descricao","DescriÃ§Ã£o SEO","textarea"],["palavras_chave","Palavras-chave","text"]] };
resources.eventos_edicoes = { label:"EdiÃ§Ãµes de eventos", title:"titulo", order:"ano", ascending:false, fields:[["evento_id","ID do evento principal","text",true],["ano","Ano","number",true],["slug","Slug da ediÃ§Ã£o","text"],["titulo","TÃ­tulo da ediÃ§Ã£o","text",true],["subtitulo","SubtÃ­tulo","text"],["data_inicio","InÃ­cio","datetime-local"],["data_fim","Fim","datetime-local"],["programacao_html","ProgramaÃ§Ã£o","editor"],["atracoes_html","AtraÃ§Ãµes","textarea"],["cartaz_url","Cartaz oficial","url"],["banner_url","Banner","url"],["galeria","Galeria (JSON)","textarea"],["videos","VÃ­deos (JSON)","textarea"],["local","Local","text"],["mapa_url","Mapa","url"],["links_uteis","Links Ãºteis (JSON)","textarea"],["patrocinadores","Patrocinadores (JSON)","textarea"],["status","Status da ediÃ§Ã£o","event-edition-status"],["resumo_pos_evento_html","Resumo pÃ³s-evento","textarea"],["publico_estimado","PÃºblico estimado","number"],["observacoes","ObservaÃ§Ãµes","textarea"],["destaque","Destaque","boolean"]] };

resources.eventos_principais = { label:"Eventos principais", title:"nome", order:"atualizado_em", fields:[["nome","Nome do evento","text",true],["slug","Slug","text",true],["descricao_curta","Descrição curta","textarea"],["historia_html","História do evento","editor"],["imagem_capa_url","Imagem de capa","url"],["galeria_historica","Galeria histórica","url-list"],["categoria","Categoria","text"],["local_tradicional","Local tradicional","text"],["recorrencia","Recorrência","event-recurrence"],["periodo_aproximado","Período aproximado","text"],["organizador","Organizador","text"],["telefone","Telefone","text"],["email","E-mail","email"],["website","Website","url"],["instagram","Instagram","url"],["facebook","Facebook","url"],["ativo","Ativo","boolean"],["destaque","Destaque","boolean"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"],["palavras_chave","Palavras-chave","text"]] };
resources.eventos_edicoes = { label:"Edições de eventos", title:"titulo", order:"ano", ascending:false, fields:[["evento_id","Evento principal","event-principal-select",true],["ano","Ano","number",true],["slug","Slug da edição","text"],["titulo","Título da edição","text",true],["subtitulo","Subtítulo","text"],["data_inicio","Início","datetime-local"],["data_fim","Fim","datetime-local"],["programacao_html","Programação","editor"],["atracoes_html","Atrações","textarea"],["cartaz_url","Cartaz oficial","url"],["banner_url","Banner","url"],["galeria","Galeria da edição","url-list"],["videos","Vídeos","line-list"],["local","Local","text"],["mapa_url","Mapa","url"],["links_uteis","Links úteis","line-list"],["patrocinadores","Patrocinadores","line-list"],["status","Status da edição","event-edition-status"],["resumo_pos_evento_html","Resumo pós-evento","textarea"],["publico_estimado","Público estimado","number"],["observacoes","Observações","textarea"],["destaque","Destaque","boolean"]] };

resources.eventos_principais = { label:"Eventos principais", title:"nome", order:"atualizado_em", fields:[["nome","Nome do evento","text",true],["slug","Slug","text",true],["descricao_curta","Descrição curta","textarea"],["historia_html","História do evento","editor"],["imagem_capa_url","Imagem de capa","url"],["galeria_historica","Galeria histórica","url-list"],["categoria","Categoria","text"],["local_tradicional","Local tradicional","text"],["recorrencia","Recorrência","event-recurrence"],["periodo_aproximado","Período aproximado","text"],["organizador","Organizador","text"],["telefone","Telefone","text"],["email","E-mail","email"],["website","Website","url"],["instagram","Instagram","url"],["facebook","Facebook","url"],["ativo","Ativo","boolean"],["destaque","Destaque","boolean"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"],["palavras_chave","Palavras-chave","text"]] };
resources.eventos_edicoes = { label:"Edições de eventos", title:"titulo", order:"ano", ascending:false, fields:[["evento_id","Evento principal","event-principal-select",true],["ano","Ano","number",true],["slug","Slug da edição","text"],["titulo","Título da edição","text",true],["subtitulo","Subtítulo","text"],["data_inicio","Início","datetime-local"],["data_fim","Fim","datetime-local"],["programacao_html","Programação","editor"],["atracoes_html","Atrações","textarea"],["cartaz_url","Cartaz oficial","url"],["banner_url","Banner","url"],["galeria","Galeria da edição","url-list"],["videos","Vídeos","line-list"],["local","Local","text"],["mapa_url","Mapa","url"],["links_uteis","Links úteis","line-list"],["patrocinadores","Patrocinadores","line-list"],["status","Status da edição","event-edition-status"],["resumo_pos_evento_html","Resumo pós-evento","textarea"],["publico_estimado","Público estimado","number"],["observacoes","Observações","textarea"],["destaque","Destaque","boolean"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"],["palavras_chave","Palavras-chave","text"]] };

Object.assign(resources, {
  noticias: { label:"Notícias", title:"titulo", order:"atualizado_em", fields:[
    ["titulo","Título","text",true],["slug","Slug","text",true],["subtitulo","Subtítulo","text"],["resumo","Resumo","textarea"],["categoria_nome","Categoria","text"],["autor","Autor","text"],["imagem_url","URL da imagem","url"],["legenda_imagem","Legenda da imagem","text"],["status","Status","status"],["destaque","Destaque","boolean"],["publicado_em","Publicação","datetime-local"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"],["seo_imagem","Imagem SEO","url"],["conteudo_html","Conteúdo","editor"]]},
  guia_comercial: { label:"Guia comercial", title:"nome", order:"atualizado_em", fields:[
    ["nome","Nome","text",true],["slug","Slug","text",true],["categoria_nome","Categoria","text"],["descricao","Descrição","textarea"],["imagem_url","URL da imagem","url"],["whatsapp","WhatsApp","text"],["telefone","Telefone","text"],["instagram","Instagram","url"],["facebook","Facebook","url"],["site","Site","url"],["endereco","Endereço","text"],["horario","Horário","text"],["mapa_url","Mapa","url"],["recomendado","Recomendado","boolean"],["status","Status","status"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"]]},
  turismo: { label:"Turismo", title:"nome", order:"atualizado_em", fields:[["nome","Nome","text",true],["slug","Slug","text",true],["descricao","Descrição","textarea"],["conteudo_html","Conteúdo","editor"],["imagem_url","Imagem","url"],["endereco","Endereço","text"],["horario","Horário","text"],["whatsapp","WhatsApp","text"],["mapa_url","Mapa","url"],["destaque","Destaque","boolean"],["status","Status","status"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"]]},
  links: { label:"Links", title:"titulo", order:"ordem", ascending:true, fields:[["titulo","Título","text",true],["url","URL","url",true],["icone","Ícone/emoji","text"],["ordem","Ordem","number"],["status","Status","active-status"]]},
  colaboradores_voluntarios: { label:"Colaborações voluntárias", title:"nome", order:"criado_em", fields:[["nome","Nome","text",true],["whatsapp","WhatsApp","text",true],["email","E-mail","email"],["cidade","Cidade","text"],["interesses","Interesses","tags"],["mensagem","Mensagem","textarea"],["status","Status","volunteer-status"],["observacoes_internas","Observações internas","textarea"],["aceite_voluntario","Aceite voluntário","boolean"]]},
  eventos: { label:"Agenda simples", title:"titulo", order:"atualizado_em", fields:[["titulo","Título","text",true],["slug","Slug","text",true],["descricao","Descrição","textarea"],["imagem_url","Imagem","url"],["data_inicio","Início","datetime-local"],["data_fim","Fim","datetime-local"],["local","Local","text"],["endereco","Endereço","text"],["organizador","Organizador","text"],["whatsapp","WhatsApp","text"],["destaque","Destaque","boolean"],["status","Status","status"]]},
  banners: { label:"Banners", title:"titulo", order:"ordem", ascending:true, fields:[["titulo","Título","text"],["subtitulo","Subtítulo","text"],["imagem_url","Imagem","url"],["link_url","Link","url"],["posicao","Posição","text"],["ordem","Ordem","number"],["status","Status","active-status"]]},
  categorias: { label:"Categorias", title:"nome", order:"ordem", ascending:true, fields:[["nome","Nome","text",true],["slug","Slug","text",true],["tipo","Tipo","category-type",true],["ordem","Ordem","number"],["status","Status","active-status"]]},
  configuracoes_site: { label:"Configurações", title:"chave", order:"chave", ascending:true, fields:[["chave","Chave","text",true],["valor","Valor","textarea"],["tipo","Tipo","text"]]},
  eventos_principais: { label:"Eventos principais", title:"nome", order:"atualizado_em", fields:[["nome","Nome do evento","text",true],["slug","Slug","text",true],["descricao_curta","Descrição curta","textarea"],["historia_html","História do evento","editor"],["imagem_capa_url","Imagem de capa","url"],["galeria_historica","Galeria histórica","url-list"],["categoria","Categoria","text"],["local_tradicional","Local tradicional","text"],["recorrencia","Recorrência","event-recurrence"],["periodo_aproximado","Período aproximado","text"],["organizador","Organizador","text"],["telefone","Telefone","text"],["email","E-mail","email"],["website","Website","url"],["instagram","Instagram","url"],["facebook","Facebook","url"],["ativo","Ativo","boolean"],["destaque","Destaque","boolean"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"],["palavras_chave","Palavras-chave","text"]]},
  eventos_edicoes: { label:"Edições de eventos", title:"titulo", order:"ano", ascending:false, fields:[["evento_id","Evento principal","event-principal-select",true],["ano","Ano","number",true],["slug","Slug da edição","text"],["titulo","Título da edição","text",true],["subtitulo","Subtítulo","text"],["data_inicio","Início","datetime-local"],["data_fim","Fim","datetime-local"],["programacao_html","Programação","editor"],["atracoes_html","Atrações","textarea"],["cartaz_url","Cartaz oficial","url"],["banner_url","Banner","url"],["galeria","Galeria da edição","url-list"],["videos","Vídeos","line-list"],["local","Local","text"],["mapa_url","Mapa","url"],["links_uteis","Links úteis","line-list"],["patrocinadores","Patrocinadores","line-list"],["status","Status da edição","event-edition-status"],["resumo_pos_evento_html","Resumo pós-evento","textarea"],["publico_estimado","Público estimado","number"],["observacoes","Observações","textarea"],["destaque","Destaque","boolean"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"],["palavras_chave","Palavras-chave","text"]]}
});

const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const inputValue = (value, type) => type === "datetime-local" && value ? new Date(value).toISOString().slice(0,16) : value ?? "";
const validSiteReference = value => !value || /^(?:https?:\/\/|mailto:|tel:|\/(?!\/)|\.{1,2}\/|#)/i.test(value) || (/^[\w.-]+(?:\/[\w\-./%~:+?#[\]@!$&'()*+,;=]*)?$/u.test(value) && !/^javascript:/i.test(value));
const listValue = value => Array.isArray(value) ? value.map(item => item?.url || item?.nome || item?.titulo || item).filter(Boolean).join("\n") : "";
const parseUrlList = value => String(value || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean).map(url => ({ url }));
const parseLineList = value => String(value || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean).map(nome => ({ nome }));

async function legacyDashboard() {
  title.textContent = "Visão geral";
  app.innerHTML = '<div class="loading">Carregando indicadores…</div>';
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
        <button class="metric-card" onclick="location.href='melhores.html'"><span>Prêmio</span><strong>Melhores de Urânia</strong><small>Votação, apuração e resultados</small></button>
        <button class="metric-card" id="dashboard-audience"><span>Dados</span><strong>Audiência</strong><small>Visualizações, cliques e buscas</small></button>
        <button class="metric-card" onclick="location.href='publicidade.html'"><span>Receita</span><strong>Publicidade</strong><small>Campanhas e desempenho</small></button>
      </div>
      <section class="panel">
        <header class="panel-header"><h2>Notícias recentes</h2></header>
        ${recentNews.length?recentNews.map(item=>`<div class="rank-item"><strong>${escapeHtml(item.titulo)}</strong><small>${escapeHtml(item.status||"")} · ${item.atualizado_em?new Date(item.atualizado_em).toLocaleDateString("pt-BR"):"sem data"}</small></div>`).join(""):'<div class="empty-state">Nenhuma notícia recente.</div>'}
      </section>`;
  } catch(error) { app.innerHTML=`<p class="form-message">${escapeHtml(error.message)}</p>`; }
}

async function dashboardBase() {
  title.textContent = "Visão geral";
  app.innerHTML = '<div class="loading">Carregando indicadores…</div>';
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
  const fmtDate = value => value ? new Date(value).toLocaleDateString("pt-BR") : "sem data";
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
      ["Fluxo", aprovacoes, "Aprovações pendentes", aprovacoes ? "Precisa de revisão editorial" : "Fila editorial em dia"],
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
      aprovacoes ? [`${aprovacoes} matéria(s) aguardando aprovação`, "Abrir fila", "aprovacoes"] : null,
      rascunhos ? [`${rascunhos} notícia(s) em rascunho`, "Ver notícias", "noticias"] : null,
      campanhasAtivas ? null : ["Nenhuma campanha publicitária ativa", "Criar campanha", "publicidade"],
      melhoresEdicoes ? null : ["Nenhuma edição ativa do Melhores cadastrada", "Abrir Melhores", "melhores"]
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
            ${pendingTasks.length ? pendingTasks.map(([text, action, target]) => `<button class="dashboard-task" ${target === "publicidade" ? "onclick=\"location.href='publicidade.html'\"" : target === "melhores" ? "onclick=\"location.href='melhores.html'\"" : target === "aprovacoes" ? "id=\"dashboard-approvals\"" : `data-view="${target}"`}><span>${escapeHtml(text)}</span><strong>${escapeHtml(action)} →</strong></button>`).join("") : '<div class="dashboard-empty-good">Tudo certo por aqui. Nenhuma pendência importante agora.</div>'}
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
            ${recentNews.length ? recentNews.map(item => `<article class="dashboard-list-row"><div><strong>${escapeHtml(item.titulo)}</strong><small>${escapeHtml(item.status_editorial || item.status || "")} · ${fmtDate(item.publicado_em || item.atualizado_em)}</small></div><span class="status-pill ${escapeHtml(item.status || "")}">${escapeHtml(item.status || "—")}</span></article>`).join("") : '<div class="empty-state">Nenhuma notícia recente.</div>'}
          </div>
        </section>
        <section class="panel dashboard-section">
          <header class="panel-header"><div><h2>Aprovações e edições</h2><p>Fila editorial e últimas edições do prêmio.</p></div></header>
          <div class="dashboard-list">
            ${pendingApprovals.length ? pendingApprovals.map(item => `<article class="dashboard-list-row"><div><strong>${escapeHtml(item.noticias?.titulo || "Notícia em revisão")}</strong><small>Enviada em ${fmtDate(item.enviado_em)}</small></div><span class="status-pill">${escapeHtml(item.status)}</span></article>`).join("") : '<div class="dashboard-empty-good compact">Sem aprovações pendentes.</div>'}
            ${recentEditions.length ? recentEditions.map(item => `<article class="dashboard-list-row"><div><strong>${escapeHtml(item.nome || `Melhores ${item.ano}`)}</strong><small>${item.ano} · ${fmtDate(item.atualizado_em)}</small></div><span class="status-pill">${escapeHtml(item.status || "—")}</span></article>`).join("") : '<div class="empty-state">Nenhuma edição do Melhores cadastrada.</div>'}
          </div>
        </section>
      </div>
      <div class="dashboard-quick-actions">
        <button class="metric-card" data-view="noticias"><span>Editorial</span><strong>Notícias</strong><small>Criar, revisar e publicar</small></button>
        <button class="metric-card" onclick="location.href='melhores.html'"><span>Prêmio</span><strong>Melhores de Urânia</strong><small>Votação, apuração e resultados</small></button>
        <button class="metric-card" onclick="location.href='publicidade.html'"><span>Receita</span><strong>Publicidade</strong><small>Campanhas e desempenho</small></button>
        <button class="metric-card" onclick="location.href='comunicacao.html'"><span>Relacionamento</span><strong>Comunicação</strong><small>Newsletter e assinantes</small></button>
      </div>`;
  } catch(error) {
    app.innerHTML = `<p class="form-message">${escapeHtml(error.message)}</p>`;
  }
}

async function dashboard() {
  title.textContent = "Visão geral";
  app.innerHTML = '<div class="loading">Carregando visão geral profissional…</div>';
  const supabase = getSupabase();
  const now = new Date();
  const isoNow = now.toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const nextSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const fmtDate = value => value ? new Date(value).toLocaleDateString("pt-BR") : "sem data";
  const fmtNumber = value => Number(value || 0).toLocaleString("pt-BR");
  const pct = (part, total) => total ? `${Math.round((Number(part || 0) / Number(total || 1)) * 100)}%` : "0%";
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
  const listRows = rows => rows.length ? rows.map(item => `<article class="dashboard-list-row"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail || "")}</small></div>${item.badge ? `<span class="status-pill ${escapeHtml(item.badgeClass || "")}">${escapeHtml(item.badge)}</span>` : ""}</article>`).join("") : '<div class="empty-state">Nenhum registro no momento.</div>';

  try {
    const [
      noticias, publicadas, rascunhos, agendadas, emRevisao,
      empresas, empresasAtivas, pontos, pontosAtivos, eventos, eventosAtivos, eventosProximos, eventosPrincipais, eventosEdicoes,
      links, campanhas, campanhasAtivas, campanhasVencendo, assinantes, melhoresEdicoes, melhoresIndicados,
      aprovacoes, colaboradores, colaboradoresNovos, categorias, usuariosAtivos, views7d, views30d, whatsapp7d, external7d
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
      safeCount("analytics_eventos", { criado_em: { op: "gte", value: sevenDaysAgo } }),
      safeCount("analytics_eventos", { criado_em: { op: "gte", value: thirtyDaysAgo } }),
      safeCount("analytics_eventos", { tipo: "whatsapp_click", criado_em: { op: "gte", value: sevenDaysAgo } }),
      safeCount("analytics_eventos", { tipo: "external_click", criado_em: { op: "gte", value: sevenDaysAgo } })
    ]);

    const [recentNews, pendingApprovals, recentEditions, recentActivities, analyticsEvents, upcomingEvents, endingCampaigns, recentCollaborators, recentMainEvents, recentEventEditions] = await Promise.all([
      safeList(() => supabase.from("noticias").select("titulo,status,status_editorial,publicado_em,atualizado_em").order("atualizado_em", { ascending: false }).limit(6)),
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
      aprovacoes ? [`${aprovacoes} notícia(s) aguardando aprovação`, "Abrir aprovações", "aprovacoes", "warning"] : null,
      colaboradoresNovos ? [`${colaboradoresNovos} colaborador(es) voluntário(s) aguardando contato`, "Ver colaborações", "colaboradores_voluntarios", "info"] : null,
      emRevisao ? [`${emRevisao} notícia(s) em revisão editorial`, "Ver notícias", "noticias", "info"] : null,
      rascunhos ? [`${rascunhos} rascunho(s) parado(s) no editorial`, "Organizar pauta", "noticias", "warning"] : null,
      agendadas ? [`${agendadas} notícia(s) agendada(s) para o futuro`, "Conferir agenda", "noticias", "info"] : null,
      campanhasVencendo ? [`${campanhasVencendo} campanha(s) vencendo em até 7 dias`, "Abrir publicidade", "publicidade", "danger"] : null,
      campanhasAtivas ? null : ["Nenhuma campanha publicitária ativa", "Criar campanha", "publicidade", "warning"],
      eventosProximos ? [`${eventosProximos} evento(s) futuro(s) publicado(s)`, "Ver agenda", "eventos", "success"] : null,
      eventosPrincipais && !eventosEdicoes ? ["Eventos principais sem edições cadastradas", "Abrir edições", "eventos_edicoes", "warning"] : null,
      melhoresEdicoes ? null : ["Nenhuma edição ativa do Melhores", "Abrir Melhores", "melhores", "warning"]
    ].filter(Boolean);
    const portalScore = Math.max(0, 100 - (aprovacoes * 8) - (rascunhos * 3) - (campanhasVencendo * 6) - (campanhasAtivas ? 0 : 10));
    const primaryMetrics = [
      ["Operação", portalScore, "Saúde do painel", portalScore >= 80 ? "Operação sem alerta crítico" : "Existem pontos pedindo atenção"],
      ["Audiência", fmtNumber(views7d), "Eventos em 7 dias", `${fmtNumber(uniqueVisitors)} visitante(s) identificáveis`],
      ["Editorial", fmtNumber(publicadas), "Notícias publicadas", `${rascunhos} rascunho(s) · ${agendadas} agendada(s)`],
      ["Receita", fmtNumber(campanhasAtivas), "Campanhas ativas", `${campanhasVencendo} vencendo em 7 dias`]
    ];
    const secondaryMetrics = [
      ["Guia", empresas, `${empresasAtivas} empresas publicadas`],
      ["Turismo", pontos, `${pontosAtivos} pontos publicados`],
      ["Eventos", Number(eventos || 0) + Number(eventosPrincipais || 0), `${eventosAtivos} agenda · ${eventosPrincipais} principais · ${eventosEdicoes} edições`],
      ["Comunicação", assinantes, "assinantes ativos"],
      ["Colaborações", colaboradores, `${colaboradoresNovos} novo(s) contato(s)`],
      ["Melhores", melhoresEdicoes, `${melhoresIndicados} indicados ativos`],
      ["Links", links, "links ativos"],
      ["Categorias", categorias, "categorias ativas"],
      ["Usuários", usuariosAtivos, "administradores ativos"]
    ];
    const newsRows = recentNews.map(item => ({ title: item.titulo || "Notícia sem título", detail: `${item.status_editorial || item.status || "sem status"} · ${fmtDate(item.publicado_em || item.atualizado_em)}`, badge: item.status || "—", badgeClass: item.status || "" }));
    const approvalRows = pendingApprovals.map(item => ({ title: item.noticias?.titulo || "Notícia em revisão", detail: `Enviada em ${fmtDate(item.enviado_em)}`, badge: item.status || "pendente" }));
    const editionRows = recentEditions.map(item => ({ title: item.nome || `Melhores ${item.ano}`, detail: `${item.ano} · atualizado em ${fmtDate(item.atualizado_em)}`, badge: item.status || "—" }));
    const activityRows = recentActivities.map(item => ({ title: item.titulo || item.tabela || "Atividade", detail: `${item.acao || "ação"} · ${fmtDate(item.criado_em)}`, badge: item.tabela || "" }));
    const eventRows = upcomingEvents.map(item => ({ title: item.titulo || "Evento", detail: `${fmtDate(item.data_inicio)}${item.local ? ` · ${item.local}` : ""}`, badge: item.status || "" }));
    const mainEventRows = recentMainEvents.map(item => ({ title: item.nome || "Evento principal", detail: `${item.categoria || "Acervo permanente"} · atualizado em ${fmtDate(item.atualizado_em)}`, badge: item.ativo ? "ativo" : "inativo", badgeClass: item.ativo ? "ativo" : "" }));
    const eventEditionRows = recentEventEditions.map(item => ({ title: item.titulo || `Edição ${item.ano}`, detail: `${item.eventos_principais?.nome || "Evento"} · ${item.ano} · ${fmtDate(item.data_inicio || item.atualizado_em)}`, badge: item.status || "edição" }));
    const campaignRows = endingCampaigns.map(item => ({ title: item.nome || "Campanha", detail: `${item.empresa_anunciante || "Anunciante"} · vence em ${fmtDate(item.data_fim)}`, badge: item.status || "ativo", badgeClass: "ativo" }));
    const collaboratorRows = recentCollaborators.map(item => ({ title: item.nome || "Colaborador voluntário", detail: `${item.cidade || "Cidade não informada"} · ${(item.interesses || []).slice(0, 3).join(", ") || "sem interesses"} · ${fmtDate(item.criado_em)}`, badge: item.status || "novo", badgeClass: item.status || "" }));

    app.innerHTML = `
      <section class="dashboard-hero panel dashboard-hero-pro">
        <div>
          <p class="eyebrow">Painel Eu Amo Urânia</p>
          <h2>Central profissional de operação</h2>
          <p>Visão geral com conteúdo, audiência, alertas, publicidade, eventos, comunicação e Melhores de Urânia em tempo real.</p>
        </div>
        <div class="dashboard-hero-status">
          <span>Saúde operacional</span>
          <strong>${portalScore}%</strong>
          <small>${importantAlerts.length ? `${importantAlerts.length} ponto(s) pedindo atenção` : "Tudo em ordem"}</small>
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
          <header class="panel-header"><div><h2>Alertas importantes</h2><p>O que merece atenção antes de seguir a rotina.</p></div></header>
          <div class="dashboard-task-list">
            ${importantAlerts.length ? importantAlerts.map(([text, action, target, tone]) => `<button class="dashboard-task ${tone || ""}" ${target === "publicidade" ? "onclick=\"location.href='publicidade.html'\"" : target === "melhores" ? "onclick=\"location.href='melhores.html'\"" : target === "aprovacoes" ? "id=\"dashboard-approvals\"" : `data-view="${target}"`}><span>${escapeHtml(text)}</span><strong>${escapeHtml(action)} →</strong></button>`).join("") : '<div class="dashboard-empty-good">Tudo certo por aqui. Nenhuma pendência importante agora.</div>'}
          </div>
        </section>
        <section class="panel dashboard-section">
          <header class="panel-header"><div><h2>Estrutura do portal</h2><p>Resumo dos módulos ativos no CMS.</p></div></header>
          <div class="dashboard-mini-grid dashboard-mini-grid-wide">
            ${secondaryMetrics.map(([label, value, detail]) => `<article class="dashboard-mini-card"><strong>${fmtNumber(value)}</strong><span>${label}</span><small>${detail}</small></article>`).join("")}
          </div>
        </section>
      </div>
      <div class="dashboard-layout dashboard-bottom">
        <section class="panel dashboard-section dashboard-audience-section">
          <header class="panel-header"><div><h2>Audiência rápida</h2><p>Últimos 7 dias: páginas, origem e dispositivos.</p></div><button class="admin-button secondary" id="dashboard-audience">Detalhes</button></header>
          <div class="dashboard-audience-grid">
            <article><strong>${fmtNumber(views30d)}</strong><span>interações em 30 dias</span></article>
            <article><strong>${fmtNumber(whatsapp7d)}</strong><span>cliques no WhatsApp</span></article>
            <article><strong>${fmtNumber(external7d)}</strong><span>cliques externos</span></article>
          </div>
          <div class="dashboard-rank-columns">
            <div><h3>Páginas mais acessadas</h3>${topPages.length ? topPages.map(item => `<p><span>${escapeHtml(item.label)}</span><strong>${item.total}</strong></p>`).join("") : '<small>Sem dados no período.</small>'}</div>
            <div><h3>Dispositivos</h3>${topDevices.length ? topDevices.map(item => `<p><span>${escapeHtml(item.label)}</span><strong>${item.total}</strong></p>`).join("") : '<small>Sem dados no período.</small>'}</div>
            <div><h3>Origem</h3>${topOrigins.length ? topOrigins.map(item => `<p><span>${escapeHtml(item.label)}</span><strong>${item.total}</strong></p>`).join("") : '<small>Sem dados no período.</small>'}</div>
          </div>
        </section>
        <section class="panel dashboard-section">
          <header class="panel-header"><div><h2>Publicidade e eventos</h2><p>Campanhas vencendo e próximos eventos publicados.</p></div></header>
          <div class="dashboard-list">${listRows([...campaignRows, ...eventRows, ...mainEventRows, ...eventEditionRows].slice(0, 10))}</div>
        </section>
      </div>
      <div class="dashboard-layout dashboard-bottom">
        <section class="panel dashboard-section">
          <header class="panel-header"><div><h2>Últimas notícias</h2><p>Conteúdos editados recentemente.</p></div><button class="admin-button secondary" data-view="noticias">Ver todas</button></header>
          <div class="dashboard-list">${listRows(newsRows)}</div>
        </section>
        <section class="panel dashboard-section">
          <header class="panel-header"><div><h2>Aprovações e Melhores</h2><p>Fila editorial e últimas edições do prêmio.</p></div></header>
          <div class="dashboard-list">${listRows([...approvalRows, ...editionRows].slice(0, 9))}</div>
        </section>
      </div>
      <div class="dashboard-layout dashboard-bottom">
        <section class="panel dashboard-section">
          <header class="panel-header"><div><h2>Colaborações e atividades</h2><p>Novos voluntários e rastro recente das ações feitas no CMS.</p></div><button class="admin-button secondary" data-view="colaboradores_voluntarios">Ver colaborações</button></header>
          <div class="dashboard-list">${listRows([...collaboratorRows, ...activityRows].slice(0, 8))}</div>
        </section>
        <section class="panel dashboard-section">
          <header class="panel-header"><div><h2>Ações rápidas</h2><p>Caminhos mais usados na rotina do portal.</p></div></header>
          <div class="dashboard-quick-actions compact">
            <button class="metric-card" data-view="noticias"><span>Editorial</span><strong>Notícias</strong><small>Criar, revisar e publicar</small></button>
            <button class="metric-card" onclick="location.href='publicidade.html'"><span>Receita</span><strong>Publicidade</strong><small>Campanhas e desempenho</small></button>
            <button class="metric-card" onclick="location.href='melhores.html'"><span>Prêmio</span><strong>Melhores</strong><small>Votação e apuração</small></button>
            <button class="metric-card" onclick="location.href='comunicacao.html'"><span>Comunicação</span><strong>Newsletter</strong><small>Assinantes e campanhas</small></button>
            <button class="metric-card" data-view="colaboradores_voluntarios"><span>Comunidade</span><strong>Colaborações</strong><small>Voluntários, pautas e contatos</small></button>
          </div>
        </section>
      </div>`;
  } catch (error) {
    app.innerHTML = `<p class="form-message">${escapeHtml(error.message)}</p>`;
  }
}

async function resourceList(table) {
  const config=resources[table]; title.textContent=config.label; app.innerHTML='<div class="loading">Carregando…</div>';
  try {
    const rows=await listarTabela(table,{ordem:config.order,crescente:config.ascending||false});
    app.innerHTML=`<section class="panel"><header class="panel-header"><h2>${config.label}</h2><button class="admin-button" data-new="${table}">Novo cadastro</button></header><div class="table-wrap"><table><thead><tr><th>Nome</th><th>Status</th><th>Atualização</th><th>Ações</th></tr></thead><tbody>${rows.length?rows.map(row=>`<tr><td><strong>${escapeHtml(row[config.title]||"Sem título")}</strong></td><td><span class="status-pill ${escapeHtml(row.status||"")}">${escapeHtml(row.status||"—")}</span></td><td>${row.atualizado_em?new Date(row.atualizado_em).toLocaleDateString("pt-BR"):"—"}</td><td><div class="row-actions"><button data-edit="${table}" data-id="${row.id}">Editar</button><button data-delete="${table}" data-id="${row.id}">Excluir</button></div></td></tr>`).join(""):'<tr><td colspan="4">Nenhum registro.</td></tr>'}</tbody></table></div></section>`;
  } catch(error) { app.innerHTML=`<p class="form-message">${escapeHtml(error.message)}</p>`; }
}

function fieldHtml([name,label,type,required], value) {
  const req=required?"required":"", full=["textarea","editor"].includes(type)?"full-row":"";
  if(type==="editor") return `<label class="${full}">${label}<div id="editor"></div><input type="hidden" name="${name}"></label>`;
  if(type==="textarea") return `<label class="${full}">${label}<textarea name="${name}" ${req}>${escapeHtml(inputValue(value,type))}</textarea></label>`;
  if(type==="boolean") return `<label>${label}<select name="${name}"><option value="false" ${!value?"selected":""}>Não</option><option value="true" ${value?"selected":""}>Sim</option></select></label>`;
  if(type==="tags") return `<label class="${full}">${label}<input type="text" name="${name}" value="${escapeHtml(Array.isArray(value)?value.join(", "):inputValue(value,type))}" placeholder="pautas, fotos, eventos"><small>Separe por vírgula.</small></label>`;
  if(type==="event-principal-select") return `<label>${label}<select name="${name}" data-event-principal-select data-current="${escapeHtml(inputValue(value,type))}" ${req}><option value="">Carregando eventos principais...</option></select><small>Escolha o evento principal. Não precisa copiar ID.</small></label>`;
  const options=type==="status"?["rascunho","publicado","arquivado"]:type==="active-status"?["ativo","inativo"]:type==="category-type"?["noticias","guia","turismo","eventos"]:type==="volunteer-status"?["novo","em_conversa","aprovado","recusado","arquivado"]:type==="event-recurrence"?["anual","mensal","unico","outro"]:type==="event-edition-status"?["anunciado","confirmado","acontecendo","encerrado","cancelado"]:null;
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
    select.innerHTML = '<option value="">Não foi possível carregar os eventos</option>';
  }
}

async function salvarEvento2Form(event) {
  if(event.target.id!=="resource-form"||!["eventos_principais","eventos_edicoes"].includes(currentResourceTable))return;
  event.preventDefault();event.stopImmediatePropagation();
  const table=currentResourceTable,config=resources[table],message=document.getElementById("form-message");
  message.textContent="Salvando…";
  const form=new FormData(event.target),payload={id:currentResourceId};
  for(const field of config.fields){
    const [name,label,type]=field;
    if(type==="editor")payload[name]=quill.root.innerHTML;
    else if(type==="boolean")payload[name]=form.get(name)==="true";
    else if(type==="number")payload[name]=form.get(name)===""?null:Number(form.get(name)||0);
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
  const req=required?"required":"", full=["textarea","editor","url-list","line-list"].includes(type)?"full-row":"";
  if(type==="editor") return `<label class="${full}">${label}<div id="editor"></div><input type="hidden" name="${name}"></label>`;
  if(type==="textarea") return `<label class="${full}">${label}<textarea name="${name}" ${req}>${escapeHtml(inputValue(value,type))}</textarea></label>`;
  if(type==="url-list") return `<label class="${full}">${label}<textarea name="${name}" placeholder="Cole uma URL de imagem por linha">${escapeHtml(listValue(value))}</textarea><small>Use uma imagem por linha para montar a galeria.</small></label>`;
  if(type==="line-list") return `<label class="${full}">${label}<textarea name="${name}" placeholder="Digite um item por linha">${escapeHtml(listValue(value))}</textarea><small>Digite um item por linha. Exemplo: nome do patrocinador, link útil ou vídeo.</small></label>`;
  if(type==="boolean"){const checked=value===undefined&&name==="ativo"?true:Boolean(value);return `<label>${label}<select name="${name}"><option value="false" ${!checked?"selected":""}>Não</option><option value="true" ${checked?"selected":""}>Sim</option></select></label>`}
  if(type==="tags") return `<label class="${full}">${label}<input type="text" name="${name}" value="${escapeHtml(Array.isArray(value)?value.join(", "):inputValue(value,type))}" placeholder="pautas, fotos, eventos"><small>Separe por vírgula.</small></label>`;
  if(type==="event-principal-select") return `<label>${label}<select name="${name}" data-event-principal-select data-current="${escapeHtml(inputValue(value,type))}" ${req}><option value="">Carregando eventos principais...</option></select><small>Escolha o evento principal. Não precisa copiar ID.</small></label>`;
  const options=type==="status"?["rascunho","publicado","arquivado"]:type==="active-status"?["ativo","inativo"]:type==="category-type"?["noticias","guia","turismo","eventos"]:type==="volunteer-status"?["novo","em_conversa","aprovado","recusado","arquivado"]:type==="event-recurrence"?["anual","mensal","unico","outro"]:type==="event-edition-status"?["anunciado","confirmado","acontecendo","encerrado","cancelado"]:null;
  if(options) return `<label>${label}<select name="${name}">${options.map(o=>`<option value="${o}" ${value===o?"selected":""}>${o}</option>`).join("")}</select></label>`;
  const inputType=type==="url"?"text":type,urlAttributes=type==="url"?' inputmode="url" data-type="url" placeholder="https://... ou /assets/..."':"";
  return `<label class="${full}">${label}<input type="${inputType}"${urlAttributes} name="${name}" value="${escapeHtml(inputValue(value,type))}" ${req}></label>`;
}

async function editForm(table,id) {
  const config=resources[table]; let row={};
  currentResourceTable=table;currentResourceId=id||null;
  if(id){const {data,error}=await getSupabase().from(table).select("*").eq("id",id).single();if(error)throw error;row=data;}
  title.textContent=`${id?"Editar":"Novo"} · ${config.label}`;
  app.innerHTML=`<section class="panel"><form id="resource-form" class="resource-form">${config.fields.map(field=>fieldHtmlCorrigido(field,row[field[0]])).join("")}<div class="form-actions"><button type="button" class="admin-button secondary" data-cancel="${table}">Cancelar</button><button class="admin-button" type="submit">Salvar</button></div><p id="form-message" class="form-message full-row"></p></form></section>`;
  const editorField=config.fields.find(f=>f[2]==="editor");
  if(editorField){quill=new Quill("#editor",{theme:"snow",modules:{toolbar:[["bold","italic","blockquote"],[{header:[2,3,false]}],[{list:"ordered"},{list:"bullet"}],["link","image","video"],["clean"]]}});quill.root.innerHTML=row[editorField[0]]||"";}
  await carregarSelectEventosPrincipais();
  const sourceName=config.fields.some(f=>f[0]==="titulo")?"titulo":config.fields.some(f=>f[0]==="nome")?"nome":null;
  if(sourceName&&config.fields.some(f=>f[0]==="slug")){const source=app.querySelector(`[name="${sourceName}"]`),slugInput=app.querySelector('[name="slug"]');source.addEventListener("input",()=>{if(!id||!slugInput.dataset.edited)slugInput.value=gerarSlug(source.value)});slugInput.addEventListener("input",()=>slugInput.dataset.edited="true");}
  document.getElementById("resource-form").addEventListener("submit",async event=>{event.preventDefault();const message=document.getElementById("form-message");message.textContent="Salvando…";const form=new FormData(event.currentTarget),payload={id};for(const field of config.fields){const [name,label,type]=field;if(type==="editor")payload[name]=quill.root.innerHTML;else if(type==="boolean")payload[name]=form.get(name)==="true";else if(type==="number")payload[name]=form.get(name)===""?null:Number(form.get(name)||0);else if(type==="tags")payload[name]=String(form.get(name)||"").split(",").map(item=>item.trim()).filter(Boolean);else{const value=form.get(name)||null;if(type==="url"&&!validSiteReference(value)){message.textContent=`Informe um link completo ou caminho interno válido em ${label}.`;event.currentTarget.elements[name]?.focus();return}if(["galeria_historica","galeria","videos","links_uteis","patrocinadores"].includes(name)){try{payload[name]=value?JSON.parse(value):[]}catch{message.textContent=`O campo ${label} precisa ser um JSON válido. Use [] quando não houver itens.`;event.currentTarget.elements[name]?.focus();return}}else payload[name]=value}}if(table==="noticias"&&payload.status==="publicado"&&!payload.publicado_em)payload.publicado_em=new Date().toISOString();try{await salvarRegistro(table,payload);await resourceList(table)}catch(error){message.textContent=error.message;}});
}

async function handleClick(event) {
  const button=event.target.closest("button");if(!button)return;
  if(button.dataset.view){currentView=button.dataset.view;location.hash=currentView;document.querySelectorAll(".admin-nav button").forEach(b=>b.classList.toggle("active",b===button));sidebar.classList.remove("open");return currentView==="dashboard"?dashboard():resourceList(currentView);}
  if(button.dataset.new)return editForm(button.dataset.new);
  if(button.dataset.edit)return editForm(button.dataset.edit,button.dataset.id);
  if(button.dataset.cancel)return resourceList(button.dataset.cancel);
  if(button.dataset.delete&&confirm("Excluir este registro? Esta ação não pode ser desfeita.")){await excluirRegistro(button.dataset.delete,button.dataset.id);return resourceList(button.dataset.delete);}
}

async function init(){
  const access=await exigirAdministrador();if(!access)return;
  if(!access.configurado){app.innerHTML='<p class="form-message">Configure assets/js/supabase-config.js para ativar o painel.</p>';return;}
  document.getElementById("admin-user").textContent=access.admin.nome||access.user.email;
  document.getElementById("logout").addEventListener("click",sair);
  document.getElementById("mobile-menu").addEventListener("click",()=>sidebar.classList.toggle("open"));
  document.addEventListener("click",handleClick);
  currentView=location.hash.slice(1)||"dashboard";
  const nav=document.querySelector(`[data-view="${currentView}"]`);if(nav)nav.click();else dashboard();
}
init();
import("./editorial-audience.js").catch(error=>console.error("Módulos editorial/audiência:",error));
import("./category-fields.js").catch(error=>console.error("Categorias dos conteúdos:",error));
import("./media-upload.js").catch(error=>console.error("Upload de imagens:",error));
