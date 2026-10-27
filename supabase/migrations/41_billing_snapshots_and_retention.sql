BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
ALTER TABLE public.saas_billings ADD COLUMN commission_snapshot jsonb;
CREATE FUNCTION public.snapshot_billing_commission() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.marketing_partners%ROWTYPE; u public.marketing_partners%ROWTYPE; settings public.platform_settings%ROWTYPE;
 agent uuid; direct_rate numeric:=0; network_rate numeric:=0;
BEGIN
 IF TG_OP='UPDATE' THEN
   IF NEW.commission_snapshot IS DISTINCT FROM OLD.commission_snapshot THEN RAISE EXCEPTION 'Snapshot komisi tidak dapat diubah.' USING ERRCODE='23514'; END IF;
   IF OLD.commission_snapshot IS NOT NULL AND (NEW.warkop_id,NEW.total_transactions,NEW.tagihan_pokok,NEW.kode_unik,NEW.total_tagihan,NEW.tanggal,NEW.shift_id)
     IS DISTINCT FROM (OLD.warkop_id,OLD.total_transactions,OLD.tagihan_pokok,OLD.kode_unik,OLD.total_tagihan,OLD.tanggal,OLD.shift_id) THEN
     RAISE EXCEPTION 'Nilai dan identitas tagihan bersnapshot tidak dapat diubah.' USING ERRCODE='23514';
   END IF;
   RETURN NEW;
 END IF;
 -- Serialize with configuration edits before capturing rates and the immediate upline.
 PERFORM pg_advisory_xact_lock(240025);
 SELECT marketing_agent_id INTO agent FROM public.warkops WHERE id=NEW.warkop_id FOR SHARE;
 SELECT * INTO settings FROM public.platform_settings WHERE id='global' FOR SHARE;
 SELECT * INTO p FROM public.marketing_partners WHERE id=agent;
 IF p.status='ACTIVE' THEN direct_rate:=settings.default_marketing_commission; END IF;
 SELECT * INTO u FROM public.marketing_partners WHERE id=p.upline_id;
 IF u.status='ACTIVE' AND u.membership_level='COORDINATOR' THEN network_rate:=coalesce(u.coordinator_commission_override,settings.coordinator_commission_per_receipt); END IF;
 IF NEW.total_transactions*(direct_rate+network_rate)>NEW.tagihan_pokok THEN RAISE EXCEPTION 'Komisi melebihi pokok tagihan.' USING ERRCODE='23514'; END IF;
 NEW.commission_snapshot:=jsonb_build_object('captured_at',now(),'source_partner_id',p.id,'source_name',p.full_name,
   'direct_partner_id',CASE WHEN direct_rate>0 THEN p.id END,'direct_rate',direct_rate,
   'network_partner_id',CASE WHEN network_rate>0 THEN u.id END,'network_rate',network_rate);
 RETURN NEW;
END $$;
CREATE TRIGGER tr_snapshot_billing_commission BEFORE INSERT OR UPDATE ON public.saas_billings
 FOR EACH ROW EXECUTE FUNCTION public.snapshot_billing_commission();
CREATE OR REPLACE FUNCTION public.handle_saas_billing_paid_commission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_partner public.marketing_partners%ROWTYPE;
  v_upline public.marketing_partners%ROWTYPE;
  v_settings public.platform_settings%ROWTYPE;
  v_agent uuid;
  v_name text;
  v_direct numeric := 0;
  v_network numeric := 0;
