-- PostgREST computed field: guia_comercial?select=id,nome,verificado
-- No billing data is exposed. Dates are inclusive in Brasilia time.
BEGIN;
CREATE OR REPLACE FUNCTION public.verificado(empresa public.guia_comercial)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guia_comercial g
    JOIN public.viva_assinaturas a ON a.guia_id = g.id
    WHERE g.id = empresa.id AND g.status = 'publicado'
      AND a.status = 'ativa' AND a.pagamento_confirmado_em IS NOT NULL
      AND (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN a.inicio AND a.validade
  );
$$;
REVOKE ALL ON FUNCTION public.verificado(public.guia_comercial) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verificado(public.guia_comercial) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
