begin;

-- A moderação depende do fluxo do aplicativo, inclusive do gatilho de publicação.
do $$
begin
  if to_regclass('public.achados_perdidos') is null
     or to_regprocedure('public.publicar_achado_perdido_v2(uuid,text,text,text,text,text,text,text,text,text,timestamp with time zone)') is null
     or not exists (select 1 from pg_trigger where tgrelid = to_regclass('public.achados_perdidos') and tgname = 'achados_perdidos_aprovacao_push' and not tgisinternal and tgenabled in ('O', 'A')) then
    raise exception 'Aplique primeiro as migrações de Achados e Perdidos do aplicativo e confirme o gatilho de aprovação.';
  end if;
end $$;

-- Acesso inicial apenas a Super Admin, sem alterar permissões existentes.

create or replace function public.admin_listar_achados_pendentes()
returns table (id uuid, tipo text, categoria text, titulo text, descricao text, local text,
  whatsapp text, contato_nome text, imagem_url text, criado_em timestamptz,
  ocorrido_em timestamptz, atualizado_em timestamptz)
language plpgsql security definer set search_path = pg_catalog, pg_temp
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Sem permissão para consultar anúncios pendentes' using errcode = '42501';
  end if;
  return query select a.id, a.tipo, a.categoria, a.titulo, a.descricao, a.local,
    a.whatsapp, a.contato_nome, a.imagem_url, a.criado_em, a.ocorrido_em, a.atualizado_em
    from public.achados_perdidos a where a.status = 'pendente' order by a.criado_em asc;
end $$;

create or replace function public.admin_moderar_achado(p_id uuid, p_acao text, p_atualizado_em timestamptz)
returns boolean language plpgsql security definer set search_path = pg_catalog, pg_temp
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Sem permissão para moderar anúncios' using errcode = '42501';
  end if;
  if p_acao not in ('aprovar', 'rejeitar') or p_acao is null or p_atualizado_em is null then
    raise exception 'Dados de moderação inválidos' using errcode = '22023';
  end if;
  update public.achados_perdidos set
    status = case when p_acao = 'aprovar' then 'ativo' else 'rejeitado' end,
    atualizado_em = now()
  where id = p_id and status = 'pendente' and atualizado_em = p_atualizado_em;
  return found;
end $$;
revoke all on function public.admin_listar_achados_pendentes() from public, anon;
revoke all on function public.admin_moderar_achado(uuid,text,timestamptz) from public, anon;
grant execute on function public.admin_listar_achados_pendentes() to authenticated;
grant execute on function public.admin_moderar_achado(uuid,text,timestamptz) to authenticated;
commit;
