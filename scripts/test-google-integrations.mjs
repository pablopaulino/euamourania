import{readFile}from"node:fs/promises";
const root=new URL("../",import.meta.url),read=path=>readFile(new URL(path,root),"utf8");
const must=(condition,message)=>{if(!condition)throw new Error(message)};
const[config,audience,publicModule,script,admin,docs]=await Promise.all([
 read("api/google-config.js"),read("api/google-audience.js"),
 read("assets/js/pages/google-analytics-page.js"),read("script.js"),
 read("admin/editorial-audience.js"),read("DOCS/FLUXO-EDITORIAL-E-AUDIENCIA.md")
]);
must(config.includes("GA_MEASUREMENT_ID")&&config.includes("measurementId"),"Configuração pública do GA4 ausente");
must(!config.includes("GOOGLE_SERVICE_ACCOUNT_JSON"),"Endpoint público referencia credencial secreta");
must(audience.includes("GOOGLE_SERVICE_ACCOUNT_JSON")&&audience.includes("tem_permissao_admin"),"API Google sem credencial ou autorização");
must(audience.includes("analytics.readonly")&&audience.includes("webmasters.readonly"),"Escopos Google não são somente leitura");
must(!audience.includes("console.log")&&!audience.includes("private_key:"),"API pode expor credencial");
must(publicModule.includes('cookieConsent")==="accepted"')&&publicModule.includes("googletagmanager.com"),"GA4 não respeita consentimento");
must(script.includes("reject-cookies")&&script.includes("cookie-consent:accepted"),"Aviso de consentimento incompleto");
must(admin.includes("/api/google-audience")&&admin.includes("Google Analytics 4 e Search Console"),"Painel não consome relatórios Google");
must(docs.includes("cache por dez minutos")&&docs.includes("Nunca exponha o JSON"),"Documentação de segurança Google incompleta");
console.log("Integrações Google validadas: consentimento, OAuth, permissões, cache e painel.");
