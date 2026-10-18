import {exigirPermissao} from './auth.js';
import {getSupabase} from '../assets/js/services/supabaseClient.js';
const access=await exigirPermissao('guia_comercial','editar');
if(access){
 const db=getSupabase(),form=document.querySelector('#subscription-form'),company=document.querySelector('#company'),save=form.querySelector('[type=submit]'),message=document.querySelector('#notice');let request=0;
 const {data,error}=await db.from('guia_comercial').select('id,nome').order('nome').limit(5000);
 if(error)message.textContent='Não foi possível carregar as empresas: '+error.message;
 else for(const g of data)company.add(new Option(g.nome,g.id));
 async function load(){const seq=++request;save.disabled=true;form.reset();company.value=selected;document.querySelector('#subscription-history').replaceChildren();message.textContent='';if(!selected){document.querySelector('#current-state').textContent='Selecione uma empresa para começar.';return;}
  const [{data:s,error:e},{data:history,error:he}]=await Promise.all([db.from('viva_assinaturas').select('*').eq('guia_id',selected).maybeSingle(),db.from('viva_assinaturas_historico').select('criado_em,novo').eq('guia_id',selected).order('criado_em',{ascending:false}).limit(20)]);
  if(seq!==request)return;if(e){message.textContent='Consulta indisponível: '+e.message;return;}
  document.querySelector('#current-state').textContent=s?'Registro: '+s.status+' · '+s.periodo+' · validade '+s.validade:'Sem assinatura Viva vinculada.';
  if(s){for(const key of ['periodo','status','inicio','validade'])form.elements[key].value=s[key];form.elements.pago.checked=Boolean(s.pagamento_confirmado_em);}else form.elements.inicio.value=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());
  if(he)message.textContent='Assinatura carregada; histórico indisponível.';
  if(!he&&!history?.length){const empty=document.createElement('li');empty.textContent='Nenhuma alteração registrada para esta empresa.';document.querySelector('#subscription-history').append(empty);}
  for(const row of history||[]){const li=document.createElement('li');li.textContent=new Date(row.criado_em).toLocaleString('pt-BR')+' · '+row.novo.status+' · '+row.novo.periodo+' · até '+row.novo.validade;document.querySelector('#subscription-history').append(li);}save.disabled=false;
 }
 let selected=new URLSearchParams(location.search).get('guia_id')||'';company.value=selected;selected=company.value;company.onchange=()=>{selected=company.value;load();};
 form.elements.inicio.onchange=form.elements.validade.onchange=form.elements.periodo.onchange=()=>{form.elements.pago.checked=false;};
 document.querySelector('#calculate').onclick=()=>{const value=form.elements.inicio.value;if(!value)return;const [y,m,d]=value.split('-').map(Number),months={mensal:1,semestral:6,anual:12}[form.elements.periodo.value];const last=new Date(y,m-1+months+1,0).getDate();const end=new Date(y,m-1+months,Math.min(d,last));end.setDate(end.getDate()-1);form.elements.validade.value=[end.getFullYear(),String(end.getMonth()+1).padStart(2,'0'),String(end.getDate()).padStart(2,'0')].join('-');form.elements.pago.checked=false;};
 form.onsubmit=async event=>{event.preventDefault();save.disabled=true;try{const {error}=await db.rpc('admin_salvar_assinatura_viva',{p_guia_id:selected,p_periodo:form.elements.periodo.value,p_status:form.elements.status.value,p_inicio:form.elements.inicio.value,p_validade:form.elements.validade.value,p_pago:form.elements.pago.checked});if(error)throw error;await load();message.textContent='Assinatura salva. O painel consultará a nova situação ao abrir a página.';}catch(error){message.textContent=error.message;}finally{save.disabled=false;}};await load();
}
