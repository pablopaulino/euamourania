const {test}=require('node:test');const assert=require('node:assert/strict');const handler=require('../lib/automacao-editorial-handler');
function response(){return {statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};}
test('endpoint exige segredo de cron ou permissão de edição',async()=>{
  const old={...process.env},original=global.fetch;
  try{
    Object.assign(process.env,{SUPABASE_URL:'https://example.org',SUPABASE_SERVICE_ROLE_KEY:'test-service',SUPABASE_PUBLISHABLE_KEY:'test-public',CRON_SECRET:'test-cron'});
    let res=response();await handler({method:'GET',headers:{}},res);assert.equal(res.statusCode,401);
    global.fetch=async()=>({ok:true,json:async()=>false});
    res=response();await handler({method:'POST',headers:{authorization:'Bearer invalid'}},res);assert.equal(res.statusCode,403);
    global.fetch=async url=>url.includes('editorial_iniciar_execucao')?{ok:true,text:async()=> 'null'}:{ok:true,json:async()=>true};
    res=response();await handler({method:'GET',headers:{authorization:'Bearer test-cron'}},res);assert.equal(res.statusCode,200);assert.equal(res.body.ignorada,true);
  }finally{global.fetch=original;process.env=old;}
});
