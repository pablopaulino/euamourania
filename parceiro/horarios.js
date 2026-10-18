import {acesso,salvar,notice} from './_layout.js';
import {week,dayNames,isOpen,hoursSummary} from './hours.js';
if(acesso?.guia){
 const form=document.querySelector('#form'),current=acesso.guia.opening_hours||{};
 const read=()=>Object.fromEntries(week.map(day=>[day,{closed:form.elements[day+'-closed'].checked,open:form.elements[day+'-open'].value,close:form.elements[day+'-close'].value}]));
 function update(){
  const hours=read();
  week.forEach(day=>{const row=document.querySelector('[data-day="'+day+'"]'),closed=hours[day].closed;
   row.classList.toggle('day-closed',closed);
   for(const kind of ['open','close'])form.elements[day+'-'+kind].disabled=closed;
   row.querySelector('.overnight-note').hidden=closed||!hours[day].close||hours[day].close>=hours[day].open;
  });
  const badge=document.querySelector('#hours-status'),open=isOpen(hours);
  badge.textContent='Sua empresa aparece como: '+(open?'Aberta agora':'Fechada agora');badge.classList.toggle('is-open',open);
 }
 week.forEach((day,i)=>{
  const row=document.createElement('div');row.className='card';row.dataset.day=day;
  row.innerHTML=`<strong>${dayNames[i]}</strong><label class="day-toggle"><input type="checkbox" role="switch" name="${day}-closed" aria-label="${dayNames[i]} fechado"><span>Fechado</span></label><label>Abertura<input type="time" name="${day}-open" required></label><label>Fechamento<input type="time" name="${day}-close" required></label><small class="overnight-note" hidden>Fecha na madrugada seguinte</small>`;
  document.querySelector('#days').append(row);
  form.elements[day+'-closed'].checked=Boolean(current[day]?.closed);
  form.elements[day+'-open'].value=current[day]?.open||'08:00';form.elements[day+'-close'].value=current[day]?.close||'18:00';
 });
 form.elements.horario.value=acesso.guia.horario||'';form.elements.opening_hours_note.value=acesso.guia.opening_hours_note||'';
 form.addEventListener('input',update);update();const timer=setInterval(update,60000);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
 document.querySelector('#copy-monday').onclick=()=>{const monday=read().mon;for(const day of week.slice(1,5)){form.elements[day+'-closed'].checked=monday.closed;for(const kind of ['open','close'])form.elements[day+'-'+kind].value=monday[kind];}update();notice('Segunda copiada para os dias úteis. Salve para aplicar.');};
 document.querySelector('#standard-hours').onclick=()=>{week.forEach((day,i)=>{form.elements[day+'-closed'].checked=i>4;form.elements[day+'-open'].value='08:00';form.elements[day+'-close'].value='18:00';});update();notice('Segunda a sexta, das 08:00 às 18:00. Revise e salve para aplicar.');};
 document.querySelector('#generate-hours').onclick=()=>{form.elements.horario.value=hoursSummary(read());notice('Resumo gerado. Você pode editar o texto antes de salvar.');};
 form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;try{const hours=read();for(const day of week){if(!hours[day].closed&&hours[day].open===hours[day].close)throw Error('Use horários diferentes para abertura e fechamento em '+dayNames[week.indexOf(day)]+'.');}await salvar({opening_hours:hours,opening_hours_note:form.elements.opening_hours_note.value,horario:form.elements.horario.value});}catch(error){notice(error.message,true);}finally{button.disabled=false;}});
}
