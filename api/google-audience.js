const crypto=require("node:crypto");

const SUPABASE_URL=process.env.SUPABASE_URL||"https://omhcpbphvtihqwdkbsbf.supabase.co";
const SUPABASE_KEY=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||"sb_publishable_m02B2sC8Ddh4fCtnvsGePg_TqwUanoM";
const PROPERTY_ID=String(process.env.GA4_PROPERTY_ID||"").trim();
const SEARCH_SITE=String(process.env.SEARCH_CONSOLE_SITE_URL||"").trim();
const jsonHeaders={"Content-Type":"application/json"};
let tokenCache={token:null,expiresAt:0};
const reportCache=new Map();

function bearer(req){return String(req.headers.authorization||"").replace(/^Bearer\s+/i,"")}
async function canReadInsights(req){
  const token=bearer(req);if(!token)return false;
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/tem_permissao_admin`,{
    method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`,...jsonHeaders},
    body:JSON.stringify({p_modulo:"insights",p_acao:"ler"})
  });
  return response.ok&&await response.json()===true;
}
function credentials(){
  const raw=process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if(!raw)throw Object.assign(new Error("Credencial Google não configurada."),{status:503});
  try{
    const parsed=JSON.parse(raw);
    if(parsed.type!=="service_account"||!parsed.client_email||!parsed.private_key)throw new Error("formato");
    return parsed;
  }catch{
    throw Object.assign(new Error("GOOGLE_SERVICE_ACCOUNT_JSON inválida na Vercel."),{status:503});
  }
}
const b64=value=>Buffer.from(typeof value==="string"?value:JSON.stringify(value)).toString("base64url");
async function googleToken(){
  if(tokenCache.token&&tokenCache.expiresAt>Date.now()+60000)return tokenCache.token;
  const account=credentials(),now=Math.floor(Date.now()/1000);
  const unsigned=`${b64({alg:"RS256",typ:"JWT"})}.${b64({
    iss:account.client_email,
    scope:"https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly",
    aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600
  })}`;
  const signature=crypto.createSign("RSA-SHA256").update(unsigned).end().sign(account.private_key).toString("base64url");
  const response=await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:`${unsigned}.${signature}`})
  });
  const data=await response.json();
  if(!response.ok)throw Object.assign(new Error(data.error_description||"Não foi possível autenticar nas APIs Google."),{status:502});
  tokenCache={token:data.access_token,expiresAt:Date.now()+Number(data.expires_in||3600)*1000};
  return tokenCache.token;
}
async function googleFetch(url,{method="GET",body,token}={}){
  const response=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,...jsonHeaders},body:body?JSON.stringify(body):undefined});
  const text=await response.text(),data=text?JSON.parse(text):null;
  if(!response.ok){
    const message=data?.error?.message||`Google API ${response.status}`;
    throw Object.assign(new Error(message),{status:response.status===403?502:response.status});
  }
  return data;
}
function reportRows(report){
  const dimensions=(report.dimensionHeaders||[]).map(item=>item.name),metrics=(report.metricHeaders||[]).map(item=>item.name);
  return(report.rows||[]).map(row=>Object.fromEntries([
    ...dimensions.map((name,index)=>[name,row.dimensionValues?.[index]?.value||""]),
    ...metrics.map((name,index)=>[name,Number(row.metricValues?.[index]?.value||0)])
  ]));
}
async function analyticsReport(startDate,endDate,token){
  if(!/^\d+$/.test(PROPERTY_ID))throw Object.assign(new Error("GA4_PROPERTY_ID não configurada."),{status:503});
  const dateRanges=[{startDate,endDate}],metricOrder=name=>[{metric:{metricName:name},desc:true}];
  const body={requests:[
    {dateRanges,metrics:["activeUsers","sessions","screenPageViews","eventCount"].map(name=>({name}))},
    {dateRanges,dimensions:[{name:"date"}],metrics:[{name:"screenPageViews"},{name:"activeUsers"}],orderBys:[{dimension:{dimensionName:"date"}}],limit:"400"},
    {dateRanges,dimensions:[{name:"pagePath"}],metrics:[{name:"screenPageViews"},{name:"activeUsers"}],orderBys:metricOrder("screenPageViews"),limit:"10"},
    {dateRanges,dimensions:[{name:"sessionDefaultChannelGroup"}],metrics:[{name:"sessions"},{name:"activeUsers"}],orderBys:metricOrder("sessions"),limit:"10"},
    {dateRanges,dimensions:[{name:"deviceCategory"}],metrics:[{name:"activeUsers"}],orderBys:metricOrder("activeUsers"),limit:"10"}
  ]};
  const data=await googleFetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:batchRunReports`,{method:"POST",body,token});
  const reports=data.reports||[],summary=reportRows(reports[0]||{})[0]||{};
  return{
    summary,
    daily:reportRows(reports[1]||{}).map(item=>({...item,date:item.date?`${item.date.slice(0,4)}-${item.date.slice(4,6)}-${item.date.slice(6,8)}`:""})),
    pages:reportRows(reports[2]||{}),
    channels:reportRows(reports[3]||{}),
    devices:reportRows(reports[4]||{})
  };
}
async function searchQuery(startDate,endDate,dimensions,token,rowLimit=10){
  if(!SEARCH_SITE)throw Object.assign(new Error("SEARCH_CONSOLE_SITE_URL não configurada."),{status:503});
  return googleFetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SEARCH_SITE)}/searchAnalytics/query`,{
    method:"POST",token,body:{startDate,endDate,dimensions,rowLimit}
  });
}
const normalizeSearchRows=data=>(data.rows||[]).map(row=>({
  item:row.keys?.join(" · ")||"Total",clicks:Number(row.clicks||0),impressions:Number(row.impressions||0),
  ctr:Number(row.ctr||0),position:Number(row.position||0)
}));
async function searchConsoleReport(startDate,endDate,token){
  const [summary,queries,pages]=await Promise.all([
    searchQuery(startDate,endDate,[],token,1),
    searchQuery(startDate,endDate,["query"],token,10),
    searchQuery(startDate,endDate,["page"],token,10)
  ]);
  return{
    summary:normalizeSearchRows(summary)[0]||{clicks:0,impressions:0,ctr:0,position:0},
    queries:normalizeSearchRows(queries),
    pages:normalizeSearchRows(pages)
  };
}
function validDate(value){return/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(new Date(`${value}T12:00:00Z`).getTime())}

