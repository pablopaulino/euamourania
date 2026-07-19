import { exigirAdministrador, sair } from "./auth.js";
import { listarCampanhas, buscarCampanha, salvarCampanha, excluirCampanha, uploadMidia, obterResumoPublicidade, obterMetricasDiarias } from "../assets/js/services/publicidadeService.js";
import { openLibraryPicker, processAndUpload } from "./media-upload.js";

const $ = s => document.querySelector(s);
const state = { page: 1, perPage: 10, total: 0, timer: null, summaries: new Map(), currentConfig: {} };
const formats = {
  automatico: ["Automático responsivo", "Adapta-se à posição escolhida"],
  super_banner: ["Super banner", "940 × 210 px · destaques amplos"],
  horizontal: ["Horizontal compacto", "760 × 86 px · final e faixas leves"],
  retangulo: ["Retângulo", "800 × 400 ou 728 × 300 px · entre conteúdos"],
  quadrado: ["Quadrado", "600 × 600 px · redes e mobile"],
  vertical: ["Vertical", "300 × 600 px · campanhas especiais"],
  nativo: ["Anúncio nativo", "Imagem, título, texto e botão"]
};
const mobileRecommendations = {
  automatico: "Mobile recomendado: 640 × 300 px. O sistema adapta conforme a posição.",
  super_banner: "Mobile recomendado: 640 × 300 px.",
  horizontal: "Mobile recomendado: 640 × 300 px para manter boa leitura.",
  retangulo: "Mobile recomendado: 720 × 400 px.",
  quadrado: "Mobile recomendado: 1080 × 1080 px.",
  vertical: "Mobile recomendado: 600 × 900 px.",
  nativo: "Mobile recomendado: 720 × 480 px; título e texto permanecem separados."
};
const formatSpecs = {
  automatico: {
    title: "Automático premium",
    desktop: "Desktop: 1600 × 600 px",
    mobile: "Celular: 1080 × 1080 px ou 1080 × 1350 px",
    tip: "Use quando quiser uma campanha flexível para vários pontos do site."
  },
  super_banner: {
    title: "Destaque amplo",
    desktop: "Desktop: 1600 × 520 px",
    mobile: "Celular: 1080 × 720 px",
    tip: "Ideal para campanhas bonitas entre seções, sem aparecer no topo."
  },
  horizontal: {
    title: "Faixa premium",
    desktop: "Desktop: 1440 × 420 px",
    mobile: "Celular: 1080 × 640 px",
    tip: "Use no final das páginas ou em chamadas compactas. Evite texto pequeno dentro da imagem."
  },
  retangulo: {
    title: "Card editorial",
    desktop: "Desktop: 1200 × 680 px",
    mobile: "Celular: 1080 × 720 px",
    tip: "Melhor opção para anúncios no meio de notícias, guia, turismo e eventos."
  },
  quadrado: {
    title: "Quadrado social",
    desktop: "Desktop/Celular: 1080 × 1080 px",
    mobile: "Celular: 1080 × 1080 px",
    tip: "Bom para logos, promoções simples e criativos vindos das redes sociais."
  },
  vertical: {
    title: "Vertical especial",
    desktop: "Desktop: 720 × 1200 px",
    mobile: "Celular: 900 × 1200 px",
    tip: "Use com cuidado, para campanhas visuais. Não recomendado para textos longos."
  },
  nativo: {
    title: "Anúncio nativo",
    desktop: "Desktop: imagem 1200 × 800 px + título e texto no painel",
    mobile: "Celular: 1080 × 720 px",
    tip: "Formato mais profissional: imagem, título, descrição e botão ficam separados."
  }
};
const positionRecommendations = {
  todas_paginas: "Nativo ou horizontal compacto",
  home_hero_conteudo: "Nativo ou super banner",
  home_entre_secoes: "Super banner ou nativo",
  home_rodape: "Horizontal 728 × 90",
  noticias_entre_listagem: "Nativo ou retângulo",
  noticia_meio: "Nativo ou retângulo",
  noticia_final: "Super banner ou nativo",
  guia_entre_estabelecimentos: "Nativo ou retângulo",
  guia_rodape: "Horizontal 728 × 90",
  turismo_entre_cartoes: "Nativo ou retângulo",
  turismo_rodape: "Horizontal 728 × 90",
  eventos_entre_eventos: "Nativo ou retângulo",
  eventos_rodape: "Horizontal 728 × 90"
};
const positionDescriptions = {
  todas_paginas: "Campanha global exibida no fluxo ou no final das páginas, nunca no topo.",
  home_hero_conteudo: "Logo depois da apresentação da cidade.",
  home_entre_secoes: "Integra a campanha ao fluxo de conteúdo da home.",
  home_rodape: "Última oportunidade antes do rodapé.",
  noticias_entre_listagem: "Entre os cards do feed de notícias.",
  noticia_meio: "Dentro do texto, próximo ao centro da matéria.",
  noticia_final: "Depois da matéria e antes das recomendações.",
  guia_entre_estabelecimentos: "Entre os estabelecimentos cadastrados.",
  guia_rodape: "Depois do guia, antes do rodapé.",
  turismo_entre_cartoes: "Entre os cartões de turismo.",
  turismo_rodape: "Depois dos atrativos, antes do rodapé.",
  eventos_entre_eventos: "Entre os eventos da agenda.",
  eventos_rodape: "Depois da agenda, antes do rodapé."
};
const positions = {
  "Todas as páginas": [["todas_paginas","Exibir em todo o site"]],
  "Home": [["home_hero_conteudo","Depois da abertura"],["home_entre_secoes","Entre seções"],["home_rodape","Final da home"]],
  "Notícias": [["noticias_entre_listagem","Entre a listagem"],["noticia_meio","Meio da notícia"],["noticia_final","Final da notícia"]],
  "Guia": [["guia_entre_estabelecimentos","Entre estabelecimentos"],["guia_rodape","Final do guia"]],
  "Turismo": [["turismo_entre_cartoes","Entre cartões"],["turismo_rodape","Final do turismo"]],
  "Eventos": [["eventos_entre_eventos","Entre eventos"],["eventos_rodape","Final dos eventos"]]
};

