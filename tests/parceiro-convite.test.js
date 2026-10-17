const test=require('node:test');
const assert=require('node:assert/strict');

test('revogar e convidar novamente o mesmo e-mail reutiliza a conta',async()=>{
  const previousKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousFetch=global.fetch;
  process.env.SUPABASE_SERVICE_ROLE_KEY='test-service-key';
  delete require.cache[require.resolve('../lib/admin-criar-parceiro.js')];
  const handler=require('../lib/admin-criar-parceiro.js');
  const guide='11111111-1111-4111-8111-111111111111';
  const partner={id:'22222222-2222-4222-8222-222222222222',user_id:'33333333-3333-4333-8333-333333333333',guia_id:guide,email:'teste@exemplo.com',ativo:true};
  let authCreates=0;
  global.fetch=async(url,options={})=>{
    const path=new URL(url).pathname;
    const query=new URL(url).searchParams;
    let data;
    if(path==='/auth/v1/user')data={id:'staff-id'};
    else if(path==='/rest/v1/usuarios_admin')data=[{id:'staff-id'}];
    else if(path==='/rest/v1/rpc/tem_permissao_admin')data=true;
    else if(path==='/rest/v1/rpc/parceiro_consumir_convite_limite')data=true;
    else if(path==='/rest/v1/guia_comercial')data=[{id:guide}];
    else if(path==='/rest/v1/parceiros'&&options.method==='PATCH'){
      partner.ativo=JSON.parse(options.body).ativo;
      data=null;
    }else if(path==='/rest/v1/parceiros'&&query.get('ativo')==='eq.true')data=partner.ativo?[partner]:[];
    else if(path==='/rest/v1/parceiros'&&query.get('email'))data=[partner];
    else if(path==='/auth/v1/admin/generate_link')data={action_link:'https://example.test/recovery'};
    else if(path==='/auth/v1/admin/users'){authCreates++;data={id:'unexpected'};}
    else throw Error(`Chamada inesperada: ${url}`);
    return {ok:true,status:200,json:async()=>data};
  };
  const invoke=async body=>{
    let result;
    const res={status(code){result={code};return this},json(data){result.data=data;return this}};
    await handler({method:'POST',headers:{authorization:'Bearer staff-token'},body:{guia_id:guide,...body},socket:{remoteAddress:'127.0.0.1'}},res);
    return result;
  };
  try{
    assert.equal((await invoke({action:'revoke'})).code,200);
    assert.equal(partner.ativo,false);
    const result=await invoke({action:'invite',email:partner.email});
    assert.equal(result.code,200);
    assert.equal(result.data.reactivated,true);
    assert.equal(result.data.invite_link,'https://example.test/recovery');
    assert.equal(partner.ativo,true);
    assert.equal(authCreates,0);
  }finally{
    global.fetch=previousFetch;
    if(previousKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY=previousKey;
  }
});
