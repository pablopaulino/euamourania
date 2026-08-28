-- Permite notificações do app apontarem para o módulo Melhores de Urânia.
-- Não altera envios antigos; apenas amplia o enum/check de destino.

alter table public.app_notificacoes
  drop constraint if exists app_notificacoes_destino_tipo_check;

alter table public.app_notificacoes
  add constraint app_notificacoes_destino_tipo_check
  check (destino_tipo in (
    'home',
    'empresa',
    'turismo',
    'evento',
    'noticia',
    'melhores',
    'telefones_uteis'
  ));

comment on constraint app_notificacoes_destino_tipo_check on public.app_notificacoes is
  'Destinos internos permitidos para notificações push do aplicativo Viva Urânia.';
