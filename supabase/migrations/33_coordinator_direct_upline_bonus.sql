BEGIN;
-- Recruitment depth is unrestricted; each bill credits DIRECT + immediate NETWORK only.
ALTER TABLE public.marketing_partners ADD COLUMN IF NOT EXISTS coordinator_commission_override numeric;
ALTER TABLE public.marketing_partners ADD CONSTRAINT coordinator_override_valid CHECK (
 coordinator_commission_override IS NULL OR (coordinator_commission_override>=0 AND coordinator_commission_override<=100000 AND coordinator_commission_override=trunc(coordinator_commission_override))
);
ALTER TABLE public.marketing_partners DROP CONSTRAINT IF EXISTS marketing_upline_shape_valid;
ALTER TABLE public.marketing_partners ADD CONSTRAINT marketing_upline_shape_valid CHECK (upline_id IS NULL OR upline_id<>id);
-- Serialize network/rate edits before row locks, including simultaneous cycle attempts.
CREATE OR REPLACE FUNCTION public.lock_marketing_configuration() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN PERFORM pg_advisory_xact_lock(240025); RETURN NULL; END $$;
CREATE TRIGGER tr_lock_marketing_configuration BEFORE INSERT OR UPDATE OF membership_level,upline_id,coordinator_commission_override,status,user_id OR DELETE ON public.marketing_partners FOR EACH STATEMENT EXECUTE FUNCTION public.lock_marketing_configuration();
CREATE TRIGGER tr_lock_platform_commissions BEFORE INSERT OR UPDATE OF default_marketing_commission,coordinator_commission_per_receipt,saas_fee_per_receipt ON public.platform_settings FOR EACH STATEMENT EXECUTE FUNCTION public.lock_marketing_configuration();
CREATE OR REPLACE FUNCTION public.validate_coordinator_override() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_settings public.platform_settings%ROWTYPE;
BEGIN
 IF NEW.coordinator_commission_override IS NOT NULL THEN
  IF NEW.membership_level<>'COORDINATOR' THEN RAISE EXCEPTION 'Bonus khusus hanya untuk Koordinator Mitra.' USING ERRCODE='23514'; END IF;
  SELECT * INTO v_settings FROM public.platform_settings WHERE id='global' FOR SHARE;
  IF NOT FOUND OR NEW.coordinator_commission_override+v_settings.default_marketing_commission>v_settings.saas_fee_per_receipt THEN
   RAISE EXCEPTION 'Komisi langsung dan bonus khusus KorMit tidak boleh melebihi tarif SaaS per struk.' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tr_validate_coordinator_override BEFORE INSERT OR UPDATE OF coordinator_commission_override,membership_level ON public.marketing_partners FOR EACH ROW EXECUTE FUNCTION public.validate_coordinator_override();
CREATE OR REPLACE FUNCTION public.validate_global_coordinator_overrides() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT FROM public.marketing_partners WHERE coordinator_commission_override+NEW.default_marketing_commission>NEW.saas_fee_per_receipt) THEN
  RAISE EXCEPTION 'Tarif global bertentangan dengan bonus khusus KorMit. Sesuaikan bonus khusus terlebih dahulu.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tr_validate_global_coordinator_overrides BEFORE UPDATE OF default_marketing_commission,saas_fee_per_receipt ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION public.validate_global_coordinator_overrides();
