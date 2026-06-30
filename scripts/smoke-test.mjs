const base=process.env.SITE_URL||"https://euamourania.com.br";
const routes=[
  "/","/news/","/guia.html","/turismo.html","/eventos/","/links/",
  "/quem-somos.html","/sitemap.xml","/news-sitemap.xml","/robots.txt",
  "/admin/login.html","/admin/publicidade.html","/admin/comunicacao.html",
  "/descadastrar.html"
];
const failures=[];

for(const path of routes){
  try{
    const response=await fetch(base+path,{redirect:"follow"});
    if(!response.ok)failures.push(`${path}: HTTP ${response.status}`);
    else console.log(`✓ ${path} (${response.status})`);
  }catch(error){
    failures.push(`${path}: ${error.message}`);
  }
}

const protectedEndpoint=await fetch(base+"/api/newsletter-send",{
  method:"POST",
  headers:{"Content-Type":"application/json"},
  body:"{}"
});
if(![401,403].includes(protectedEndpoint.status)){
  failures.push(`/api/newsletter-send: esperado bloqueio 401/403 sem autenticação, recebido ${protectedEndpoint.status}`);
}else{
  console.log(`✓ API de newsletter protegida (${protectedEndpoint.status})`);
}

if(failures.length){
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Smoke test concluído.");
