const {createHash}=require('node:crypto');

function normalizarTexto(value) {
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
const stop=new Set('a ao aos as com da das de do dos e em na nas no nos o os para pela pelas pelo pelos por que um uma urania'.split(' '));
function palavras(value) { return new Set(normalizarTexto(value).split(' ').filter(x=>x.length>2&&!stop.has(x))); }
function similaridade(a,b) {
  const x=palavras(a),y=palavras(b);if(x.size<3||y.size<3)return 0;
  let count=0;for(const token of x)if(y.has(token))count++;
  return count/Math.min(x.size,y.size);
}
function urlCanonica(value) {
  const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw new Error('URL inválida');
  u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_.+|gclid|fbclid)$/i.test(k))u.searchParams.delete(k);
  u.searchParams.sort();u.hostname=u.hostname.toLowerCase();u.pathname=u.pathname.replace(/\/+$/,'')||'/';return u.href;
}
function chaveFato(url) {return createHash('sha256').update(urlCanonica(url)).digest('hex');}
function duplicada(pauta, anteriores) {
  const canonical=urlCanonica(pauta.url);
  return anteriores.some(item=>{
    if(item.url){try{if(urlCanonica(item.url)===canonical)return true;}catch{}}
    return (item.titulo && normalizarTexto(pauta.titulo)===normalizarTexto(item.titulo)) || similaridade(pauta.titulo,item.titulo)>=0.75;
  });
}
// A data da fonte e a data do acontecimento são campos distintos. A ausência
// de data verificável ou texto suficiente impede seleção automática.
function escopoDaPagina(pauta, sugerido) {
  const titulo=normalizarTexto(pauta.titulo);
  const inicio=normalizarTexto(pauta.texto).slice(0,1400);
  const local=/\burania\b/;
  const regional=/\b(comarca de jales|noroeste paulista|regiao de jales|regional de jales|estado de sao paulo|governo de sao paulo|todo o (?:estado|brasil|pais)|em todo o (?:territorio nacional|pais)|todos os municipios paulistas)\b/;
  const servico=/\b(alerta|chuva|clima|agricultura|agricultores|safra|fruticultura|sus|saude|vacina\w*|hospital|beneficio\w*|inscric\w*|concurso\w*|rodovia\w*|educacao|programa social|bolsa familia|atendimento|matricula\w*)\b/;
  const destaque=titulo+' '+inicio.slice(0,450);
  const area=/\b(comarca de jales|noroeste paulista|regiao de jales|regional de jales|todos os municipios paulistas|todo o estado|todo o pais|todo o brasil|territorio nacional|rede estadual paulista|em todo o estado de sao paulo)\b/;
  const localNoTitulo=local.test(titulo);
  const focoLocal=localNoTitulo || /\b(em urania|de urania|municipio de urania|moradores de urania)\b/.test(inicio.slice(0,300));
  if(focoLocal && !regional.test(titulo) &&
     (sugerido!=='regional_nacional' || /\b(em urania|prefeitura de urania|camara de urania)\b/.test(titulo))) return 'local';
  // Exige serviço e abrangência aplicável. O nome do governo isolado não
  // demonstra que um programa restrito a outra cidade atende Urânia.
  if(servico.test(destaque) && (area.test(destaque) ||
     (local.test(inicio) && (regional.test(destaque) || /\bjales\b/.test(titulo) || sugerido==='regional_nacional'))))
    return 'regional_nacional';
  return null;
}
function elegivel(pauta, agora=new Date(), escopo) {
  if(!pauta || typeof pauta.texto!=='string' || pauta.texto.trim().length<600 || !pauta.titulo || !pauta.url)return false;
  const published=Date.parse(pauta.publicado_em||'');
  if(!Number.isFinite(published)||published>agora.getTime()||agora.getTime()-published>7*86400000)return false;
  if(pauta.ocorrido_em){const occurred=Date.parse(pauta.ocorrido_em);if(!Number.isFinite(occurred)||agora.getTime()-occurred>30*86400000)return false;}
  return Boolean(escopoDaPagina(pauta,escopo));
}
module.exports={normalizarTexto,similaridade,urlCanonica,chaveFato,duplicada,elegivel,escopoDaPagina};
