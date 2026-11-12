-- A nova oferta tem contagem independente da oferta mensal anterior.
begin;

create table public.viva_oferta_anual (
  vaga smallint primary key check (vaga between 1 and 5),
  guia_id uuid unique references public.guia_comercial(id) on delete set null,
  concedida_em timestamptz not null default now()
);
alter table public.viva_oferta_anual enable row level security;
revoke all on public.viva_oferta_anual from public, anon, authenticated;
grant select on public.viva_oferta_anual to authenticated;
create policy viva_oferta_anual_staff_select on public.viva_oferta_anual for select to authenticated
  using (public.tem_permissao_admin('guia_comercial', 'editar'));

create function public.viva_oferta_anual_vagas() returns integer
language sql stable security definer set search_path = ''
as $$ select greatest(0, 5 - count(*)::integer) from public.viva_oferta_anual $$;
revoke all on function public.viva_oferta_anual_vagas() from public;
grant execute on function public.viva_oferta_anual_vagas() to anon, authenticated;

create function public.admin_salvar_assinatura_viva_oferta_anual(
  p_guia_id uuid, p_status text, p_inicio date, p_validade date, p_pago boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare v_vaga integer;
begin
  if not public.tem_permissao_admin('guia_comercial', 'editar') then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if p_status <> 'ativa' or not coalesce(p_pago, false) then
    raise exception 'A oferta exige assinatura anual ativa e pagamento confirmado.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('viva-oferta-anual', 0));
  if not exists (select 1 from public.viva_oferta_anual where guia_id = p_guia_id) then
    select min(n) into v_vaga from pg_catalog.generate_series(1, 5) n
      where not exists (select 1 from public.viva_oferta_anual where vaga = n);
    if v_vaga is null then raise exception 'As 5 vagas da oferta anual já foram preenchidas.'; end if;
    insert into public.viva_oferta_anual(vaga, guia_id) values (v_vaga, p_guia_id);
  end if;
  perform public.admin_salvar_assinatura_viva(p_guia_id, 'anual', p_status, p_inicio, p_validade, p_pago);
end $$;
revoke all on function public.admin_salvar_assinatura_viva_oferta_anual(uuid,text,date,date,boolean) from public, anon;
grant execute on function public.admin_salvar_assinatura_viva_oferta_anual(uuid,text,date,date,boolean) to authenticated;
commit;
