-- KorMit audit: serialize payout decisions and preserve financial history on partner deletion.
BEGIN;
-- 1. TUTUP AKSES PUBLIK / ANON KE TABEL MARKETING & KEUANGAN
DROP POLICY IF EXISTS "Public can register as marketing partner" ON public.marketing_partners;
DROP POLICY IF EXISTS "Public can view marketing partners" ON public.marketing_partners;
DROP POLICY IF EXISTS "Service and admin can update marketing partners" ON public.marketing_partners;
DROP POLICY IF EXISTS "Marketing can read own profile" ON public.marketing_partners;
DROP POLICY IF EXISTS "Marketing can read own mutations" ON public.marketing_commission_mutations;
DROP POLICY IF EXISTS "Marketing can read own withdrawals" ON public.marketing_commission_withdrawals;

ALTER TABLE public.marketing_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_commission_mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_commission_withdrawals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.marketing_partners, public.marketing_commission_mutations,
  public.marketing_commission_withdrawals FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_partners, public.marketing_commission_mutations,
  public.marketing_commission_withdrawals TO service_role;

-- Kebijakan mandiri: Hanya mitra login yang dapat melihat profil, mutasi, dan pencairan miliknya
CREATE POLICY "Marketing can read own profile" ON public.marketing_partners
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Marketing can read own mutations" ON public.marketing_commission_mutations
  FOR SELECT TO authenticated USING (partner_id IN (SELECT id FROM public.marketing_partners WHERE user_id = auth.uid()));

CREATE POLICY "Marketing can read own withdrawals" ON public.marketing_commission_withdrawals
  FOR SELECT TO authenticated USING (marketing_partner_id IN (SELECT id FROM public.marketing_partners WHERE user_id = auth.uid()));

-- 2. TINGKAT KEANGGOTAAN & INTEGRITAS JARINGAN 2 LEVEL
UPDATE public.marketing_partners
SET membership_level = CASE
  WHEN upper(membership_level) IN ('COORDINATOR', 'KOORDINATOR') THEN 'COORDINATOR'
  ELSE 'MITRA'
END;

ALTER TABLE public.marketing_partners DROP CONSTRAINT IF EXISTS marketing_membership_level_valid;
ALTER TABLE public.marketing_partners ADD CONSTRAINT marketing_membership_level_valid
  CHECK (membership_level IN ('MITRA', 'COORDINATOR'));

ALTER TABLE public.marketing_partners DROP CONSTRAINT IF EXISTS marketing_upline_shape_valid;
ALTER TABLE public.marketing_partners ADD CONSTRAINT marketing_upline_shape_valid
  CHECK (upline_id IS NULL OR (upline_id <> id AND membership_level = 'MITRA'));

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
    -- Koordinator tidak boleh memiliki upline (batas 2 level)
    IF NEW.upline_id IS NOT NULL THEN
      RAISE EXCEPTION 'Mitra yang masih memiliki upline tidak dapat diangkat menjadi Koordinator. Lepaskan upline terlebih dahulu.' USING ERRCODE='23514';
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
    IF NOT FOUND OR v_upline.membership_level<>'COORDINATOR' OR v_upline.upline_id IS NOT NULL OR NEW.upline_id=NEW.id OR NEW.membership_level<>'MITRA' THEN
      RAISE EXCEPTION 'Jaringan kemitraan maksimal 2 level (Koordinator -> Mitra). Upline harus koordinator aktif tanpa upline lain.' USING ERRCODE='23514';
    END IF;
    IF (TG_OP='INSERT' OR OLD.upline_id IS DISTINCT FROM NEW.upline_id) AND (v_upline.status<>'ACTIVE' OR v_upline.user_id IS NULL) THEN
      RAISE EXCEPTION 'Koordinator perekrut harus aktif dan memiliki akun login.' USING ERRCODE='23514';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tr_enforce_marketing_network ON public.marketing_partners;
