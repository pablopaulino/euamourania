-- Corrige a colisao entre a coluna retornada `id` e a coluna da notificacao.
-- A versao anterior falhava antes de consultar a Expo com:
-- column reference "id" is ambiguous.
create or replace function public.app_push_tokens_para_notificacao(p_notificacao_id uuid)
returns table (id uuid, expo_push_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plataforma text;
  v_tema text;
begin
  if auth.role() <> 'service_role'
     and not public.tem_permissao_admin('notificacoes', 'enviar') then
    raise exception 'Permissão para enviar notificações necessária';
  end if;

  select notificacao.plataforma, notificacao.tema
    into v_plataforma, v_tema
    from public.app_notificacoes as notificacao
   where notificacao.id = p_notificacao_id;

  if not found then
    raise exception 'Notificação não encontrada';
  end if;

  return query
  select token.id, token.expo_push_token
    from public.app_push_tokens as token
    left join public.app_preferencias_notificacao as preferencia
      on preferencia.user_id = token.usuario_id
   where token.ativo = true
     and (v_plataforma = 'todos' or token.plataforma = v_plataforma)
     and (
       v_tema = 'geral'
       or token.usuario_id is null
       or preferencia.user_id is null
       or coalesce((preferencia.temas ->> v_tema)::boolean, true)
     )
   order by token.visto_em desc;
end;
$$;

revoke all on function public.app_push_tokens_para_notificacao(uuid) from public;
grant execute on function public.app_push_tokens_para_notificacao(uuid) to authenticated;
grant execute on function public.app_push_tokens_para_notificacao(uuid) to service_role;
