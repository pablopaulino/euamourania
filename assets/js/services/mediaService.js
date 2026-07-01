import { getSupabase } from "./supabaseClient.js";

const BUCKET="cms-media";
const MAX_SIZE=8*1024*1024;
const EXTENSIONS={
 "image/jpeg":"jpg",
 "image/png":"png",
 "image/webp":"webp",
 "image/gif":"gif",
 "image/avif":"avif"
};

export function validarImagem(arquivo){
 if(!arquivo)throw new Error("Escolha uma imagem.");
 if(!EXTENSIONS[arquivo.type])throw new Error("Use uma imagem JPG, PNG, WebP, GIF ou AVIF.");
 if(arquivo.size>MAX_SIZE)throw new Error("A imagem deve ter no máximo 8 MB.");
}

export async function uploadImagem(arquivo,pasta,{largura=null,altura=null,variante="otimizada"}={}){
 validarImagem(arquivo);
 const agora=new Date();
 const periodo=`${agora.getFullYear()}/${String(agora.getMonth()+1).padStart(2,"0")}`;
 const caminho=`${pasta}/${periodo}/${crypto.randomUUID()}.${EXTENSIONS[arquivo.type]}`;
 const {error}=await getSupabase().storage.from(BUCKET).upload(caminho,arquivo,{
  cacheControl:"31536000",
  contentType:arquivo.type,
  upsert:false
 });
 if(error)throw error;
 const url=getSupabase().storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
 const {data:{user}}=await getSupabase().auth.getUser();
 const {error:registroError}=await getSupabase().from("cms_midias").insert({
  bucket:BUCKET,caminho,url,pasta,nome_original:arquivo.name,mime_type:arquivo.type,
  tamanho:arquivo.size,largura,altura,variante,criado_por:user?.id||null
 });
 if(registroError){
  await getSupabase().storage.from(BUCKET).remove([caminho]);
  throw registroError;
 }
 return{url,caminho};
}

export async function listarMidias(){
 const {data,error}=await getSupabase().rpc("listar_midias_cms");
 if(error)throw error;
 return data||[];
}

export async function listarMidiasDisponiveis(){
 const {data,error}=await getSupabase().from("cms_midias")
  .select("id,url,caminho,pasta,nome_original,mime_type,tamanho,largura,altura,variante,criado_em")
  .eq("variante","otimizada")
  .order("criado_em",{ascending:false})
  .limit(500);
 if(error)throw error;
 return data||[];
}

export async function excluirMidia(midia){
 if(midia.em_uso)throw new Error("Esta imagem está sendo usada e não pode ser excluída.");
 const {error:storageError}=await getSupabase().storage.from(BUCKET).remove([midia.caminho]);
 if(storageError)throw storageError;
 const {error}=await getSupabase().from("cms_midias").delete().eq("id",midia.id);
 if(error)throw error;
}
