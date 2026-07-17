-- Eu Amo Urânia — Newsletter mensal assistida
-- Reutiliza a tabela public.newsletters e o campo configuracao_futura.
-- A edição mensal é identificada por:
--   automatizacao_tipo = 'resumo_mensal'
--   configuracao_futura->>'periodo_chave' = 'AAAA-MM'

create unique index if not exists newsletters_resumo_mensal_periodo_unique
on public.newsletters (
  automatizacao_tipo,
  ((configuracao_futura->>'periodo_chave'))
)
where automatizacao_tipo = 'resumo_mensal'
  and configuracao_futura ? 'periodo_chave';

comment on index public.newsletters_resumo_mensal_periodo_unique is
'Impede a geração duplicada de newsletters mensais automáticas para o mesmo período.';
