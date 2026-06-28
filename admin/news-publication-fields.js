import { getSupabase } from "../assets/js/services/supabaseClient.js";

const db=getSupabase();
const originalFrom=db.from.bind(db);
let currentNewsId=null;
let pendingPublication=null;

const pad=value=>String(value).padStart(2,"0");
function brasiliaParts(value=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{
    timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"
  }).formatToParts(new Date(value)).filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${pad(parts.hour)}:${pad(parts.minute)}`};
}
function publicationIso(date,time){
  if(!date||!time)return null;
  const value=new Date(`${date}T${time}:00-03:00`);
  return Number.isNaN(value.getTime())?null:value.toISOString();
}

// Mantém o editor avançado existente, mas garante que a data escolhida seja
// enviada ao Supabase em vez de ser substituída pela data da edição.
db.from=function(table){
  const builder=originalFrom(table);
  if(table!=="noticias")return builder;
  for(const method of ["insert","update"]){
    const original=builder[method].bind(builder);
    builder[method]=function(values,...args){
      if(pendingPublication&&values&&Object.prototype.hasOwnProperty.call(values,"status")){
        const publication=pendingPublication;
        pendingPublication=null;
        const patched={...values,publicado_em:publication};
        return original(patched,...args);
      }
      return original(values,...args);
    };
  }
  return builder;
};

document.addEventListener("click",event=>{
  const button=event.target.closest("button");
  if(!button)return;
  if(button.hasAttribute("data-news-new"))currentNewsId=null;
  if(button.dataset.newsEdit)currentNewsId=button.dataset.newsEdit;
},true);

document.addEventListener("submit",event=>{
  const form=event.target;
  if(form.id!=="news-form")return;
  const date=form.elements.publicacao_data?.value;
  const time=form.elements.publicacao_hora?.value;
  const iso=publicationIso(date,time);
  if(!iso){
    event.preventDefault();
    event.stopImmediatePropagation();
    form.elements.publicacao_data?.setCustomValidity("Informe uma data de publicação válida.");
    form.elements.publicacao_data?.reportValidity();
    return;
  }
  form.elements.publicacao_data.setCustomValidity("");
  pendingPublication=iso;
},true);

async function addPublicationFields(form){
  if(form.dataset.publicationFields)return;
  form.dataset.publicationFields="true";
  const initial=brasiliaParts();
  const section=document.createElement("div");
  section.className="cms-form-section";
  section.dataset.publicationSection="true";
  section.innerHTML=`<h3>Publicação</h3><div class="cms-form"><div class="cms-field"><label for="news-publication-date">Data de publicação *</label><input id="news-publication-date" name="publicacao_data" type="date" required value="${initial.date}"></div><div class="cms-field"><label for="news-publication-time">Horário de publicação (Brasília) *</label><input id="news-publication-time" name="publicacao_hora" type="time" required value="${initial.time}"></div><p class="cms-field full publication-help">A notícia será exibida somente quando esta data e este horário chegarem. Editar o conteúdo não altera a posição pública.</p></div>`;
  const seoSection=[...form.querySelectorAll(".cms-form-section")].find(item=>item.querySelector("h3")?.textContent.includes("SEO"));
  form.insertBefore(section,seoSection||form.querySelector(".cms-sticky-actions"));
  if(!currentNewsId)return;
  const {data,error}=await originalFrom("noticias").select("publicado_em").eq("id",currentNewsId).maybeSingle();
  if(error){console.error("Data de publicação:",error);return}
  if(data?.publicado_em){
    const selected=brasiliaParts(data.publicado_em);
    form.elements.publicacao_data.value=selected.date;
    form.elements.publicacao_hora.value=selected.time;
  }
}

const observer=new MutationObserver(()=>{
  const form=document.getElementById("news-form");
  if(form)addPublicationFields(form);
});
observer.observe(document.getElementById("app-content"),{childList:true,subtree:true});
