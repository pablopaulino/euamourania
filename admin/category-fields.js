import { getSupabase } from "../assets/js/services/supabaseClient.js";

const db=getSupabase();
const types={
 guia_comercial:{tipo:"guia",idField:"categoria_id",nameField:"categoria_nome"},
 turismo:{tipo:"turismo",idField:"categoria_id",nameField:"categoria_nome"},
 eventos:{tipo:"eventos",idField:"categoria_id",nameField:"categoria_nome"},
 eventos_principais:{tipo:"eventos",idField:null,nameField:"categoria"}
};
export function categoryValues(form) {
 const config=types[form.dataset.resourceTable];
 const select=form.elements.cms_categoria_id;
 if(!config || !select)return {};
 const values = { [config.nameField]: select.value ? select.selectedOptions[0].textContent.trim() : null };
 if(config.idField) values[config.idField] = select.value || null;
 return values;
}

const escapeHtml=value=>String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));

export async function enhanceCategoryField(form, row){
 const table=form.dataset.resourceTable;
 if(form.dataset.categoryField||!types[table])return;
 form.dataset.categoryField="loading";
 const config=types[table];
 const {data:categories,error} = await db.from("categorias").select("id,nome").eq("tipo",config.tipo).eq("status","ativo").order("ordem").order("nome");
 if(error) { form.dataset.categoryField="error"; return; }
 const selected=config.idField?row[config.idField]||"":categories?.find(item=>item.nome===row[config.nameField])?.id||"";
 const field=document.createElement("label");
 field.innerHTML=`Categoria<select name="cms_categoria_id"><option value="">Sem categoria</option>${(categories||[]).map(item=>`<option value="${item.id}" ${item.id===selected?"selected":""}>${escapeHtml(item.nome)}</option>`).join("")}</select>`;
 const legacy=form.querySelector('[name="categoria_nome"]')?.closest("label")||form.querySelector('[name="categoria"]')?.closest("label");
 if(legacy)legacy.replaceWith(field);
 else{
  const description=form.querySelector('[name="descricao"]')?.closest("label");
  if(description) description.before(field);
  else form.querySelector(".form-actions")?.before(field);
 }
 form.dataset.categoryField="ready";
}
