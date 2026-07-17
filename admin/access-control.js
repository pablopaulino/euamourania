const viewModules={dashboard:"dashboard",noticias:"noticias",colaboradores_voluntarios:"colaboradores",guia_comercial:"guia_comercial",turismo:"turismo",links:"links",eventos:"eventos",categorias:"categorias",insights:"insights",configuracoes_site:"configuracoes"};
const navItems=[
  ["dashboard","Visão geral","dashboard"],
  ["noticias","Notícias","noticias"],
  ["aprovacoes","Aprovações","noticias"],
  ["colaboradores_voluntarios","Colaborações","colaboradores"],
  ["guia_comercial","Guia comercial","guia_comercial"],
  ["turismo","Turismo","turismo"],
  ["links","Links","links"],
  ["eventos","Eventos","eventos"],
  ["publicidade","Publicidade","publicidade"],
  ["comunicacao","Comunicação","comunicacao"],
  ["notificacoes","Notificações do app","notificacoes"],
  ["melhores","Melhores de Urânia","melhores"],
  ["categorias","Categorias","categorias"],
  ["audiencia","Audiência","insights"],
  ["configuracoes_site","Configurações","configuracoes"],
  ["usuarios","Usuários","usuarios"],
  ["importacao","Importar JSON","importacao"]
];
function currentAdminKey(){
  const page=location.pathname.split("/").pop()||"index.html";
  if(page==="publicidade.html")return"publicidade";
  if(page==="comunicacao.html")return"comunicacao";
  if(page==="notificacoes-app.html")return"notificacoes";
  if(page==="melhores.html")return"melhores";
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
    if(["dashboard","noticias","colaboradores_voluntarios","guia_comercial","turismo","links","eventos","categorias","configuracoes_site"].includes(key))attrs.push(`data-view="${key}"`);
    else if(key==="aprovacoes")attrs.push('id="editorial-approvals-nav"');
    else if(key==="audiencia")attrs.push('id="audience-nav"');
    else if(key==="publicidade")attrs.push(`onclick="location.href='publicidade.html'"`);
    else if(key==="comunicacao")attrs.push(`onclick="location.href='comunicacao.html'"`);
    else if(key==="notificacoes")attrs.push(`onclick="location.href='notificacoes-app.html'"`);
    else if(key==="melhores")attrs.push(`onclick="location.href='melhores.html'"`);
    else if(key==="usuarios")attrs.push(`onclick="location.href='usuarios.html'"`);
    else if(key==="importacao")attrs.push(`onclick="location.href='migrar.html'"`);
  }else{
    const href={
      dashboard:"index.html",
      noticias:"index.html#noticias",
      aprovacoes:"index.html#aprovacoes",
      colaboradores_voluntarios:"index.html#colaboradores_voluntarios",
      guia_comercial:"index.html#guia_comercial",
      turismo:"index.html#turismo",
      links:"index.html#links",
      eventos:"index.html#eventos",
      publicidade:"publicidade.html",
      comunicacao:"comunicacao.html",
      notificacoes:"notificacoes-app.html",
      melhores:"melhores.html",
      categorias:"index.html#categorias",
      audiencia:"index.html#audiencia",
      configuracoes_site:"index.html#configuracoes_site",
      usuarios:"usuarios.html",
      importacao:"migrar.html"
    }[key]||"index.html";
    attrs.push(`onclick="location.href='${href}'"`);
  }
  return `<button ${attrs.join(" ")}>${label}</button>`;
}
function normalizeAdminNavigation(){
  const nav=document.querySelector(".admin-nav");
  if(!nav||nav.dataset.fixed==="1")return;
  const page=location.pathname.split("/").pop()||"index.html";
  const isIndex=page==="index.html"||page===""||location.pathname.endsWith("/admin/");
  nav.innerHTML=navItems.map(item=>buttonForNav(item,isIndex,currentAdminKey())).join("");
  nav.dataset.fixed="1";
}
function navModule(button){
  if(button.dataset.module)return button.dataset.module;
  if(button.dataset.view)return viewModules[button.dataset.view];
  const target=button.getAttribute("onclick")||"";
  if(target.includes("publicidade.html"))return"publicidade";
  if(target.includes("comunicacao.html"))return"comunicacao";
  if(target.includes("melhores.html"))return"melhores";
  if(target.includes("usuarios.html"))return"usuarios";
  if(target.includes("migrar.html"))return"importacao";
  const hash=target.match(/#([a-z_]+)/)?.[1];return hash?viewModules[hash]:target.includes("index.html")?"dashboard":null;
}
function mainAction(button){
  const view=location.hash.slice(1)||"dashboard",module=viewModules[view]||view;
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
  const requested=viewModules[location.hash.slice(1)];
  if(requested&&!allowed(requested)){history.replaceState(null,"",`${location.pathname}#dashboard`)}
  const apply=()=>{
    document.querySelectorAll(".admin-nav button").forEach(button=>{const module=navModule(button);if(module)button.hidden=!allowed(module)});
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
  document.addEventListener("click",event=>{const button=event.target.closest("button");if(!button)return;const module=button.closest(".admin-nav")?navModule(button):null,action=pageAction(button);if((module&&!allowed(module))||(action&&!allowed(...action))){event.preventDefault();event.stopImmediatePropagation()}},true);
}
