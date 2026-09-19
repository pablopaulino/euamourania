import { getAppDownloadConfig } from "/assets/js/services/appDownloadConfig.js";

const header=document.querySelector(".site-header"),menu=document.getElementById("menu-principal"),menuButton=header?.querySelector(".menu-toggle"),searchTrigger=header?.querySelector(".search-trigger"),headerSearchInput=document.getElementById("header-search-input");
const closeHeaderSearch=()=>{header?.classList.remove("search-open");searchTrigger?.setAttribute("aria-expanded","false");};
searchTrigger?.addEventListener("click",()=>{menu?.classList.remove("is-open");menuButton?.setAttribute("aria-expanded","false");header?.classList.add("search-open");searchTrigger.setAttribute("aria-expanded","true");setTimeout(()=>headerSearchInput?.focus(),180);});
menuButton?.addEventListener("click",()=>{closeHeaderSearch();const open=menuButton.getAttribute("aria-expanded")!=="true";menuButton.setAttribute("aria-expanded",String(open));menu?.classList.toggle("is-open",open);});
header?.querySelector(".header-search-close")?.addEventListener("click",closeHeaderSearch);
document.addEventListener("keydown",event=>{if(event.key==="Escape")closeHeaderSearch();});
document.getElementById("year").textContent=new Date().getFullYear();

async function init(){
  await Promise.allSettled([import("/assets/js/pages/site-config-page.js"),import("/assets/js/pages/analytics-page.js"),import("/assets/js/pages/newsletter-public.js"),import("/assets/js/pages/google-analytics-page.js"),import("/assets/js/pages/smart-app-banner.js"),import("/assets/js/pages/error-monitor.js")]);
  const signup=document.querySelector(".newsletter-signup");
  if(signup){const title=signup.querySelector("h2"),description=signup.querySelector(".newsletter-box > div > p:last-child"),name=signup.querySelector('input[name="nome"]');if(title)title.textContent="Urânia direto no seu e-mail.";if(description)description.textContent="Receba notícias importantes, novidades da cidade e conteúdos do Eu Amo Urânia.";if(name){name.placeholder="Seu nome";name.required=true;}}
  try{const app=await getAppDownloadConfig();const href=app.googlePlayUrl||app.appStoreUrl||app.appPageUrl||"/app.html";document.querySelectorAll("[data-app-download]").forEach(link=>link.href=href);}catch{}
}
init();