function escapeHtml(value="") { const el=document.createElement("div"); el.textContent=String(value); return el.innerHTML; }
function fmtNumber(value) { return new Intl.NumberFormat("pt-BR").format(Number(value)||0); }
function fmtDate(value) { return value ? new Intl.DateTimeFormat("pt-BR",{dateStyle:"short"}).format(new Date(value)) : "Sem limite"; }
function inputDate(value) { if(!value) return ""; const d=new Date(value); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,16); }
function toast(message, type="success") { const el=document.createElement("div"); el.className=`toast ${type}`; el.textContent=message; $("#toasts").append(el); setTimeout(()=>el.remove(),3800); }
function errorMessage(error) { return error?.message?.includes("campanhas_publicitarias") ? "A estrutura de Publicidade ainda não foi instalada no Supabase." : (error?.message || "Não foi possível concluir a operação."); }

function renderPositions() {
  $("#positions").innerHTML=`<div class="position-selection-head"><span id="position-selection-summary">Nenhuma posição selecionada</span><small>Você pode escolher vários locais.</small></div>${Object.entries(positions).map(([group,items])=>`<section class="position-group"><div class="position-group-title"><strong>${group}</strong><span>${items.length} ${items.length===1?"posição":"posições"}</span></div><div class="position-options">${items.map(([value,label])=>`<label class="position-option"><input type="checkbox" name="posicoes" value="${value}"><span class="position-check" aria-hidden="true">✓</span><span class="position-option-copy"><strong>${label}</strong><small>${positionDescriptions[value]||"Posição responsiva no portal."}</small><em>${positionRecommendations[value]||"Automático responsivo"}</em></span></label>`).join("")}</div></section>`).join("")}`;
  syncPositionCards();
}

