-- Permite que o parceiro altere a categoria do Guia sem alterar nome ou campos editoriais.
-- A galeria passa a ter quatro fotos extras; cadastros antigos com mais fotos podem reduzi-las aos poucos.
begin;

create or replace function public.parceiro_atualizar_cadastro(p_guia_id uuid, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_parceiro uuid;
  v_antes public.guia_comercial%rowtype;
  v_depois public.guia_comercial%rowtype;
  v_campos text[];
  v_categoria_id uuid;
  v_categoria_nome text;
  v_novas_fotos integer;
  v_fotos_atuais integer;
begin
  select id into v_parceiro from public.parceiros where user_id=auth.uid() and guia_id=p_guia_id and ativo=true;
  if v_parceiro is null then raise exception 'Acesso de parceiro negado' using errcode='42501'; end if;
  if p_dados is null or jsonb_typeof(p_dados)<>'object' or p_dados='{}'::jsonb then raise exception 'Dados inválidos'; end if;
  if octet_length(p_dados::text)>20000 then raise exception 'Dados excedem o limite permitido'; end if;
  select array_agg(key) into v_campos from jsonb_object_keys(p_dados) key;
  if exists(select 1 from unnest(v_campos) key where key <> all(array[
    'categoria_id','descricao','imagem_url','galeria_urls','whatsapp','telefone','instagram',
    'facebook','site','endereco','horario','opening_hours','opening_hours_note','mapa_url'
  ])) then raise exception 'Campo não permitido' using errcode='42501'; end if;
  if p_dados ? 'descricao' and length(p_dados->>'descricao') > 1000 then raise exception 'Descrição excede 1000 caracteres'; end if;

  if p_dados ? 'categoria_id' then
    v_categoria_id=(p_dados->>'categoria_id')::uuid;
    select nome into v_categoria_nome from public.categorias
      where id=v_categoria_id and tipo='guia' and status='ativo';
    if not found then raise exception 'Categoria inválida' using errcode='22023'; end if;
  end if;

  select * into v_antes from public.guia_comercial where id=p_guia_id for update;
  if not found then raise exception 'Cadastro não encontrado'; end if;
  if p_dados ? 'galeria_urls' then
    if jsonb_typeof(p_dados->'galeria_urls') <> 'array' then raise exception 'Galeria inválida'; end if;
    v_novas_fotos=jsonb_array_length(p_dados->'galeria_urls');
    v_fotos_atuais=case when jsonb_typeof(v_antes.galeria_urls)='array' then jsonb_array_length(v_antes.galeria_urls) else 0 end;
    if v_novas_fotos>4 and (v_novas_fotos>=v_fotos_atuais and p_dados->'galeria_urls' is distinct from v_antes.galeria_urls) then
      raise exception 'Limite de quatro fotos extras. Remova uma antes de adicionar outra.';
    end if;
  end if;

  update public.guia_comercial set
    categoria_id=case when p_dados ? 'categoria_id' then v_categoria_id else categoria_id end,
    categoria_nome=case when p_dados ? 'categoria_id' then v_categoria_nome else categoria_nome end,
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
commit;