BEGIN
  IF NEW.status_bayar <> 'PAID' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.commission_settled_at IS NOT NULL AND OLD.status_bayar = 'PAID' THEN
    RETURN NEW;
  END IF;
  IF NEW.total_transactions <= 0 OR NEW.tagihan_pokok < 0 THEN RETURN NEW; END IF;

  IF NEW.commission_snapshot IS NOT NULL THEN
    -- Eligibility and rates belong to the issue date. Later suspension hides access,
    -- but does not rewrite an already issued commission entitlement.
    PERFORM 1 FROM public.marketing_partners WHERE id IN (
      (NEW.commission_snapshot->>'direct_partner_id')::uuid,(NEW.commission_snapshot->>'network_partner_id')::uuid
    ) ORDER BY id FOR UPDATE;
    INSERT INTO public.marketing_commission_mutations(billing_id,warkop_id,partner_id,source_partner_id,kind,receipts_count,rate_per_receipt,total_amount,notes)
    SELECT NEW.id,NEW.warkop_id,(NEW.commission_snapshot->>'direct_partner_id')::uuid,
      (NEW.commission_snapshot->>'source_partner_id')::uuid,'DIRECT',NEW.total_transactions,
      (NEW.commission_snapshot->>'direct_rate')::numeric,NEW.total_transactions*(NEW.commission_snapshot->>'direct_rate')::numeric,'Komisi sesuai snapshot tagihan'
    WHERE NEW.commission_snapshot->>'direct_partner_id' IS NOT NULL AND (NEW.commission_snapshot->>'direct_rate')::numeric>0
    ON CONFLICT(billing_id,kind) DO NOTHING;
    INSERT INTO public.marketing_commission_mutations(billing_id,warkop_id,partner_id,source_partner_id,kind,receipts_count,rate_per_receipt,total_amount,notes)
    SELECT NEW.id,NEW.warkop_id,(NEW.commission_snapshot->>'network_partner_id')::uuid,
      (NEW.commission_snapshot->>'source_partner_id')::uuid,'NETWORK',NEW.total_transactions,
      (NEW.commission_snapshot->>'network_rate')::numeric,NEW.total_transactions*(NEW.commission_snapshot->>'network_rate')::numeric,'Bonus jaringan sesuai snapshot tagihan'
    WHERE NEW.commission_snapshot->>'network_partner_id' IS NOT NULL AND (NEW.commission_snapshot->>'network_rate')::numeric>0
    ON CONFLICT(billing_id,kind) DO NOTHING;
    RETURN NEW;
  END IF;
  -- Legacy bills have no recoverable issue-time snapshot; retain their old settlement rule.
  SELECT marketing_agent_id, nama INTO v_agent, v_name
  FROM public.warkops WHERE id = NEW.warkop_id FOR SHARE;
  IF v_agent IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_settings FROM public.platform_settings WHERE id = 'global' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parameter master global tidak tersedia.'; END IF;

  SELECT * INTO v_partner FROM public.marketing_partners WHERE id = v_agent FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- ATURAN: Hanya mitra aktif yang berhak mendapatkan komisi langsung
  IF v_partner.status = 'ACTIVE' THEN
    v_direct := COALESCE(v_settings.default_marketing_commission, 0);
  ELSE
    v_direct := 0;
  END IF;

  -- ATURAN: Hanya koordinator aktif yang berhak mendapatkan bonus jaringan
  IF v_partner.upline_id IS NOT NULL THEN
    SELECT * INTO v_upline FROM public.marketing_partners WHERE id = v_partner.upline_id FOR UPDATE;
    IF FOUND AND v_upline.status = 'ACTIVE' AND v_upline.membership_level = 'COORDINATOR'
      AND v_upline.id <> v_partner.id THEN
      v_network := COALESCE(v_upline.coordinator_commission_override, v_settings.coordinator_commission_per_receipt, 0);
    ELSE
      v_network := 0;
    END IF;
  ELSE
    v_network := 0;
  END IF;

  IF NEW.total_transactions * (v_direct + v_network) > NEW.tagihan_pokok THEN
    RAISE EXCEPTION 'Total komisi melebihi pokok tagihan. Periksa parameter global dan bonus khusus KorMit.' USING ERRCODE='23514';
  END IF;

  -- Kunci idempoten: ON CONFLICT DO NOTHING menjamin nominal historis tidak dapat ditimpa
  IF v_direct > 0 AND NEW.total_transactions > 0 THEN
    INSERT INTO public.marketing_commission_mutations (
      billing_id, warkop_id, partner_id, source_partner_id, kind, receipts_count, rate_per_receipt, total_amount, notes
    ) VALUES (
      NEW.id, NEW.warkop_id, v_partner.id, v_partner.id, 'DIRECT',
      NEW.total_transactions, v_direct, NEW.total_transactions * v_direct,
      'Komisi tenant: ' || COALESCE(v_name, 'Warkop')
    ) ON CONFLICT (billing_id, kind) DO NOTHING;
  END IF;

  IF v_network > 0 AND NEW.total_transactions > 0 THEN
    INSERT INTO public.marketing_commission_mutations (
      billing_id, warkop_id, partner_id, source_partner_id, kind, receipts_count, rate_per_receipt, total_amount, notes
    ) VALUES (
      NEW.id, NEW.warkop_id, v_upline.id, v_partner.id, 'NETWORK',
      NEW.total_transactions, v_network, NEW.total_transactions * v_network,
      'Bonus jaringan: ' || COALESCE(v_partner.full_name, 'Mitra') || ' / ' || COALESCE(v_name, 'Warkop')
    ) ON CONFLICT (billing_id, kind) DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.close_shift(
  p_shift_id uuid,
  p_actual_cash_deposited numeric DEFAULT 0,
  p_notes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_shift public.shifts%ROWTYPE;
  v_warkop public.warkops%ROWTYPE;
  v_bill public.saas_billings%ROWTYPE;
  v_fee numeric;
  v_receipts integer;
BEGIN
  PERFORM pg_advisory_xact_lock(240025);
  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift tidak ditemukan.'; END IF;

  SELECT * INTO v_bill FROM public.saas_billings WHERE shift_id = p_shift_id;
  IF NOT FOUND THEN
    IF v_shift.status <> 'OPEN' THEN
      IF NOT EXISTS(SELECT FROM public.saas_billings WHERE shift_id=p_shift_id) THEN
        RETURN jsonb_build_object('shift_id',p_shift_id,'billing_id',NULL,'total_transactions',(SELECT count(*) FROM public.transactions WHERE shift_id=p_shift_id AND status_pesanan IN ('COOKING','READY','DONE')),'tagihan_pokok',0,'kode_unik',0,'total_tagihan',0,'status','CLOSED');
      END IF;
      RAISE EXCEPTION 'Shift sudah ditutup sebelumnya.';
    END IF;
    IF EXISTS(SELECT FROM public.transactions WHERE shift_id=p_shift_id AND status_pesanan IN ('COOKING','READY','DONE') AND payment_status<>'PAID') THEN
      RAISE EXCEPTION 'Masih ada pembayaran belum dicatat pada shift ini. Selesaikan pelunasan atau pemeriksaan transaksi lama di kasir.';
    END IF;
    IF p_actual_cash_deposited IS NULL OR p_actual_cash_deposited < 0 THEN
      RAISE EXCEPTION 'Nominal kas tidak valid.';
    END IF;

    SELECT * INTO v_warkop FROM public.warkops WHERE id = v_shift.warkop_id;
    SELECT saas_fee_per_receipt INTO v_fee FROM public.platform_settings WHERE id = 'global' FOR SHARE;
    IF v_fee IS NULL THEN RAISE EXCEPTION 'Tarif sewa belum tersedia.'; END IF;

    SELECT count(*) INTO v_receipts
    FROM public.transactions
    WHERE shift_id = p_shift_id AND status_pesanan IN ('COOKING','READY','DONE');

    IF v_receipts=0 OR v_fee=0 THEN
      UPDATE public.shifts SET closed_at=now(),actual_cash_deposited=p_actual_cash_deposited,
        total_cash_expected=public.report_shift_cash(v_shift.warkop_id,p_shift_id),
        difference=p_actual_cash_deposited-public.report_shift_cash(v_shift.warkop_id,p_shift_id),
        notes=coalesce(p_notes,notes),status='CLOSED' WHERE id=p_shift_id;
      RETURN jsonb_build_object('shift_id',p_shift_id,'billing_id',NULL,'total_transactions',v_receipts,'saas_fee_per_receipt',v_fee,'tagihan_pokok',0,'kode_unik',0,'total_tagihan',0,'status','CLOSED');
    END IF;

    v_bill.kode_unik := floor(random() * (v_warkop.unique_code_range_end - v_warkop.unique_code_range_start + 1) + v_warkop.unique_code_range_start);

    INSERT INTO public.saas_billings (
      warkop_id, shift_id, tanggal, total_transactions, tagihan_pokok, kode_unik, total_tagihan, status_bayar, grace_until
    ) VALUES (
      v_shift.warkop_id, p_shift_id, (now() AT TIME ZONE 'Asia/Makassar')::date,
      v_receipts, v_receipts * v_fee, v_bill.kode_unik, v_receipts * v_fee + v_bill.kode_unik,
      'UNPAID', now() + interval '12 hours'
    ) RETURNING * INTO v_bill;

    UPDATE public.shifts
    SET closed_at = now(), actual_cash_deposited = p_actual_cash_deposited,
        notes = coalesce(p_notes, notes), status = 'CLOSED'
    WHERE id = p_shift_id;
  END IF;

  RETURN jsonb_build_object(
    'shift_id', p_shift_id,
    'billing_id', v_bill.id,
    'total_transactions', v_bill.total_transactions,
    'saas_fee_per_receipt', CASE WHEN v_bill.total_transactions > 0 THEN v_bill.tagihan_pokok / v_bill.total_transactions ELSE 0 END,
    'tagihan_pokok', v_bill.tagihan_pokok,
    'kode_unik', v_bill.kode_unik,
    'total_tagihan', v_bill.total_tagihan,
    'status', 'CLOSED'
  );
END $$;


CREATE OR REPLACE FUNCTION public.delete_entity_permanently(p_type text,p_id uuid,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE job uuid; users uuid[]; files jsonb; folders jsonb; affected integer:=0; partner uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor AND raw_app_meta_data->>'role'='SUPERADMIN') THEN RAISE EXCEPTION 'Akses Super Admin diperlukan.' USING ERRCODE='42501'; END IF;
 IF p_type NOT IN ('TENANT','MARKETING') THEN RAISE EXCEPTION 'Jenis data tidak valid.'; END IF;
 PERFORM pg_advisory_xact_lock(240025);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_type||p_id::text,0));
 SELECT id INTO job FROM public.entity_deletion_jobs WHERE entity_type=p_type AND entity_id=p_id;
 IF FOUND THEN RETURN jsonb_build_object('jobId',job,'duplicate',true); END IF;
 IF p_type='TENANT' THEN
   SELECT marketing_agent_id INTO partner FROM public.warkops WHERE id=p_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Tenant tidak ditemukan.' USING ERRCODE='P0002'; END IF;
   IF EXISTS(SELECT FROM public.transactions WHERE warkop_id=p_id) OR EXISTS(SELECT FROM public.saas_billings WHERE warkop_id=p_id)
     OR EXISTS(SELECT FROM public.marketing_commission_mutations WHERE warkop_id=p_id) THEN
     RAISE EXCEPTION 'Tenant memiliki riwayat keuangan. Nonaktifkan tenant untuk mempertahankan laporan.' USING ERRCODE='23514';
   END IF;
   PERFORM 1 FROM public.marketing_partners WHERE id IN (SELECT partner_id FROM public.marketing_commission_mutations WHERE warkop_id=p_id) ORDER BY id FOR UPDATE;
   PERFORM 1 FROM public.shifts WHERE warkop_id=p_id ORDER BY id FOR UPDATE;
   SELECT coalesce(array_agg(u.id),'{}') INTO users FROM auth.users u WHERE
     u.id<>p_actor AND u.raw_app_meta_data->>'role' IN ('OWNER','KASIR','DAPUR')
     AND (EXISTS(SELECT 1 FROM public.warkop_members WHERE warkop_id=p_id AND user_id=u.id) OR u.raw_app_meta_data->>'warkop_id'=p_id::text)
     AND NOT EXISTS(SELECT 1 FROM public.warkop_members WHERE user_id=u.id AND warkop_id<>p_id)
     AND NOT EXISTS(SELECT 1 FROM public.marketing_partners WHERE user_id=u.id);
   folders:=jsonb_build_array(
     jsonb_build_object('bucket','menu-images','path',p_id||'/'),
     jsonb_build_object('bucket','business-logos','path',p_id||'/'),
     jsonb_build_object('bucket','qris-warkop','path',p_id||'/'),
     jsonb_build_object('bucket','bukti-transfer','path',p_id||'/'),
     jsonb_build_object('bucket','bukti-transfer','path','saas-billings/'||p_id||'/'));
   SELECT coalesce(jsonb_agg(jsonb_build_object('bucket',bucket,'path',path)),'[]') INTO files FROM (
     SELECT 'menu-images' AS bucket,image_url AS path FROM public.menus WHERE warkop_id=p_id AND image_url IS NOT NULL
     UNION SELECT 'business-logos',logo_url FROM public.warkops WHERE id=p_id AND logo_url IS NOT NULL
     UNION SELECT 'qris-warkop',qris_image_url FROM public.warkops WHERE id=p_id AND qris_image_url IS NOT NULL
     UNION SELECT 'bukti-transfer',payment_proof_url FROM public.transactions WHERE warkop_id=p_id AND payment_proof_url IS NOT NULL
     UNION SELECT 'bukti-transfer',bukti_transfer_url FROM public.saas_billings WHERE warkop_id=p_id AND bukti_transfer_url IS NOT NULL
   ) f;
   PERFORM set_config('okesih.archive_tenant',p_id::text,true);
   DELETE FROM public.marketing_commission_mutations WHERE warkop_id=p_id;
   DELETE FROM public.saas_billings WHERE warkop_id=p_id;
   DELETE FROM public.transactions WHERE warkop_id=p_id;
   DELETE FROM public.waiter_shifts WHERE warkop_id=p_id;
   DELETE FROM public.shifts WHERE warkop_id=p_id;
   DELETE FROM public.tenant_applications WHERE warkop_id=p_id;
   -- All tenant-owned tables have ON DELETE CASCADE, including devices and outbox.
   DELETE FROM public.warkops WHERE id=p_id;
   IF partner IS NOT NULL THEN UPDATE public.marketing_partners SET total_tenants_acquired=(SELECT count(*) FROM public.warkops WHERE marketing_agent_id=partner) WHERE id=partner; END IF;
   PERFORM set_config('okesih.archive_tenant','',true);
 ELSE
   PERFORM 1 FROM public.marketing_partners WHERE id=p_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Mitra tidak ditemukan.' USING ERRCODE='P0002'; END IF;
   IF EXISTS(SELECT FROM public.marketing_commission_mutations WHERE partner_id=p_id OR source_partner_id=p_id)
     OR EXISTS(SELECT FROM public.marketing_commission_withdrawals WHERE marketing_partner_id=p_id)
     OR EXISTS(SELECT FROM public.marketing_partners WHERE id=p_id AND coalesce(commission_paid,0)>0)
     OR EXISTS(SELECT FROM public.saas_billings WHERE commission_snapshot->>'source_partner_id'=p_id::text
       OR commission_snapshot->>'direct_partner_id'=p_id::text OR commission_snapshot->>'network_partner_id'=p_id::text)
     OR EXISTS(SELECT FROM public.warkops w JOIN public.saas_billings b ON b.warkop_id=w.id WHERE w.marketing_agent_id=p_id) THEN
     RAISE EXCEPTION 'Mitra memiliki riwayat atau hak komisi tagihan. Nonaktifkan akun untuk mempertahankan laporan.' USING ERRCODE='23514';
   END IF;
   SELECT coalesce(array_agg(u.id),'{}') INTO users FROM auth.users u JOIN public.marketing_partners p ON p.user_id=u.id
     WHERE p.id=p_id AND u.id<>p_actor AND u.raw_app_meta_data->>'role'='MARKETING'
     AND NOT EXISTS(SELECT 1 FROM public.warkop_members WHERE user_id=u.id)
     AND NOT EXISTS(SELECT 1 FROM public.marketing_partners WHERE user_id=u.id AND id<>p_id);
   folders:=jsonb_build_array(jsonb_build_object('bucket','partner-photos','path',p_id||'/'));
   SELECT coalesce(jsonb_agg(jsonb_build_object('bucket','partner-photos','path',profile_photo_url)),'[]') INTO files
     FROM public.marketing_partners WHERE id=p_id AND profile_photo_url IS NOT NULL;
   PERFORM 1 FROM public.marketing_partners WHERE id IN (SELECT partner_id FROM public.marketing_commission_mutations WHERE source_partner_id=p_id) ORDER BY id FOR UPDATE;
   PERFORM set_config('okesih.delete_partner',p_id::text,true);
   DELETE FROM public.marketing_commission_mutations WHERE partner_id=p_id OR source_partner_id=p_id;
   UPDATE public.marketing_partners SET upline_id=NULL WHERE upline_id=p_id;
   UPDATE public.warkops SET marketing_agent_id=NULL,marketing_commission_per_receipt=0 WHERE marketing_agent_id=p_id;
   GET DIAGNOSTICS affected=ROW_COUNT;
   DELETE FROM public.tenant_applications WHERE marketing_partner_id=p_id;
   DELETE FROM public.marketing_commission_withdrawals WHERE marketing_partner_id=p_id;
   DELETE FROM public.audit_logs WHERE target_id=p_id OR actor_user_id=ANY(users);
   IF to_regclass('public.marketing_agents') IS NOT NULL THEN EXECUTE 'DELETE FROM public.marketing_agents WHERE id=$1' USING p_id; END IF;
   DELETE FROM public.marketing_partners WHERE id=p_id;
   PERFORM set_config('okesih.delete_partner','',true);
 END IF;
 DELETE FROM public.auth_handoff_codes WHERE user_id=ANY(users);
 INSERT INTO public.entity_deletion_jobs(entity_type,entity_id,user_ids,objects,prefixes)
 VALUES(p_type,p_id,users,files,folders) RETURNING id INTO job;
 RETURN jsonb_build_object('jobId',job,'detachedTenantsCount',affected);
END $$;
CREATE OR REPLACE FUNCTION public.archive_tenant_and_purge_finance(p_warkop_id uuid,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 RAISE EXCEPTION 'Penghapusan riwayat keuangan dinonaktifkan. Nonaktifkan tenant tanpa menghapus laporan.' USING ERRCODE='23514';
END $$;
REVOKE ALL ON FUNCTION public.archive_tenant_and_purge_finance(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
-- The obsolete partner deletion function must not bypass snapshot retention checks.
REVOKE ALL ON FUNCTION public.delete_marketing_partner_safely(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
