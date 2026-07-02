const SUPABASE_URL=process.env.SUPABASE_URL||"https://omhcpbphvtihqwdkbsbf.supabase.co";
const SUPABASE_KEY=process.env.SUPABASE_PUBLISHABLE_KEY||"sb_publishable_m02B2sC8Ddh4fCtnvsGePg_TqwUanoM";
const DEFAULT_DOMAIN="https://euamourania.com.br";
const DEFAULT_LOGO="/assets/Design%20sem%20nome%20(9).png";
const esc=(v="")=>String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const plain=(v="")=>String(v).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
const validDomain=v=>{try{const u=new URL(v);return /^https?:$/.test(u.protocol)?u.origin:DEFAULT_DOMAIN}catch{return DEFAULT_DOMAIN}};
const absolute=(v,domain,fallback=DEFAULT_LOGO)=>{try{return new URL(v||fallback,`${domain}/`).href}catch{return new URL(fallback,`${domain}/`).href}};
async function getConfig(){
  const keys="nome_site,seo_publicador,seo_logo,dominio_principal,imagem_compartilhamento,imagem_padrao_noticia,logo_principal,favicon";
  try{
    const response=await fetch(`${SUPABASE_URL}/rest/v1/configuracoes_site?select=chave,valor&chave=in.(${keys})`,{headers:{apikey:SUPABASE_KEY}});
    if(!response.ok)return{};
    return Object.fromEntries((await response.json()).map(item=>[item.chave,item.valor]));
  }catch{return{}}
}
module.exports=async(req,res)=>{
  const slug=String(req.query.slug||"").trim();
  if(!/^[a-z0-9-]+$/.test(slug)){res.status(404).send("Notícia não encontrada");return}
  try{
    const now=encodeURIComponent(new Date().toISOString());
    const [response,config]=await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/noticias?slug=eq.${encodeURIComponent(slug)}&status=eq.publicado&publicado_em=lte.${now}&select=*&limit=1`,{headers:{apikey:SUPABASE_KEY}}),
      getConfig()
    ]);
    const rows=await response.json(),n=rows?.[0];
    if(!response.ok||!n){res.status(404).send("Notícia não encontrada");return}
    const domain=validDomain(config.dominio_principal||DEFAULT_DOMAIN);
    const siteName=config.nome_site||"Eu Amo Urânia";
    const publisher=config.seo_publicador||siteName;
    const logo=absolute(config.seo_logo||config.logo_principal,domain);
    const favicon=absolute(config.favicon,domain);
    const canonical=`${domain}/noticias/${encodeURIComponent(n.slug)}`;
    const description=(n.seo_descricao||n.resumo||plain(n.conteudo_html)).slice(0,160);
    const image=absolute(n.seo_imagem||n.imagem_url||config.imagem_padrao_noticia||config.imagem_compartilhamento,domain);
    const title=`${n.seo_titulo||n.titulo} | ${siteName}`;
    const structured=JSON.stringify({"@context":"https://schema.org","@type":"NewsArticle",headline:n.titulo,description,image:[image],datePublished:n.publicado_em,dateModified:n.atualizado_em||n.publicado_em,author:{"@type":"Organization",name:n.autor||publisher},publisher:{"@type":"Organization",name:publisher,logo:{"@type":"ImageObject",url:logo}},mainEntityOfPage:canonical}).replace(/</g,"\\u003c");
    const initialNews=JSON.stringify(n).replace(/</g,"\\u003c");
    res.setHeader("Content-Type","text/html; charset=utf-8");
    res.setHeader("Cache-Control","public, s-maxage=300, stale-while-revalidate=86400");
    res.status(200).send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="article"><meta property="og:site_name" content="${esc(siteName)}"><meta property="og:title" content="${esc(n.titulo)}"><meta property="og:description" content="${esc(description)}"><meta property="og:image" content="${esc(image)}"><meta property="og:url" content="${esc(canonical)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(n.titulo)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(image)}"><meta name="theme-color" content="#0b4f6c"><script id="news-structured-data" type="application/ld+json">${structured}</script><script id="initial-news-data" type="application/json">${initialNews}</script><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/inner-pages.css"><link rel="stylesheet" href="/assets/css/public-polish.css"><link rel="icon" href="${esc(favicon)}"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"></head><body class="inner-page"><a class="skip-link" href="#newsDetails">Pular para a notícia</a><header class="site-header"><div class="container header-content"><a class="brand" href="/index.html"><img src="${esc(logo)}" alt="${esc(siteName)}" width="190" height="56"></a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="menu-principal"><span class="menu-icon" aria-hidden="true"></span><span>Menu</span></button><nav class="main-nav" id="menu-principal"><ul><li><a href="/index.html">Início</a></li><li><a href="/guia.html">Guia da cidade</a></li><li><a href="/turismo.html">Turismo</a></li><li><a href="/news/" aria-current="page">Notícias</a></li><li><a href="/quem-somos.html">Quem somos</a></li></ul></nav></div></header><main id="newsDetails" class="article-main" aria-live="polite"><p class="not-found-message">Carregando notícia…</p></main><footer class="site-footer"><div class="container footer-grid"><div><img src="${esc(logo)}" alt="${esc(siteName)}" class="footer-logo" width="170" height="50"><p>Informação, turismo e comunidade.</p></div><nav><a href="mailto:euamourania@gmail.com">Contato</a><a href="/termos-de-servico.html">Termos</a><a href="/politica-de-privacidade.html">Privacidade</a></nav></div><div class="container footer-bottom"><p>&copy; <span id="year"></span> ${esc(siteName)}.</p></div></footer><script src="/script.js"></script><script type="module" src="/assets/js/pages/noticia-page.js"></script></body></html>`);
  }catch(error){console.error(error);res.status(500).send("Não foi possível carregar a notícia")}
};
