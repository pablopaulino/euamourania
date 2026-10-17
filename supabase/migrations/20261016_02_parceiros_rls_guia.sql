create policy parceiro_select_proprio on public.guia_comercial for select to authenticated using (
  exists(select 1 from public.parceiros p where p.user_id=auth.uid() and p.guia_id=guia_comercial.id and p.ativo)
);
create policy vantagens_parceiro_select on public.vantagens for select to authenticated using (
  exists(select 1 from public.parceiros p where p.user_id=auth.uid() and p.guia_id=vantagens.estabelecimento_id and p.ativo)
);
-- Escrita direta por parceiro em vantagens permitiria alterar ativo/destaque.
-- As mutações passam exclusivamente pela função com lista de campos permitidos.
create or replace function public.parceiro_salvar_vantagem(p_guia_id uuid, p_id uuid, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_row public.vantagens%rowtype;
begin
  if not exists(select 1 from public.parceiros where user_id=auth.uid() and guia_id=p_guia_id and ativo) then raise exception 'Acesso negado' using errcode='42501'; end if;
  if p_dados is null or jsonb_typeof(p_dados)<>'object' or exists(
    select 1 from jsonb_object_keys(p_dados) k where k <> all(array['tipo','titulo','descricao','imagem_url','preco_original','preco_promocional','percentual_desconto','codigo_cupom','regras','data_inicio','data_fim'])
  ) then raise exception 'Campos inválidos' using errcode='42501'; end if;
  if p_id is null then
    insert into public.vantagens(estabelecimento_id,tipo,titulo,descricao,imagem_url,preco_original,preco_promocional,percentual_desconto,codigo_cupom,regras,data_inicio,data_fim,ativo,exclusivo_viva,destaque)
    values(p_guia_id,p_dados->>'tipo',p_dados->>'titulo',p_dados->>'descricao',p_dados->>'imagem_url',nullif(p_dados->>'preco_original','')::numeric,nullif(p_dados->>'preco_promocional','')::numeric,nullif(p_dados->>'percentual_desconto','')::numeric,p_dados->>'codigo_cupom',p_dados->>'regras',coalesce(nullif(p_dados->>'data_inicio','')::timestamptz,now()),nullif(p_dados->>'data_fim','')::timestamptz,false,false,false)
    returning id into v_id;
  else
    update public.vantagens set
      tipo=case when p_dados ? 'tipo' then p_dados->>'tipo' else tipo end,
      titulo=case when p_dados ? 'titulo' then p_dados->>'titulo' else titulo end,
      descricao=case when p_dados ? 'descricao' then p_dados->>'descricao' else descricao end,
      imagem_url=case when p_dados ? 'imagem_url' then p_dados->>'imagem_url' else imagem_url end,
      preco_original=case when p_dados ? 'preco_original' then nullif(p_dados->>'preco_original','')::numeric else preco_original end,
      preco_promocional=case when p_dados ? 'preco_promocional' then nullif(p_dados->>'preco_promocional','')::numeric else preco_promocional end,
      percentual_desconto=case when p_dados ? 'percentual_desconto' then nullif(p_dados->>'percentual_desconto','')::numeric else percentual_desconto end,
      codigo_cupom=case when p_dados ? 'codigo_cupom' then p_dados->>'codigo_cupom' else codigo_cupom end,
      regras=case when p_dados ? 'regras' then p_dados->>'regras' else regras end,
      data_inicio=case when p_dados ? 'data_inicio' then (p_dados->>'data_inicio')::timestamptz else data_inicio end,
      data_fim=case when p_dados ? 'data_fim' then nullif(p_dados->>'data_fim','')::timestamptz else data_fim end,
      ativo=false
    where id=p_id and estabelecimento_id=p_guia_id returning id into v_id;
    if v_id is null then raise exception 'Promoção não encontrada' using errcode='42501'; end if;
  end if;
  return jsonb_build_object('success',true,'id',v_id);
end $$;
revoke all on function public.parceiro_salvar_vantagem(uuid,uuid,jsonb) from public;
grant execute on function public.parceiro_salvar_vantagem(uuid,uuid,jsonb) to authenticated;

create or replace function public.parceiro_desativar_vantagem(p_guia_id uuid,p_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.parceiros where user_id=auth.uid() and guia_id=p_guia_id and ativo) then raise exception 'Acesso negado' using errcode='42501'; end if;
  update public.vantagens set ativo=false where id=p_id and estabelecimento_id=p_guia_id;
  if not found then raise exception 'Promoção não encontrada'; end if;
end $$;
revoke all on function public.parceiro_desativar_vantagem(uuid,uuid) from public;
grant execute on function public.parceiro_desativar_vantagem(uuid,uuid) to authenticated;

create policy parceiro_upload_media on storage.objects for insert to authenticated with check (
  bucket_id='cms-media' and (storage.foldername(name))[1]='parceiros' and
  exists(select 1 from public.parceiros p where p.user_id=auth.uid() and p.ativo and p.guia_id::text=(storage.foldername(name))[2])
);

create or replace function public.parceiro_resumo(p_guia_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_views integer; v_last timestamptz;
begin
  if not exists(select 1 from public.parceiros where user_id=auth.uid() and guia_id=p_guia_id and ativo) then raise exception 'Acesso negado' using errcode='42501'; end if;
  select count(*) into v_views from public.analytics_eventos where tipo='guia_view' and recurso_id=p_guia_id and criado_em>=date_trunc('month',now());
  select max(criado_em) into v_last from public.parceiro_alteracoes_log where guia_id=p_guia_id;
  return jsonb_build_object('visualizacoes_mes',v_views,'ultima_alteracao',v_last);
end $$;
revoke all on function public.parceiro_resumo(uuid) from public;
grant execute on function public.parceiro_resumo(uuid) to authenticated;
