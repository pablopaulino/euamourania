// Leitura defensiva para o futuro trabalhador editorial. Nunca executa scripts.
const https = require('node:https');
const dns = require('node:dns').promises;
const net = require('node:net');

function urlSegura(input, base) {
  const u = new URL(input, base);
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || net.isIP(u.hostname) || u.hostname === 'localhost' || !u.hostname.includes('.')) throw new Error('Endereço de fonte inválido');
  u.hash='';
  return u;
}
function ipPublico(ip) {
  if (net.isIP(ip)!==4) return false;
  const [a,b,c]=ip.split('.').map(Number);
  return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19)||a===192&&b===0||a===192&&b===2||a===198&&b===51&&c===100||a===203&&b===0&&c===113);
}
function escolherIpv4(addresses) {
  const ipv4=addresses.filter(x=>net.isIP(x.address)===4);
  if(!ipv4.length || ipv4.some(x=>!ipPublico(x.address)))throw new Error('Endereço de rede não permitido');
  return ipv4[0].address;
}
async function obter(url, {limite=500000, timeout=8000,signal,referenciaGoogle=false}={}) {
  const u=urlSegura(url), addresses=await dns.lookup(u.hostname,{all:true,verbatim:true});
  const address=escolherIpv4(addresses);
  return new Promise((resolve,reject)=>{
    const req=https.get(u,{signal,headers:{'user-agent':'EuAmoUraniaEditorial/1.0','accept':'text/html, application/rss+xml, application/atom+xml, application/xml, text/xml, text/plain'},lookup:(_host,opts,cb)=>opts.all?cb(null,[{address,family:4}]):cb(null,address,4)},res=>{
      if(res.statusCode>=300&&res.statusCode<400){res.resume();
        if(referenciaGoogle && u.hostname==='vertexaisearch.cloud.google.com' && res.headers.location) {
          try {resolve({destino:urlSegura(res.headers.location,u).href});} catch(error){reject(error);}
        } else reject(new Error('Redirecionamento não permitido'));
        return;}
      const chunks=[];let length=0;
      res.on('data',chunk=>{length+=chunk.length;if(length>limite){req.destroy(new Error('Resposta excede o limite'));return;}chunks.push(chunk);});
      res.on('end',()=>resolve({status:res.statusCode,type:String(res.headers['content-type']||'').toLowerCase(),body:Buffer.concat(chunks).toString('utf8')}));
      res.on('error',reject);
    });
    req.setTimeout(timeout,()=>req.destroy(new Error('Tempo de leitura esgotado')));
    req.on('error',reject);
  });
}
function robotsPermite(text,path) {
  // Grupos específicos prevalecem sobre o grupo genérico. Regras complexas
  // são recusadas para não interpretar uma restrição de forma permissiva.
  const groups=[];let group=null,seenRule=false;
  for(const raw of text.split(/\r?\n/)){
    const line=raw.replace(/#.*/,''),i=line.indexOf(':');if(i<0)continue;
    const key=line.slice(0,i).trim().toLowerCase(),value=line.slice(i+1).trim();
    if(key==='user-agent') { if(!group||seenRule){group={agents:[],rules:[]};groups.push(group);seenRule=false;} group.agents.push(value.toLowerCase()); }
    else if(group && (key==='allow'||key==='disallow')){seenRule=true;if(value)group.rules.push({key,value});}
  }
  const specific=groups.filter(g=>g.agents.some(a=>a==='euamouraniaeditorial'));
  const rules=(specific.length?specific:groups.filter(g=>g.agents.includes('*'))).flatMap(g=>g.rules);
  if(rules.some(r=>/[*$]/.test(r.value)))return false;
  const matches=rules.filter(r=>path.startsWith(r.value)).sort((a,b)=>b.value.length-a.value.length||(a.key==='allow'?-1:1));
  return !matches.length || matches[0].key==='allow';
}
function entidadesPt(value) {
  const acentos={acute:'\u0301',grave:'\u0300',circ:'\u0302',tilde:'\u0303',cedil:'\u0327',uml:'\u0308'};
  return value.replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>{
    const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);
    return code>0 && code<=0x10ffff?String.fromCodePoint(code):' ';
  }).replace(/&([aeiouc])(acute|grave|circ|tilde|cedil|uml);/gi,(_,l,a)=>(l+acentos[a.toLowerCase()]).normalize('NFC'));
}
function texto(html) {
  return html.replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|noscript|svg|nav|footer|header|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s+/g,' ').trim();
}
function itensFeed(xml,origem,limite=10) {
  const results=[];
  for(const item of xml.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi)||[]){
    const raw=item.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i)?.[1] || item.match(/<link\b[^>]*>\s*(?:<!\[CDATA\[)?([^<\]\s]+)(?:\]\]>)?\s*<\/link>/i)?.[1];
    if(!raw)continue;
    try{const u=urlSegura(raw.replace(/&amp;/g,'&'),origem);if(u.origin===origem.origin&&!results.some(x=>x.url===u.href)){
      const rawDate=item.match(/<(?:pubDate|published)\b[^>]*>\s*(?:<!\[CDATA\[)?([^<\]]+)/i)?.[1]?.trim();
      results.push({url:u.href,publicado_em:rawDate&&Number.isFinite(Date.parse(rawDate))?new Date(rawDate).toISOString():null});
    }}catch{}
    if(results.length>=limite)break;
  }
  return results;
}
function linksFeed(xml,origem,limite=10) { return itensFeed(xml,origem,limite).map(x=>x.url); }
function linksPagina(html,origem,limite=10) {
  const results=[],seen=new Set();
  const articles=html.match(/<article\b[^>]*>[\s\S]*?<\/article\s*>/gi)||[];
  const area=articles.length?articles.join(' '):html.replace(/<(nav|header|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ');
  for(const match of area.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi)){
    try{const u=urlSegura(match[1].replace(/&amp;/g,'&'),origem);if(u.origin!==origem.origin||u.pathname===origem.pathname||seen.has(u.href)||/\.(?:jpe?g|png|svg|webp|pdf)$/i.test(u.pathname))continue;seen.add(u.href);const relevant=/ur[aâ]nia/i.test(decodeURIComponent(u.href)+' '+texto(match[2]));results.push({url:u.href,relevant});}catch{}
  }
  const prioridade=item=>{
    const path=new URL(item.url).pathname;
    if(origem.hostname==='portal.cepasf.com.br' && /^\/edital\/ver\/\d+\/?$/.test(path)) return 4;
    const materia=/\/(?:19|20)\d{2}\/\d\d\/\d\d\/[^/]+|\/noticias\/[^/]+\/[^/]+/i.test(path);
    return (materia?2:0)+Number(item.relevant);
  };
  return results.sort((a,b)=>prioridade(b)-prioridade(a)).slice(0,limite).map(x=>x.url);
}
async function lerRecurso(input,{request=obter,signal}={}) {
  const u=urlSegura(input), robots=await request(new URL('/robots.txt',u).href,{limite:100000,signal});
  if(robots.status!==404 && (robots.status!==200 || !robotsPermite(robots.body,u.pathname+u.search)))throw new Error('Acesso não autorizado pelo robots.txt ou indisponível');
  const page=await request(u.href,{signal});
  if(page.status!==200)throw new Error('Fonte indisponível (HTTP '+page.status+')');
  return {u,...page};
}
async function lerPagina(input,{request=obter,signal,grounding=false}={}) {
  const ref=urlSegura(input);
  if(grounding && ref.hostname==='vertexaisearch.cloud.google.com' && ref.pathname.startsWith('/grounding-api-redirect/')) {
    const redirect=await request(ref.href,{signal,referenciaGoogle:true});
    if(!redirect.destino) throw Error('Referência Google sem destino verificável');
    input=redirect.destino;
  }
  const {u,...page}=await lerRecurso(input,{request,signal});
  if(page.status!==200 || !/text\/html|application\/xhtml\+xml/.test(page.type))throw new Error('Página indisponível ou formato não suportado');
  const main=page.body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || page.body;
  const clean=main.replace(/<article\b[^>]*class=["'][^"']*conteudo-relacionado[^"']*["'][^>]*>[\s\S]*?<\/article>/gi,'');
  const artigos=clean.match(/<article\b[^>]*>[\s\S]*?<\/article>/gi)||[];
  const principal=artigos.find(a=>/<h1\b/i.test(a)) || (/<h1\b/i.test(clean)?clean:artigos[0]||clean);
  const content=entidadesPt(texto(principal));
  if(content.length<600)throw new Error('Página não contém texto suficiente para apuração');
  const tags=page.body.match(/<meta\b[^>]*>/gi)||[];
  const tag=tags.find(t=>/\b(?:property|name)\s*=\s*["'](?:article:published_time|datePublished|date)["']/i.test(t));
  let published=tag?.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1];
  if(!published){
    const articles=page.body.match(/<article\b[^>]*>[\s\S]*?<\/article\s*>/gi)||[];
    const primary=articles.filter(a=>/<h1\b/i.test(a));
    if(primary.length===1){const times=primary[0].match(/<time\b[^>]*>/gi)||[];if(times.length===1)published=times[0].match(/\bdatetime\s*=\s*["']([^"']+)["']/i)?.[1];}
  }
  const cabecalho=principal.match(/<header\b[^>]*>([\s\S]*?<h1\b[\s\S]*?)<\/header>/i)?.[1];
  if(!published && cabecalho) {
    const tempos=cabecalho.match(/<time\b[^>]*>/gi)||[];
    if(tempos.length===1) published=tempos[0].match(/\bdatetime=["']([^"']+)/i)?.[1];
  }
  if(!published && /<h1\b/i.test(page.body)){
    const dataAutor=principal.match(/<p\b[^>]*class=["'][^"']*\bdata\b[^"']*["'][^>]*>\s*(\d{1,2} de [\p{L}]+ de \d{4} às \d{2}:\d{2})\s*<\/p>/iu)?.[1];
    const plain=dataAutor?'Publicado em '+dataAutor:texto(principal), matches=[...plain.matchAll(/\bpublicado em\s+(\d{1,2}) de (janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro) de (\d{4})(?:\s+às\s+(\d{1,2}):(\d{2}))?/gi)];
    if(matches.length===1){const m=matches[0],month=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'].indexOf(m[2].toLowerCase())+1;published=`${m[3]}-${String(month).padStart(2,'0')}-${m[1].padStart(2,'0')}T${(m[4]||'12').padStart(2,'0')}:${m[5]||'00'}:00-03:00`;}
  }
  let titulo=principal.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || page.body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  if(u.hostname==='portal.cepasf.com.br' && /^\/edital\/ver\/\d+\/?$/.test(u.pathname)) {
    const heading=page.body.match(/<p\b[^>]*>\s*<u\b[^>]*>([^<]+)<\/u>\s*<br\s*\/?>\s*([^<]+)<\/p>/i);
    if(heading) titulo=heading[1]+' — '+heading[2];
    // A data pertence ao ato de abertura; inscrições, provas e retificações têm outras datas.
    const opening=page.body.match(/<small\b[^>]*>\s*(\d{2})\/(\d{2})\/(\d{4})\s*<\/small>\s*<\/div>\s*<div\b[^>]*>\s*<p\b[^>]*>([^<]+)<\/p>/gi)||[];
    const aviso=opening.find(line=>/torna p[úu]blica a abertura de inscri/i.test(line));
    const data=aviso?.match(/>(\d{2})\/(\d{2})\/(\d{4})</);
    if(!published && data) published=data[3]+'-'+data[2]+'-'+data[1]+'T00:00:00-03:00';
  }
  return {url:u.href,titulo:entidadesPt(texto(titulo)),texto:content.slice(0,24000),publicado_em:published&&Number.isFinite(Date.parse(published))?new Date(published).toISOString():null,consultado_em:new Date().toISOString()};
}
module.exports={urlSegura,ipPublico,escolherIpv4,robotsPermite,texto,linksFeed,itensFeed,linksPagina,lerPagina,lerRecurso};
