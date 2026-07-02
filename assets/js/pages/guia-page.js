import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";

const container=document.getElementById("guia-container");
const status=document.getElementById("guia-status");
const filters=document.getElementById("guia-filtros");
const loadMore=document.getElementById("guia-ver-mais");
const esc=(v="")=>String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const safeImage=v=>/^https?:\/\//i.test(v||"")||/^assets\//.test(v||"")?esc(v):"";
const placeholder='<div class="media-placeholder"><img src="assets/1505 - Urania - Logo Horizontal - 1.png" alt="Eu Amo Urânia"></div>';
const normalize=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const PAGE_SIZE=6;
let itens=[];
let itensFiltrados=[];
let quantidadeVisivel=PAGE_SIZE;

function renderizar(dados){
 itensFiltrados=dados;
 if(!dados.length){container.innerHTML="";status.hidden=false;status.textContent="Nenhum item cadastrado no guia.";loadMore.hidden=true;return}
 status.hidden=true;
 const visiveis=dados.slice(0,quantidadeVisivel);
 container.innerHTML=visiveis.map(item=>`<article class="card-guia" id="guia-${esc(item.id)}" data-guide-id="${item.id}">${item.recomendado?'<span class="badge-destaque">Recomendado</span>':""}<div class="card-media">${safeImage(item.imagem_url)?`<img src="${safeImage(item.imagem_url)}" class="card-img-top" alt="${esc(item.nome)}" loading="lazy">`:placeholder}</div><div class="card-body"><h2 class="card-title">${esc(item.nome)}</h2><p class="card-text">${esc(item.descricao)}</p><p class="card-address">${esc(item.endereco)}${item.horario?`<br>${esc(item.horario)}`:""}</p>${item.whatsapp?`<a href="https://wa.me/${String(item.whatsapp).replace(/\D/g,"")}" target="_blank" rel="noopener" class="btn-whatsapp">Chamar no WhatsApp</a>`:""}</div></article>`).join("");
 const restantes=Math.max(0,dados.length-visiveis.length);
 loadMore.hidden=restantes===0;
 loadMore.textContent=restantes?`Ver mais estabelecimentos (${restantes})`:"Ver mais estabelecimentos";
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
  quantidadeVisivel=PAGE_SIZE;
  renderizar(categoria?itens.filter(item=>item.categoria_nome===categoria):itens);
 });
}

loadMore.addEventListener("click",()=>{
 quantidadeVisivel+=PAGE_SIZE;
 renderizar(itensFiltrados);
 requestAnimationFrame(()=>container.children[Math.max(0,quantidadeVisivel-PAGE_SIZE)]?.scrollIntoView({behavior:"smooth",block:"nearest"}));
});

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
  itens=dados;renderizarFiltros(categorias);
  const termo=normalize(new URLSearchParams(location.search).get("busca"));
  const iniciais=termo?itens.filter(item=>normalize(`${item.nome} ${item.descricao||""} ${item.categoria_nome||""} ${item.endereco||""}`).includes(termo)):itens;
  const alvo=location.hash.startsWith("#guia-")?itens.findIndex(item=>`#guia-${item.id}`===location.hash):-1;
  quantidadeVisivel=alvo>=0?Math.max(PAGE_SIZE,alvo+1):PAGE_SIZE;
  renderizar(iniciais);
  if(location.hash.startsWith("#guia-"))requestAnimationFrame(()=>document.querySelector(location.hash)?.scrollIntoView({behavior:"smooth",block:"center"}));
 }catch(error){
  console.error(error);status.textContent="Não foi possível carregar o guia.";
 }
}
carregar();
