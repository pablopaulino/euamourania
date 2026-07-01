import { getSupabase } from "../assets/js/services/supabaseClient.js";

const db=getSupabase();
const originalFrom=db.from.bind(db);
const types={guia_comercial:"guia",turismo:"turismo",eventos:"eventos"};
const app=document.getElementById("app-content");
let currentTable=null;
let currentId=null;
let pendingCategory=null;

db.from=function(table){
 const builder=originalFrom(table);
 if(!types[table])return builder;
 for(const method of ["insert","update"]){
  const original=builder[method].bind(builder);
  builder[method]=function(values,...args){
   if(pendingCategory?.table===table&&values){
    const selected=pendingCategory;
    pendingCategory=null;
    return original({...values,categoria_id:selected.id,categoria_nome:selected.nome},...args);
   }
   return original(values,...args);
  };
 }
 return builder;
};

document.addEventListener("click",event=>{
 const button=event.target.closest("button");
 if(!button)return;
 if(button.dataset.new&&types[button.dataset.new]){
  currentTable=button.dataset.new;currentId=null;
 }
 if(button.dataset.edit&&types[button.dataset.edit]){
  currentTable=button.dataset.edit;currentId=button.dataset.id||null;
 }
},true);

document.addEventListener("submit",event=>{
 if(event.target.id!=="resource-form"||!types[currentTable])return;
 const select=event.target.elements.cms_categoria_id;
 const option=select?.selectedOptions?.[0];
 pendingCategory={
  table:currentTable,
  id:select?.value||null,
  nome:select?.value?option?.textContent?.trim()||null:null
 };
},true);

const escapeHtml=value=>String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));

async function enhanceCategoryField(form){
 if(form.dataset.categoryField||!types[currentTable])return;
 form.dataset.categoryField="loading";
 const [{data:categories,error},record]=await Promise.all([
  originalFrom("categorias").select("id,nome").eq("tipo",types[currentTable]).eq("status","ativo").order("ordem").order("nome"),
  currentId?originalFrom(currentTable).select("categoria_id").eq("id",currentId).maybeSingle():Promise.resolve({data:null})
 ]);
 if(error){console.error("Categorias:",error);form.dataset.categoryField="error";return}
 const selected=record.data?.categoria_id||"";
 const field=document.createElement("label");
 field.innerHTML=`Categoria<select name="cms_categoria_id"><option value="">Sem categoria</option>${(categories||[]).map(item=>`<option value="${item.id}" ${item.id===selected?"selected":""}>${escapeHtml(item.nome)}</option>`).join("")}</select><small>O menor número em “Ordem” aparece primeiro nos filtros públicos.</small>`;
 const legacy=form.querySelector('[name="categoria_nome"]')?.closest("label");
 if(legacy)legacy.replaceWith(field);
 else{
  const description=form.querySelector('[name="descricao"]')?.closest("label");
  form.insertBefore(field,description||form.querySelector(".form-actions"));
 }
 form.dataset.categoryField="ready";
}

const observer=new MutationObserver(()=>{
 const form=document.getElementById("resource-form");
 if(form)enhanceCategoryField(form);
 const categoryForm=document.getElementById("category-form");
 const orderInput=categoryForm?.elements.ordem;
 if(orderInput&&!categoryForm.dataset.orderHelp){
  categoryForm.dataset.orderHelp="true";
  orderInput.insertAdjacentHTML("afterend","<small>Menor número = aparece primeiro. Você pode usar 0, 10, 20 para facilitar futuras mudanças.</small>");
 }
 const categoryIntro=document.querySelector("#cat-rows")?.closest(".panel")?.querySelector(".cms-section-head p");
 if(categoryIntro&&!categoryIntro.dataset.orderHelp){
  categoryIntro.dataset.orderHelp="true";
  categoryIntro.append(" A ordem usa números: o menor aparece primeiro nos filtros públicos.");
 }
});
observer.observe(app,{childList:true,subtree:true});