CREATE TRIGGER tr_enforce_marketing_network BEFORE INSERT OR UPDATE OF membership_level,upline_id ON public.marketing_partners
  FOR EACH ROW EXECUTE FUNCTION public.enforce_marketing_network();

-- 3. VALIDASI TARIF PARAMETER GLOBAL
ALTER TABLE public.platform_settings DROP CONSTRAINT IF EXISTS affiliate_rates_valid;
ALTER TABLE public.platform_settings ADD CONSTRAINT affiliate_rates_valid CHECK (
  default_marketing_commission >= 0 AND coordinator_commission_per_receipt >= 0
  AND default_marketing_commission = trunc(default_marketing_commission)
  AND coordinator_commission_per_receipt = trunc(coordinator_commission_per_receipt)
  AND default_marketing_commission + coordinator_commission_per_receipt <= saas_fee_per_receipt
);


-- Production may have only migration 24 installed manually. Install the commission
-- prerequisites explicitly, without applying unrelated order/device migrations.
ALTER TABLE public.saas_billings ADD COLUMN IF NOT EXISTS commission_settled_at timestamptz;
UPDATE public.saas_billings SET commission_settled_at=coalesce(created_at,now()) WHERE status_bayar='PAID' AND commission_settled_at IS NULL;
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
    IF (NEW.status_bayar, NEW.warkop_id, NEW.tanggal, NEW.total_transactions, NEW.tagihan_pokok, NEW.kode_unik, NEW.total_tagihan, to_jsonb(NEW)->'shift_id')
      IS DISTINCT FROM (OLD.status_bayar, OLD.warkop_id, OLD.tanggal, OLD.total_transactions, OLD.tagihan_pokok, OLD.kode_unik, OLD.total_tagihan, to_jsonb(OLD)->'shift_id') THEN
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

DROP TRIGGER IF EXISTS tr_guard_settled_billing ON public.saas_billings;
CREATE TRIGGER tr_guard_settled_billing BEFORE INSERT OR UPDATE OR DELETE ON public.saas_billings FOR EACH ROW EXECUTE FUNCTION public.guard_settled_billing();
DROP TRIGGER IF EXISTS tr_guard_commission_history ON public.marketing_commission_mutations;
CREATE TRIGGER tr_guard_commission_history BEFORE UPDATE OR DELETE ON public.marketing_commission_mutations FOR EACH ROW EXECUTE FUNCTION public.guard_commission_history();
-- 5. DISTRIBUSI KOMISI: HANYA UNTUK AKUN ACTIVE & IDEMPOTEN
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
  IF v_partner.upline_id IS NOT NULL AND v_partner.membership_level = 'MITRA' THEN
    SELECT * INTO v_upline FROM public.marketing_partners WHERE id = v_partner.upline_id FOR UPDATE;
    IF FOUND AND v_upline.status = 'ACTIVE' AND v_upline.membership_level = 'COORDINATOR'
      AND v_upline.upline_id IS NULL AND v_upline.id <> v_partner.id THEN
      v_network := COALESCE(v_settings.coordinator_commission_per_receipt, 0);
    ELSE
      v_network := 0;
    END IF;
  ELSE
    v_network := 0;
  END IF;

  IF NEW.total_transactions * (v_direct + v_network) > NEW.tagihan_pokok THEN
    RAISE EXCEPTION 'Total komisi melebihi pokok tagihan. Periksa parameter global.' USING ERRCODE='23514';
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

