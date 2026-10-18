import {acesso,db,notice} from './_layout.js';

if(acesso?.guia){
  const period=document.querySelector('#periodo');
  const refresh=document.querySelector('#refresh-results');
  const content=document.querySelector('#results-content');
  const number=new Intl.NumberFormat('pt-BR');
  const channels=['whatsapp','instagram','telefone','mapa','links_site'];
  const labels=['WhatsApp','Instagram','Telefone','Como chegar','Outros links'];
  for(const key of channels){const dd=document.querySelector('dd[data-metric="'+key+'"]');const bar=document.createElement('span');bar.className='channel-bar channel-'+key;bar.setAttribute('aria-hidden','true');const fill=document.createElement('i');bar.append(fill);const percent=document.createElement('small');percent.className='channel-percent';dd.parentElement.append(bar,percent);}
  function charts(data){
   const sum=channels.reduce((total,key)=>total+Number(data[key]||0),0);
   channels.forEach(key=>{const row=document.querySelector('dd[data-metric="'+key+'"]').parentElement;const percent=sum?Number(data[key]||0)/sum*100:0;row.querySelector('i').style.width=percent+'%';row.querySelector('.channel-percent').textContent=percent.toLocaleString('pt-BR',{maximumFractionDigits:1})+'% dos cliques identificados';});
   const max=Math.max(...channels.map(key=>Number(data[key]||0))),leaders=channels.filter(key=>Number(data[key]||0)===max);
   document.querySelector('#hero-insight').textContent=max&&leaders.length===1?'Seu canal mais procurado é '+labels[channels.indexOf(leaders[0])]+', com '+number.format(max)+' cliques registrados.':Number(data.impressoes_total)>0?'Sua vitrine teve '+number.format(data.impressoes_total)+' impressões no site e no aplicativo.':'Sua próxima oportunidade começa com uma vitrine completa.';
   const site=Number(data.impressoes_site||0),app=Number(data.impressoes_app||0),total=site+app;
   document.querySelector('#source-caption').textContent=total?'Impressões · Site: '+Math.round(site/total*100)+'% · Aplicativo: '+Math.round(app/total*100)+'%':'Ainda sem impressões neste período.';
   document.querySelector('#source-site').style.width=(total?site/total*100:0)+'%';document.querySelector('#source-app').style.width=(total?app/total*100:0)+'%';
  }
  let request=0;
  async function load(){
    const current=++request;
    content.setAttribute('aria-busy','true');refresh.disabled=true;
    notice('Carregando resultados…',false,'info');
    document.querySelector('#hero-insight').textContent='Atualizando seus resultados…';
    content.hidden=true;
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
      charts(data);content.hidden=false;
      document.querySelector('#results-empty').hidden=Boolean(data.primeiro_registro);
      const updated=new Date(data.consultado_em).toLocaleString('pt-BR');
      const first=data.primeiro_registro?` · Primeiro registro no período: ${new Date(data.primeiro_registro).toLocaleDateString('pt-BR')}`:'';
      document.querySelector('#results-updated').textContent=`${period.value==='total'?'Todo o histórico disponível':'Últimos 30 dias'} · Consultado em ${updated}${first}`;
      notice('');
    }catch(error){
      if(current===request)document.querySelector('#hero-insight').textContent='Seus resultados estão indisponíveis no momento.';
      if(current===request)notice('Não foi possível carregar os resultados. Clique em Atualizar para tentar novamente.',true);
    }finally{
      if(current===request){content.setAttribute('aria-busy','false');refresh.disabled=false;}
    }
  }
  period.addEventListener('change',load);refresh.addEventListener('click',load);
  await load();
}
