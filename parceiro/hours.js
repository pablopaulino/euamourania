export const week=['mon','tue','wed','thu','fri','sat','sun'];
export const dayNames=['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const minutes=value=>/^\d{2}:\d{2}$/.test(value||'')?Number(value.slice(0,2))*60+Number(value.slice(3)):NaN;
export function isOpen(hours,now=new Date()){
 const index=(now.getDay()+6)%7,time=now.getHours()*60+now.getMinutes();
 const today=hours?.[week[index]],previous=hours?.[week[(index+6)%7]];
 if(previous&&!previous.closed&&minutes(previous.close)<minutes(previous.open)&&time<minutes(previous.close))return true;
 if(!today||today.closed)return false;
 const open=minutes(today.open),close=minutes(today.close);
 return close<open?time>=open:time>=open&&time<close;
}
export function hoursSummary(hours){
 const groups=[];
 for(let i=0;i<week.length;i++){
  const day=hours[week[i]];if(!day||day.closed)continue;
  const label=`${day.open} às ${day.close}${day.close<day.open?' (madrugada seguinte)':''}`;
  const last=groups.at(-1);
  if(last&&last.end===i-1&&last.label===label)last.end=i;else groups.push({start:i,end:i,label});
 }
 return groups.length?groups.map(g=>`${dayNames[g.start]}${g.end!==g.start?' a '+dayNames[g.end]:''}: ${g.label}`).join('; ')+'.':'Fechado todos os dias.';
}