function syncPositionCards() {
  const selected=[...document.querySelectorAll('[name="posicoes"]:checked')];
  document.querySelectorAll(".position-option").forEach(card=>card.classList.toggle("selected",card.querySelector("input")?.checked));
  const summary=$("#position-selection-summary");
  if(summary)summary.textContent=selected.length?`${selected.length} ${selected.length===1?"posição selecionada":"posições selecionadas"}`:"Nenhuma posição selecionada";
}

function enhanceCreativeForm() {
  if(!document.querySelector('link[href*="publicidade-v2.css"]')){const link=document.createElement("link");link.rel="stylesheet";link.href="publicidade-v2.css";document.head.appendChild(link)}
  const imageField=$("#imagem_url")?.closest(".ads-field");
  if(!imageField||$("#formato"))return;
  imageField.insertAdjacentHTML("afterend",`<div class="ads-field"><label for="formato">Formato do anúncio</label><select id="formato" name="formato">${Object.entries(formats).map(([value,[label]])=>`<option value="${value}">${label}</option>`).join("")}</select><small id="format-help">Adapta-se à posição escolhida.</small></div><div class="ads-field format-size-guide" id="format-size-guide" aria-live="polite"></div><div class="ads-field"><label for="imagem_mobile_url">Imagem para celular</label><div class="upload-row"><input id="imagem_mobile_url" name="imagem_mobile_url" type="text" inputmode="url" placeholder="Opcional · URL da versão mobile"><input id="mobile-image-upload" type="file" accept="image/*" title="Enviar imagem mobile"></div><small class="upload-state" id="mobile-image-state">Se não houver versão mobile, a imagem principal será adaptada.</small></div><div class="ads-field"><label for="titulo_publico">Título público</label><input id="titulo_publico" name="titulo_publico" maxlength="100" placeholder="Usado principalmente no formato nativo"></div><div class="ads-field"><label for="texto_publico">Texto público</label><textarea id="texto_publico" name="texto_publico" rows="3" maxlength="240" placeholder="Descrição curta e objetiva do anúncio"></textarea></div><div class="ads-field"><label for="rotacao_segundos">Tempo de exibição</label><input id="rotacao_segundos" name="rotacao_segundos" type="number" min="5" max="30" value="8"><small>Segundos desta campanha antes da próxima. Padrão: 8 segundos.</small></div><div class="ads-field full creative-preview-field"><div class="creative-preview-head"><div><label>Prévia real do anúncio</label><small>Confira formato, imagem, logo, texto e botão antes de publicar.</small></div><div class="preview-device-switch" role="group" aria-label="Dispositivo da prévia"><button type="button" class="active" data-preview-device="desktop" aria-pressed="true">Desktop</button><button type="button" data-preview-device="mobile" aria-pressed="false">Celular</button></div></div><div id="campaign-preview" class="campaign-preview" data-device="desktop"></div></div>`);
  const dashboard=$("#dashboard-view");
  if(dashboard&&!$("#placement-inventory"))dashboard.insertAdjacentHTML("beforeend",'<article class="ads-card placement-card"><div class="inventory-heading"><div><h3>Inventário de posições</h3><p>Veja onde existem campanhas configuradas no portal.</p></div><span>Formatos responsivos</span></div><div id="placement-inventory" class="placement-inventory"><div class="skeleton"></div></div></article>');
  enhanceAdImageLibrary();
}

