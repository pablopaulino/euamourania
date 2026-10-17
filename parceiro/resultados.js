import {acesso,db,notice} from './_layout.js';

if(acesso?.guia){
  const period=document.querySelector('#periodo');
  const refresh=document.querySelector('#refresh-results');
  const content=document.querySelector('#results-content');
  const number=new Intl.NumberFormat('pt-BR');
  let request=0;
  async function load(){
    const current=++request;
    content.setAttribute('aria-busy','true');refresh.disabled=true;
    notice('Carregando resultados…');
    document.querySelectorAll('[data-metric]').forEach(el=>el.textContent='—');
    document.querySelector('#results-empty').hidden=true;
    document.querySelector('#results-updated').textContent='';
    try{
      const params={p_guia_id:acesso.guia.id,p_dias:period.value==='30'?30:null};
      const [details,totals]=await Promise.all([db.rpc('parceiro_resultados',params),db.rpc('parceiro_totais',params)]);
      const data=details.data&&totals.data?{...details.data,...totals.data}:null;
      const error=details.error||totals.error;
      if(current!==request)return;
      if(error||!data)throw error||new Error('Resposta indisponível');
      document.querySelectorAll('[data-metric]').forEach(el=>{el.textContent=number.format(data[el.dataset.metric]??0);});
      document.querySelector('#results-empty').hidden=Boolean(data.primeiro_registro);
      const updated=new Date(data.consultado_em).toLocaleString('pt-BR');
      const first=data.primeiro_registro?` · Primeiro registro no período: ${new Date(data.primeiro_registro).toLocaleDateString('pt-BR')}`:'';
      document.querySelector('#results-updated').textContent=`${period.value==='total'?'Todo o histórico disponível':'Últimos 30 dias'} · Consultado em ${updated}${first}`;
      notice('');
    }catch(error){
      if(current===request)notice('Não foi possível carregar os resultados. Clique em Atualizar para tentar novamente.',true);
    }finally{
      if(current===request){content.setAttribute('aria-busy','false');refresh.disabled=false;}
    }
  }
  period.addEventListener('change',load);refresh.addEventListener('click',load);
  await load();
}
