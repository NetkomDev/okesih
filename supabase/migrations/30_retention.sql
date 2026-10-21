BEGIN;
CREATE FUNCTION public.enqueue_expired_billing_proofs()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b record; n integer:=0;
BEGIN
 FOR b IN SELECT id,bukti_transfer_url FROM public.saas_billings
 WHERE status_bayar='PAID' AND proof_uploaded_at < now()-interval '90 days' AND bukti_transfer_url IS NOT NULL
 ORDER BY proof_uploaded_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
 INSERT INTO public.storage_cleanup_jobs(bucket,path) VALUES('bukti-transfer',b.bukti_transfer_url) ON CONFLICT DO NOTHING;
 UPDATE public.saas_billings SET bukti_transfer_url=NULL,ocr_raw_text=NULL WHERE id=b.id;
 n:=n+1;
 END LOOP;
 DELETE FROM public.api_rate_limits WHERE expires_at < now()-interval '1 day';
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_expired_billing_proofs() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_expired_billing_proofs() TO service_role;
COMMIT;
