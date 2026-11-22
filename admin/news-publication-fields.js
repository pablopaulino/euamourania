function brasiliaParts(value=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{
    timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"
  }).formatToParts(new Date(value)).filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}
export function publicationIso(date,time){
  if(!date||!time)return null;
  const value=new Date(`${date}T${time}:00-03:00`);
  return Number.isNaN(value.getTime())?null:value.toISOString();
}

export function addPublicationFields(form, publishedAt){
  if(form.dataset.publicationFields)return;
  form.dataset.publicationFields="true";
  const initial=brasiliaParts(publishedAt || new Date());
  const section=document.createElement("div");
  section.className="cms-form-section";
  section.dataset.publicationSection="true";
  section.innerHTML=`<h3>Publicação</h3><div class="cms-form"><div class="cms-field"><label for="news-publication-date">Data de publicação *</label><input id="news-publication-date" name="publicacao_data" type="date" required value="${initial.date}"></div><div class="cms-field"><label for="news-publication-time">Horário de publicação (Brasília) *</label><input id="news-publication-time" name="publicacao_hora" type="time" required value="${initial.time}"></div><p class="cms-field full publication-help">A notícia será exibida somente quando esta data e este horário chegarem. Editar o conteúdo não altera a posição pública.</p></div>`;
  const seoSection=[...form.querySelectorAll(".cms-form-section")].find(item=>item.querySelector("h3")?.textContent.includes("SEO"));
  form.insertBefore(section,seoSection||form.querySelector(".cms-sticky-actions"));
}
