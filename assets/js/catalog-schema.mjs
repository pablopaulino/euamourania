// Viva Urânia Catalog v1: transport only. Operational data lives in relational tables.
export const statuses = ['rascunho', 'ativo', 'inativo', 'em_revisao', 'desatualizado'];
export const sources = ['manual', 'json', 'externa'];
export const newKey = () => crypto.randomUUID();
export function emptyCatalog() {
  return { version: 1, catalog: { key: newKey(), name: '', description: '', status: 'rascunho', source: 'manual', external_id: null, order: 0, currency: 'BRL', categories: [] } };
}
export function emptyProduct() {
  return { key: newKey(), name: '', description: '', status: 'ativo', availability: 'disponivel', price_mode: 'fixo', price_cents: 0, promo_price_cents: null, order: 0, sku: null, external_id: null, source: 'manual', accepts_notes: false, images: [], variants: [], option_groups: [] };
}
export function validateCatalog(doc) {
  const errors = [], keys = new Set(), references = [], products = new Set();
  const counts = { categories: 0, products: 0, variants: 0, groups: 0, options: 0 };
  const fail = (path, msg) => errors.push(`${path}: ${msg}`);
  const obj = (v, p) => { if (!v || typeof v !== 'object' || Array.isArray(v)) { fail(p, 'deve ser um objeto'); return false; } return true; };
  const text = (v, p, required = false, max = 5000) => { if (v == null && !required) return; if (typeof v !== 'string' || (required && !v.trim()) || v.length > max) fail(p, `texto ${required ? 'obrigatório, ' : ''}até ${max} caracteres`); };
  const choice = (v, p, values) => { if (!values.includes(v)) fail(p, `use ${values.join(', ')}`); };
  const int = (v, p, nullable = false, max = 100000000) => { if (v == null && nullable) return; if (!Number.isSafeInteger(v) || v < 0 || v > max) fail(p, `inteiro entre 0 e ${max}`); };
  const bool = (v,p) => { if (typeof v !== 'boolean') fail(p, 'use true ou false'); };
  const list = (v,p,max) => { if (!Array.isArray(v) || v.length > max) { fail(p, `lista obrigatória, máximo ${max} itens`); return []; } return v; };
  const fields = (v,p,allowed) => { for (const k of Object.keys(v)) if (!allowed.includes(k)) fail(`${p}.${k}`, 'campo desconhecido na versão 1'); };
  const common = (v,p,allowed) => {
    if (!obj(v,p)) return false;
    fields(v,p,['key','name','order','external_id','source','last_synced_at',...allowed]);
    if (typeof v.key !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/.test(v.key)) fail(`${p}.key`, 'identificador estável obrigatório (até 120 caracteres)');
    else if(keys.has(v.key)) fail(`${p}.key`, 'identificador duplicado no documento'); else keys.add(v.key);
    text(v.name,`${p}.name`,true,180); int(v.order,`${p}.order`,false,1000000);
    text(v.external_id,`${p}.external_id`,false,200);
    if(v.source!=null) text(v.source,`${p}.source`,true,120);
    if(v.external_id && !v.source) fail(`${p}.source`,'origem obrigatória quando há identificador externo');
    if(v.last_synced_at!=null && (typeof v.last_synced_at!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(v.last_synced_at)||!Number.isFinite(Date.parse(v.last_synced_at)))) fail(`${p}.last_synced_at`,'data ISO inválida');
    return true;
  };
  if (!obj(doc,'documento')) return { valid:false,errors,counts };
  fields(doc,'documento',['version','catalog']);
  if(doc.version!==1) fail('version','versão suportada: 1');
  const c=doc.catalog;
  if(!common(c,'catalog',['description','status','currency','categories','last_reviewed_at'])) return {valid:false,errors,counts};
  text(c.description,'catalog.description'); choice(c.status,'catalog.status',statuses); choice(c.source,'catalog.source',sources); choice(c.currency,'catalog.currency',['BRL']);
  if(c.last_reviewed_at!=null && (typeof c.last_reviewed_at!=='string'||!Number.isFinite(Date.parse(c.last_reviewed_at)))) fail('catalog.last_reviewed_at','data ISO inválida');
  list(c.categories,'categories',200).forEach((cat,i)=>{
    const p=`categories[${i}]`; counts.categories++;
    if(!common(cat,p,['active','products']))return; bool(cat.active,`${p}.active`);
    list(cat.products,`${p}.products`,5000).forEach((product,j)=>{
      const q=`${p}.products[${j}]`; counts.products++;
      if(!common(product,q,['description','status','availability','price_mode','price_cents','promo_price_cents','sku','accepts_notes','images','variants','option_groups']))return;
      products.add(product.key); text(product.description,`${q}.description`); text(product.sku,`${q}.sku`,false,120);
      choice(product.status,`${q}.status`,['ativo','inativo']); choice(product.availability,`${q}.availability`,['disponivel','indisponivel']);
      choice(product.price_mode,`${q}.price_mode`,['fixo','a_partir','variacoes']); int(product.price_cents,`${q}.price_cents`,product.price_mode==='variacoes'); int(product.promo_price_cents,`${q}.promo_price_cents`,true);
      if(product.promo_price_cents!=null && (product.price_cents==null || product.promo_price_cents>product.price_cents || product.price_mode==='variacoes')) fail(q,'promoção requer preço base e não pode excedê-lo; em variações, use o preço de cada variante');
      bool(product.accepts_notes,`${q}.accepts_notes`);
      list(product.images,`${q}.images`,20).forEach((image,k)=>{const r=`${q}.images[${k}]`; if(!obj(image,r))return; fields(image,r,['url','alt']); if(typeof image.url!=='string'||!/^https:\/\/[^\s]+$/.test(image.url))fail(r,'URL pública HTTPS obrigatória');text(image.alt,`${r}.alt`,false,500);});
      const combinations=new Set();
      list(product.variants,`${q}.variants`,300).forEach((v,k)=>{const r=`${q}.variants[${k}]`;counts.variants++;if(!common(v,r,['attributes','price_cents','promo_price_cents','sku','available']))return;int(v.price_cents,`${r}.price_cents`);int(v.promo_price_cents,`${r}.promo_price_cents`,true);if(v.promo_price_cents>v.price_cents)fail(r,'promoção maior que o preço');bool(v.available,`${r}.available`);text(v.sku,`${r}.sku`,false,120);if(obj(v.attributes,`${r}.attributes`)){const entries=Object.entries(v.attributes).sort();if(!entries.length||entries.length>10)fail(r,'informe de 1 a 10 atributos');for(const [a,b]of entries){text(a,r,true,80);text(b,r,true,120);}const fingerprint=JSON.stringify(entries);if(combinations.has(fingerprint))fail(r,'combinação de atributos duplicada');combinations.add(fingerprint);}});
      if(product.price_mode==='variacoes'&&!product.variants?.length)fail(q,'preço por variações requer pelo menos uma variante');
      list(product.option_groups,`${q}.option_groups`,40).forEach((g,k)=>{const r=`${q}.option_groups[${k}]`;counts.groups++;if(!common(g,r,['min','max','selection','options']))return;int(g.min,`${r}.min`,false,100);int(g.max,`${r}.max`,false,100);choice(g.selection,`${r}.selection`,['unica','multipla']);if(g.max<1||g.min>g.max||(g.selection==='unica'&&g.max!==1))fail(r,'limites de seleção inconsistentes');const opts=list(g.options,`${r}.options`,100);if(g.min>opts.filter(o=>o?.available===true).length)fail(r,'mínimo maior que as opções disponíveis');opts.forEach((o,l)=>{const s=`${r}.options[${l}]`;counts.options++;if(!common(o,s,['price_cents','available','product_key','quantity']))return;int(o.price_cents,`${s}.price_cents`);bool(o.available,`${s}.available`);int(o.quantity,`${s}.quantity`,false,100);if(o.quantity<1)fail(s,'quantidade mínima 1');if(o.product_key){references.push([product.key,o.product_key,s]);}});});
    });
  });
  if(counts.products>5000)fail('products','máximo 5000 produtos por catálogo');
  for(const [from,to,p] of references){if(!products.has(to))fail(p,'produto referenciado não existe neste catálogo');if(from===to)fail(p,'produto não pode incluir a si mesmo');}
  const edges=new Map();for(const [from,to]of references)edges.set(from,[...(edges.get(from)||[]),to]);
  // Iterative cycle detection also handles deep catalogs without exhausting the JS stack.
  const incoming=new Map([...products].map(k=>[k,0]));
  for(const [,to]of references)if(incoming.has(to))incoming.set(to,incoming.get(to)+1);
  const queue=[...products].filter(k=>incoming.get(k)===0);let visited=0;
  for(let i=0;i<queue.length;i++){const key=queue[i];visited++;for(const next of edges.get(key)||[]){if(!incoming.has(next))continue;incoming.set(next,incoming.get(next)-1);if(incoming.get(next)===0)queue.push(next);}}
  if(visited!==products.size)fail('combos','referência circular entre produtos');
  return {valid:errors.length===0,errors,counts};
}
export function parseCatalog(text) {
  if(new TextEncoder().encode(text).length>5*1024*1024)throw new Error('O JSON deve ter no máximo 5 MB.');
  let doc;try{doc=JSON.parse(text);}catch{throw new Error('JSON inválido. Verifique vírgulas, aspas e colchetes.');}
  const result=validateCatalog(doc);if(!result.valid)throw new Error(result.errors.slice(0,25).join('\n'));return {doc,...result};
}
export function duplicateCatalog(doc) {
  const copy=structuredClone(doc),mapping=new Map();
  function visit(v){if(!v||typeof v!=='object')return;if(v.key){const key=newKey();mapping.set(v.key,key);v.key=key;v.external_id=null;v.last_synced_at=null;if(v.source)v.source='manual';}Object.values(v).forEach(x=>Array.isArray(x)?x.forEach(visit):visit(x));}
  visit(copy);function refs(v){if(!v||typeof v!=='object')return;if(v.product_key)v.product_key=mapping.get(v.product_key);Object.values(v).forEach(x=>Array.isArray(x)?x.forEach(refs):refs(x));}refs(copy);
  copy.catalog.name+=' (cópia)';copy.catalog.status='rascunho';copy.catalog.source='manual';copy.catalog.last_reviewed_at=null;return copy;
}
