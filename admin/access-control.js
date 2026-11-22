import { adminModuleFromLocation } from "./admin-routes.js";
import { getAdminModule } from "./admin-modules.js";

function mainAction(button){
  const view=adminModuleFromLocation()||location.hash.slice(1)||"dashboard",module=getAdminModule(view).permission||view;
  if(button.hasAttribute("data-news-new"))return["noticias","criar"];
  if(button.dataset.newsEdit)return["noticias","editar"];
  if(button.dataset.sendApproval)return["noticias","editar"];
  if(button.dataset.approvalReview||button.dataset.requestChanges||button.dataset.approveNews||button.dataset.publishNews)return["noticias","publicar"];
  if(button.dataset.newsFeature||button.dataset.saveStatus==="publicado")return["noticias","publicar"];
  if(button.dataset.catEdit)return["categorias","editar"];
  if(button.hasAttribute("data-cat-new"))return["categorias","criar"];
  if(button.dataset.catDelete)return["categorias","excluir"];
  if(button.dataset.new)return[getAdminModule(button.dataset.new).permission||button.dataset.new,"criar"];
  if(button.dataset.edit)return[module,"editar"];
  if(button.dataset.delete||button.dataset.genericDelete)return[module,"excluir"];
  return null;
}
function pageAction(button){
  const view=adminModuleFromLocation();
  if(view==="natal_premiado" && button.dataset.new)return["configuracoes","criar"];
  if(view==="publicidade"){
    if(button.id==="new-campaign")return["publicidade","criar"];
    if(button.dataset.edit)return["publicidade","editar"];
    if(button.dataset.delete)return["publicidade","excluir"];
    return null;
  }
  if(["comunicacao","assinantes","newsletters"].includes(view)){
    if(["add-subscriber"].includes(button.id)||button.dataset.subEdit||button.dataset.subDelete)return["assinantes","gerenciar"];
    if(["new-newsletter","add-news","generate-monthly"].includes(button.id)||button.dataset.newsCopy||button.hasAttribute("data-generate-monthly"))return["comunicacao","criar"];
    if(button.dataset.newsEdit)return["comunicacao","editar"];
    if(button.dataset.newsTest||button.dataset.newsSend)return["comunicacao","enviar"];
    if(button.dataset.newsDelete)return["comunicacao","excluir"];
    return null;
  }
  return mainAction(button);
}

export function aplicarControleAcesso(access, can) {
  const role = access.admin.funcao;
  document.documentElement.dataset.adminRole = role;
  const allowed = (module, action) => module === "assinantes" && action === "gerenciar"
    ? ["super_admin", "administrador"].includes(role)
    : can(access.admin, module, action);
  function protect(button) {
    const action = pageAction(button);
    if (!action || allowed(...action)) return true;
    button.hidden = true;
    return false;
  }
  const observer = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node.nodeType !== 1) continue;
      if (node.matches("button")) protect(node);
      node.querySelectorAll("button").forEach(protect);
    }
  });
  observer.observe(document.querySelector(".admin-main"), {childList: true, subtree: true});
  document.querySelector(".admin-main").addEventListener("click", event => {
    const button = event.target.closest("button");
    if (button && !protect(button)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}