function enhanceAdImageLibrary() {
  [
    ["logo_empresa_url", "publicidade/logos", "square", "Escolher logo da biblioteca"],
    ["imagem_url", "publicidade/campanhas", "card", "Escolher imagem da biblioteca"],
    ["imagem_mobile_url", "publicidade/mobile", "card", "Escolher imagem mobile da biblioteca"]
  ].forEach(([inputId, folder, preset, label]) => {
    const input = $("#" + inputId);
    if (!input || input.dataset.adsLibraryEnhanced) return;
    input.dataset.adsLibraryEnhanced = "true";
    const row = input.closest(".upload-row") || input;
    const tools = document.createElement("div");
    tools.className = "ads-library-tools";
    tools.innerHTML = `<button type="button" class="admin-button secondary" data-ad-library="${inputId}">${label}</button><small>Use uma imagem já enviada, ou edite outro formato pela biblioteca.</small>`;
    row.insertAdjacentElement("afterend", tools);
    tools.querySelector("[data-ad-library]").addEventListener("click", async () => {
      const button = tools.querySelector("[data-ad-library]");
      const stateEl = input.closest(".ads-field")?.querySelector(".upload-state") || tools.querySelector("small");
      button.disabled = true;
      stateEl.textContent = "Abrindo biblioteca…";
      try {
        await openLibraryPicker({
          folder,
          preset,
          onSelect: url => {
            input.value = url;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
            updateCreativePreview();
          }
        });
        stateEl.textContent = input.value ? "Imagem da biblioteca selecionada." : "Seleção cancelada.";
      } catch (error) {
        stateEl.textContent = errorMessage(error);
        toast(errorMessage(error), "error");
      } finally {
        button.disabled = false;
      }
    });
  });
}

function updateCreativePreview() {
  const form=$("#campaign-form"),preview=$("#campaign-preview");
  if(!form||!preview)return;
  const selected=form.elements.formato?.value||"automatico";
  const device=preview.dataset.device||"desktop";
  const desktop=safePreviewUrl(form.elements.imagem_url?.value);
  const mobile=safePreviewUrl(form.elements.imagem_mobile_url?.value);
  const source=device==="mobile"&&mobile?mobile:desktop;
  const logo=safePreviewUrl(form.elements.logo_empresa_url?.value);
  const video=safePreviewUrl(form.elements.video_url?.value);
  const type=form.elements.tipo?.value||"banner";
  const title=form.elements.titulo_publico?.value||form.elements.empresa_anunciante?.value||"Título do anúncio";
  const text=form.elements.texto_publico?.value||"A descrição opcional aparece nos anúncios nativos.";
  const button=form.elements.texto_botao?.value||"Saiba mais";
  preview.className=`campaign-preview preview-${selected}`;
  const youtubeUrl=youtubePreview(video);
  const media=type==="video"&&youtubeUrl
    ? `<iframe src="${escapeHtml(youtubeUrl)}" title="Prévia do vídeo"></iframe>`
    : type==="video"&&video
      ? `<video src="${escapeHtml(video)}" controls muted playsinline></video>`
      : source
        ? `<img src="${escapeHtml(source)}" alt="">`
        : selected==="nativo"
          ? `<div class="preview-native-placeholder">${logo?`<img src="${escapeHtml(logo)}" alt="">`:`<strong>${escapeHtml(form.elements.empresa_anunciante?.value||"Sua empresa")}</strong>`}</div>`
          : "";
  preview.innerHTML=media?`<div class="preview-creative"><span>Publicidade</span>${media}${logo&&source?`<img class="preview-logo" src="${escapeHtml(logo)}" alt="">`:""}<div class="preview-copy"><strong>${escapeHtml(title)}</strong>${selected==="nativo"?`<p>${escapeHtml(text)}</p>`:""}<b>${escapeHtml(button)}</b></div></div>`:'<div class="preview-empty"><strong>O anúncio ainda não possui mídia.</strong><span>Adicione uma imagem, vídeo ou escolha o formato nativo com conteúdo.</span></div>';
  const help=formats[selected]?.[1]||formats.automatico[1];
  $("#format-help").textContent=help;
  $("#mobile-image-state").textContent=mobileRecommendations[selected]||mobileRecommendations.automatico;
  const spec=formatSpecs[selected]||formatSpecs.automatico;
  const guide=$("#format-size-guide");
  if(guide)guide.innerHTML=`<strong>${escapeHtml(spec.title)}</strong><span>${escapeHtml(spec.desktop)}</span><span>${escapeHtml(spec.mobile)}</span><small>${escapeHtml(spec.tip)}</small>`;
}