CREATE OR REPLACE FUNCTION public.enforce_marketing_network()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_upline public.marketing_partners%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(240025);

  -- Koordinator harus berstatus aktif dan memiliki akun user terhubung
  IF NEW.membership_level = 'COORDINATOR' AND (TG_OP='INSERT' OR OLD.membership_level IS DISTINCT FROM NEW.membership_level) THEN
    IF NEW.status <> 'ACTIVE' OR NEW.user_id IS NULL THEN
      RAISE EXCEPTION 'Hanya mitra aktif dengan akun login yang dapat diangkat menjadi Koordinator.' USING ERRCODE='23514';
    END IF;

  END IF;

  -- Jika status Koordinator dicabut, pastikan tidak ada downline yang menggantung
  IF TG_OP='UPDATE' AND OLD.membership_level='COORDINATOR' AND NEW.membership_level<>'COORDINATOR'
    AND EXISTS (SELECT 1 FROM public.marketing_partners WHERE upline_id=NEW.id) THEN
    RAISE EXCEPTION 'Lepaskan atau pindahkan seluruh downline sebelum mencabut level koordinator.' USING ERRCODE='23514';
  END IF;

  -- Validasi hubungan upline
  IF NEW.upline_id IS NOT NULL THEN
    SELECT * INTO v_upline FROM public.marketing_partners WHERE id=NEW.upline_id;
    IF NOT FOUND OR v_upline.membership_level<>'COORDINATOR' OR NEW.upline_id=NEW.id THEN
      RAISE EXCEPTION 'Upline harus seorang Koordinator Mitra dan bukan diri sendiri.' USING ERRCODE='23514';
    END IF;
    IF (TG_OP='INSERT' OR OLD.upline_id IS DISTINCT FROM NEW.upline_id) AND (v_upline.status<>'ACTIVE' OR v_upline.user_id IS NULL) THEN
      RAISE EXCEPTION 'Koordinator perekrut harus aktif dan memiliki akun login.' USING ERRCODE='23514';
    END IF;
  END IF;

  IF NEW.upline_id IS NOT NULL AND EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT id,upline_id,ARRAY[id] AS path FROM public.marketing_partners WHERE id=NEW.upline_id
      UNION ALL
      SELECT p.id,p.upline_id,a.path||p.id FROM public.marketing_partners p JOIN ancestors a ON p.id=a.upline_id WHERE NOT p.id=ANY(a.path)
    ) SELECT 1 FROM ancestors WHERE id=NEW.id
  ) THEN RAISE EXCEPTION 'Relasi upline tidak boleh membentuk siklus.' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tr_enforce_marketing_network ON public.marketing_partners;
CREATE TRIGGER tr_enforce_marketing_network BEFORE INSERT OR UPDATE OF membership_level,upline_id ON public.marketing_partners
  FOR EACH ROW EXECUTE FUNCTION public.enforce_marketing_network();

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

DROP TRIGGER IF EXISTS tr_saas_billing_paid_commission ON public.saas_billings;
CREATE TRIGGER tr_saas_billing_paid_commission AFTER INSERT OR UPDATE ON public.saas_billings
FOR EACH ROW EXECUTE FUNCTION public.handle_saas_billing_paid_commission();

CREATE OR REPLACE FUNCTION public.delete_marketing_partner_safely(p_partner_id uuid,p_admin_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.marketing_partners%ROWTYPE; v_tenants jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=p_admin_id AND raw_app_meta_data->>'role'='SUPERADMIN') THEN
    RAISE EXCEPTION 'Akses Super Admin diperlukan.' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(240025);
  SELECT * INTO p FROM public.marketing_partners WHERE id=p_partner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mitra tidak ditemukan.' USING ERRCODE='P0002'; END IF;
  IF coalesce(p.commission_paid,0)>0
    OR EXISTS(SELECT 1 FROM public.marketing_commission_mutations WHERE partner_id=p_partner_id OR source_partner_id=p_partner_id)
    OR EXISTS(SELECT 1 FROM public.marketing_commission_withdrawals WHERE marketing_partner_id=p_partner_id) THEN
    RAISE EXCEPTION 'Mitra memiliki riwayat komisi atau pencairan. Nonaktifkan akun untuk mempertahankan riwayat keuangan.' USING ERRCODE='P0001';
  END IF;
  UPDATE public.marketing_partners SET upline_id=NULL WHERE upline_id=p_partner_id;
  WITH detached AS (
    UPDATE public.warkops SET marketing_agent_id=NULL,marketing_commission_per_receipt=0 WHERE marketing_agent_id=p_partner_id RETURNING id,nama
  ) SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'nama',nama)),'[]'::jsonb) INTO v_tenants FROM detached;
  DELETE FROM public.tenant_applications WHERE marketing_partner_id=p_partner_id;
  DELETE FROM public.marketing_agents WHERE id=p_partner_id;
  DELETE FROM public.marketing_partners WHERE id=p_partner_id;
  INSERT INTO public.audit_logs(actor_user_id,action,target_type,target_id,metadata)
    VALUES(p_admin_id,'MARKETING_PARTNER_DELETED','marketing_partner',p_partner_id,
      jsonb_build_object('partner_name',p.full_name,'referral_code',p.referral_code,'detached_tenants',v_tenants));
  RETURN jsonb_build_object('name',p.full_name,'userId',p.user_id,'detachedTenantsCount',jsonb_array_length(v_tenants));
END $$;
REVOKE ALL ON FUNCTION public.delete_marketing_partner_safely(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.delete_marketing_partner_safely(uuid,uuid) TO service_role;

COMMIT;
