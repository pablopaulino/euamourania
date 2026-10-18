-- Run after 20261018_02. Changes are transactional and always rolled back.
BEGIN;
DO $$
DECLARE g public.guia_comercial; today date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  SELECT * INTO g FROM public.guia_comercial WHERE status = 'publicado' LIMIT 1;
  IF g.id IS NULL THEN RAISE EXCEPTION 'A published guide fixture is required'; END IF;
  DELETE FROM public.viva_assinaturas WHERE guia_id = g.id;
  IF public.verificado(g) THEN RAISE EXCEPTION 'No subscription must be false'; END IF;
  INSERT INTO public.viva_assinaturas(guia_id,periodo,status,inicio,validade,pagamento_confirmado_em)
    VALUES(g.id,'mensal','ativa',today,today,CURRENT_TIMESTAMP);
  IF NOT public.verificado(g) THEN RAISE EXCEPTION 'Paid active inclusive dates must be true'; END IF;
  UPDATE public.viva_assinaturas SET status='pausada' WHERE guia_id=g.id;
  IF public.verificado(g) THEN RAISE EXCEPTION 'Paused must be false'; END IF;
  UPDATE public.viva_assinaturas SET status='cancelada' WHERE guia_id=g.id;
  IF public.verificado(g) THEN RAISE EXCEPTION 'Cancelled must be false'; END IF;
  UPDATE public.viva_assinaturas SET status='pendente',pagamento_confirmado_em=NULL WHERE guia_id=g.id;
  IF public.verificado(g) THEN RAISE EXCEPTION 'Unpaid must be false'; END IF;
  UPDATE public.viva_assinaturas SET status='ativa',pagamento_confirmado_em=CURRENT_TIMESTAMP,inicio=today-30,validade=today-1 WHERE guia_id=g.id;
  IF public.verificado(g) THEN RAISE EXCEPTION 'Expired must be false'; END IF;
  UPDATE public.viva_assinaturas SET inicio=today+1,validade=today+30 WHERE guia_id=g.id;
  IF public.verificado(g) THEN RAISE EXCEPTION 'Future must be false'; END IF;
  UPDATE public.viva_assinaturas SET inicio=today,validade=today WHERE guia_id=g.id;
  UPDATE public.guia_comercial SET status='rascunho' WHERE id=g.id;
  IF public.verificado(g) THEN RAISE EXCEPTION 'Forged published row must not reveal private subscription'; END IF;
END $$;
ROLLBACK;
