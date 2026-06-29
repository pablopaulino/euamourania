const viewModules={dashboard:"dashboard",noticias:"noticias",guia_comercial:"guia_comercial",turismo:"turismo",links:"links",eventos:"eventos",categorias:"categorias",insights:"insights",configuracoes_site:"configuracoes"};
function navModule(button){
  if(button.dataset.module)return button.dataset.module;
  if(button.dataset.view)return viewModules[button.dataset.view];
  const target=button.getAttribute("onclick")||"";
  if(target.includes("publicidade.html"))return"publicidade";
  if(target.includes("comunicacao.html"))return"comunicacao";
  if(target.includes("usuarios.html"))return"usuarios";
  if(target.includes("migrar.html"))return"importacao";
  const hash=target.match(/#([a-z_]+)/)?.[1];return hash?viewModules[hash]:target.includes("index.html")?"dashboard":null;
}
function mainAction(button){
  const view=location.hash.slice(1)||"dashboard",module=viewModules[view]||view;
  if(button.hasAttribute("data-news-new"))return["noticias","criar"];
  if(button.dataset.newsEdit)return["noticias","editar"];
  if(button.dataset.newsFeature||button.dataset.saveStatus==="publicado")return["noticias","publicar"];
  if(button.dataset.catEdit)return["categorias","editar"];
  if(button.hasAttribute("data-cat-new"))return["categorias","criar"];
  if(button.dataset.catDelete)return["categorias","excluir"];
  if(button.dataset.new)return[viewModules[button.dataset.new]||button.dataset.new,"criar"];
  if(button.dataset.edit)return[module,"editar"];
  if(button.dataset.delete||button.dataset.genericDelete)return[module,"excluir"];
  return null;
}
export function aplicarControleAcesso(access,can){
  if(!access?.admin)return;
  const role=access.admin.funcao;
  document.documentElement.dataset.adminRole=role;
  const allowed=(module,action="acessar")=>can(access.admin,module,action);
  const apply=()=>{
    document.querySelectorAll(".admin-nav button").forEach(button=>{const module=navModule(button);if(module)button.hidden=!allowed(module)});
    const path=location.pathname;
    if(path.endsWith("/admin/index.html")||path.endsWith("/admin/")||path.endsWith("/admin")){
      document.querySelectorAll("button").forEach(button=>{const action=mainAction(button);if(action&&!allowed(...action))button.hidden=true});
    }
    if(path.endsWith("publicidade.html")){
      document.querySelectorAll("#new-campaign").forEach(x=>x.hidden=!allowed("publicidade","criar"));
      document.querySelectorAll("[data-edit]").forEach(x=>x.hidden=!allowed("publicidade","editar"));
      document.querySelectorAll("[data-delete]").forEach(x=>x.hidden=!allowed("publicidade","excluir"));
    }
    if(path.endsWith("comunicacao.html")){
      const manageSubscribers=["super_admin","administrador"].includes(role);
      document.querySelectorAll("#add-subscriber,[data-sub-edit],[data-sub-delete]").forEach(x=>x.hidden=!manageSubscribers);
      document.querySelectorAll("#new-newsletter,#add-news").forEach(x=>x.hidden=!allowed("comunicacao","criar"));
      document.querySelectorAll("[data-news-edit]").forEach(x=>x.hidden=!allowed("comunicacao","editar"));
      document.querySelectorAll("[data-news-test],[data-news-send]").forEach(x=>x.hidden=!allowed("comunicacao","enviar"));
      document.querySelectorAll("[data-news-delete]").forEach(x=>x.hidden=!allowed("comunicacao","excluir"));
      document.querySelectorAll("[data-news-copy]").forEach(x=>x.hidden=!allowed("comunicacao","criar"));
    }
  };
  apply();
  new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});
  document.addEventListener("click",event=>{
    const button=event.target.closest("button");if(!button)return;
    const module=button.closest(".admin-nav")?navModule(button):null,action=mainAction(button);
    if((module&&!allowed(module))||(action&&!allowed(...action))){event.preventDefault();event.stopImmediatePropagation()}
  },true);
}
