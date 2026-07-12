import { getSupabase, supabaseConfigurado } from "../assets/js/services/supabaseClient.js";

const permissoesPorFuncao={
  super_admin:["*:*"] ,
  administrador:["dashboard:acessar","insights:acessar","insights:ler","noticias:*","categorias:*","guia_comercial:*","turismo:*","eventos:*","publicidade:*","comunicacao:*","notificacoes:*","melhores:*","links:*"],
  editor:["dashboard:acessar","noticias:acessar","noticias:ler","noticias:criar","noticias:editar","noticias:publicar","categorias:acessar","categorias:ler","categorias:criar","categorias:editar","melhores:acessar","melhores:ler"],
  redator:["dashboard:acessar","noticias:acessar","noticias:ler","noticias:criar","noticias:editar"],
  comercial:["dashboard:acessar","guia_comercial:acessar","guia_comercial:ler","guia_comercial:criar","guia_comercial:editar","publicidade:acessar","publicidade:ler","publicidade:criar","publicidade:editar","melhores:acessar","melhores:ler"],
  comunicacao:["dashboard:acessar","comunicacao:acessar","comunicacao:ler","comunicacao:criar","comunicacao:editar","comunicacao:excluir","comunicacao:enviar","notificacoes:*","links:acessar","links:ler","links:criar","links:editar","links:excluir"],
  visualizador:["dashboard:acessar","insights:acessar","insights:ler","noticias:ler","categorias:ler","guia_comercial:ler","turismo:ler","eventos:ler","publicidade:ler","comunicacao:ler","notificacoes:ler","melhores:acessar","melhores:ler","links:ler"]
};
const rotaModulo={"publicidade.html":"publicidade","comunicacao.html":"comunicacao","notificacoes-app.html":"notificacoes","melhores.html":"melhores","migrar.html":"importacao","usuarios.html":"usuarios"};
let acessoAtual=null;

export const rotulosFuncoes={super_admin:"Super Admin",administrador:"Administrador",editor:"Editor",redator:"Redator",comercial:"Comercial",comunicacao:"Comunicação",visualizador:"Visualizador"};
export function temPermissao(admin,modulo,acao="acessar"){
  if(!admin?.ativo)return false;
  const base=permissoesPorFuncao[admin.funcao]||[];
  if(base.includes("*:*")||base.includes(`${modulo}:*`)||base.includes(`${modulo}:${acao}`))return true;
  const extras=admin.permissoes_extra?.[modulo];
  return Array.isArray(extras)&&extras.includes(acao);
}
export const obterAcessoAtual=()=>acessoAtual;

export async function entrar(email,password){
  if(!supabaseConfigurado())throw new Error("Configure o Supabase antes de entrar.");
  const{data,error}=await getSupabase().auth.signInWithPassword({email,password});
  if(error)throw error;
  const autorizado=await verificarAdministrador(data.user.id);
  if(!autorizado){await getSupabase().auth.signOut({scope:"local"});throw new Error("Usuário sem permissão para acessar o CMS.")}
  const{error:loginError}=await getSupabase().rpc("registrar_login_admin");
  if(loginError)console.warn("Não foi possível registrar o último login.");
  return data;
}

export async function verificarAdministrador(userId){
  const{data,error}=await getSupabase().from("usuarios_admin").select("id,ativo,nome,email,funcao,permissoes_extra,ultimo_login,criado_em").eq("id",userId).eq("ativo",true).maybeSingle();
  if(error)throw error;
  return data;
}

export async function exigirAdministrador(){
  if(!supabaseConfigurado())return{configurado:false,user:null,admin:null};
  const{data:{session}}=await getSupabase().auth.getSession();
  if(!session){location.replace("login.html");return null}
  const admin=await verificarAdministrador(session.user.id);
  if(!admin){await getSupabase().auth.signOut({scope:"local"});location.replace("login.html?erro=sem-permissao");return null}
  acessoAtual={configurado:true,user:session.user,admin};
  const pagina=location.pathname.split("/").pop()||"index.html",modulo=rotaModulo[pagina];
  if(modulo&&!temPermissao(admin,modulo,"acessar")){location.replace("index.html?erro=acesso-negado");return null}
  try{const{aplicarControleAcesso}=await import("./access-control.js");aplicarControleAcesso(acessoAtual,temPermissao)}catch(error){console.warn("Controle visual de acesso indisponível.")}
  return acessoAtual;
}

export async function exigirPermissao(modulo,acao="acessar"){
  const acesso=await exigirAdministrador();
  if(!acesso)return null;
  if(!temPermissao(acesso.admin,modulo,acao)){location.replace("index.html?erro=acesso-negado");return null}
  return acesso;
}

export async function sair(){await getSupabase().auth.signOut({scope:"local"});location.replace("login.html")}
