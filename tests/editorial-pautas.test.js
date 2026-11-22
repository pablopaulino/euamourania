const {test}=require('node:test');const assert=require('node:assert/strict');
const {urlCanonica,chaveFato,duplicada,elegivel}=require('../lib/editorial-pautas');
test('remove rastreamento e identifica reaproveitamento da URL',()=>{
  assert.equal(urlCanonica('https://example.org/fato/?utm_source=a&x=1#t'),'https://example.org/fato?x=1');
  assert.equal(chaveFato('https://example.org/fato?utm_source=a'),chaveFato('https://example.org/fato'));
  assert.equal(duplicada({url:'https://example.org/fato?utm_source=a',titulo:'Título diferente'},[{url:'https://example.org/fato'}]),true);
});
test('identifica títulos próximos sem bloquear assunto completamente diferente',()=>{
  assert.equal(duplicada({url:'https://example.org/2',titulo:'Prefeitura anuncia reforma da praça central'},[{titulo:'Reforma da praça central é anunciada pela Prefeitura'}]),true);
  assert.equal(duplicada({url:'https://example.org/2',titulo:'Prefeitura anuncia reforma da praça central'},[{titulo:'Vacinação infantil começa segunda-feira'}]),false);
});
test('exige texto, relevância local e data recente sem confundir data do fato',()=>{
  const base={url:'https://example.org/1',titulo:'Urânia informa reforma',texto:'Urânia '.repeat(100),publicado_em:'2026-11-08',ocorrido_em:'2026-11-07'},now=new Date('2026-11-09T12:00:00Z');
  assert.equal(elegivel(base,now),true);
  assert.equal(elegivel({...base,ocorrido_em:'2020-01-01'},now),false);
  assert.equal(elegivel({...base,publicado_em:null},now),false);
  assert.equal(elegivel({...base,texto:'Urânia'},now),false);
});
test('uma ação estadual restrita à capital não preenche a vaga regional de Urânia',()=>{
  const page={url:'https://estado.org/acao',titulo:'Governo de São Paulo inaugura hospital na capital',
    publicado_em:new Date().toISOString(),texto:'O hospital atende exclusivamente um bairro da capital. '.repeat(18)};
  assert.equal(elegivel(page,new Date(),'regional_nacional'),false);
});
