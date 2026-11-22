const {test}=require('node:test');const assert=require('node:assert/strict');const {executar}=require('../lib/editorial-execucao');
function setup(options={}) {
  const calls=[];const db=async(path,req={})=>{
    calls.push({path,...req});
    if(path.includes('iniciar'))return options.ignored?null:'run-1';
    if(path.startsWith('editorial_configuracao?'))return [{limite_pautas:5,limite_materias:options.limite||1}];
    if(path.startsWith('editorial_fontes?'))return options.fontes||[{nome:'Um',tipo:'pagina',url:'https://a.example/1'},{nome:'Dois',tipo:'pagina',url:'https://b.example/2'}];
    if(path.startsWith('noticias?'))return options.news||[];
    if(path.startsWith('editorial_pautas?'))return [];
    return [];
  };
  const read=async url=>({url,titulo:'Prefeitura anuncia reforma da praça central em Urânia',texto:'Urânia '.repeat(100),publicado_em:new Date(Date.now()-60000).toISOString(),consultado_em:new Date().toISOString()});
  const write=async({fontes})=>({titulo:'Prefeitura anuncia reforma da praça central',resumo:'Resumo',conteudo_html:'<p>Matéria</p>',seo_titulo:'SEO',seo_descricao:'Descrição',relevancia:'Local',pendencias:[],revisao_reforcada:false,fontes:fontes.map(({texto,...f})=>f)});
  return {calls,db,read,write,search:async()=>[],apiKey:'local',model:'gemini-2.5-flash-lite',freeTierConfirmed:true};
}
test('conecta leitura, comparação, geração e RPC de rascunho',async()=>{
  const t=setup(),result=await executar(t);assert.equal(result.criados,1);
  const saved=t.calls.find(x=>x.path.includes('criar_rascunho'));assert.equal(saved.body.p_dados.fontes.length,2);assert.equal(saved.body.p_dados.conteudo_html,'<p>Matéria</p>');
  assert.equal(t.calls.at(-1).body.estado,'concluida');assert.equal(t.calls.some(x=>x.path.startsWith('noticias?')&&x.method==='PATCH'),false);
});
test('pauta existente impede geração e salvamento',async()=>{
  const t=setup({news:[{titulo:'Prefeitura anuncia reforma da praça central em Urânia'}]}),result=await executar(t);assert.equal(result.criados,0);assert.equal(t.calls.some(x=>x.path.includes('criar_rascunho')),false);assert.equal(t.calls.at(-1).body.estado,'sem_pautas');
});
test('credencial ausente registra falha e rotina pausada é ignorada',async()=>{
  const t=setup();await assert.rejects(executar({...t,apiKey:''}),/GEMINI_API_KEY/);assert.equal(t.calls.at(-1).body.estado,'falhou');
  const unconfirmed=setup();await assert.rejects(executar({...unconfirmed,freeTierConfirmed:false}),/GEMINI_FREE_TIER_CONFIRMED/);assert.equal(unconfirmed.calls.at(-1).body.estado,'falhou');
  const paused=setup({ignored:true});assert.equal((await executar({...paused,automatica:true})).ignorada,true);assert.equal(paused.calls.length,1);
});
test('cota esgotada é registrada e impede nova tentativa imediata',async()=>{
  const t=setup();await assert.rejects(executar({...t,write:async()=>{throw Object.assign(new Error('limite'),{code:'GEMINI_QUOTA'});}}),/Cota Gemini/);
  assert.ok(t.calls.some(x=>x.path.startsWith('editorial_configuracao?')&&x.method==='PATCH'&&x.body.quota_ate));
  assert.equal(t.calls.at(-1).body.estado,'falhou');
  const t2=setup();const original=t2.db;t2.db=async(path,req)=>path.startsWith('editorial_configuracao?')&&!req?.method?[{limite_pautas:5,limite_materias:1,quota_ate:new Date(Date.now()+3600000).toISOString()}]:original(path,req);
  await assert.rejects(executar({...t2,write:async()=>{throw Error('não deve chamar');}}),/aguarde/);
});
test('falha total de fontes não vira sucesso',async()=>{
  const t=setup();await assert.rejects(executar({...t,read:async()=>{throw Error('indisponível');}}),/Nenhuma página/);assert.equal(t.calls.at(-1).body.estado,'falhou');
});
test('resumo registra motivos granulares de descarte por URL',async()=>{
  // Página sem data: deve registrar aviso com URL e motivo
  const t=setup();
  const readSemData=async url=>({url,titulo:'Urânia informa obra',texto:'Urânia '.repeat(100),publicado_em:null,consultado_em:new Date().toISOString()});
  const result=await executar({...t,read:readSemData});
  assert.equal(result.criados,0);
  assert.match(result.resumo,/sem data de publicação/);
});
test('fonte oficial única avança com revisão reforçada',async()=>{
  const fonteOficial={nome:'Câmara',confiabilidade:'oficial',tipo:'pagina',url:'https://urania.sp.leg.br/noticias'};
  const t=setup({fontes:[fonteOficial]});
  // read retorna URL do domínio oficial
  const readOficial=async url=>({url:'https://urania.sp.leg.br/noticias/sessao-aprovada',titulo:'Câmara aprova projeto em Urânia',texto:'Urânia '.repeat(100),publicado_em:new Date().toISOString(),consultado_em:new Date().toISOString()});
  // write espera ser chamado com fonteUnicaOficial=true e uma fonte
  let writeArgs;
  const writeSpy=async(args)=>{writeArgs=args;return {titulo:'Câmara aprova projeto',resumo:'Resumo',conteudo_html:'<p>Matéria</p>',seo_titulo:'SEO',seo_descricao:'Descrição',relevancia:'Local',pendencias:[],revisao_reforcada:true,fontes:[{url:'https://urania.sp.leg.br/noticias/sessao-aprovada',titulo:'Câmara aprova projeto em Urânia',publicado_em:new Date().toISOString(),consultado_em:new Date().toISOString()}]};};
  const result=await executar({...t,read:readOficial,write:writeSpy});
  assert.equal(result.criados,1);
  assert.equal(writeArgs.fonteUnicaOficial,true);
  assert.equal(writeArgs.fontes.length,1);
  // revisao_reforcada deve estar true no rascunho salvo
  const saved=t.calls.find(x=>x.path.includes('criar_rascunho'));
  assert.equal(saved.body.p_dados.revisao_reforcada,true);
});
test('marcar órgão como portal exige confirmação, mesmo no domínio da prefeitura',async()=>{
  const t=setup({fontes:[{nome:'Prefeitura',tipo:'pagina',confiabilidade:'portal',url:'https://urania.sp.gov.br/obra'}]});
  assert.equal((await executar(t)).criados,0);
  assert.match(t.calls.find(x=>x.path==='editorial_pautas').body[0].relevancia,/outro domínio/);
});
test('um resultado de pesquisa não herda confiança do título ou de outro domínio',async()=>{
  const t=setup({fontes:[]});
  assert.equal((await executar({...t,search:async()=>['https://outro.org/aviso']})).criados,0);
});
test('usa data do RSS quando a página não informa publicação',async()=>{
  const t=setup({fontes:[{nome:'Feed',confiabilidade:'oficial',tipo:'rss',url:'https://urania.sp.leg.br/feed'}]});
  const data=new Date().toISOString();
  const result=await executar({...t,readResource:async()=>({u:new URL('https://urania.sp.leg.br/feed'),type:'application/rss+xml',body:`<item><link>https://urania.sp.leg.br/noticia</link><pubDate>${data}</pubDate></item>`}),read:async url=>({url,titulo:'Obra em Urânia',texto:'Urânia '.repeat(100),publicado_em:null})});
  assert.equal(result.criados,1);
  const saved=t.calls.find(x=>x.path.includes('criar_rascunho'));
  assert.equal(saved.body.p_dados.fontes[0].publicado_em,data);
});
test('registra espera de cinco minutos para 429 transitório e 24 horas para cota diária',async()=>{
  for(const [quotaDiaria,espera] of [[false,300000],[true,86400000]]){
    const t=setup(),agora=Date.now();
    await assert.rejects(executar({...t,now:()=>agora,write:async()=>{throw Object.assign(new Error('limite'),{code:'GEMINI_QUOTA',quotaDiaria});}}),/Cota Gemini/);
    const saved=t.calls.find(x=>x.path.startsWith('editorial_configuracao?')&&x.method==='PATCH');
    assert.equal(Date.parse(saved.body.quota_ate)-agora,espera);
  }
});
test('guarda até cinco pautas e reserva vagas distintas para Urânia e para a região',async()=>{
  const titulos=['Urânia abre biblioteca','Comarca de Jales amplia atendimento no hospital','Urânia reforma estrada',
    'Urânia celebra aniversário','Urânia inaugura parque','Urânia recebe festival'];
  const fontes=titulos.map((_,i)=>({tipo:'pagina',url:'https://org'+i+'.org/noticia',confiabilidade:'oficial',escopo:i===1?'regional_nacional':'local'}));
  const t=setup({fontes,limite:2});
  const result=await executar({...t,read:async url=>{
    const titulo=titulos[fontes.findIndex(f=>f.url===url)];
    return {url,titulo,texto:(titulo+' ').repeat(50),publicado_em:new Date().toISOString()};
  },write:async({fontes,escopo})=>({titulo:fontes[0].titulo,escopo})});
  assert.equal(result.criados,2);
  assert.equal(t.calls.find(c=>c.path==='editorial_pautas').body.length,5);
  assert.deepEqual(t.calls.filter(c=>c.path.includes('criar_rascunho')).map(c=>c.body.p_dados.escopo),['local','regional_nacional']);
  assert.ok(t.calls.some(c=>c.path.includes('publicado_em=gte.')));
});
test('registra encerramento parcial quando o orçamento já expirou',async()=>{
  const t=setup();
  await executar({...t,deadline:0,search:async()=>assert.fail('pesquisa fora do prazo')});
  assert.equal(t.calls.at(-1).body.estado,'parcial');
});
