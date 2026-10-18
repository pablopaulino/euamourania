begin;
create table public.viva_assinaturas (
 guia_id uuid primary key references public.guia_comercial(id) on delete cascade,
 periodo text not null check(periodo in ('mensal','semestral','anual')),
 status text not null default 'pendente' check(status in ('pendente','ativa','pausada','cancelada')),
 inicio date not null,
 validade date not null check(validade>=inicio),
 pagamento_confirmado_em timestamptz,
 atualizado_em timestamptz not null default now(),
 atualizado_por uuid references auth.users(id),
 check(status<>'ativa' or pagamento_confirmado_em is not null)
);
create table public.viva_assinaturas_historico (
 id uuid primary key default gen_random_uuid(), guia_id uuid not null,
 anterior jsonb, novo jsonb, autor uuid, criado_em timestamptz not null default now()
);
alter table public.viva_assinaturas enable row level security;
alter table public.viva_assinaturas_historico enable row level security;
grant select on public.viva_assinaturas,public.viva_assinaturas_historico to authenticated;
create policy viva_assinatura_staff on public.viva_assinaturas for select to authenticated using(public.tem_permissao_admin('guia_comercial','editar'));
create policy viva_historico_staff on public.viva_assinaturas_historico for select to authenticated using(public.tem_permissao_admin('guia_comercial','editar'));
create function public.admin_salvar_assinatura_viva(p_guia_id uuid,p_periodo text,p_status text,p_inicio date,p_validade date,p_pago boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_antes jsonb; v_novo jsonb; v_pago timestamptz;
begin
 if not public.tem_permissao_admin('guia_comercial','editar') then raise exception 'Acesso negado' using errcode='42501'; end if;
 if p_status='ativa' and not coalesce(p_pago,false) then raise exception 'Confirme o pagamento antes de ativar'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_guia_id::text,0));
 select to_jsonb(s) into v_antes from public.viva_assinaturas s where guia_id=p_guia_id;
 v_pago=case when p_pago then now() else null end;
 insert into public.viva_assinaturas(guia_id,periodo,status,inicio,validade,pagamento_confirmado_em,atualizado_por)
 values(p_guia_id,p_periodo,p_status,p_inicio,p_validade,v_pago,auth.uid())
 on conflict(guia_id) do update set periodo=excluded.periodo,status=excluded.status,inicio=excluded.inicio,validade=excluded.validade,pagamento_confirmado_em=excluded.pagamento_confirmado_em,atualizado_por=auth.uid(),atualizado_em=now();
 select to_jsonb(s) into v_novo from public.viva_assinaturas s where guia_id=p_guia_id;
 insert into public.viva_assinaturas_historico(guia_id,anterior,novo,autor) values(p_guia_id,v_antes,v_novo,auth.uid());
end $$;
revoke all on function public.admin_salvar_assinatura_viva(uuid,text,text,date,date,boolean) from public,anon;
grant execute on function public.admin_salvar_assinatura_viva(uuid,text,text,date,date,boolean) to authenticated;
create function public.viva_assinatura_ativa(p_guia_id uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.parceiros p join public.viva_assinaturas s on s.guia_id=p.guia_id
 where p.guia_id=p_guia_id and p.user_id=auth.uid() and p.ativo and s.status='ativa' and s.pagamento_confirmado_em is not null
 and (now() at time zone 'America/Sao_Paulo')::date between s.inicio and s.validade);
$$;
revoke all on function public.viva_assinatura_ativa(uuid) from public,anon;
grant execute on function public.viva_assinatura_ativa(uuid) to authenticated;
create function public.exigir_assinatura_viva(p_guia_id uuid) returns void language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.viva_assinatura_ativa(p_guia_id) then raise exception 'Plano Parceiro Viva sem vigência ativa. Consulte Ajuda / Plano.' using errcode='42501'; end if;
end $$;
revoke all on function public.exigir_assinatura_viva(uuid) from public,anon,authenticated;
create function public.parceiro_plano_viva(p_guia_id uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare s public.viva_assinaturas%rowtype; hoje date=(now() at time zone 'America/Sao_Paulo')::date;
begin
 if not exists(select 1 from public.parceiros where user_id=auth.uid() and guia_id=p_guia_id and ativo) then raise exception 'Acesso negado' using errcode='42501'; end if;
 select * into s from public.viva_assinaturas where guia_id=p_guia_id;
 if not found then return jsonb_build_object('ativo',false,'situacao','sem_assinatura'); end if;
 return jsonb_build_object('ativo',public.viva_assinatura_ativa(p_guia_id),'periodo',s.periodo,'inicio',s.inicio,'validade',s.validade,
 'situacao',case when s.status<>'ativa' then s.status when hoje<s.inicio then 'agendada' when hoje>s.validade then 'vencida' else 'ativa' end);
end $$;
revoke all on function public.parceiro_plano_viva(uuid) from public,anon;
grant execute on function public.parceiro_plano_viva(uuid) to authenticated;
-- Validação também no servidor, preservando os contratos das RPCs.
do $guard$
declare signature text; definition text;
begin
 foreach signature in array array['public.parceiro_atualizar_cadastro(uuid,jsonb)','public.parceiro_resultados(uuid,integer)','public.parceiro_totais(uuid,integer)','public.parceiro_salvar_vantagem(uuid,uuid,jsonb)','public.parceiro_desativar_vantagem(uuid,uuid)','public.parceiro_resumo(uuid)'] loop
  definition=pg_get_functiondef(signature::regprocedure);
  if position('exigir_assinatura_viva' in definition)=0 then
   definition=regexp_replace(definition,'\mbegin\M',E'begin\n perform public.exigir_assinatura_viva(p_guia_id);','i');
   execute definition;
  end if;
 end loop;
end $guard$;
drop policy parceiro_upload_media on storage.objects;
create policy parceiro_upload_media on storage.objects for insert to authenticated with check (
 bucket_id='cms-media' and (storage.foldername(name))[1]='parceiros' and
 exists(select 1 from public.parceiros p where p.user_id=auth.uid() and p.ativo and p.guia_id::text=(storage.foldername(name))[2] and public.viva_assinatura_ativa(p.guia_id))
);
commit;