function safePreviewUrl(value) {
  return /^https?:\/\//i.test(value||"")||/^\/?assets\//.test(value||"")?value:"";
}

function youtubePreview(value) {
  const match=String(value||"").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
  return match?`https://www.youtube-nocookie.com/embed/${match[1]}`:"";
}

function formatName(campaign) {
  const key=campaign?.configuracao_futura?.formato||"automatico";
  return formats[key]?.[0]||formats.automatico[0];
}

function renderInventory(campaigns) {
  const target=$("#placement-inventory");if(!target)return;
  const counts={};
  campaigns.forEach(campaign=>(campaign.campanha_posicoes||[]).forEach(item=>{counts[item.posicao]=(counts[item.posicao]||0)+1}));
  const entries=Object.entries(positionRecommendations);
  target.innerHTML=entries.map(([position,recommendation])=>`<div class="placement-item ${counts[position]?"configured":""}"><span>${escapeHtml(position.replaceAll("_"," "))}</span><strong>${counts[position]||0}</strong><small>${escapeHtml(recommendation)}</small></div>`).join("");
}

function switchView(name) {
  ["dashboard","campaigns"].forEach(v=>$("#"+v+"-view").classList.toggle("hidden",v!==name));
  $("#form-view").classList.toggle("open",name==="form");
  document.querySelectorAll(".ads-tab").forEach(t=>t.classList.toggle("active",t.dataset.tab===name));
  if(name==="dashboard") loadDashboard();
  if(name==="campaigns") loadCampaigns();
}

async function loadDashboard() {
  $("#metrics").innerHTML=Array(6).fill('<div class="metric-card"><span>&nbsp;</span><div class="skeleton"></div></div>').join("");
  try {
    const [summary,daily,inventory]=await Promise.all([obterResumoPublicidade(),obterMetricasDiarias(30),listarCampanhas({pagina:1,porPagina:1000})]);
    state.summaries=new Map(summary.map(item=>[item.id,item]));
    const active=summary.filter(x=>x.situacao==="ativa").length;
    const ended=summary.filter(x=>x.situacao==="encerrada").length;
    const scheduled=summary.filter(x=>x.situacao==="agendada").length;
    const impressions=summary.reduce((a,x)=>a+Number(x.impressoes||0),0);
    const clicks=summary.reduce((a,x)=>a+Number(x.cliques||0),0);
    const ctr=impressions ? clicks*100/impressions : 0;
    const cards=[["Campanhas ativas",active],["Agendadas",scheduled],["Encerradas",ended],["Impressões",fmtNumber(impressions)],["Cliques",fmtNumber(clicks)],["CTR geral",ctr.toFixed(2)+"%"]];
    $("#metrics").innerHTML=cards.map(([label,value])=>`<div class="metric-card"><span>${label}</span><strong>${value}</strong></div>`).join("");
    $("#campaign-summary").innerHTML=summary.length ? `<p><strong>${summary.length}</strong> campanhas cadastradas</p><p><strong>${active}</strong> entregando anúncios agora</p><p><strong>${scheduled}</strong> programadas para começar</p>` : '<div class="empty-state"><strong>Nenhuma campanha ainda</strong>Crie a primeira campanha para começar.</div>';
    renderChart(daily);
    renderInventory(inventory.itens);
  } catch(error) { $("#metrics").innerHTML=`<div class="ads-card" style="grid-column:1/-1">${escapeHtml(errorMessage(error))}</div>`; $("#performance-chart").innerHTML=""; }
}

