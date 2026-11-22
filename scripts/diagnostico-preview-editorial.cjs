const {executar}=require("../lib/editorial-execucao");
(async()=>{
 if(process.env.GEMINI_FREE_TIER_CONFIRMED!=="true")throw Error("Confirmação do plano ausente");
 const fontes=[
   {nome:"Mural 17",url:"https://mural17.com.br/cidade/urania/",tipo:"site",escopo:"local",confiabilidade:"portal"},
   {nome:"CEPAS F",url:"https://portal.cepasf.com.br/edital/index/abertos",tipo:"site",escopo:"local",confiabilidade:"portal"}
 ];
 const db=async(path,options={})=>{
   if(path==="rpc/editorial_iniciar_execucao")return "teste-em-memoria";
   if(path.startsWith("editorial_fontes?"))return fontes;
   if(path.startsWith("editorial_configuracao?"))return [{limite_pautas:5,limite_materias:1}];
   if(path==="editorial_pautas")console.log("EDITORIAL triagem",options.body.map(p=>[p.titulo,p.relevancia]));
   if(path==="rpc/editorial_criar_rascunho_v2"){
     const draft=options.body.p_dados;
     console.log("EDITORIAL texto validado",draft.titulo,draft.categoria,draft.fontes.map(f=>new URL(f.url).hostname),draft.texto.length);
   }
   return [];
 };
 const r=await executar({db,apiKey:process.env.GEMINI_API_KEY,model:"gemini-3.5-flash-lite",freeTierConfirmed:true});
 console.log("EDITORIAL resultado",r.resumo);
})().catch(e=>console.log("EDITORIAL falha",e.message));
