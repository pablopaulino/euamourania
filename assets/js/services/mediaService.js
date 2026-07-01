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

export async function uploadImagem(arquivo,pasta){
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
 return getSupabase().storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
}
