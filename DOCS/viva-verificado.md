# Selo de Empresa Verificada

## Ativação

Aplicar `supabase/migrations/20261018_02_viva_verificado_publico.sql` **antes de publicar o código**. A migration depende de `20261018_01_viva_assinaturas.sql`. Não cria nem confirma pagamentos.

O campo calculado `verificado` usa a assinatura real a cada consulta: status ativa, pagamento confirmado e data de Brasília dentro do intervalo inclusivo de início/validade. Cadastros não publicados retornam falso, inclusive quando um cliente envia um objeto com status adulterado à função. As tabelas financeiras continuam protegidas por RLS.

## Contrato público para site e aplicativo

Incluir explicitamente `verificado` no select; campos calculados não são incluídos pelo `*`:

```js
supabase.from('guia_comercial')
  .select('id,nome,slug,verificado')
  .eq('status', 'publicado');
```

Ou `select('*,verificado')`. Exibir o selo somente se `verificado === true`. O aplicativo nativo deve consumir esse mesmo campo; seu código não faz parte desta entrega.

O site inclui o campo nos cards e detalhes, inclusive SSR. Essas respostas não usam cache persistente nem dados antigos em caso de falha. A validade é reavaliada ao consultar/reabrir a página; uma página já aberta não faz polling de assinaturas.

## Verificação

- `npm.cmd run test:parceiro`
- `npm.cmd run validate`
- `node --test tests/viva-verified.test.js`
- No SQL Editor: `supabase/tests/viva_verificado.sql` testa os estados com rollback; nenhuma assinatura de teste permanece.
- Após a migration, consultar anonimamente `/rest/v1/guia_comercial?select=id,nome,verificado&status=eq.publicado&limit=1` e conferir que `verificado` é booleano. Acesso anônimo direto a `viva_assinaturas` deve continuar bloqueado.
