import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";

const container=document.getElementById("guia-container");
const status=document.getElementById("guia-status");
const filters=document.getElementById("guia-filtros");
const esc=(v="")=>String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const safeImage=v=>/^https?:\/\//i.test(v||"")||/^assets\//.test(v||"")?esc(v):"";
const placeholder='<div class="media-placeholder"><img src="assets/1505 - Urania - Logo Horizontal - 1.png" alt="Eu Amo Urânia"></div>';
let itens=[];

function renderizar(dados){
 if(!dados.length){container.innerHTML="";status.hidden=false;status.textContent="Nenhum item cadastrado no guia.";return}
 status.hidden=true;
 container.innerHTML=dados.map(item=>`<article class="card-guia" data-guide-id="${item.id}">${item.recomendado?'<span class="badge-destaque">Recomendado</span>':""}<div class="card-media">${safeImage(item.imagem_url)?`<img src="${safeImage(item.imagem_url)}" class="card-img-top" alt="${esc(item.nome)}" loading="lazy">`:placeholder}</div><div class="card-body"><h2 class="card-title">${esc(item.nome)}</h2><p class="card-text">${esc(item.descricao)}</p><p class="card-address">${esc(item.endereco)}${item.horario?`<br>${esc(item.horario)}`:""}</p>${item.whatsapp?`<a href="https://wa.me/${String(item.whatsapp).replace(/\D/g,"")}" target="_blank" rel="noopener" class="btn-whatsapp">Chamar no WhatsApp</a>`:""}</div></article>`).join("");
 container.querySelectorAll(".card-img-top").forEach(img=>img.addEventListener("error",()=>{img.parentElement.innerHTML=placeholder},{once:true}));
 document.dispatchEvent(new CustomEvent("guia:renderizado"));
}

function renderizarFiltros(categorias){
 const cadastradas=categorias.map(item=>item.nome);
 const extras=[...new Set(itens.map(item=>item.categoria_nome).filter(Boolean))]
  .filter(nome=>!cadastradas.includes(nome)).sort((a,b)=>a.localeCompare(b,"pt-BR"));
 const nomes=[...cadastradas,...extras];
 filters.innerHTML=`<button class="btn-filtro ativo" type="button" data-category="">Todos</button>${nomes.map(nome=>`<button class="btn-filtro" type="button" data-category="${esc(nome)}">${esc(nome)}</button>`).join("")}`;
 filters.addEventListener("click",event=>{
  const button=event.target.closest("[data-category]");if(!button)return;
  filters.querySelectorAll(".btn-filtro").forEach(item=>item.classList.toggle("ativo",item===button));
  const categoria=button.dataset.category;
  renderizar(categoria?itens.filter(item=>item.categoria_nome===categoria):itens);
 });
}

async function carregar(){
 if(!publicSupabaseConfigured()){status.textContent="Configure o Supabase para carregar o guia.";return}
 try{
  const [dados,categorias]=await Promise.all([
   fetchPublicRows("guia_comercial",{
    select:"id,nome,slug,categoria_nome,descricao,imagem_url,whatsapp,endereco,horario,recomendado",
    status:"eq.publicado",
    order:"recomendado.desc,nome.asc"
   }),
   fetchPublicRows("categorias",{
    select:"nome,ordem",
    tipo:"eq.guia",
    status:"eq.ativo",
    order:"ordem.asc,nome.asc"
   })
  ]);
  itens=dados;renderizarFiltros(categorias);renderizar(itens);
 }catch(error){
  console.error(error);status.textContent="Não foi possível carregar o guia.";
 }
}
carregar();