module.exports=async(req,res)=>{
  if(req.method!=="GET")return res.status(405).json({error:"Método não permitido"});
  if(!await canReadInsights(req))return res.status(403).json({error:"Permissão de audiência necessária."});
  const startDate=String(req.query.start||""),endDate=String(req.query.end||"");
  if(!validDate(startDate)||!validDate(endDate)||startDate>endDate)return res.status(400).json({error:"Período inválido."});
  if((new Date(endDate)-new Date(startDate))/864e5>366)return res.status(400).json({error:"O período máximo é de 367 dias."});
  const cacheKey=`${startDate}:${endDate}`,cached=reportCache.get(cacheKey);
  if(cached&&cached.expiresAt>Date.now())return res.status(200).json(cached.data);
  try{
    const token=await googleToken();
    const results=await Promise.allSettled([
      analyticsReport(startDate,endDate,token),
      searchConsoleReport(startDate,endDate,token)
    ]);
    const data={
      ga4:results[0].status==="fulfilled"?results[0].value:{error:results[0].reason.message},
      searchConsole:results[1].status==="fulfilled"?results[1].value:{error:results[1].reason.message},
      generatedAt:new Date().toISOString()
    };
    reportCache.set(cacheKey,{data,expiresAt:Date.now()+10*60*1000});
    res.setHeader("Cache-Control","private, max-age=300");
    return res.status(200).json(data);
  }catch(error){
    console.error("google-audience:",error.message);
    return res.status(error.status||500).json({error:error.message||"Falha ao consultar o Google."});
  }
};
