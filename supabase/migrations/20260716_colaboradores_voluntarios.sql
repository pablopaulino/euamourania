create or replace function public.set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create table if not exists public.colaboradores_voluntarios(
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  whatsapp text not null,
  email text,
  cidade text,
  interesses text[] not null default '{}',
  mensagem text,
  aceite_voluntario boolean not null default false,
  status text not null default 'novo',
  origem text not null default 'site',
  observacoes_internas text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint colaboradores_voluntarios_status_check check(status in('novo','em_conversa','aprovado','recusado','arquivado')),
  constraint colaboradores_voluntarios_aceite_check check(aceite_voluntario is true),
  constraint colaboradores_voluntarios_nome_check check(char_length(trim(nome)) >= 2),
  constraint colaboradores_voluntarios_whatsapp_check check(char_length(regexp_replace(whatsapp,'\D','','g')) >= 10)
);

create index if not exists colaboradores_voluntarios_status_idx
  on public.colaboradores_voluntarios(status, criado_em desc);

create index if not exists colaboradores_voluntarios_criado_idx
  on public.colaboradores_voluntarios(criado_em desc);

drop trigger if exists colaboradores_voluntarios_atualizado on public.colaboradores_voluntarios;
create trigger colaboradores_voluntarios_atualizado
  before update on public.colaboradores_voluntarios
  for each row execute function public.set_atualizado_em();

alter table public.colaboradores_voluntarios enable row level security;

drop policy if exists "colaboradores_admin_select" on public.colaboradores_voluntarios;
create policy "colaboradores_admin_select" on public.colaboradores_voluntarios
  for select to authenticated using(public.is_admin());

drop policy if exists "colaboradores_admin_insert" on public.colaboradores_voluntarios;
create policy "colaboradores_admin_insert" on public.colaboradores_voluntarios
  for insert to authenticated with check(public.is_admin());

drop policy if exists "colaboradores_admin_update" on public.colaboradores_voluntarios;
create policy "colaboradores_admin_update" on public.colaboradores_voluntarios
  for update to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "colaboradores_admin_delete" on public.colaboradores_voluntarios;
create policy "colaboradores_admin_delete" on public.colaboradores_voluntarios
  for delete to authenticated using(public.is_super_admin());

create or replace function public.enviar_colaboracao_voluntaria(
  p_nome text,
  p_whatsapp text,
  p_email text default null,
  p_cidade text default null,
  p_interesses text[] default '{}',
  p_mensagem text default null,
  p_aceite_voluntario boolean default false,
  p_website text default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_nome text := left(trim(coalesce(p_nome,'')),160);
  v_whatsapp text := left(trim(coalesce(p_whatsapp,'')),40);
  v_email text := nullif(left(trim(coalesce(p_email,'')),180),'');
  v_cidade text := nullif(left(trim(coalesce(p_cidade,'')),120),'');
  v_mensagem text := nullif(left(trim(coalesce(p_mensagem,'')),1200),'');
  v_interesses text[] := coalesce(p_interesses,'{}'::text[]);
  v_id uuid;
begin
  if nullif(trim(coalesce(p_website,'')),'') is not null then
    return jsonb_build_object('ok', true, 'message', 'Cadastro recebido para análise.');
  end if;

  if char_length(v_nome) < 2 then
    raise exception 'Informe seu nome.';
  end if;

  if char_length(regexp_replace(v_whatsapp,'\D','','g')) < 10 then
    raise exception 'Informe um WhatsApp válido.';
  end if;

  if v_email is not null and v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'Informe um e-mail válido ou deixe em branco.';
  end if;

  if p_aceite_voluntario is not true then
    raise exception 'É preciso confirmar que a colaboração é voluntária.';
  end if;

  insert into public.colaboradores_voluntarios(
    nome,
    whatsapp,
    email,
    cidade,
    interesses,
    mensagem,
    aceite_voluntario,
    status,
    origem
  ) values(
    v_nome,
    v_whatsapp,
    v_email,
    v_cidade,
    v_interesses,
    v_mensagem,
    true,
    'novo',
    'site'
  )
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'message', 'Cadastro recebido. Obrigado por querer colaborar voluntariamente com o Eu Amo Urânia.'
  );
end;
$$;

revoke all on function public.enviar_colaboracao_voluntaria(text,text,text,text,text[],text,boolean,text) from public;
grant execute on function public.enviar_colaboracao_voluntaria(text,text,text,text,text[],text,boolean,text) to anon, authenticated;