function renderChart(rows) {
  const grouped={}; rows.forEach(r=>{ grouped[r.dia]??={impressions:0,clicks:0}; grouped[r.dia].impressions+=Number(r.impressoes); grouped[r.dia].clicks+=Number(r.cliques); });
  const days=Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-13+i);return d.toISOString().slice(0,10)});
  const max=Math.max(1,...days.map(d=>grouped[d]?.impressions||0));
  $("#performance-chart").innerHTML=days.map((day,i)=>{const x=grouped[day]||{impressions:0,clicks:0};return `<div class="chart-day" title="${fmtNumber(x.impressions)} impressões · ${fmtNumber(x.clicks)} cliques"><i class="chart-bar" style="height:${Math.max(2,x.impressions/max*100)}%"></i><i class="chart-bar clicks" style="height:${Math.max(2,x.clicks/max*100)}%"></i>${i%2===0?`<span class="chart-label">${day.slice(8)}</span>`:""}</div>`}).join("");
}

async function loadCampaigns() {
  $("#campaign-table").innerHTML='<tr><td colspan="8"><div class="skeleton"></div><div class="skeleton"></div></td></tr>';
  try {
    if(!state.summaries.size) { const summaries=await obterResumoPublicidade(); state.summaries=new Map(summaries.map(x=>[x.id,x])); }
    const result=await listarCampanhas({busca:$("#campaign-search").value.trim(),status:$("#status-filter").value,tipo:$("#type-filter").value,pagina:state.page,porPagina:state.perPage});
    state.total=result.total;
    $("#campaign-table").innerHTML=result.itens.length ? result.itens.map(c=>{const m=state.summaries.get(c.id)||{};const situation=m.situacao||c.status;return `<tr><td><div class="campaign-name">${c.imagem_url?`<img class="campaign-thumb" src="${escapeHtml(c.imagem_url)}" alt="" loading="lazy">`:'<span class="campaign-thumb"></span>'}<div><strong>${escapeHtml(c.nome)}</strong><small>${escapeHtml(c.empresa_anunciante)}</small></div></div></td><td>${escapeHtml(c.tipo)}</td><td><span class="status-pill ${situation}">${escapeHtml(situation)}</span></td><td>${fmtDate(c.data_inicio)} — ${fmtDate(c.data_fim)}</td><td>${fmtNumber(m.impressoes)}</td><td>${fmtNumber(m.cliques)}</td><td>${Number(m.ctr||0).toFixed(2)}%</td><td><div class="ads-actions"><button class="icon-button" data-edit="${c.id}" title="Editar">Editar</button><button class="icon-button danger" data-delete="${c.id}" data-name="${escapeHtml(c.nome)}" title="Excluir">Excluir</button></div></td></tr>`}).join("") : '<tr><td colspan="8"><div class="empty-state"><strong>Nenhuma campanha encontrada</strong>Ajuste os filtros ou crie uma nova campanha.</div></td></tr>';
    result.itens.forEach((campaign,index)=>{const cell=$("#campaign-table")?.rows[index]?.cells[1];if(cell){const selected=formatName(campaign);cell.innerHTML=`<span class="campaign-type">${escapeHtml(campaign.tipo)}</span><small class="campaign-format">${escapeHtml(selected)}</small>`}});
    const from=state.total?(state.page-1)*state.perPage+1:0, to=Math.min(state.page*state.perPage,state.total);
    $("#pagination-info").textContent=`Mostrando ${from}–${to} de ${state.total}`;
    $("#prev-page").disabled=state.page<=1; $("#next-page").disabled=to>=state.total;
  } catch(error) { $("#campaign-table").innerHTML=`<tr><td colspan="8"><div class="empty-state"><strong>Publicidade indisponível</strong>${escapeHtml(errorMessage(error))}</div></td></tr>`; }
}

