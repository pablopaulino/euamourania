begin;
create table public.editorial_configuracao (
  id integer primary key default 1 check (id=1),
  ativa boolean not null default false,
  intervalo_dias integer not null default 1 check(intervalo_dias between 1 and 30),
  limite_pautas integer not null default 5 check(limite_pautas between 1 and 10),
  limite_materias integer not null default 1 check(limite_materias between 1 and 2),
  quota_ate timestamptz,
  ultima_execucao_automatica date
);
insert into public.editorial_configuracao(id) values (1);
alter table public.editorial_configuracao enable row level security;
create policy editorial_config_ler on public.editorial_configuracao for select to authenticated using(public.tem_permissao_admin('noticias','ler'));
create policy editorial_config_editar on public.editorial_configuracao for update to authenticated using(public.tem_permissao_admin('noticias','editar')) with check(public.tem_permissao_admin('noticias','editar'));
-- A data da última execução é escrita somente pela função de servidor.
revoke update on public.editorial_configuracao from authenticated;
grant update (ativa,intervalo_dias,limite_pautas,limite_materias) on public.editorial_configuracao to authenticated;

create function public.editorial_iniciar_execucao(p_automatica boolean) returns uuid
language plpgsql security definer set search_path=public as $$
declare cfg public.editorial_configuracao%rowtype; result uuid; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  perform pg_advisory_xact_lock(hashtext('editorial_execucao'));
  select * into cfg from public.editorial_configuracao where id=1 for update;
  if p_automatica and (not cfg.ativa or (cfg.ultima_execucao_automatica is not null and hoje-cfg.ultima_execucao_automatica < cfg.intervalo_dias)) then return null; end if;
  update public.editorial_execucoes set estado='falhou',finalizada_em=now(),resumo='Execução interrompida ou tempo esgotado.' where estado='iniciada' and iniciada_em < now()-interval '5 minutes';
  if exists(select 1 from public.editorial_execucoes where estado='iniciada') then raise exception 'Já existe uma execução em andamento'; end if;
  insert into public.editorial_execucoes default values returning id into result;
  if p_automatica then update public.editorial_configuracao set ultima_execucao_automatica=hoje where id=1; end if;
  return result;
end $$;
revoke all on function public.editorial_iniciar_execucao(boolean) from public,anon,authenticated;
grant execute on function public.editorial_iniciar_execucao(boolean) to service_role;
commit;
