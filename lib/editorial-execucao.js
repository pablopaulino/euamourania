const {lerPagina,lerRecurso,itensFeed,linksPagina}=require('./editorial-fontes');
const {escopoDaPagina,elegivel,duplicada,similaridade,chaveFato}=require('./editorial-pautas');
const {redigir,descobrir}=require('./editorial-redacao');
const {createHash}=require('node:crypto');

function criarDb({url,key,fetchImpl=fetch}) {
  if(!url||!key)throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no servidor.');
  return async(path,{method='GET',body}={})=>{
    const r=await fetchImpl(`${url.replace(/\/$/,'')}/rest/v1/${path}`,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
    if(!r.ok)throw new Error('Falha ao consultar ou salvar dados no CMS.');
    const t=await r.text();return t?JSON.parse(t):null;
  };
}


function host(url) {return new URL(url).hostname.replace(/^www\./,'');}
function dominio(url) {
  const labels=host(url).split('.');
  const br=labels.at(-1)==='br';
  // Conservador para subdomínios do mesmo portal ou órgão.
  return labels.slice(br?-3:-2).join('.');
}
async function comPrazo(fn) {
  const signal=AbortSignal.timeout(5000);
  let abort;
  const expiracao=new Promise((_,reject)=>{
    abort=()=>reject(Error('Tempo de leitura esgotado'));
    signal.addEventListener('abort',abort,{once:true});
  });
  try{return await Promise.race([fn(signal),expiracao]);}
  finally{signal.removeEventListener('abort',abort);}
}
async function listarFonte(fonte,readResource) {
  if(fonte.tipo==='pagina') return [{url:fonte.url,fonte}];
  const recurso=await comPrazo(signal=>readResource(fonte.url,{signal}));
  let itens;
  if(fonte.tipo==='rss' && /xml|rss|atom/.test(recurso.type)) itens=itensFeed(recurso.body,recurso.u,5);
  else if(fonte.tipo==='site' && /html/.test(recurso.type)) itens=linksPagina(recurso.body,recurso.u,5).map(url=>({url}));
  else throw Error('Formato da fonte inválido');
  return itens.map(item=>({...item,fonte}));
}
function referencia({url,titulo,publicado_em,consultado_em,referencia_google}) {
  return {url,titulo,publicado_em,consultado_em,...(referencia_google?{referencia_google}:{})};
}

function triar(pages,anteriores,limite) {
  const grupos=[];
  for(const page of pages) {
    if(duplicada(page,anteriores)) continue;
    const grupo=grupos.find(g=>g.escopo===page.escopo && (g.pages[0].url===page.url ||
      similaridade(g.pages[0].titulo,page.titulo)>=0.75));
    if(grupo) {
      if(!grupo.pages.some(p=>p.url===page.url)) grupo.pages.push(page);
    } else grupos.push({escopo:page.escopo,pages:[page]});
  }
  for(const g of grupos) {
    const principal=g.pages.find(p=>p.oficial)||g.pages[0];
    const outra=g.pages.find(p=>dominio(p.url)!==dominio(principal.url));
    g.fontes=outra?[principal,outra]:[principal];
    g.apta=Boolean(outra||principal.oficial);
  }
  const ordenadas=grupos.sort((a,b)=>Number(b.apta)-Number(a.apta));
  const primeiras=['local','regional_nacional'].map(e=>ordenadas.find(g=>g.escopo===e)).filter(Boolean);
  return [...new Set([...primeiras,...ordenadas])].slice(0,Math.min(5,limite));
}

async function executar({db,automatica=false,apiKey,model,freeTierConfirmed=false,read=lerPagina,
  readResource=lerRecurso,write=redigir,search=descobrir,now=Date.now,deadline=now()+100000}) {
  const id=await db('rpc/editorial_iniciar_execucao',{method:'POST',body:{p_automatica:automatica}});
  if(!id) return {ignorada:true};
  const runPath='editorial_execucoes?id=eq.'+encodeURIComponent(id)+'&estado=eq.iniciada';
  const log=[];
  let created=0;
  async function finalizar(estado,msg) {
    const resumo=[created+' rascunho(s) criado(s).',msg,...log].filter(Boolean).join('\n').slice(0,1500);
    await db(runPath,{method:'PATCH',body:{estado,finalizada_em:new Date(now()).toISOString(),resumo}});
    return {id,criados:created,resumo};
  }
  const restante=()=>deadline-now();
  try {
    if(!apiKey||model!=='gemini-2.5-flash-lite') throw Error('Verifique GEMINI_API_KEY e GEMINI_MODEL.');
    if(!freeTierConfirmed) throw Error('Confirme o projeto sem faturamento com GEMINI_FREE_TIER_CONFIRMED=true.');
    const desde=encodeURIComponent(new Date(now()-7*86400000).toISOString());
    const [[cfg],fontes,news,old]=await Promise.all([
      db('editorial_configuracao?id=eq.1&select=*'),
      db('editorial_fontes?ativa=eq.true&select=*&order=prioridade.desc&limit=20'),
      db('noticias?select=titulo,slug&status=eq.publicado&publicado_em=gte.'+desde+'&order=publicado_em.desc&limit=1000'),
      db('editorial_pautas?select=titulo,fontes&tentativa_pendente=eq.false&criado_em=gte.'+desde+'&order=criado_em.desc&limit=1000')]);
    if(!cfg) throw Error('Configuração editorial indisponível.');
    if(Date.parse(cfg.quota_ate)>now()) throw Error('Cota Gemini atingida; aguarde até o horário indicado.');
    if(restante()<10000) return await finalizar('parcial','Tempo de execução esgotado antes da pesquisa.');
    const [busca,...feeds]=await Promise.allSettled([
      search({apiKey,model,data:new Date(now()).toISOString().slice(0,10),timeoutMs:Math.min(20000,restante()-5000)}),
      ...fontes.map(f=>listarFonte(f,readResource))]);
    if(busca.status==='rejected' && busca.reason?.code==='GEMINI_QUOTA') throw busca.reason;
    if(busca.status==='rejected') log.push('Google Search indisponível: '+busca.reason.message+' Consulta às fontes cadastradas.');
    const grupos=feeds.flatMap((feed,i)=>{
      if(feed.status==='fulfilled') return [feed.value];
      log.push('Fonte indisponível: '+fontes[i].nome+' ('+feed.reason.message+').');
      return [];
    });
    if(busca.status==='fulfilled') grupos.unshift(busca.value.map(url=>({url,grounding:true})));
    const itens=new Map();
    for(let i=0;i<10;i++) for(const grupo of grupos) {
      const item=grupo[i];
      if(item && (itens.size<30 || itens.has(item.url))) itens.set(item.url,{...itens.get(item.url),...item});
    }
    if(!itens.size && log.length) throw Error('Não foi possível descobrir páginas.');
    const leituras=await Promise.allSettled([...itens.values()].map(async item=>{
      const page=await comPrazo(signal=>read(item.url,{signal,grounding:item.grounding}));
      const fonte=item.fonte || fontes.find(f=>host(f.url)===host(page.url));
      page.publicado_em ||= item.publicado_em;
      if(!page.publicado_em) log.push('Leitura: '+page.url+' sem data de publicação.');
      if(!elegivel(page,new Date(now()),fonte?.escopo)) return null;
      page.escopo=escopoDaPagina(page,fonte?.escopo);
      page.oficial=fonte?.confiabilidade==='oficial' && host(fonte.url)===host(page.url);
      if(item.grounding) page.referencia_google=item.url;
      return page;
    }));
    if(leituras.length && leituras.every(x=>x.status==='rejected')) throw Error('Nenhuma página pôde ser lida.');
    const anteriores=[...news.map(n=>({...n,url:n.slug?'https://euamourania.com.br/noticias/'+n.slug:null})),
      ...old,...old.flatMap(p=>p.fontes||[])];
    const pautas=triar(leituras.flatMap(x=>x.status==='fulfilled'&&x.value?[x.value]:[]),anteriores,cfg.limite_pautas);
    const lidas=leituras.filter(x=>x.status==='fulfilled');
    const elegiveis=lidas.filter(x=>x.value);
    log.unshift('Páginas consultadas: '+itens.size+'. Lidas: '+lidas.length+'. Com data recente e escopo adequado: '+elegiveis.length+'. Pautas após comparar com o acervo: '+pautas.length+'.');
    const slots=Number(cfg.limite_materias)===2?['local','regional_nacional']:['local'];
    const selecionadas=slots.map(e=>pautas.find(p=>p.apta && p.escopo===e)).filter(Boolean);
    for(const p of pautas) {
      const primeira=p.fontes[0];
      p.chave=createHash('sha256').update(id+':'+chaveFato(primeira.url)).digest('hex');
      p.registro={execucao_id:id,chave_fato:p.chave,fato_original:chaveFato(primeira.url),
        titulo:primeira.titulo,escopo:p.escopo,fontes:p.fontes.map(referencia),estado_triagem:'descartada',uso_ia:false,
        tentativa_pendente:selecionadas.includes(p),
        relevancia:!p.apta?'Falta confirmação de outro domínio.':selecionadas.includes(p)?
          'Rascunho ainda não gerado.':'Fora dos rascunhos desta execução.'};
    }
    if(pautas.length) await db('editorial_pautas',{method:'POST',body:pautas.map(p=>p.registro)});
    for(const pauta of selecionadas) {
      if(restante()<12000) return await finalizar('parcial','Tempo reservado para salvar o histórico.');
      const draft=await write({fontes:pauta.fontes,apiKey,model,escopo:pauta.escopo,
        fonteUnicaOficial:pauta.fontes.length===1,timeoutMs:Math.min(35000,restante()-10000)});
      if(!draft || duplicada({url:pauta.fontes[0].url,titulo:draft.titulo},anteriores)) {
        await db('editorial_pautas?chave_fato=eq.'+pauta.chave,{method:'PATCH',body:{
          tentativa_pendente:false,relevancia:draft?'Título já coberto no acervo.':'Apuração insuficiente para redigir.'}});
        continue;
      }
      await db('rpc/editorial_criar_rascunho_v2',{method:'POST',body:{p_execucao:id,p_chave_fato:pauta.chave,p_dados:draft}});
      created++;
      anteriores.push(...pauta.fontes,{titulo:draft.titulo});
    }
    return await finalizar(created?'concluida':'sem_pautas');
  } catch(error) {
    let msg=error.message||'Falha na execução.';
    if(error.code==='GEMINI_QUOTA') {
      const until=new Date(now()+(error.quotaDiaria?86400000:300000)).toISOString();
      await db('editorial_configuracao?id=eq.1',{method:'PATCH',body:{quota_ate:until}});
      msg='Cota Gemini atingida; nova tentativa após '+until+'.';
    }
    const parcial=created>0 || error.name==='TimeoutError' || restante()<10000;
    const resultado=await finalizar(parcial?'parcial':'falhou',msg);
    if(parcial) return resultado;
    throw Error(msg);
  }
}
module.exports={criarDb,executar,triar};
