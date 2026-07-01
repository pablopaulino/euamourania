-- Eu Amo Urânia — publicação direta exclusiva do Super Admin
-- Execute uma vez no SQL Editor do Supabase antes de publicar esta branch.
begin;

-- Impede que usuários autenticados fabriquem uma notícia já aprovada no insert.
-- O Super Admin publica pela RPC segura criada abaixo.
create or replace function public.proteger_estado_editorial()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if current_user in('anon','authenticated') then
    if tg_op='INSERT' then
      if new.status_editorial<>'rascunho' or new.status='publicado' then
        raise exception 'Use o fluxo editorial para publicar a notícia.' using errcode='42501';
      end if;
    elsif old.status_editorial is distinct from new.status_editorial then
      raise exception 'Use o fluxo de aprovação para alterar o estado editorial.' using errcode='42501';
    end if;
  end if;
  if new.status='publicado' and new.status_editorial<>'aprovado' then
    raise exception 'A notícia precisa ser aprovada antes da publicação.' using errcode='23514';
  end if;
  return new;
end;
$$;

drop trigger if exists noticias_proteger_estado_editorial on public.noticias;
create trigger noticias_proteger_estado_editorial
before insert or update on public.noticias
for each row execute function public.proteger_estado_editorial();

-- Administradores e Editores podem revisar matérias de outras pessoas,
-- mas somente o Super Admin pode concluir a própria revisão.
create or replace function public.impedir_autorrevisao_noticia()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if old.status='pendente'
     and new.status is distinct from old.status
     and old.enviado_por=(select auth.uid())
     and public.funcao_admin_atual()<>'super_admin' then
    raise exception 'Sua própria matéria deve ser revisada por outro responsável.' using errcode='42501';
  end if;
  return new;
end;
$$;

drop trigger if exists solicitacoes_impedir_autorrevisao on public.solicitacoes_aprovacao;
create trigger solicitacoes_impedir_autorrevisao
before update on public.solicitacoes_aprovacao
for each row execute function public.impedir_autorrevisao_noticia();

-- Publica e aprova em uma única operação protegida. A chamada é recusada
-- para qualquer função diferente de Super Admin.
create or replace function public.publicar_noticia_super_admin(
  p_noticia uuid,
  p_publicado_em timestamptz default null
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_noticia public.noticias%rowtype;
begin
  if public.funcao_admin_atual()<>'super_admin' then
    raise exception 'Somente o Super Admin pode publicar sem aprovação.' using errcode='42501';
  end if;

  select * into v_noticia
  from public.noticias
  where id=p_noticia
  for update;
  if not found then
    raise exception 'Notícia não encontrada.' using errcode='P0002';
  end if;
  if nullif(trim(v_noticia.titulo),'') is null
     or nullif(trim(v_noticia.slug),'') is null
     or nullif(trim(coalesce(v_noticia.conteudo_html,'')),'') is null then
    raise exception 'Preencha título, slug e conteúdo antes de publicar.' using errcode='22023';
  end if;

  update public.solicitacoes_aprovacao
  set status='cancelado',revisado_por=(select auth.uid()),
      revisado_em=now(),atualizado_em=now(),
      comentario=coalesce(comentario,'Publicação direta pelo Super Admin.')
  where noticia_id=p_noticia and status='pendente';

  update public.noticias
  set status='publicado',
      status_editorial='aprovado',
      publicado_em=coalesce(p_publicado_em,publicado_em,now()),
      revisado_por=(select auth.uid()),
      revisado_em=now()
  where id=p_noticia;

  insert into public.cms_atividades(tabela,registro_id,acao,titulo,usuario_id,dados)
  values(
    'noticias',p_noticia::text,'publicado',v_noticia.titulo,(select auth.uid()),
    jsonb_build_object('publicacao_direta',true)
  );
end;
$$;

revoke all on function public.publicar_noticia_super_admin(uuid,timestamptz) from public;
grant execute on function public.publicar_noticia_super_admin(uuid,timestamptz) to authenticated;

commit;