CREATE OR REPLACE FUNCTION public.request_marketing_commission_withdrawal(
  p_marketing_partner_id UUID,
  p_amount NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_partner public.marketing_partners%ROWTYPE;
  v_earned NUMERIC(12, 2);
  v_pending NUMERIC(12, 2);
  v_available NUMERIC(12, 2);
  v_withdrawal public.marketing_commission_withdrawals%ROWTYPE;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR trunc(p_amount) <> p_amount THEN
    RAISE EXCEPTION 'Nominal pencairan harus berupa Rupiah bulat dan lebih dari nol.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_partner
  FROM public.marketing_partners
  WHERE id = p_marketing_partner_id AND status = 'ACTIVE'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Akun marketing tidak aktif atau tidak ditemukan.' USING ERRCODE = 'P0002';
  END IF;

  -- Sumber pendapatan sah: Hanya dari mutasi komisi settled (DIRECT + NETWORK)
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_earned
  FROM public.marketing_commission_mutations
  WHERE partner_id = p_marketing_partner_id;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_pending
  FROM public.marketing_commission_withdrawals
  WHERE marketing_partner_id = p_marketing_partner_id
    AND status = 'PENDING';

  v_available := GREATEST(0, v_earned - COALESCE(v_partner.commission_paid, 0) - v_pending);
  IF p_amount > v_available THEN
    RAISE EXCEPTION 'Saldo komisi tidak mencukupi. Saldo tersedia: Rp %.', trim(to_char(v_available, 'FM999G999G999G990')) USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.marketing_commission_withdrawals (
    marketing_partner_id, amount, bank_name, bank_account_number, bank_account_name
  ) VALUES (
    v_partner.id, p_amount, v_partner.bank_name, v_partner.bank_account_number, v_partner.bank_account_name
  ) RETURNING * INTO v_withdrawal;

  RETURN jsonb_build_object(
    'id', v_withdrawal.id,
    'amount', v_withdrawal.amount,
    'status', v_withdrawal.status,
    'available_balance', v_available - p_amount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.report_marketing_dashboard(p_partner_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  WITH tenants AS (SELECT * FROM public.warkops WHERE marketing_agent_id=p_partner_id),
  receipts AS (
    SELECT t.warkop_id, count(*) AS amount
    FROM public.transactions t JOIN tenants w ON w.id=t.warkop_id
    WHERE t.status_pesanan IN ('COOKING','READY','DONE') GROUP BY t.warkop_id
  ),
  billings AS (
    SELECT b.warkop_id, bool_or(b.status_bayar<>'PAID') AS unpaid,
      coalesce(sum(b.tagihan_pokok) FILTER(WHERE b.status_bayar<>'PAID'),0) AS amount
    FROM public.saas_billings b JOIN tenants w ON w.id=b.warkop_id GROUP BY b.warkop_id
  ),
  mutations_per_tenant AS (
    SELECT m.warkop_id, coalesce(sum(m.total_amount), 0) AS commission
    FROM public.marketing_commission_mutations m
    WHERE m.partner_id = p_partner_id
    GROUP BY m.warkop_id
  ),
  mapped AS (
    SELECT w.id, w.created_at, coalesce(r.amount, 0) AS receipts,
      coalesce(mpt.commission, 0) AS commission,
      coalesce(b.unpaid, false) AS unpaid,
      jsonb_build_object(
        'id', w.id, 'name', w.nama, 'slug', w.slug, 'ownerName', coalesce(w.owner_name, ''),
        'phone', w.owner_phone, 'address', w.address, 'province', coalesce(w.province, ''),
        'cityRegency', coalesce(w.city_regency, ''),
        'status', CASE WHEN w.is_active THEN 'ACTIVE' ELSE 'SUSPENDED' END,
        'paymentStatus', CASE WHEN coalesce(b.unpaid, false) THEN 'UNPAID' ELSE 'PAID' END,
        'unpaidAmount', coalesce(b.amount, 0),
        'commissionPerReceipt', coalesce(w.marketing_commission_per_receipt, 0),
        'joinedAt', w.created_at, 'receipts', coalesce(r.amount, 0),
        'commission', coalesce(mpt.commission, 0)
      ) AS row
    FROM tenants w
    LEFT JOIN receipts r ON r.warkop_id = w.id
    LEFT JOIN billings b ON b.warkop_id = w.id
    LEFT JOIN mutations_per_tenant mpt ON mpt.warkop_id = w.id
  ),
  totals AS (
    SELECT count(*) AS tenants, count(*) FILTER(WHERE unpaid) AS unpaid, count(*) FILTER(WHERE NOT unpaid) AS paid,
      coalesce(sum(receipts), 0) AS receipts,
      coalesce((SELECT sum(total_amount) FROM public.marketing_commission_mutations WHERE partner_id = p_partner_id), 0) AS commission
    FROM mapped
  ),
  pending AS (
    SELECT coalesce(sum(amount), 0) AS amount
    FROM public.marketing_commission_withdrawals
    WHERE marketing_partner_id = p_partner_id AND status = 'PENDING'
  )
  SELECT jsonb_build_object(
    'tenants', coalesce((SELECT jsonb_agg(row ORDER BY created_at DESC, id DESC) FROM mapped), '[]'::jsonb),
    'applications', coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY created_at DESC, id DESC) FROM (
      SELECT id, business_name, owner_name, owner_phone, address, province, city_regency, status, review_notes, created_at, warkop_id
      FROM public.tenant_applications WHERE marketing_partner_id = p_partner_id
    ) a), '[]'::jsonb),
    'withdrawals', coalesce((SELECT jsonb_agg(to_jsonb(w) ORDER BY created_at DESC, id DESC) FROM (
      SELECT id, amount, status, bank_name, bank_account_number, bank_account_name, notes, reviewed_at, created_at
      FROM public.marketing_commission_withdrawals
      WHERE marketing_partner_id = p_partner_id ORDER BY created_at DESC, id DESC LIMIT 25
    ) w), '[]'::jsonb),
    'totals', jsonb_build_object(
      'tenants', t.tenants,
      'pending', (SELECT count(*) FROM public.tenant_applications WHERE marketing_partner_id = p_partner_id AND status IN ('PENDING', 'PROCESSING')),
      'unpaidTenants', t.unpaid,
      'paidTenants', t.paid,
      'receipts', t.receipts,
      'commission', t.commission,
      'pendingWithdrawal', p.amount,
      'availableCommission', greatest(0, t.commission - coalesce((SELECT commission_paid FROM public.marketing_partners WHERE id = p_partner_id), 0) - p.amount)
    )
  ) FROM totals t CROSS JOIN pending p;
