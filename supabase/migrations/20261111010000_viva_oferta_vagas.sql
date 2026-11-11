-- Vagas da oferta de lançamento são históricas: cancelamento não devolve vaga.
begin;

create table public.viva_oferta_lancamento (
  vaga smallint primary key check (vaga between 1 and 15),
  guia_id uuid unique references public.guia_comercial(id) on delete set null,
  concedida_em timestamptz not null default now(),
  encerrada_em timestamptz
);
alter table public.viva_oferta_lancamento enable row level security;
revoke all on public.viva_oferta_lancamento from public, anon, authenticated;
grant select on public.viva_oferta_lancamento to authenticated;
create policy viva_oferta_staff_select on public.viva_oferta_lancamento for select to authenticated
  using (public.tem_permissao_admin('guia_comercial', 'editar'));

-- Não inferir nomes semelhantes: se os três cadastros não forem inequívocos,
-- toda a migração falha e a oferta continua sem contador público.
do $$
declare v_nome text; empresa uuid; quantidade integer; indice integer := 0;
begin
  foreach v_nome in array array['Dentin do Corte', 'Patinhas Douradas', 'Só Jeans'] loop
    select count(*), min(id::text)::uuid into quantidade, empresa
      from public.guia_comercial where lower(trim(public.guia_comercial.nome)) = lower(v_nome);
    if quantidade <> 1 or not exists (select 1 from public.viva_assinaturas where guia_id = empresa) then
      raise exception 'Cadastro de assinatura não identificado de forma única: %', v_nome;
    end if;
    indice := indice + 1;
    insert into public.viva_oferta_lancamento(vaga, guia_id, encerrada_em)
      select indice, empresa, case when status = 'cancelada' then now() else null end
      from public.viva_assinaturas where guia_id = empresa;
  end loop;
end $$;

create function public.viva_oferta_vagas() returns integer
language sql stable security definer set search_path = ''
as $$ select greatest(0, 15 - count(*)::integer) from public.viva_oferta_lancamento $$;
revoke all on function public.viva_oferta_vagas() from public;
grant execute on function public.viva_oferta_vagas() to anon, authenticated;

create function public.viva_oferta_encerrar_cancelada() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'cancelada' and old.status is distinct from 'cancelada' then
    update public.viva_oferta_lancamento set encerrada_em = now()
      where guia_id = new.guia_id and encerrada_em is null;
  end if;
  return new;
end $$;
revoke all on function public.viva_oferta_encerrar_cancelada() from public, anon, authenticated;
create trigger viva_oferta_cancelamento after update of status on public.viva_assinaturas
for each row execute function public.viva_oferta_encerrar_cancelada();

create function public.admin_salvar_assinatura_viva_oferta(
  p_guia_id uuid, p_periodo text, p_status text, p_inicio date, p_validade date,
  p_pago boolean, p_oferta boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare v_vaga integer; v_encerrada timestamptz; v_existe boolean;
begin
  if not public.tem_permissao_admin('guia_comercial', 'editar') then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('viva-oferta-lancamento', 0));
  select true, encerrada_em into v_existe, v_encerrada from public.viva_oferta_lancamento where guia_id = p_guia_id;
  if p_oferta then
    if p_periodo <> 'mensal' or p_status <> 'ativa' or not coalesce(p_pago, false) then
      raise exception 'A oferta exige plano mensal ativo e pagamento confirmado.';
    end if;
    if coalesce(v_existe, false) and v_encerrada is not null then
      raise exception 'A oferta foi encerrada para esta empresa e não pode ser reativada.';
    end if;
    if not coalesce(v_existe, false) then
      select min(n) into v_vaga from pg_catalog.generate_series(1, 15) n
        where not exists (select 1 from public.viva_oferta_lancamento where vaga = n);
      if v_vaga is null then raise exception 'As 15 vagas da oferta já foram preenchidas.'; end if;
      insert into public.viva_oferta_lancamento(vaga, guia_id) values (v_vaga, p_guia_id);
    end if;
  end if;
  perform public.admin_salvar_assinatura_viva(p_guia_id, p_periodo, p_status, p_inicio, p_validade, p_pago);
end $$;
revoke all on function public.admin_salvar_assinatura_viva_oferta(uuid,text,text,date,date,boolean,boolean) from public, anon;
grant execute on function public.admin_salvar_assinatura_viva_oferta(uuid,text,text,date,date,boolean,boolean) to authenticated;
commit;
