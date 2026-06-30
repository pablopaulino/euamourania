let loaded=false;
function hasConsent(){
  try{return localStorage.getItem("cookieConsent")==="accepted"}catch{return false}
}
async function loadGoogleAnalytics(){
  if(loaded||!hasConsent())return;
  try{
    const response=await fetch("/api/google-config",{headers:{Accept:"application/json"}});
    if(!response.ok)return;
    const config=await response.json(),id=config.measurementId;
    if(!config.enabled||!/^G-[A-Z0-9]+$/i.test(id||""))return;
    loaded=true;
    window.dataLayer=window.dataLayer||[];
    window.gtag=function(){window.dataLayer.push(arguments)};
    window.gtag("js",new Date());
    window.gtag("config",id,{anonymize_ip:true,send_page_view:true});
    const script=document.createElement("script");
    script.async=true;script.src=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.append(script);
  }catch(error){
    console.warn("Google Analytics indisponível:",error.message);
  }
}
window.addEventListener("cookie-consent:accepted",loadGoogleAnalytics);
loadGoogleAnalytics();
