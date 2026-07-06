-- Permite campanha nativa sem imagem quando há conteúdo público suficiente.
-- Mantém a exigência de mídia para banners, vídeos e pop-ups ativos.

alter table public.campanhas_publicitarias
  drop constraint if exists campanha_midia;

alter table public.campanhas_publicitarias
  add constraint campanha_midia check (
    status = 'rascunho'
    or imagem_url is not null
    or video_url is not null
    or (
      configuracao_futura->>'formato' = 'nativo'
      and (
        nullif(btrim(configuracao_futura->>'titulo_publico'), '') is not null
        or nullif(btrim(configuracao_futura->>'texto_publico'), '') is not null
      )
    )
  );
