-- Viva Urânia: Catálogos privados. NÃO executar remotamente sem autorização.
-- Depende do Guia Comercial e de 20260628_admin_rbac.sql.
begin;
create table public.catalogos(
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.guia_comercial(id) on delete restrict,
 key text not null check(key ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$'),
 name text not null check(length(btrim(name)) between 1 and 180),
 description text check(length(description)<=5000),
 status text not null default 'rascunho' check(status in ('rascunho','ativo','inativo','em_revisao','desatualizado')),
 source text not null default 'manual' check(source in ('manual','json','externa')),
 external_id text check(length(external_id)<=200),
 currency text not null default 'BRL' check(currency='BRL'),
 "order" integer not null default 0 check("order" between 0 and 1000000),
 revision integer not null default 1 check(revision>0),
 last_reviewed_at timestamptz,
 last_synced_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 unique(empresa_id,key)
);
create unique index catalogos_external_unique on public.catalogos(empresa_id,source,external_id) where external_id is not null;
create index catalogos_status_idx on public.catalogos(status,updated_at desc);

create table public.catalogo_categorias(
 id uuid primary key default gen_random_uuid(),
 catalogo_id uuid not null references public.catalogos(id) on delete cascade,
 key text not null check(key ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$'),
 name text not null check(length(btrim(name)) between 1 and 180),
 "order" integer not null default 0 check("order" between 0 and 1000000),
 external_id text check(length(external_id)<=200),
 source text check(length(source) between 1 and 120),
 last_synced_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(catalogo_id,key), unique(catalogo_id,id),
 active boolean not null default true
);
create unique index catalogo_categorias_external_unique on public.catalogo_categorias(catalogo_id,source,external_id) where external_id is not null and source is not null;

create table public.catalogo_produtos(
 id uuid primary key default gen_random_uuid(),
 catalogo_id uuid not null references public.catalogos(id) on delete cascade,
 key text not null check(key ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$'),
 name text not null check(length(btrim(name)) between 1 and 180),
 "order" integer not null default 0 check("order" between 0 and 1000000),
 external_id text check(length(external_id)<=200),
 source text check(length(source) between 1 and 120),
 last_synced_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(catalogo_id,key), unique(catalogo_id,id),
 categoria_id uuid not null,
 description text check(length(description)<=5000),
 status text not null check(status in ('ativo','inativo')),
 availability text not null check(availability in ('disponivel','indisponivel')),
 price_mode text not null check(price_mode in ('fixo','a_partir','variacoes')),
 price_cents integer check(price_cents between 0 and 100000000),
 promo_price_cents integer check(promo_price_cents between 0 and 100000000),
 sku text check(length(sku)<=120),
 accepts_notes boolean not null default false,
 foreign key(catalogo_id,categoria_id) references public.catalogo_categorias(catalogo_id,id) on delete cascade,
 check(price_mode='variacoes' or price_cents is not null),
 check(promo_price_cents is null or (price_mode<>'variacoes' and price_cents is not null and promo_price_cents<=price_cents))
);
create unique index catalogo_produtos_external_unique on public.catalogo_produtos(catalogo_id,source,external_id) where external_id is not null and source is not null;

create table public.catalogo_variantes(
 id uuid primary key default gen_random_uuid(),
 catalogo_id uuid not null references public.catalogos(id) on delete cascade,
 key text not null check(key ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$'),
 name text not null check(length(btrim(name)) between 1 and 180),
 "order" integer not null default 0 check("order" between 0 and 1000000),
 external_id text check(length(external_id)<=200),
 source text check(length(source) between 1 and 120),
 last_synced_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(catalogo_id,key), unique(catalogo_id,id),
 produto_id uuid not null,
 attributes jsonb not null check(jsonb_typeof(attributes)='object' and attributes<>'{}'::jsonb),
 price_cents integer not null check(price_cents between 0 and 100000000),
 promo_price_cents integer check(promo_price_cents between 0 and price_cents),
 sku text check(length(sku)<=120),
 available boolean not null default true,
 foreign key(catalogo_id,produto_id) references public.catalogo_produtos(catalogo_id,id) on delete cascade,
 unique(produto_id,attributes) deferrable initially deferred
);
create unique index catalogo_variantes_external_unique on public.catalogo_variantes(catalogo_id,source,external_id) where external_id is not null and source is not null;

create table public.catalogo_grupos_opcoes(
 id uuid primary key default gen_random_uuid(),
 catalogo_id uuid not null references public.catalogos(id) on delete cascade,
 key text not null check(key ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$'),
 name text not null check(length(btrim(name)) between 1 and 180),
 "order" integer not null default 0 check("order" between 0 and 1000000),
 external_id text check(length(external_id)<=200),
 source text check(length(source) between 1 and 120),
 last_synced_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(catalogo_id,key), unique(catalogo_id,id),
 produto_id uuid not null,
 min integer not null check(min between 0 and 100),
 max integer not null check(max between 1 and 100),
 selection text not null check(selection in ('unica','multipla')),
 check(min<=max and (selection<>'unica' or max=1)),
 foreign key(catalogo_id,produto_id) references public.catalogo_produtos(catalogo_id,id) on delete cascade
);
create unique index catalogo_grupos_opcoes_external_unique on public.catalogo_grupos_opcoes(catalogo_id,source,external_id) where external_id is not null and source is not null;

create table public.catalogo_opcoes(
 id uuid primary key default gen_random_uuid(),
 catalogo_id uuid not null references public.catalogos(id) on delete cascade,
 key text not null check(key ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$'),
 name text not null check(length(btrim(name)) between 1 and 180),
 "order" integer not null default 0 check("order" between 0 and 1000000),
 external_id text check(length(external_id)<=200),
 source text check(length(source) between 1 and 120),
 last_synced_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(catalogo_id,key), unique(catalogo_id,id),
 grupo_id uuid not null,
 produto_referencia_id uuid,
 price_cents integer not null check(price_cents between 0 and 100000000),
 available boolean not null default true,
 quantity integer not null default 1 check(quantity between 1 and 100),
 foreign key(catalogo_id,grupo_id) references public.catalogo_grupos_opcoes(catalogo_id,id) on delete cascade,
 foreign key(catalogo_id,produto_referencia_id) references public.catalogo_produtos(catalogo_id,id) deferrable initially deferred
);
create unique index catalogo_opcoes_external_unique on public.catalogo_opcoes(catalogo_id,source,external_id) where external_id is not null and source is not null;

create table public.catalogo_produto_imagens(
 id uuid primary key default gen_random_uuid(),
 catalogo_id uuid not null references public.catalogos(id) on delete cascade,
 produto_id uuid not null,
 url text not null check(length(url)<=2048 and url ~ '^https://[^[:space:]]+$'),
 alt text check(length(alt)<=500),
 "order" integer not null check("order" between 0 and 19),
 foreign key(catalogo_id,produto_id) references public.catalogo_produtos(catalogo_id,id) on delete cascade,
 unique(produto_id,"order")
);
create index catalogo_produtos_categoria_idx on public.catalogo_produtos(categoria_id,"order");
create index catalogo_produtos_busca_idx on public.catalogo_produtos using gin(to_tsvector('portuguese',name || ' ' || coalesce(description,'')));
create index catalogo_variantes_produto_idx on public.catalogo_variantes(produto_id,"order");
create index catalogo_grupos_produto_idx on public.catalogo_grupos_opcoes(produto_id,"order");
create index catalogo_opcoes_grupo_idx on public.catalogo_opcoes(grupo_id,"order");
create index catalogo_opcoes_referencia_idx on public.catalogo_opcoes(produto_referencia_id);
create index catalogo_imagens_catalogo_idx on public.catalogo_produto_imagens(catalogo_id);

-- Escrita exclusivamente pelas RPCs: revisão otimista e transação não podem ser contornadas.
do $$
declare t text;
begin
 foreach t in array array['catalogos','catalogo_categorias','catalogo_produtos','catalogo_variantes','catalogo_grupos_opcoes','catalogo_opcoes','catalogo_produto_imagens'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy catalogos_admin_read on public.%I for select to authenticated using(public.tem_permissao_admin(''guia_comercial'',''ler''))',t);
 end loop;
end $$;

-- Validação estrutural no servidor. Campos extras são recusados, não descartados.
create function public.catalogo_validar_no(n jsonb,kind text) returns void
language plpgsql set search_path=pg_catalog,pg_temp as $$
declare allowed text[]; required text[]; k text; typ text; v jsonb;
begin
 if jsonb_typeof(n) is distinct from 'object' then raise exception 'Catálogo: % deve ser objeto',kind; end if;
 allowed:=array['key','name','order','external_id','source','last_synced_at'];
 required:=array['key','name','order'];
 case kind
 when 'catalog' then allowed:=allowed||array['description','status','currency','categories','last_reviewed_at']; required:=required||array['status','source','currency','categories'];
 when 'category' then allowed:=allowed||array['active','products']; required:=required||array['active','products'];
 when 'product' then allowed:=allowed||array['description','status','availability','price_mode','price_cents','promo_price_cents','sku','accepts_notes','images','variants','option_groups']; required:=required||array['status','availability','price_mode','accepts_notes','images','variants','option_groups'];
 when 'variant' then allowed:=allowed||array['attributes','price_cents','promo_price_cents','sku','available']; required:=required||array['attributes','price_cents','available'];
 when 'group' then allowed:=allowed||array['min','max','selection','options']; required:=required||array['min','max','selection','options'];
 when 'option' then allowed:=allowed||array['price_cents','available','product_key','quantity']; required:=required||array['price_cents','available','quantity'];
 else raise exception 'Tipo de nó inválido';
 end case;
 foreach k in array required loop
  if not(n ? k) or n->k='null'::jsonb then raise exception '%: campo obrigatório %',kind,k; end if;
 end loop;
 for k,v in select * from jsonb_each(n) loop
  if not(k=any(allowed)) then raise exception '%: campo desconhecido %',kind,k; end if;
    if v='null'::jsonb then continue; end if;
  typ:=case when k=any(array['order','price_cents','promo_price_cents','min','max','quantity']) then 'number'
   when k=any(array['active','available','accepts_notes']) then 'boolean'
   when k=any(array['categories','products','images','variants','option_groups','options']) then 'array'
   when k='attributes' then 'object' else 'string' end;
  if jsonb_typeof(v)<>typ then raise exception '%: tipo incorreto em %',kind,k; end if;
  if typ='number' and (v::text !~ '^[0-9]+$' or (v::text)::numeric>100000000) then raise exception '%: % deve ser inteiro não negativo',kind,k; end if;
 end loop;
 if nullif(n->>'external_id','') is not null and nullif(n->>'source','') is null then raise exception '%: origem obrigatória para identificador externo',kind; end if;
 if n->>'key' !~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$' or length(btrim(n->>'name')) not between 1 and 180 then raise exception '%: identificador ou nome inválido',kind; end if;
 if kind='variant' then
  if (select count(*) from jsonb_each(n->'attributes')) not between 1 and 10
   or exists(select 1 from jsonb_each(n->'attributes') a where length(btrim(a.key)) not between 1 and 80 or jsonb_typeof(a.value)<>'string' or length(btrim(a.value#>>'{}')) not between 1 and 120)
  then raise exception 'Variante: informe de 1 a 10 atributos de texto'; end if;
 end if;
end $$;

-- Helper privado. Lista de tabelas fechada; nomes/valores vindos do JSON nunca viram SQL.
create function public.catalogo_gravar_no(t text,n jsonb) returns uuid
language plpgsql set search_path=pg_catalog,pg_temp as $$
declare cols text; updates text; result uuid;
begin
 if t not in ('catalogo_categorias','catalogo_produtos','catalogo_variantes','catalogo_grupos_opcoes','catalogo_opcoes') then raise exception 'Tabela inválida'; end if;
 select string_agg(format('%I',a.attname),',' order by a.attnum),
 string_agg(format('%I=excluded.%I',a.attname,a.attname),',' order by a.attnum) filter(where a.attname not in ('catalogo_id','key'))
 into cols,updates from pg_attribute a where a.attrelid=('public.'||t)::regclass and a.attnum>0 and not a.attisdropped and a.attname not in ('id','created_at');
 execute format('insert into public.%I(%s) select %s from jsonb_populate_record(null::public.%I,$1) on conflict(catalogo_id,key) do update set %s returning id',t,cols,cols,t,updates)
 into result using n||jsonb_build_object('updated_at',now());
 return result;
end $$;

create function public.salvar_catalogo(p_empresa_id uuid,p_documento jsonb,p_id uuid default null,p_revision integer default null)
returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare c jsonb; cat jsonb; p jsonb; v jsonb; g jsonb; o jsonb; im jsonb;
 cid uuid; catid uuid; pid uuid; gid uuid; refid uuid; existing public.catalogos;
 keys text[]:='{}'; catkeys text[]:='{}'; pkeys text[]:='{}'; vkeys text[]:='{}'; gkeys text[]:='{}'; okeys text[]:='{}';
 t text; n jsonb; k text; pos integer; total integer:=0;
begin
 if not coalesce(public.tem_permissao_admin('guia_comercial','ler'),false)
 or not coalesce(public.tem_permissao_admin('guia_comercial',case when p_id is null then 'criar' else 'editar' end),false)
 then raise exception 'Sem permissão para salvar catálogos' using errcode='42501'; end if;
 if octet_length(p_documento::text)>5242880 or jsonb_typeof(p_documento) is distinct from 'object'
 or p_documento->'version' is distinct from '1'::jsonb or (p_documento-array['version','catalog'])<>'{}'::jsonb
 then raise exception 'Documento inválido. Use JSON versão 1, até 5 MB'; end if;
 c:=p_documento->'catalog'; perform public.catalogo_validar_no(c,'catalog');
 if jsonb_array_length(c->'categories')>200 then raise exception 'Máximo de 200 categorias'; end if;
 keys:=array[c->>'key'];
 -- Validar toda a árvore antes de escrever.
 for cat in select value from jsonb_array_elements(c->'categories') loop
  perform public.catalogo_validar_no(cat,'category'); keys:=array_append(keys,cat->>'key'); catkeys:=array_append(catkeys,cat->>'key');
  for p in select value from jsonb_array_elements(cat->'products') loop
   total:=total+1; if total>5000 then raise exception 'Máximo de 5000 produtos'; end if;
   perform public.catalogo_validar_no(p,'product'); keys:=array_append(keys,p->>'key'); pkeys:=array_append(pkeys,p->>'key');
   if jsonb_array_length(p->'variants')>300 or jsonb_array_length(p->'option_groups')>40 or jsonb_array_length(p->'images')>20 then raise exception 'Limite de variantes, grupos ou imagens excedido'; end if;
   if p->>'price_mode'='variacoes' and jsonb_array_length(p->'variants')=0 then raise exception 'Preço por variações requer variantes'; end if;
   for im in select value from jsonb_array_elements(p->'images') loop
    if jsonb_typeof(im) is distinct from 'object' or (im-array['url','alt'])<>'{}'::jsonb or jsonb_typeof(im->'url') is distinct from 'string'
    or (im ? 'alt' and im->'alt'<>'null'::jsonb and jsonb_typeof(im->'alt')<>'string') then raise exception 'Imagem inválida'; end if;
   end loop;
   for v in select value from jsonb_array_elements(p->'variants') loop
    perform public.catalogo_validar_no(v,'variant'); keys:=array_append(keys,v->>'key'); vkeys:=array_append(vkeys,v->>'key');
   end loop;
   for g in select value from jsonb_array_elements(p->'option_groups') loop
    perform public.catalogo_validar_no(g,'group'); keys:=array_append(keys,g->>'key'); gkeys:=array_append(gkeys,g->>'key');
    if jsonb_array_length(g->'options')>100 then raise exception 'Máximo de 100 opções por grupo'; end if;
    if (g->>'min')::int>(select count(*) from jsonb_array_elements(g->'options') x where x->'available'='true'::jsonb) then raise exception 'Mínimo de seleção maior que as opções disponíveis'; end if;
    for o in select value from jsonb_array_elements(g->'options') loop
     perform public.catalogo_validar_no(o,'option'); keys:=array_append(keys,o->>'key'); okeys:=array_append(okeys,o->>'key');
    end loop;
   end loop;
  end loop;
 end loop;
 if cardinality(keys)<>(select count(distinct x) from unnest(keys) x) then raise exception 'Identificador key duplicado no documento'; end if;
 if p_id is not null then
  select * into existing from public.catalogos where id=p_id for update;
  if not found then raise exception 'Catálogo não encontrado'; end if;
  if existing.empresa_id<>p_empresa_id or existing.key<>c->>'key' then raise exception 'Empresa ou identificador não corresponde ao catálogo selecionado'; end if;
  if p_revision is null or existing.revision<>p_revision then raise exception 'Outro administrador alterou este catálogo. Recarregue antes de salvar' using errcode='40001'; end if;
  cid:=p_id;
 else
  insert into public.catalogos(empresa_id,key,name,created_by) values(p_empresa_id,c->>'key',c->>'name',auth.uid()) returning id into cid;
 end if;
 update public.catalogos set name=c->>'name',description=c->>'description',status=c->>'status',source=c->>'source',external_id=c->>'external_id',
 currency=c->>'currency',"order"=(c->>'order')::int,last_reviewed_at=(c->>'last_reviewed_at')::timestamptz,last_synced_at=(c->>'last_synced_at')::timestamptz,
 revision=case when p_id is null then 1 else revision+1 end,updated_at=now(),updated_by=auth.uid() where id=cid;
 -- Remoções em atualização exigem permissão explícita de excluir.
 if p_id is not null and not public.tem_permissao_admin('guia_comercial','excluir') and (
 exists(select 1 from public.catalogo_categorias where catalogo_id=cid and not(key=any(catkeys))) or
 exists(select 1 from public.catalogo_produtos where catalogo_id=cid and not(key=any(pkeys))) or
 exists(select 1 from public.catalogo_variantes where catalogo_id=cid and not(key=any(vkeys))) or
 exists(select 1 from public.catalogo_grupos_opcoes where catalogo_id=cid and not(key=any(gkeys))) or
 exists(select 1 from public.catalogo_opcoes where catalogo_id=cid and not(key=any(okeys))))
 then raise exception 'Remover registros existentes exige permissão de excluir' using errcode='42501'; end if;
 -- Primeiro pais/produtos. Referências de combos são resolvidas numa segunda passagem.
 for cat in select value from jsonb_array_elements(c->'categories') loop
  catid:=public.catalogo_gravar_no('catalogo_categorias',cat||jsonb_build_object('catalogo_id',cid));
  for p in select value from jsonb_array_elements(cat->'products') loop
   pid:=public.catalogo_gravar_no('catalogo_produtos',p||jsonb_build_object('catalogo_id',cid,'categoria_id',catid));
  end loop;
 end loop;
 -- Variantes mantêm IDs; remover as ausentes antes permite reutilizar combinações.
 delete from public.catalogo_opcoes where catalogo_id=cid and not(key=any(okeys));
 delete from public.catalogo_grupos_opcoes where catalogo_id=cid and not(key=any(gkeys));
 delete from public.catalogo_variantes where catalogo_id=cid and not(key=any(vkeys));
 for cat in select value from jsonb_array_elements(c->'categories') loop
  for p in select value from jsonb_array_elements(cat->'products') loop
   select id into pid from public.catalogo_produtos where catalogo_id=cid and key=p->>'key';
   delete from public.catalogo_produto_imagens where produto_id=pid;
   pos:=0;
   for im in select value from jsonb_array_elements(p->'images') loop
    insert into public.catalogo_produto_imagens(catalogo_id,produto_id,url,alt,"order") values(cid,pid,im->>'url',im->>'alt',pos); pos:=pos+1;
   end loop;
   for v in select value from jsonb_array_elements(p->'variants') loop
    perform public.catalogo_gravar_no('catalogo_variantes',v||jsonb_build_object('catalogo_id',cid,'produto_id',pid));
   end loop;
   for g in select value from jsonb_array_elements(p->'option_groups') loop
    gid:=public.catalogo_gravar_no('catalogo_grupos_opcoes',g||jsonb_build_object('catalogo_id',cid,'produto_id',pid));
    for o in select value from jsonb_array_elements(g->'options') loop
     refid:=null;
     if nullif(o->>'product_key','') is not null then
      select id into refid from public.catalogo_produtos where catalogo_id=cid and key=o->>'product_key' and key=any(pkeys);
      if refid is null or refid=pid then raise exception 'Referência de combo inválida'; end if;
     end if;
     perform public.catalogo_gravar_no('catalogo_opcoes',o||jsonb_build_object('catalogo_id',cid,'grupo_id',gid,'produto_referencia_id',refid));
    end loop;
   end loop;
  end loop;
 end loop;
 delete from public.catalogo_produtos where catalogo_id=cid and not(key=any(pkeys));
 delete from public.catalogo_categorias where catalogo_id=cid and not(key=any(catkeys));
 if exists(
  with recursive edges as (select g.produto_id a,o.produto_referencia_id b from public.catalogo_opcoes o join public.catalogo_grupos_opcoes g on g.id=o.grupo_id where o.catalogo_id=cid and o.produto_referencia_id is not null),
  walk(a,b) as (select a,b from edges union select w.a,e.b from walk w join edges e on e.a=w.b)
  select 1 from walk where a=b
 ) then raise exception 'Referência circular entre produtos de combo'; end if;
 return cid;
end $$;

create function public.excluir_catalogo(p_id uuid,p_revision integer) returns void
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
 if not coalesce(public.tem_permissao_admin('guia_comercial','excluir'),false) then raise exception 'Sem permissão para excluir' using errcode='42501'; end if;
 delete from public.catalogos where id=p_id and revision=p_revision;
 if not found then raise exception 'Catálogo alterado ou removido. Recarregue antes de excluir' using errcode='40001'; end if;
end $$;

-- Exportação em um snapshot consistente, no mesmo contrato usado para importar.
create function public.exportar_catalogo(p_id uuid) returns jsonb
language sql stable security invoker set search_path=pg_catalog,pg_temp as $$
select jsonb_build_object('id',c.id,'empresa_id',c.empresa_id,'revision',c.revision,'document',jsonb_build_object('version',1,'catalog',
 (to_jsonb(c)-array['id','empresa_id','revision','created_at','updated_at','created_by','updated_by'])||
 jsonb_build_object('categories',coalesce((
 select jsonb_agg((to_jsonb(cat)-array['id','catalogo_id','created_at','updated_at'])||jsonb_build_object('products',coalesce((
 select jsonb_agg((to_jsonb(p)-array['id','catalogo_id','categoria_id','created_at','updated_at'])||jsonb_build_object(
 'images',coalesce((select jsonb_agg(jsonb_build_object('url',im.url,'alt',im.alt) order by im."order") from public.catalogo_produto_imagens im where im.produto_id=p.id),'[]'::jsonb),
 'variants',coalesce((select jsonb_agg(to_jsonb(v)-array['id','catalogo_id','produto_id','created_at','updated_at'] order by v."order",v.key) from public.catalogo_variantes v where v.produto_id=p.id),'[]'::jsonb),
 'option_groups',coalesce((select jsonb_agg((to_jsonb(g)-array['id','catalogo_id','produto_id','created_at','updated_at'])||jsonb_build_object('options',
 coalesce((select jsonb_agg((to_jsonb(o)-array['id','catalogo_id','grupo_id','produto_referencia_id','created_at','updated_at'])||jsonb_build_object('product_key',r.key) order by o."order",o.key)
 from public.catalogo_opcoes o left join public.catalogo_produtos r on r.id=o.produto_referencia_id where o.grupo_id=g.id),'[]'::jsonb)) order by g."order",g.key)
 from public.catalogo_grupos_opcoes g where g.produto_id=p.id),'[]'::jsonb)) order by p."order",p.key)
 from public.catalogo_produtos p where p.categoria_id=cat.id),'[]'::jsonb)) order by cat."order",cat.key)
 from public.catalogo_categorias cat where cat.catalogo_id=c.id),'[]'::jsonb))))
from public.catalogos c where c.id=p_id;
$$;
revoke all on function public.catalogo_validar_no(jsonb,text),public.catalogo_gravar_no(text,jsonb),public.salvar_catalogo(uuid,jsonb,uuid,integer),public.excluir_catalogo(uuid,integer),public.exportar_catalogo(uuid) from public,anon,authenticated;
grant execute on function public.salvar_catalogo(uuid,jsonb,uuid,integer),public.excluir_catalogo(uuid,integer),public.exportar_catalogo(uuid) to authenticated;
comment on table public.catalogos is 'Catálogos privados; empresa herdada pelos filhos. Sem exposição pública nesta fase.';
comment on column public.catalogo_variantes.attributes is 'Pequeno mapa de atributos de uma combinação (tamanho/cor etc.), não um catálogo JSON.';
comment on column public.catalogo_opcoes.produto_referencia_id is 'Preparação para combos: produto do mesmo catálogo; preço é adicional explícito, não soma automática.';
commit;
