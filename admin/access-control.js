import { adminModuleFromLocation, adminPathForModule } from "./admin-routes.js";

const viewModules={dashboard:"dashboard",noticias:"noticias",colaboradores_voluntarios:"colaboradores",guia_comercial:"guia_comercial",turismo:"turismo",links:"links",eventos:"eventos",eventos_principais:"eventos",eventos_edicoes:"eventos",categorias:"categorias",insights:"insights",audiencia:"insights",configuracoes_site:"configuracoes",comunicacao:"comunicacao",notificacoes:"notificacoes",submissoes:"submissoes"};
const navItems=[
  ["dashboard","Visão geral","dashboard"],
  ["noticias","Notícias","noticias"],
  ["aprovacoes","Aprovações","noticias"],
  ["colaboradores_voluntarios","Colaborações","colaboradores"],
  ["guia_comercial","Guia comercial","guia_comercial"],
  ["turismo","Turismo","turismo"],
  ["links","Links","links"],
  ["submissoes","Submissões públicas","submissoes"],
  ["eventos","Agenda simples","eventos"],
  ["eventos_principais","Eventos principais","eventos"],
  ["eventos_edicoes","Edições","eventos"],
  ["publicidade","Publicidade","publicidade"],
  ["comunicacao","Comunicação","comunicacao"],
  ["notificacoes","Notificações do app","notificacoes"],
  ["melhores","Melhores de Ur�nia","melhores"],
  ["categorias","Categorias","categorias"],
  ["audiencia","Audiência","insights"],
  ["configuracoes_site","Configurações","configuracoes"],
  ["usuarios","Usuários administrativos","usuarios"],
  ["importacao","Migrar conteúdo antigo","importacao"]
];
const eventosEdicoesNav = navItems.find(item => item[0] === "eventos_edicoes");
if (eventosEdicoesNav) eventosEdicoesNav[1] = "Edições";
function currentAdminKey(){
  const routed=adminModuleFromLocation();
  if(routed)return routed;
  const page=location.pathname.split("/").pop()||"index.html";
  if(page==="publicidade.html")return"publicidade";
  if(page==="comunicacao.html")return"comunicacao";
  if(page==="notificacoes-app.html")return"notificacoes";
  if(page==="melhores.html")return"melhores";
  if(page==="submissoes.html")return"submissoes";
  if(page==="usuarios.html")return"usuarios";
  if(page==="migrar.html")return"importacao";
  const hash=location.hash.slice(1);
  if(hash==="aprovacoes")return"aprovacoes";
  if(hash==="audiencia")return"audiencia";
  return hash||"dashboard";
}
function buttonForNav([key,label,module],isIndex,current){
  const attrs=[`type="button"`,`data-module="${module}"`];
  if(current===key)attrs.push('class="active"');
  if(isIndex){
    if(["dashboard","noticias","colaboradores_voluntarios","guia_comercial","turismo","links","eventos","eventos_principais","eventos_edicoes","categorias","configuracoes_site","comunicacao","notificacoes","submissoes"].includes(key))attrs.push(`data-view="${key}"`);
    else if(key==="aprovacoes")attrs.push('id="editorial-approvals-nav"');
    else if(key==="audiencia")attrs.push('id="audience-nav"');
    else attrs.push(`onclick="location.href='${adminPathForModule(key)}'"`);
  }else{
    const href=adminPathForModule(key);
    attrs.push(`onclick="location.href='${href}'"`);
  }
  return `<button ${attrs.join(" ")}>${label}</button>`;
}
function normalizeAdminNavigation(){
  const nav=document.querySelector(".admin-nav");
  if(!nav||nav.dataset.fixed==="1")return;
  const page=location.pathname.split("/").pop()||"index.html";
  const current=currentAdminKey();
  const shellViews=["dashboard","noticias","aprovacoes","colaboradores_voluntarios","guia_comercial","turismo","links","eventos","eventos_principais","eventos_edicoes","categorias","audiencia","insights","configuracoes_site","midia","banners","comunicacao","notificacoes","submissoes","publicidade"];
  const isIndex=page==="index.html"||page===""||location.pathname.endsWith("/admin/")||shellViews.includes(current);
  nav.innerHTML=navItems.map(item=>buttonForNav(item,isIndex,current)).join("");
  nav.dataset.fixed="1";
}
function navModule(button){
  if(button.dataset.module)return button.dataset.module;
  if(button.dataset.view)return viewModules[button.dataset.view];
  const target=button.getAttribute("onclick")||"";
  if(target.includes("publicidade.html"))return"publicidade";
  if(target.includes("comunicacao.html"))return"comunicacao";
  if(target.includes("melhores.html"))return"melhores";
  if(target.includes("submissoes.html"))return"submissoes";
  if(target.includes("usuarios.html"))return"usuarios";
  if(target.includes("migrar.html"))return"importacao";
  const hash=target.match(/#([a-z_]+)/)?.[1];return hash?viewModules[hash]:target.includes("index.html")?"dashboard":null;
}
function mainAction(button){
  const view=adminModuleFromLocation()||location.hash.slice(1)||"dashboard",module=viewModules[view]||view;
  if(button.hasAttribute("data-news-new"))return["noticias","criar"];
  if(button.dataset.newsEdit)return["noticias","editar"];
  if(button.dataset.sendApproval)return["noticias","editar"];
  if(button.dataset.approvalReview||button.dataset.requestChanges||button.dataset.approveNews||button.dataset.publishNews)return["noticias","publicar"];
  if(button.dataset.newsFeature||button.dataset.saveStatus==="publicado")return["noticias","publicar"];
  if(button.dataset.catEdit)return["categorias","editar"];
  if(button.hasAttribute("data-cat-new"))return["categorias","criar"];
  if(button.dataset.catDelete)return["categorias","excluir"];
  if(button.dataset.new)return[viewModules[button.dataset.new]||button.dataset.new,"criar"];
  if(button.dataset.edit)return[module,"editar"];
  if(button.dataset.delete||button.dataset.genericDelete)return[module,"excluir"];
  return null;
}
function pageAction(button){
  const path=location.pathname;
  if(path.endsWith("publicidade.html")){
    if(button.id==="new-campaign")return["publicidade","criar"];
    if(button.dataset.edit)return["publicidade","editar"];
    if(button.dataset.delete)return["publicidade","excluir"];
    return null;
  }
  if(path.endsWith("comunicacao.html")){
    if(["add-subscriber"].includes(button.id)||button.dataset.subEdit||button.dataset.subDelete)return["assinantes","gerenciar"];
    if(["new-newsletter","add-news","generate-monthly"].includes(button.id)||button.dataset.newsCopy||button.dataset.generateMonthly!==undefined)return["comunicacao","criar"];
    if(button.dataset.newsEdit)return["comunicacao","editar"];
    if(button.dataset.newsTest||button.dataset.newsSend)return["comunicacao","enviar"];
    if(button.dataset.newsDelete)return["comunicacao","excluir"];
    return null;
  }
  return mainAction(button);
}
export function aplicarControleAcesso(access,can){
  if(!access?.admin)return;
  normalizeAdminNavigation();
  const role=access.admin.funcao;
  document.documentElement.dataset.adminRole=role;
  const allowed=(module,action="acessar")=>module==="assinantes"&&action==="gerenciar"?["super_admin","administrador"].includes(role):can(access.admin,module,action);
  const requested=viewModules[adminModuleFromLocation()]||viewModules[location.hash.slice(1)];
  if(requested&&!allowed(requested)){history.replaceState(null,"",adminPathForModule("dashboard"))}
  const apply=()=>{
    document.querySelectorAll(".admin-nav button,.admin-nav a").forEach(button=>{const module=navModule(button);if(module)button.hidden=!allowed(module)});
    const path=location.pathname;
    if(path.endsWith("/admin/index.html")||path.endsWith("/admin/")||path.endsWith("/admin"))document.querySelectorAll("button").forEach(button=>{const action=mainAction(button);if(action&&!allowed(...action))button.hidden=true});
    if(path.endsWith("publicidade.html")){
      document.querySelectorAll("#new-campaign").forEach(x=>x.hidden=!allowed("publicidade","criar"));
      document.querySelectorAll("[data-edit]").forEach(x=>x.hidden=!allowed("publicidade","editar"));
      document.querySelectorAll("[data-delete]").forEach(x=>x.hidden=!allowed("publicidade","excluir"));
    }
    if(path.endsWith("comunicacao.html")){
      document.querySelectorAll("#add-subscriber,[data-sub-edit],[data-sub-delete]").forEach(x=>x.hidden=!allowed("assinantes","gerenciar"));
      document.querySelectorAll("#new-newsletter,#add-news,#generate-monthly,[data-generate-monthly]").forEach(x=>x.hidden=!allowed("comunicacao","criar"));
      document.querySelectorAll("[data-news-edit]").forEach(x=>x.hidden=!allowed("comunicacao","editar"));
      document.querySelectorAll("[data-news-test],[data-news-send]").forEach(x=>x.hidden=!allowed("comunicacao","enviar"));
      document.querySelectorAll("[data-news-delete]").forEach(x=>x.hidden=!allowed("comunicacao","excluir"));
      document.querySelectorAll("[data-news-copy]").forEach(x=>x.hidden=!allowed("comunicacao","criar"));
    }
  };
  apply();
  new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});
  document.addEventListener("click",event=>{const button=event.target.closest("button,.admin-nav a");if(!button)return;const module=button.closest(".admin-nav")?navModule(button):null,action=button.matches("button")?pageAction(button):null;if((module&&!allowed(module))||(action&&!allowed(...action))){event.preventDefault();event.stopImmediatePropagation()}},true);
}
