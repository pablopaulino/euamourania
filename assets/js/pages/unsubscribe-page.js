import { getSupabase } from "../services/supabaseClient.js";
const message=document.getElementById("unsubscribe-message"),token=new URLSearchParams(location.search).get("token");
if(!/^[0-9a-f-]{36}$/i.test(token||""))message.textContent="Link de descadastro inválido.";else{const{data,error}=await getSupabase().rpc("descadastrar_newsletter",{p_token:token});message.textContent=error?"Não foi possível concluir agora. Tente novamente.":data?.alterado?"Inscrição cancelada. Você não receberá novos e-mails.":"Esta inscrição já estava cancelada ou não foi encontrada."}