$$;

REVOKE ALL ON FUNCTION public.request_marketing_commission_withdrawal(uuid,numeric), public.report_marketing_dashboard(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_marketing_commission_withdrawal(uuid,numeric), public.report_marketing_dashboard(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.review_marketing_commission_withdrawal(
  p_withdrawal_id UUID, p_decision TEXT, p_admin_id UUID, p_notes TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_withdrawal public.marketing_commission_withdrawals%ROWTYPE;
  v_partner public.marketing_partners%ROWTYPE;
  v_partner_id uuid;
  v_earned numeric;
  v_other_pending numeric;
  v_decision text := upper(trim(p_decision));
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=p_admin_id AND raw_app_meta_data->>'role'='SUPERADMIN') THEN
    RAISE EXCEPTION 'Akses Super Admin diperlukan.' USING ERRCODE='42501';
  END IF;
  IF v_decision IS NULL OR v_decision NOT IN ('PAID','REJECTED') THEN
    RAISE EXCEPTION 'Keputusan pencairan tidak valid.' USING ERRCODE='22023';
  END IF;
  SELECT marketing_partner_id INTO v_partner_id FROM public.marketing_commission_withdrawals WHERE id=p_withdrawal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pengajuan pencairan tidak ditemukan.' USING ERRCODE='P0002'; END IF;
  -- Same lock as requests, settlements and archives; serialize all balance decisions.
  SELECT * INTO v_partner FROM public.marketing_partners WHERE id=v_partner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mitra tidak ditemukan.' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_withdrawal FROM public.marketing_commission_withdrawals WHERE id=p_withdrawal_id FOR UPDATE;
  IF NOT FOUND OR v_withdrawal.status<>'PENDING' THEN
    RAISE EXCEPTION 'Pengajuan pencairan sudah diproses.' USING ERRCODE='P0001';
  END IF;
  IF v_decision='PAID' THEN
    IF v_partner.status<>'ACTIVE' THEN RAISE EXCEPTION 'Akun mitra tidak aktif. Pencairan tidak dapat dibayarkan.' USING ERRCODE='P0001'; END IF;
    SELECT coalesce(sum(total_amount),0) INTO v_earned FROM public.marketing_commission_mutations WHERE partner_id=v_partner_id;
    SELECT coalesce(sum(amount),0) INTO v_other_pending FROM public.marketing_commission_withdrawals
      WHERE marketing_partner_id=v_partner_id AND status='PENDING' AND id<>p_withdrawal_id;
    IF v_withdrawal.amount>v_earned-coalesce(v_partner.commission_paid,0)-v_other_pending THEN
      RAISE EXCEPTION 'Saldo komisi berubah atau tidak mencukupi. Periksa seluruh pengajuan sebelum membayar.' USING ERRCODE='P0001';
    END IF;
    UPDATE public.marketing_partners SET commission_paid=coalesce(commission_paid,0)+v_withdrawal.amount WHERE id=v_partner_id;
  END IF;
  UPDATE public.marketing_commission_withdrawals SET status=v_decision,
    notes=nullif(trim(coalesce(p_notes,'')),''),reviewed_by=p_admin_id,reviewed_at=now() WHERE id=p_withdrawal_id;
  RETURN jsonb_build_object('id',p_withdrawal_id,'status',v_decision,'amount',v_withdrawal.amount);
END $$;
REVOKE ALL ON FUNCTION public.review_marketing_commission_withdrawal(uuid,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_marketing_commission_withdrawal(uuid,text,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_marketing_partner_safely(p_partner_id uuid,p_admin_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.marketing_partners%ROWTYPE; v_tenants jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=p_admin_id AND raw_app_meta_data->>'role'='SUPERADMIN') THEN
    RAISE EXCEPTION 'Akses Super Admin diperlukan.' USING ERRCODE='42501';
  END IF;
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

CREATE OR REPLACE FUNCTION public.report_superadmin_marketing(p_status text DEFAULT NULL,p_city text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object(
   'commission_rate',(SELECT default_marketing_commission FROM public.platform_settings WHERE id='global'),
   'coordinator_name',u.full_name,
   'total_tenants_acquired',(SELECT count(*) FROM public.warkops WHERE marketing_agent_id=p.id),
   'total_receipts_generated',(SELECT coalesce(sum(receipts_count),0) FROM public.marketing_commission_mutations WHERE partner_id=p.id AND kind='DIRECT'),
   'total_commission_earned',(SELECT coalesce(sum(total_amount),0) FROM public.marketing_commission_mutations WHERE partner_id=p.id),
   'pending_withdrawal',(SELECT coalesce(sum(amount),0) FROM public.marketing_commission_withdrawals WHERE marketing_partner_id=p.id AND status='PENDING')
 ) ORDER BY p.created_at DESC,p.id),'[]'::jsonb)
 FROM public.marketing_partners p LEFT JOIN public.marketing_partners u ON u.id=p.upline_id
 WHERE (p_status IS NULL OR p.status=p_status) AND (p_city IS NULL OR p.city_area ILIKE '%'||p_city||'%');
$$;
REVOKE ALL ON FUNCTION public.report_superadmin_marketing(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.report_superadmin_marketing(text,text) TO service_role;

-- Billing is the source of earned commission: a shift may be billed only once.
ALTER TABLE public.saas_billings ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.shifts(id);
CREATE UNIQUE INDEX IF NOT EXISTS saas_billings_shift_unique ON public.saas_billings(shift_id) WHERE shift_id IS NOT NULL;
ALTER TABLE public.saas_billings DROP CONSTRAINT IF EXISTS saas_billings_warkop_id_tanggal_key;
CREATE INDEX IF NOT EXISTS saas_billings_tenant_date ON public.saas_billings(warkop_id,tanggal DESC);
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
  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift tidak ditemukan.'; END IF;

  SELECT * INTO v_bill FROM public.saas_billings WHERE shift_id = p_shift_id;
  IF NOT FOUND THEN
    IF v_shift.status <> 'OPEN' THEN RAISE EXCEPTION 'Shift sudah ditutup sebelumnya.'; END IF;
    IF p_actual_cash_deposited IS NULL OR p_actual_cash_deposited < 0 THEN
      RAISE EXCEPTION 'Nominal kas tidak valid.';
    END IF;

    SELECT * INTO v_warkop FROM public.warkops WHERE id = v_shift.warkop_id;
    SELECT saas_fee_per_receipt INTO v_fee FROM public.platform_settings WHERE id = 'global' FOR SHARE;
    IF v_fee IS NULL THEN RAISE EXCEPTION 'Tarif sewa belum tersedia.'; END IF;

    SELECT count(*) INTO v_receipts
    FROM public.transactions
    WHERE shift_id = p_shift_id AND status_pesanan IN ('COOKING','READY','DONE');

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


REVOKE ALL ON FUNCTION public.close_shift(uuid,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.close_shift(uuid,numeric,text) TO service_role;
ALTER TABLE public.warkops DROP CONSTRAINT IF EXISTS warkops_marketing_agent_id_fkey;
ALTER TABLE public.warkops ADD CONSTRAINT warkops_marketing_agent_id_fkey FOREIGN KEY(marketing_agent_id) REFERENCES public.marketing_partners(id) ON DELETE SET NULL;
ALTER TABLE public.saas_billings ADD COLUMN IF NOT EXISTS proof_uploaded_at timestamptz,
 ADD COLUMN IF NOT EXISTS proof_sha256 text, ADD COLUMN IF NOT EXISTS settlement_reference text, ADD COLUMN IF NOT EXISTS settled_by uuid REFERENCES auth.users(id);
CREATE UNIQUE INDEX IF NOT EXISTS billing_proof_unique ON public.saas_billings(proof_sha256) WHERE proof_sha256 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS billing_settlement_unique ON public.saas_billings(settlement_reference) WHERE settlement_reference IS NOT NULL;
-- Existing proofs have no reliable upload timestamp; retain them for a full window.
UPDATE public.saas_billings SET proof_uploaded_at=now() WHERE bukti_transfer_url IS NOT NULL AND proof_uploaded_at IS NULL;
CREATE TABLE IF NOT EXISTS public.storage_cleanup_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket text NOT NULL,path text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(bucket,path));
ALTER TABLE public.storage_cleanup_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.storage_cleanup_jobs FROM anon,authenticated;
GRANT ALL ON public.storage_cleanup_jobs TO service_role;

CREATE OR REPLACE FUNCTION public.submit_billing_proof(p_billing_id uuid,p_warkop_id uuid,p_actor uuid,p_path text,p_hash text,p_ocr text)
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
CREATE OR REPLACE FUNCTION public.review_billing(p_billing_id uuid,p_actor uuid,p_action text,p_reference text,p_notes text)
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

CREATE OR REPLACE FUNCTION public.report_daily_billing(p_warkop_id uuid,p_date date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN count(*)=0 THEN NULL ELSE jsonb_build_object('tagihan_pokok',sum(tagihan_pokok),'kode_unik',sum(kode_unik),'total_tagihan',sum(total_tagihan),
 'status_bayar',CASE WHEN bool_and(status_bayar='PAID') THEN 'PAID' WHEN bool_or(status_bayar='PENDING_REVIEW') THEN 'PENDING_REVIEW' ELSE 'UNPAID' END) END
 FROM public.saas_billings WHERE warkop_id=p_warkop_id AND tanggal=p_date;
$$;
REVOKE ALL ON FUNCTION public.report_daily_billing(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.report_daily_billing(uuid,date) TO service_role;


COMMIT;