function openForm(campaign=null) {
  const form=$("#campaign-form"); form.reset(); form.elements.id.value=""; form.elements.prioridade.value=0; form.elements.popup_atraso_seg.value=3; form.elements.abrir_nova_aba.checked=true; form.elements.popup_uma_vez.checked=true; form.elements.popup_botao_fechar.checked=true;
  state.currentConfig={};form.elements.formato.value="automatico";form.elements.rotacao_segundos.value=8;
  document.querySelectorAll('[name="posicoes"]').forEach(x=>x.checked=false);
  if(campaign) {
    Object.entries(campaign).forEach(([key,value])=>{const field=form.elements[key];if(!field||key==="campanha_posicoes")return;if(field.type==="checkbox")field.checked=Boolean(value);else if(field.type==="datetime-local")field.value=inputDate(value);else field.value=value??"";});
    state.currentConfig={...(campaign.configuracao_futura||{})};["formato","imagem_mobile_url","titulo_publico","texto_publico","rotacao_segundos"].forEach(key=>{if(form.elements[key])form.elements[key].value=state.currentConfig[key]??(key==="formato"?"automatico":key==="rotacao_segundos"?8:"")});
    (campaign.campanha_posicoes||[]).forEach(x=>{const field=form.querySelector(`[name="posicoes"][value="${x.posicao}"]`);if(field)field.checked=true;});
  }
  syncPositionCards();togglePopup();updateCreativePreview(); switchView("form"); window.scrollTo({top:0,behavior:"smooth"});
}

function togglePopup() { $("#popup-options").classList.toggle("visible",$("#tipo").value==="popup"); }

async function handleSave(event) {
  event.preventDefault(); const form=event.currentTarget; const button=$("#save-campaign"); button.disabled=true; button.textContent="Salvando…";
  try {
    const fd=new FormData(form); const campaign={}; ["id","nome","empresa_anunciante","tipo","status","logo_empresa_url","imagem_url","video_url","link_destino","texto_botao"].forEach(k=>campaign[k]=fd.get(k)||null);
    if(!campaign.id) delete campaign.id;
    campaign.abrir_nova_aba=fd.has("abrir_nova_aba"); campaign.prioridade=Number(fd.get("prioridade")||0); campaign.data_inicio=fd.get("data_inicio")?new Date(fd.get("data_inicio")).toISOString():null; campaign.data_fim=fd.get("data_fim")?new Date(fd.get("data_fim")).toISOString():null; campaign.popup_uma_vez=fd.has("popup_uma_vez"); campaign.popup_botao_fechar=fd.has("popup_botao_fechar"); campaign.popup_reexibir=fd.get("popup_reexibir")||"24h"; campaign.popup_atraso_seg=Number(fd.get("popup_atraso_seg")||3);
    campaign.configuracao_futura={...state.currentConfig,formato:fd.get("formato")||"automatico",imagem_mobile_url:fd.get("imagem_mobile_url")||null,titulo_publico:fd.get("titulo_publico")||null,texto_publico:fd.get("texto_publico")||null,rotacao_segundos:Math.max(5,Math.min(30,Number(fd.get("rotacao_segundos"))||8))};
    const nativeContent=campaign.configuracao_futura.formato==="nativo"&&(campaign.configuracao_futura.titulo_publico||campaign.configuracao_futura.texto_publico);
    if(campaign.status!=="rascunho"&&!campaign.imagem_url&&!campaign.video_url&&!nativeContent) throw new Error("Adicione uma imagem, vídeo ou conteúdo nativo antes de ativar a campanha.");
    if(campaign.data_inicio&&campaign.data_fim&&campaign.data_fim<campaign.data_inicio) throw new Error("A data final deve ser posterior à data inicial.");
    const selected=[...form.querySelectorAll('[name="posicoes"]:checked')].map(x=>x.value); if(!selected.length&&campaign.tipo!=="popup") throw new Error("Escolha ao menos um local de exibição.");
    await salvarCampanha(campaign,selected); state.summaries.clear(); toast("Campanha salva com sucesso."); switchView("campaigns");
  } catch(error) { toast(errorMessage(error),"error"); }
  finally { button.disabled=false; button.textContent="Salvar campanha"; }
}

