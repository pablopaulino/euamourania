const viewModules={dashboard:"dashboard",noticias:"noticias",guia_comercial:"guia_comercial",turismo:"turismo",links:"links",eventos:"eventos",categorias:"categorias",insights:"insights",configuracoes_site:"configuracoes"};
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
    if(["new-newsletter","add-news"].includes(button.id)||button.dataset.newsCopy)return["comunicacao","criar"];
    if(button.dataset.newsEdit)return["comunicacao","editar"];
    if(button.dataset.newsTest||button.dataset.newsSend)return["comunicacao","enviar"];
    if(button.dataset.newsDelete)return["comunicacao","excluir"];
    return null;
  }
  return mainAction(button);
}
export function aplicarControleAcesso(access,can){
  if(!access?.admin)return;
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
      document.querySelectorAll("#new-newsletter,#add-news").forEach(x=>x.hidden=!allowed("comunicacao","criar"));
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
