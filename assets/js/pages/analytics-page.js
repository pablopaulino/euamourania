import { getSupabase } from "../services/supabaseClient.js";
import { registrarEventoSite } from "../services/analyticsService.js";

const once=new Set();
function record(tipo,data={}){const key=`${tipo}:${data.recursoId||data.destino||location.pathname}`;if(once.has(key))return;once.add(key);registrarEventoSite(tipo,data)}
record("page_view");

document.addEventListener("click",event=>{
 const link=event.target.closest("a[href]");if(!link)return;
 const href=link.href||"",guide=link.closest("[data-guide-id]");
 if(/wa\.me|whatsapp\.com/i.test(href))record("whatsapp_click",{recursoTipo:guide?"guia":null,recursoId:guide?.dataset.guideId||null,destino:href});
 else if(/^https?:/i.test(href)&&new URL(href).origin!==location.origin)record("external_click",{recursoTipo:guide?"guia":null,recursoId:guide?.dataset.guideId||null,destino:href});
});

async function noticiaView(){
 const slug=location.pathname.match(/^\/noticias\/([^/]+)/)?.[1]||new URLSearchParams(location.search).get("slug");if(!slug)return;
 const {data}=await getSupabase().from("noticias").select("id").eq("slug",decodeURIComponent(slug)).maybeSingle();
 if(data?.id)record("noticia_view",{recursoTipo:"noticia",recursoId:data.id});
}
window.addEventListener("noticia:renderizada",noticiaView,{once:true});