async function upload(input,target,stateEl) {
  const file=input.files?.[0]; if(!file)return; stateEl.textContent="Enviando arquivo…"; input.disabled=true;
  try {
    if(file.type.startsWith("video/")){
      target.value=await uploadMidia(file,"videos");
    } else {
      const folder = target.id === "logo_empresa_url" ? "publicidade/logos" : target.id === "imagem_mobile_url" ? "publicidade/mobile" : "publicidade/campanhas";
      const preset = target.id === "logo_empresa_url" ? "square" : "card";
      const result = await processAndUpload(file, folder, preset);
      if(!result){stateEl.textContent="Envio cancelado.";return}
      target.value=result.url;
    }
    stateEl.textContent="Arquivo enviado com sucesso na biblioteca.";
    toast("Mídia enviada.");
    updateCreativePreview();
  }
  catch(error){stateEl.textContent=errorMessage(error);toast(errorMessage(error),"error");}
  finally{input.disabled=false;input.value="";}
}

function bindEvents() {
  $("#logout").addEventListener("click",sair); $("#mobile-menu").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
  document.querySelectorAll(".ads-tab").forEach(t=>t.addEventListener("click",()=>switchView(t.dataset.tab)));
  $("#new-campaign").addEventListener("click",()=>openForm()); $("#cancel-form").addEventListener("click",()=>switchView("campaigns")); $("#tipo").addEventListener("change",()=>{togglePopup();updateCreativePreview()}); $("#campaign-form").addEventListener("submit",handleSave);
  [["logo-upload","logo_empresa_url","logo-state"],["image-upload","imagem_url","image-state"],["mobile-image-upload","imagem_mobile_url","mobile-image-state"],["video-upload","video_url","video-state"]].forEach(([a,b,c])=>$("#"+a).addEventListener("change",e=>upload(e.target,$("#"+b),$("#"+c))));
  $("#campaign-form").addEventListener("input",event=>{if(["formato","tipo","imagem_url","imagem_mobile_url","video_url","logo_empresa_url","titulo_publico","texto_publico","texto_botao","empresa_anunciante"].includes(event.target.name))updateCreativePreview()});
  $("#positions").addEventListener("change",event=>{if(event.target.matches('[name="posicoes"]'))syncPositionCards()});
  document.querySelectorAll("[data-preview-device]").forEach(button=>button.addEventListener("click",()=>{document.querySelectorAll("[data-preview-device]").forEach(item=>{const active=item===button;item.classList.toggle("active",active);item.setAttribute("aria-pressed",String(active))});$("#campaign-preview").dataset.device=button.dataset.previewDevice;updateCreativePreview()}));
  $("#campaign-search").addEventListener("input",()=>{clearTimeout(state.timer);state.timer=setTimeout(()=>{state.page=1;loadCampaigns()},350)}); ["status-filter","type-filter"].forEach(id=>$("#"+id).addEventListener("change",()=>{state.page=1;loadCampaigns()}));
  $("#clear-filters").addEventListener("click",()=>{$("#campaign-search").value="";$("#status-filter").value="";$("#type-filter").value="";state.page=1;loadCampaigns()});
  $("#prev-page").addEventListener("click",()=>{if(state.page>1){state.page--;loadCampaigns()}}); $("#next-page").addEventListener("click",()=>{if(state.page*state.perPage<state.total){state.page++;loadCampaigns()}});
  $("#campaign-table").addEventListener("click",async e=>{const edit=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete]"); if(edit){try{openForm(await buscarCampanha(edit.dataset.edit))}catch(error){toast(errorMessage(error),"error")}} if(del&&confirm(`Excluir a campanha “${del.dataset.name}”? Esta ação não pode ser desfeita.`)){try{await excluirCampanha(del.dataset.delete);state.summaries.clear();toast("Campanha excluída.");loadCampaigns()}catch(error){toast(errorMessage(error),"error")}}});
}

async function init() {
  const auth=await exigirAdministrador(); if(!auth)return; $("#admin-user").textContent=auth.admin?.nome||auth.user.email; enhanceCreativeForm();renderPositions(); bindEvents(); loadDashboard();
}
init();
