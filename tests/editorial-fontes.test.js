const {test}=require('node:test');
const assert=require('node:assert/strict');
const {urlSegura,ipPublico,escolherIpv4,robotsPermite,linksFeed,itensFeed,linksPagina,lerPagina}=require('../lib/editorial-fontes');
test('rejeita endereços locais e credenciais',()=>{
  for(const url of ['http://example.org','https://127.0.0.1/','https://user:pass@example.org/','https://localhost/','https://example.org:8443/'])assert.throws(()=>urlSegura(url));
  for(const ip of ['127.0.0.1','10.1.2.3','169.254.169.254','192.168.1.1','100.64.0.1','::1'])assert.equal(ipPublico(ip),false);
  assert.equal(ipPublico('8.8.8.8'),true);
});
test('aceita DNS misto usando apenas IPv4 público e recusa IPv4 privado',()=>{
  assert.equal(escolherIpv4([{address:'2001:4860:4860::8888'},{address:'8.8.8.8'}]),'8.8.8.8');
  assert.throws(()=>escolherIpv4([{address:'8.8.8.8'},{address:'127.0.0.1'}]));
  assert.throws(()=>escolherIpv4([{address:'::1'}]));
});
test('respeita regras robots e recusa regras complexas',()=>{
  assert.equal(robotsPermite('User-agent: *\nDisallow: /privado\nAllow: /privado/aberto','/privado/aberto'),true);
  assert.equal(robotsPermite('User-agent: *\nDisallow: /privado','/privado/a'),false);
  assert.equal(robotsPermite('User-agent: *\nDisallow: /*.pdf$','/publico'),false);
});
test('feed só fornece links do mesmo domínio',()=>{
  const feed='<rss><item><link>https://exemplo.org/a</link></item><item><link>https://outro.org/b</link></item></rss>';
  assert.deepEqual(linksFeed(feed,new URL('https://exemplo.org/rss')),['https://exemplo.org/a']);
});
test('preserva a data de publicação dos itens RSS e Atom',()=>{
  const feed='<rss><item><link>https://exemplo.org/a</link><pubDate>Mon, 16 Nov 2026 12:00:00 GMT</pubDate></item><entry><link href="/b"/><published>2026-11-17T12:00:00Z</published></entry><item><link>https://outro.org/x</link><pubDate>Mon, 16 Nov 2026 12:00:00 GMT</pubDate></item></rss>';
  assert.deepEqual(itensFeed(feed,new URL('https://exemplo.org/feed')), [{url:'https://exemplo.org/a',publicado_em:'2026-11-16T12:00:00.000Z'},{url:'https://exemplo.org/b',publicado_em:'2026-11-17T12:00:00.000Z'}]);
});
test('site só sugere páginas do mesmo domínio',()=>{
  assert.deepEqual(linksPagina('<a href="/noticia">Notícia</a><a href="https://outro.org/x">Outro</a>',new URL('https://exemplo.org/')),['https://exemplo.org/noticia']);
});
test('prioriza matérias da capa sobre atalhos de serviço',()=>{
  const html='<a href="/servicos/">Urânia</a><a href="/2026/11/21/noticia/">Notícia</a>';
  assert.deepEqual(linksPagina(html,new URL('https://exemplo.org/'),1),['https://exemplo.org/2026/11/21/noticia/']);
});
test('edital da banca usa o título municipal e a data do ato de abertura',async()=>{
  const body='<p><u>Concurso Público 002/2026</u><br>Prefeitura de Urânia</p>'+
    '<small>21/11/2026</small></div><div><p>Início das inscrições</p></div>'+
    '<small>17/11/2026</small></div><div><p>A Prefeitura torna pública a abertura de inscrições. '+
    'Texto do edital municipal. '.repeat(35)+'</p></div>';
  const request=async url=>url.endsWith('/robots.txt')?{status:404}:{status:200,type:'text/html',body};
  const page=await lerPagina('https://portal.cepasf.com.br/edital/ver/23',{request});
  assert.equal(page.titulo,'Concurso Público 002/2026 — Prefeitura de Urânia');
  assert.equal(page.publicado_em,'2026-11-17T03:00:00.000Z');
});
test('extrai comunicado municipal com entidades e separa notícias relacionadas',async()=>{
  const html='<main><header><h1>Concurso em Ur&#194;nia</h1><time datetime="2026-11-18">18/11/2026</time></header>'+
    '<p>'+('Inscri&ccedil;&otilde;es municipais. '.repeat(50))+'</p><article class="conteudo-relacionado no-print">Outra pauta</article></main>';
  const request=async u=>u.endsWith('/robots.txt')?{status:404}:{status:200,type:'text/html',body:html};
  const p=await lerPagina('https://exemplo.org/noticias/concurso',{request});
  assert.equal(p.titulo,'Concurso em UrÂnia');assert.match(p.texto,/Inscrições/);
  assert.doesNotMatch(p.texto,/Outra pauta/);assert.equal(p.publicado_em.slice(0,10),'2026-11-18');
});
test('consulta robots antes de ler e recusa texto insuficiente',async()=>{
  const calls=[];const request=async u=>{calls.push(u);return u.endsWith('/robots.txt')?{status:200,body:'User-agent: *\nDisallow: /proibido'}:{status:200,type:'text/html',body:'<title>Teste</title><article>'+('Texto local '.repeat(100))+'</article>'}};
  const result=await lerPagina('https://exemplo.org/noticia',{request});assert.equal(result.titulo,'Teste');assert.equal(calls.length,2);
  await assert.rejects(lerPagina('https://exemplo.org/proibido',{request}),/robots/);
  await assert.rejects(lerPagina('https://exemplo.org/noticia',{request:async u=>u.endsWith('/robots.txt')?{status:404}:{status:200,type:'text/html',body:'curto'}}),/suficiente/);
});
test('lê data do artigo principal sem usar datas de artigos relacionados',async()=>{
  const request=async u=>u.endsWith('/robots.txt')?{status:404}:{status:200,type:'text/html',body:'<title>Urânia</title><article><h1>Urânia</h1><time datetime="2026-11-06T15:24:36-03:00">data</time>'+('Texto '.repeat(150))+'</article><article><time datetime="2020-01-01">outra</time></article>'};
  assert.equal((await lerPagina('https://exemplo.org/noticia',{request})).publicado_em,'2026-11-06T18:24:36.000Z');
});
test('reconhece data de publicação identificada em português',async()=>{
  const request=async u=>u.endsWith('/robots.txt')?{status:404}:{status:200,type:'text/html',body:'<h1>Urânia</h1><p>Publicado em</p><p>07 de novembro de 2026 às 13:15</p>'+('Texto '.repeat(150))};
  assert.equal((await lerPagina('https://exemplo.org/noticia',{request})).publicado_em,'2026-11-07T16:15:00.000Z');
});
test('a referência do Google exige leitura do artigo final e respeita seu robots',async()=>{
  const google='https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc';
  const destino='https://jornal.org/artigo';
  const calls=[];
  const request=async(url,op)=>{
    calls.push(url);
    if(url===google && op.referenciaGoogle) return {destino};
    if(url.endsWith('/robots.txt')) return {status:200,body:'User-agent: *\nDisallow: /artigo'};
    throw Error('a página restrita não deveria ser aberta');
  };
  await assert.rejects(lerPagina(google,{request,grounding:true}),/robots/);
  assert.deepEqual(calls,[google,'https://jornal.org/robots.txt']);
});
