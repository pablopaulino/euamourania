create table public.parceiros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  guia_id uuid references public.guia_comercial(id) on delete set null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index parceiros_guia_ativo_unique on public.parceiros(guia_id) where ativo and guia_id is not null;
create or replace function public.impedir_conta_mista() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_table_name='parceiros' and exists(select 1 from public.usuarios_admin where id=new.user_id) then raise exception 'Conta de staff não pode ser parceira'; end if;
  if tg_table_name='usuarios_admin' and exists(select 1 from public.parceiros where user_id=new.id) then raise exception 'Conta de parceiro não pode ser staff'; end if;
  return new;
end $$;
create trigger parceiros_sem_staff before insert or update of user_id on public.parceiros for each row execute function public.impedir_conta_mista();
create trigger staff_sem_parceiros before insert or update of id on public.usuarios_admin for each row execute function public.impedir_conta_mista();
create table public.parceiro_alteracoes_log (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  guia_id uuid not null references public.guia_comercial(id) on delete cascade,
  campos_alterados text[] not null,
  snapshot_anterior jsonb,
  snapshot_novo jsonb,
  ip_origem text,
  criado_em timestamptz not null default now()
);
create index parceiro_log_guia_idx on public.parceiro_alteracoes_log(guia_id, criado_em desc);
create table public.parceiro_convites_rate (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  criado_em timestamptz not null default now()
);
create index parceiro_convites_rate_idx on public.parceiro_convites_rate(ip_hash,criado_em desc);
alter table public.parceiro_convites_rate enable row level security;
create or replace function public.parceiro_consumir_convite_limite(p_ip_hash text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_ip_hash));
  if (select count(*) from public.parceiro_convites_rate where ip_hash=p_ip_hash and criado_em>now()-interval '1 hour') >= 5 then return false; end if;
  insert into public.parceiro_convites_rate(ip_hash) values(p_ip_hash);
  return true;
end $$;
revoke all on function public.parceiro_consumir_convite_limite(text) from public;
grant execute on function public.parceiro_consumir_convite_limite(text) to service_role;
alter table public.parceiros enable row level security;
alter table public.parceiro_alteracoes_log enable row level security;
grant select on public.parceiros, public.parceiro_alteracoes_log to authenticated;
grant insert, update, delete on public.parceiros to authenticated;
create policy parceiros_self_select on public.parceiros for select to authenticated using (user_id = auth.uid());
create policy parceiros_staff_select on public.parceiros for select to authenticated using (public.tem_permissao_admin('guia_comercial','editar'));
create policy parceiros_staff_insert on public.parceiros for insert to authenticated with check (public.tem_permissao_admin('guia_comercial','editar'));
create policy parceiros_staff_update on public.parceiros for update to authenticated using (public.tem_permissao_admin('guia_comercial','editar')) with check (public.tem_permissao_admin('guia_comercial','editar'));
create policy parceiros_staff_delete on public.parceiros for delete to authenticated using (public.tem_permissao_admin('guia_comercial','editar'));
create policy parceiro_log_self_select on public.parceiro_alteracoes_log for select to authenticated using (exists(select 1 from public.parceiros p where p.id=parceiro_id and p.user_id=auth.uid()));
create policy parceiro_log_staff_select on public.parceiro_alteracoes_log for select to authenticated using (public.tem_permissao_admin('guia_comercial','editar'));

create or replace function public.parceiro_atualizar_cadastro(p_guia_id uuid, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_parceiro uuid; v_antes public.guia_comercial%rowtype; v_depois public.guia_comercial%rowtype; v_campos text[];
begin
  select id into v_parceiro from public.parceiros where user_id=auth.uid() and guia_id=p_guia_id and ativo=true;
  if v_parceiro is null then raise exception 'Acesso de parceiro negado' using errcode='42501'; end if;
  if p_dados is null or jsonb_typeof(p_dados)<>'object' or p_dados='{}'::jsonb then raise exception 'Dados inválidos'; end if;
  if octet_length(p_dados::text)>20000 then raise exception 'Dados excedem o limite permitido'; end if;
  select array_agg(key) into v_campos from jsonb_object_keys(p_dados) key;
  if exists(select 1 from unnest(v_campos) key where key <> all(array['descricao','imagem_url','galeria_urls','whatsapp','telefone','instagram','facebook','site','endereco','horario','opening_hours','opening_hours_note','mapa_url'])) then
    raise exception 'Campo não permitido' using errcode='42501';
  end if;
  if p_dados ? 'galeria_urls' and (jsonb_typeof(p_dados->'galeria_urls') <> 'array' or jsonb_array_length(p_dados->'galeria_urls') > 10) then raise exception 'Galeria inválida'; end if;
  if p_dados ? 'descricao' and length(p_dados->>'descricao') > 1000 then raise exception 'Descrição excede 1000 caracteres'; end if;
  select * into v_antes from public.guia_comercial where id=p_guia_id for update;
  if not found then raise exception 'Cadastro não encontrado'; end if;
  update public.guia_comercial set
    descricao=case when p_dados ? 'descricao' then p_dados->>'descricao' else descricao end,
    imagem_url=case when p_dados ? 'imagem_url' then p_dados->>'imagem_url' else imagem_url end,
    galeria_urls=case when p_dados ? 'galeria_urls' then p_dados->'galeria_urls' else galeria_urls end,
    whatsapp=case when p_dados ? 'whatsapp' then p_dados->>'whatsapp' else whatsapp end,
    telefone=case when p_dados ? 'telefone' then p_dados->>'telefone' else telefone end,
    instagram=case when p_dados ? 'instagram' then p_dados->>'instagram' else instagram end,
    facebook=case when p_dados ? 'facebook' then p_dados->>'facebook' else facebook end,
    site=case when p_dados ? 'site' then p_dados->>'site' else site end,
    endereco=case when p_dados ? 'endereco' then p_dados->>'endereco' else endereco end,
    horario=case when p_dados ? 'horario' then p_dados->>'horario' else horario end,
    opening_hours=case when p_dados ? 'opening_hours' then p_dados->'opening_hours' else opening_hours end,
    opening_hours_note=case when p_dados ? 'opening_hours_note' then p_dados->>'opening_hours_note' else opening_hours_note end,
    mapa_url=case when p_dados ? 'mapa_url' then p_dados->>'mapa_url' else mapa_url end,
    atualizado_em=now()
  where id=p_guia_id returning * into v_depois;
  insert into public.parceiro_alteracoes_log(parceiro_id,guia_id,campos_alterados,snapshot_anterior,snapshot_novo)
  values(v_parceiro,p_guia_id,v_campos,to_jsonb(v_antes),to_jsonb(v_depois));
  return jsonb_build_object('success',true,'atualizado_em',v_depois.atualizado_em);
end $$;
revoke all on function public.parceiro_atualizar_cadastro(uuid,jsonb) from public;
grant execute on function public.parceiro_atualizar_cadastro(uuid,jsonb) to authenticated;
