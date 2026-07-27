-- Eu Amo Urânia — libera uploads da biblioteca de mídia para o módulo Melhores de Urânia.
-- Execute no SQL Editor do Supabase após as migrações de mídia do CMS.

begin;

create or replace function public.pode_gerenciar_midia_cms(
  p_nome text,
  p_acao text default 'editar'
) returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select case split_part(coalesce(p_nome,''),'/',1)
    when 'noticias' then
      public.tem_permissao_admin('noticias',p_acao)
      or (p_acao='criar' and public.tem_permissao_admin('noticias','editar'))
    when 'guia' then
      public.tem_permissao_admin('guia_comercial',p_acao)
      or (p_acao='criar' and public.tem_permissao_admin('guia_comercial','editar'))
    when 'turismo' then
      public.tem_permissao_admin('turismo',p_acao)
      or (p_acao='criar' and public.tem_permissao_admin('turismo','editar'))
    when 'eventos' then
      public.tem_permissao_admin('eventos',p_acao)
      or (p_acao='criar' and public.tem_permissao_admin('eventos','editar'))
    when 'comunicacao' then
      public.tem_permissao_admin('comunicacao',p_acao)
      or (p_acao='criar' and public.tem_permissao_admin('comunicacao','editar'))
    when 'melhores' then
      public.tem_permissao_admin('melhores',p_acao)
      or (p_acao='criar' and public.tem_permissao_admin('melhores','editar'))
    else false
  end;
$$;

revoke all on function public.pode_gerenciar_midia_cms(text,text) from public;
grant execute on function public.pode_gerenciar_midia_cms(text,text) to authenticated;

commit;
