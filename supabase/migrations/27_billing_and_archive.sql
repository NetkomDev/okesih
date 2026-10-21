BEGIN;
ALTER TABLE public.saas_billings ADD COLUMN proof_uploaded_at timestamptz,
 ADD COLUMN proof_sha256 text, ADD COLUMN settlement_reference text, ADD COLUMN settled_by uuid REFERENCES auth.users(id);
CREATE UNIQUE INDEX billing_proof_unique ON public.saas_billings(proof_sha256) WHERE proof_sha256 IS NOT NULL;
CREATE UNIQUE INDEX billing_settlement_unique ON public.saas_billings(settlement_reference) WHERE settlement_reference IS NOT NULL;
-- Existing proofs have no reliable upload timestamp; retain them for a full window.
UPDATE public.saas_billings SET proof_uploaded_at=now() WHERE bukti_transfer_url IS NOT NULL;
ALTER TABLE public.warkops ADD COLUMN archived_at timestamptz;
CREATE TABLE public.storage_cleanup_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket text NOT NULL,path text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(bucket,path));
ALTER TABLE public.storage_cleanup_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.storage_cleanup_jobs FROM anon,authenticated;
GRANT ALL ON public.storage_cleanup_jobs TO service_role;

CREATE FUNCTION public.submit_billing_proof(p_billing_id uuid,p_warkop_id uuid,p_actor uuid,p_path text,p_hash text,p_ocr text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b public.saas_billings%ROWTYPE;
BEGIN
 SELECT * INTO b FROM public.saas_billings WHERE id=p_billing_id AND warkop_id=p_warkop_id FOR UPDATE;
 IF NOT FOUND OR b.status_bayar='PAID' THEN RAISE EXCEPTION 'Tagihan tidak tersedia untuk unggah bukti.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.warkop_members WHERE warkop_id=p_warkop_id AND user_id=p_actor AND role='OWNER' AND is_active) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF p_hash !~ '^[a-f0-9]{64}$' OR p_path NOT LIKE 'saas-billings/'||p_warkop_id||'/%' THEN RAISE EXCEPTION 'Invalid proof'; END IF;
 IF b.bukti_transfer_url IS NOT NULL AND b.bukti_transfer_url<>p_path THEN
 INSERT INTO public.storage_cleanup_jobs(bucket,path) VALUES('bukti-transfer',b.bukti_transfer_url) ON CONFLICT DO NOTHING; END IF;
 UPDATE public.saas_billings SET bukti_transfer_url=p_path,proof_sha256=p_hash,proof_uploaded_at=now(),ocr_raw_text=p_ocr,status_bayar='PENDING_REVIEW' WHERE id=b.id;
 INSERT INTO public.audit_logs(warkop_id,actor_user_id,action,target_type,target_id) VALUES(p_warkop_id,p_actor,'OWNER_UPLOADED_SAAS_PROOF','saas_billing',b.id);
 RETURN jsonb_build_object('id',b.id,'status_bayar','PENDING_REVIEW','total_tagihan',b.total_tagihan,'tanggal',b.tanggal);
END $$;
CREATE FUNCTION public.review_billing(p_billing_id uuid,p_actor uuid,p_action text,p_reference text,p_notes text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b public.saas_billings%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor AND raw_app_meta_data->>'role'='SUPERADMIN') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO b FROM public.saas_billings WHERE id=p_billing_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tagihan tidak ditemukan.'; END IF;
 IF b.status_bayar='PAID' THEN
   IF p_action='APPROVE' AND b.settlement_reference=trim(p_reference) THEN RETURN jsonb_build_object('id',b.id,'status_bayar','PAID','duplicate',true); END IF;
   RAISE EXCEPTION 'Tagihan lunas tidak dapat diubah.';
 END IF;
 IF b.status_bayar<>'PENDING_REVIEW' OR b.bukti_transfer_url IS NULL THEN RAISE EXCEPTION 'Bukti belum tersedia untuk ditinjau.'; END IF;
 IF p_action='APPROVE' THEN
   IF length(trim(coalesce(p_reference,'')))<4 OR length(p_reference)>160 THEN RAISE EXCEPTION 'Nomor referensi pembayaran wajib diisi.'; END IF;
   UPDATE public.saas_billings SET status_bayar='PAID',settlement_reference=trim(p_reference),settled_by=p_actor WHERE id=b.id;
 ELSIF p_action='REJECT' THEN
   UPDATE public.saas_billings SET status_bayar='UNPAID' WHERE id=b.id;
 ELSE RAISE EXCEPTION 'Aksi tidak valid.'; END IF;
 INSERT INTO public.audit_logs(warkop_id,actor_user_id,action,target_type,target_id,metadata)
 VALUES(b.warkop_id,p_actor,'BILLING_'||p_action,'saas_billing',b.id,jsonb_build_object('reference',p_reference,'notes',left(p_notes,1000)));
 RETURN jsonb_build_object('id',b.id,'status_bayar',CASE WHEN p_action='APPROVE' THEN 'PAID' ELSE 'UNPAID' END);
END $$;
REVOKE ALL ON FUNCTION public.submit_billing_proof(uuid,uuid,uuid,text,text,text),public.review_billing(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_billing_proof(uuid,uuid,uuid,text,text,text),public.review_billing(uuid,uuid,text,text,text) TO service_role;

CREATE FUNCTION public.report_daily_billing(p_warkop_id uuid,p_date date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN count(*)=0 THEN NULL ELSE jsonb_build_object('tagihan_pokok',sum(tagihan_pokok),'kode_unik',sum(kode_unik),'total_tagihan',sum(total_tagihan),
 'status_bayar',CASE WHEN bool_and(status_bayar='PAID') THEN 'PAID' WHEN bool_or(status_bayar='PENDING_REVIEW') THEN 'PENDING_REVIEW' ELSE 'UNPAID' END) END
 FROM public.saas_billings WHERE warkop_id=p_warkop_id AND tanggal=p_date;
$$;
REVOKE ALL ON FUNCTION public.report_daily_billing(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.report_daily_billing(uuid,date) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_settled_billing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' AND current_setting('okesih.archive_tenant',true)=OLD.warkop_id::text THEN RETURN OLD; END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.commission_settled_at IS NOT NULL OR OLD.status_bayar = 'PAID' THEN
      RAISE EXCEPTION 'Tagihan yang sudah dilunasi/diselesaikan tidak dapat dihapus.' USING ERRCODE='23514';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND (OLD.commission_settled_at IS NOT NULL OR OLD.status_bayar = 'PAID') THEN
    IF (NEW.status_bayar, NEW.warkop_id, NEW.tanggal, NEW.total_transactions, NEW.tagihan_pokok, NEW.kode_unik, NEW.total_tagihan, NEW.shift_id)
      IS DISTINCT FROM (OLD.status_bayar, OLD.warkop_id, OLD.tanggal, OLD.total_transactions, OLD.tagihan_pokok, OLD.kode_unik, OLD.total_tagihan, OLD.shift_id) THEN
      RAISE EXCEPTION 'Tagihan yang sudah berstatus PAID tidak dapat diubah nominalnya.' USING ERRCODE='23514';
    END IF;
  ELSE
    NEW.commission_settled_at := CASE WHEN NEW.status_bayar = 'PAID' THEN now() ELSE NULL END;
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_commission_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP='DELETE' AND current_setting('okesih.archive_tenant',true)=OLD.warkop_id::text THEN RETURN OLD; END IF;
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Mutasi komisi bersifat permanen dan tidak dapat diubah atau dihapus.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION public.archive_tenant_and_purge_finance(p_warkop_id uuid,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE w public.warkops%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor AND raw_app_meta_data->>'role'='SUPERADMIN') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO w FROM public.warkops WHERE id=p_warkop_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tenant tidak ditemukan.'; END IF;
 IF w.archived_at IS NOT NULL THEN RETURN jsonb_build_object('archived',true,'duplicate',true); END IF;
 -- Serialize with withdrawal/commission writers before removing earnings.
 PERFORM 1 FROM public.marketing_partners WHERE id IN (SELECT partner_id FROM public.marketing_commission_mutations WHERE warkop_id=p_warkop_id) ORDER BY id FOR UPDATE;
 PERFORM 1 FROM public.shifts WHERE warkop_id=p_warkop_id ORDER BY id FOR UPDATE;
 PERFORM set_config('okesih.archive_tenant',p_warkop_id::text,true);
 INSERT INTO public.storage_cleanup_jobs(bucket,path)
 SELECT 'bukti-transfer',payment_proof_url FROM public.transactions WHERE warkop_id=p_warkop_id AND payment_proof_url IS NOT NULL
 UNION SELECT 'bukti-transfer',bukti_transfer_url FROM public.saas_billings WHERE warkop_id=p_warkop_id AND bukti_transfer_url IS NOT NULL
 ON CONFLICT DO NOTHING;
 DELETE FROM public.marketing_commission_mutations WHERE warkop_id=p_warkop_id;
 DELETE FROM public.saas_billings WHERE warkop_id=p_warkop_id;
 DELETE FROM public.transactions WHERE warkop_id=p_warkop_id;
 DELETE FROM public.waiter_shifts WHERE warkop_id=p_warkop_id;
 DELETE FROM public.shifts WHERE warkop_id=p_warkop_id;
 DELETE FROM public.operation_idempotency WHERE warkop_id=p_warkop_id;
 DELETE FROM public.audit_logs WHERE warkop_id=p_warkop_id;
 UPDATE public.device_installations SET status='REVOKED',revoked_at=now() WHERE warkop_id=p_warkop_id AND status='ACTIVE';
 UPDATE public.warkops SET is_active=false,archived_at=now(),updated_at=now() WHERE id=p_warkop_id;
 INSERT INTO public.audit_logs(warkop_id,actor_user_id,action,target_type,target_id) VALUES(p_warkop_id,p_actor,'TENANT_ARCHIVED_FINANCE_PURGED','warkop',p_warkop_id);
 PERFORM set_config('okesih.archive_tenant','',true);
 RETURN jsonb_build_object('archived',true);
END $$;
REVOKE ALL ON FUNCTION public.archive_tenant_and_purge_finance(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.archive_tenant_and_purge_finance(uuid,uuid) TO service_role;
COMMIT;
