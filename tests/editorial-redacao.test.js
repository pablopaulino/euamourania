const {test}=require('node:test');const assert=require('node:assert/strict');const {redigir,erroQuota,descobrir,responseSchema}=require('../lib/editorial-redacao');
const fontes=[1,2].map(i=>({url:`https://fonte${i}.org/noticia`,titulo:`Fonte ${i}`,texto:'Texto de referência '.repeat(50)}));
const fonteUnica=[{url:'https://urania.sp.leg.br/sessoes/1',titulo:'Câmara aprova projeto',texto:'Texto de referência '.repeat(50)}];
const refs=fontes=>fontes.map(({titulo,url})=>({titulo,url}));
const draft={titulo:'Título',slug:'titulo',subtitulo:'Subtítulo',categoria:'Cidade',resumo:'Resumo',titulo_seo:'Título',
  descricao_seo:'Descrição',texto:['Segundo a fonte, '+'texto relevante '.repeat(5),'<script>alert(1)</script> '+'informação '.repeat(6),
  'Outro parágrafo '+'informação '.repeat(6)].join('\n\n'),legenda_imagem:'Legenda',prompt_imagem:'Ilustração realista',fontes:refs(fontes)};
const draftUnico={...draft,fontes:refs(fonteUnica)};
const mock=value=>async()=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]})});
test('exige fontes lidas e escapa HTML da geração',async()=>{
  await assert.rejects(redigir({fontes:fontes.slice(0,1),apiKey:'teste',model:'gemini-2.5-flash-lite',fetchImpl:mock(draft)}),/duas fontes/);
  const result=await redigir({fontes,apiKey:'teste',model:'gemini-2.5-flash-lite',fetchImpl:mock(draft)});
  assert.match(result.conteudo_html,/&lt;script&gt;/);assert.doesNotMatch(result.conteudo_html,/<script>/);assert.equal(result.fontes.length,2);
});
test('falha fechada para provedor e dados inválidos',async()=>{
  await assert.rejects(redigir({fontes,apiKey:'teste',model:'gemini-2.5-flash-lite',fetchImpl:async()=>({ok:false})}),/indisponível/);
  await assert.rejects(redigir({fontes,apiKey:'teste',model:'gemini-2.5-flash-lite',fetchImpl:mock({...draft,fontes_usadas:[1,1]})}),/requisitos/);
  await assert.rejects(redigir({fontes,apiKey:'teste',model:'gemini-2.5-flash-lite',fetchImpl:async()=>({ok:false,status:429})}),e=>e.code==='GEMINI_QUOTA');
  assert.equal(await redigir({fontes,apiKey:'teste',model:'gemini-2.5-flash-lite',fetchImpl:mock({...draft,texto:''})}),null);
});
test('envia apenas fontes lidas e não ativa ferramentas de pesquisa',async()=>{
  let request;
  await redigir({fontes,apiKey:'teste',model:'gemini-2.5-flash-lite',fetchImpl:async(url,opts)=>{request={url,body:JSON.parse(opts.body)};return mock(draft)();}});
  assert.match(request.url,/generativelanguage\.googleapis\.com/);
  assert.equal(request.body.tools,undefined);
  assert.deepEqual(request.body.generationConfig.responseSchema.required.sort(),Object.keys(draft).sort());
  assert.match(request.body.contents[0].parts[0].text,/Texto de referência/);
});
test('fonte única oficial aceita 1 fonte e força revisão reforçada',async()=>{
  // Deve aceitar com fonteUnicaOficial=true mesmo com 1 fonte
  const result=await redigir({fontes:fonteUnica,apiKey:'teste',model:'gemini-2.5-flash-lite',fetchImpl:mock(draftUnico),fonteUnicaOficial:true});
  assert.equal(result.revisao_reforcada,true,'revisão reforçada deve ser true mesmo que o modelo retorne false');
  assert.ok(result.pendencias.some(p=>p.includes('outras fontes')),'deve incluir pendência de verificação adicional');
  assert.equal(result.fontes.length,1);
});
test('fonte única sem fonteUnicaOficial=true continua rejeitada',async()=>{
  await assert.rejects(redigir({fontes:fonteUnica,apiKey:'teste',model:'gemini-2.5-flash-lite',fetchImpl:mock(draftUnico),fonteUnicaOficial:false}),/duas fontes/);
});
test('instrução adicional aparece no prompt quando fonteUnicaOficial',async()=>{
  let sentBody;
  await redigir({fontes:fonteUnica,apiKey:'teste',model:'gemini-2.5-flash-lite',fetchImpl:async(url,opts)=>{sentBody=JSON.parse(opts.body);return mock(draftUnico)();},fonteUnicaOficial:true});
  const instruction=sentBody.system_instruction.parts[0].text;
  assert.match(instruction,/comunicado oficial/);
});
test('distingue erro diário de limite temporário ou desconhecido',async()=>{
  assert.equal((await erroQuota({json:async()=>({error:{details:[{quotaMetric:'generate_requests_per_day'}]}})})).quotaDiaria,true);
  assert.equal((await erroQuota({json:async()=>({error:{message:'Requests per minute exceeded'}})})).quotaDiaria,false);
  assert.equal((await erroQuota({json:async()=>{throw Error('sem corpo')}})).quotaDiaria,false);
});
test('repete uma indisponibilidade transitória respeitando o mesmo prazo',async()=>{
  let chamadas=0;
  const result=await redigir({fontes,apiKey:'teste',model:'gemini-3.5-flash-lite',fetchImpl:async()=>{
    if(++chamadas===1)return {status:503};
    return mock(draft)();
  }});
  assert.equal(chamadas,2);assert.equal(result.titulo,draft.titulo);
});
test('descoberta descarta URLs geradas fora dos metadados',async()=>{
  const urls=await descobrir({apiKey:'teste',model:'gemini-2.5-flash-lite',timeoutMs:1000,fetchImpl:async(_,opts)=>{
    assert.deepEqual(JSON.parse(opts.body).tools,[{google_search:{}}]);
    return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:'https://inventado.org/'}]},
      groundingMetadata:{groundingChunks:[{web:{uri:'https://real.org/fato'}},{web:{uri:'javascript:ignorar'}}]}}]})};
  }});
  assert.deepEqual(urls,['https://real.org/fato']);
});
test('valida categoria, comprimentos, slug, fontes e links no corpo antes de salvar',async()=>{
  for(const invalid of [{categoria:'Outra'},{slug:'Com Espaço'},{titulo:'x'.repeat(181)},{descricao_seo:'x'.repeat(161)},
    {fontes:[{url:'https://inventado.org/',titulo:'Falsa'},draft.fontes[1]]},{texto:draft.texto+' https://inventado.org/fato'}]) {
    await assert.rejects(redigir({fontes,apiKey:'teste',model:'gemini-2.5-flash-lite',fetchImpl:mock({...draft,...invalid})}),/requisitos/);
  }
});
