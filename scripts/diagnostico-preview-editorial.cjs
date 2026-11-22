const {lerRecurso,linksPagina}=require("../lib/editorial-fontes");
(async()=>{
  const key=process.env.GEMINI_API_KEY;
  if(!key || process.env.GEMINI_FREE_TIER_CONFIRMED!=="true" || process.env.GEMINI_MODEL!=="gemini-2.5-flash-lite")return;
  for(const version of ["v1","v1beta"]){
    const model="gemini-2.5-flash-lite",base="https://generativelanguage.googleapis.com/"+version+"/models/"+model;
    const h={"x-goog-api-key":key,"content-type":"application/json"};
    for(const method of ["GET","POST"]){
      const r=await fetch(base+(method==="POST"?":generateContent":""),{method,headers:h,body:method==="POST"?JSON.stringify({contents:[{parts:[{text:"Responda OK."}]}]}):undefined,signal:AbortSignal.timeout(12000)});
      const j=await r.json();
      const why=(j.error?.message||"").replaceAll(key,"[redigido]").replace(/[A-Za-z0-9_-]{32,}/g,"[redigido]").slice(0,300);
      console.log("EDITORIAL modelo",version,method,r.status,why);
    }
  }
  for(const url of ["https://urania.sp.gov.br/","https://www.urania.sp.gov.br/noticias","https://cmurania.sp.gov.br/feed/","https://dosp.com.br/diario/sp/urania/","https://imprensaoficialmunicipal.com.br/listaatos.php?c=Ur%C3%A2nia&s=Decretos","https://mural17.com.br/cidade/urania/"]){
    try{const r=await lerRecurso(url,{signal:AbortSignal.timeout(5000)});console.log("EDITORIAL fonte",url,r.type,linksPagina(r.body,r.u,3).map(u=>new URL(u).pathname));}catch(e){console.log("EDITORIAL fonte",url,e.message)}
  }
})().catch(e=>console.log("EDITORIAL erro",e.name));
