import { createRequire } from "node:module";

const require=createRequire(import.meta.url);
const handler=require("../api/noticia.js");
const {renderNews,renderGuide,renderTourism}=require("../lib/site-2026-detail-ssr.js");
const must=(condition,message)=>{if(!condition)throw new Error(message);};
const originalFetch=globalThis.fetch;

const fixtures={
  noticias:{id:"news-1",slug:"materia-teste",titulo:"Notícia real de Urânia",subtitulo:"Detalhes da notícia",resumo:"Resumo da matéria.",conteudo_html:'<h2>Conteúdo principal</h2><p>Texto completo da matéria. <img src="https://example.com/interior.jpg" alt="Imagem no corpo"></p>',imagem_url:"https://example.com/noticia.jpg",categoria_nome:"Cidade",autor:"Redação",publicado_em:"2026-10-10T12:00:00Z",criado_por:"USUARIO_INTERNO_NAO_PUBLICAR"},
  guia_comercial:{id:"guide-1",slug:"empresa-teste",nome:"Empresa real de Urânia",descricao:"Atendimento no centro de Urânia.",imagem_url:"https://example.com/empresa.jpg",categoria_nome:"Comércio",endereco:"Rua Central, 10",whatsapp:"5517999999999",status:"publicado",verificacao_interna:"ADMINISTRATIVO_NAO_PUBLICAR"},
  turismo:{id:"tour-1",slug:"lugar-teste",nome:"Lugar real de Urânia",descricao:"Um ponto para visitar em Urânia.",conteudo_html:"<h2>História do lugar</h2><p>Descrição completa do lugar.</p>",imagem_url:"https://example.com/lugar.jpg",endereco:"Praça Central",horario:"Todos os dias",status:"publicado",notas_internas:"PRIVADO_NAO_PUBLICAR"}
};

globalThis.fetch=async input=>{
  const url=String(input);
  if(url.includes("configuracoes_site"))return new Response(JSON.stringify([]),{status:200});
  const table=Object.keys(fixtures).find(name=>url.includes(`/rest/v1/${name}?`));
  if(table){
    const query=new URL(url).searchParams;
    must(query.get("select") && query.get("select")!=="*",`${table}: consulta ainda seleciona colunas administrativas`);
    must(query.get("status")==="eq.publicado",`${table}: filtro de publicação ausente`);
    if(table==="noticias")must(query.has("publicado_em"),"notícias futuras não foram filtradas");
    return new Response(JSON.stringify([fixtures[table]]),{status:200});
  }
  throw new Error(`Consulta inesperada: ${url}`);
};

async function request(tipo,slug){
  const response={statusCode:200,headers:{},setHeader(name,value){this.headers[name]=value;},status(code){this.statusCode=code;return this;},send(body){this.body=String(body);return this;}};
  await handler({query:{tipo,slug}},response);
  return response;
}

try{
  for(const [tipo,slug,title,expectedText,image,secret] of [
    ["news","materia-teste","Notícia real de Urânia","Texto completo da matéria.","noticia.jpg","USUARIO_INTERNO_NAO_PUBLICAR"],
    ["guia","empresa-teste","Empresa real de Urânia","Atendimento no centro de Urânia.","empresa.jpg","ADMINISTRATIVO_NAO_PUBLICAR"],
    ["turismo","lugar-teste","Lugar real de Urânia","Descrição completa do lugar.","lugar.jpg","PRIVADO_NAO_PUBLICAR"]
  ]){
    const {statusCode,body,headers}=await request(tipo,slug);
    must(statusCode===200,`${tipo}: status ${statusCode}`);
    must(headers["Cache-Control"]==="public, s-maxage=60, stale-while-revalidate=60",`${tipo}: cache longo ou ausente`);
    const main=body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]||"";
    must(main.includes(`<h1>${title}</h1>`),`${tipo}: título ausente do HTML bruto`);
    must(main.includes(expectedText),`${tipo}: texto principal ausente do HTML bruto`);
    must(main.includes(image),`${tipo}: imagem principal ausente do HTML bruto`);
    must(main.includes('data-server-rendered="true"'),`${tipo}: markup SSR não sinalizado para hidratação`);
    must(!body.includes(secret),`${tipo}: campo administrativo exposto`);
    must((body.match(/property="og:title"/g)||[]).length===1,`${tipo}: og:title duplicado`);
    must((body.match(/property="og:image"/g)||[]).length===1,`${tipo}: og:image duplicado`);
    must(!/Carregando empresa|Carregando lugar|Abrindo a notícia/.test(main),`${tipo}: placeholder inicial persistiu`);
  }
  must(renderNews(fixtures.noticias).includes('alt="Imagem no corpo"'),"Imagem incorporada à notícia ausente sem JavaScript");
  must(renderNews(fixtures.noticias).includes('aria-label="Compartilhar no WhatsApp"'),"Compartilhamento da notícia perdeu o markup visual inicial");
  const hours={mon:{open:"09:00",close:"18:00"}};
  const guide=renderGuide({...fixtures.guia_comercial,opening_hours:hours,horario:""});
  must(guide.includes('class="hours-list"') && guide.includes('class="opening-state'),"Horários e status da empresa ausentes do SSR");
  must(!renderGuide({...fixtures.guia_comercial,opening_hours:{},horario:""}).includes('class="hours-panel"'),"Horários vazios criaram painel na empresa");
  const tourism=renderTourism({...fixtures.turismo,opening_hours:hours,facebook:"https://facebook.com/urania",conteudo_html:`<p>${"Texto completo do lugar. ".repeat(50)}</p>`});
  must(tourism.includes('aria-label="Abrir Facebook"') && tourism.includes('class="hours-details"'),"Ações e horários do turismo não foram preservados");
  must(!tourism.includes('class="place-article is-collapsed"') && tourism.includes('hidden style="display:none" class="read-more"'),"Texto turístico ficou inacessível sem JavaScript");
  console.log("HTML inicial SSR de notícia, empresa e turismo validado sem JavaScript; metadados únicos e campos internos ocultos.");
}finally{globalThis.fetch=originalFetch;}
