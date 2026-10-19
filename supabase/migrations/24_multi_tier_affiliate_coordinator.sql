-- Migrasi 24: Jaringan Kemitraan 2 Level (Multi-Tier Affiliate - Skema A)
-- Fitur:
-- 1. Parameter Global coordinator_commission_per_receipt
-- 2. Tingkat keanggotaan marketing_partners (MITRA vs KOORDINATOR) & upline_id
-- 3. Buku mutasi komisi marketing_commission_mutations (DIRECT & NETWORK)
-- 4. Trigger otomatis saat saas_billings lunas (status_bayar = 'PAID')
-- 5. RPC report_marketing_network untuk dashboard Jaringan Saya

-- 1. Tambah kolom di platform_settings
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS coordinator_commission_per_receipt NUMERIC(10, 2) NOT NULL DEFAULT 5.00;

-- 2. Tambah kolom level keanggotaan dan upline di marketing_partners
ALTER TABLE public.marketing_partners
  ADD COLUMN IF NOT EXISTS membership_level VARCHAR(20) NOT NULL DEFAULT 'MITRA';

ALTER TABLE public.marketing_partners
  ADD COLUMN IF NOT EXISTS upline_id UUID REFERENCES public.marketing_partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_partners_upline
  ON public.marketing_partners (upline_id);

CREATE INDEX IF NOT EXISTS idx_marketing_partners_level
  ON public.marketing_partners (membership_level);

-- 3. Tabel Buku Mutasi Komisi (Pencatatan Idempoten & Transparan)
CREATE TABLE IF NOT EXISTS public.marketing_commission_mutations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_id UUID NOT NULL REFERENCES public.saas_billings(id) ON DELETE CASCADE,
  warkop_id UUID NOT NULL REFERENCES public.warkops(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.marketing_partners(id) ON DELETE CASCADE,
  source_partner_id UUID REFERENCES public.marketing_partners(id) ON DELETE SET NULL,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('DIRECT', 'NETWORK')),
  receipts_count INTEGER NOT NULL DEFAULT 0,
  rate_per_receipt NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT uq_billing_commission_kind UNIQUE (billing_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_comm_mutations_partner
  ON public.marketing_commission_mutations (partner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comm_mutations_billing
  ON public.marketing_commission_mutations (billing_id);

ALTER TABLE public.marketing_commission_mutations ENABLE ROW LEVEL SECURITY;

-- 4. Fungsi & Trigger Distribusi Komisi Otomatis saat Tagihan Lunas
CREATE OR REPLACE FUNCTION public.handle_saas_billing_paid_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_warkop RECORD;
  v_partner RECORD;
  v_upline RECORD;
  v_settings RECORD;
  v_receipts INTEGER;
  v_direct_rate NUMERIC(10, 2);
  v_network_rate NUMERIC(10, 2);
  v_direct_amount NUMERIC(12, 2);
  v_network_amount NUMERIC(12, 2);
BEGIN
  -- Hanya picu jika status_bayar berubah menjadi 'PAID'
  IF NEW.status_bayar = 'PAID' AND (OLD.status_bayar IS NULL OR OLD.status_bayar <> 'PAID') THEN
    -- Ambil data warkop & marketing agent
    SELECT w.id, w.nama, w.marketing_agent_id
    INTO v_warkop
    FROM public.warkops w
    WHERE w.id = NEW.warkop_id;

    IF NOT FOUND OR v_warkop.marketing_agent_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Ambil data mitra marketing langsung
    SELECT p.id, p.full_name, p.status, p.membership_level, p.upline_id
    INTO v_partner
    FROM public.marketing_partners p
    WHERE p.id = v_warkop.marketing_agent_id;

    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    -- Baca parameter master global terkini
    SELECT
      COALESCE(default_marketing_commission, 0) AS direct_rate,
      COALESCE(coordinator_commission_per_receipt, 0) AS coordinator_rate
    INTO v_settings
    FROM public.platform_settings
    WHERE id = 'global';

    v_receipts := COALESCE(NEW.total_transactions, 0);
    IF v_receipts <= 0 THEN
      RETURN NEW;
    END IF;

    v_direct_rate := COALESCE(v_settings.direct_rate, 0);
    v_network_rate := COALESCE(v_settings.coordinator_rate, 0);

    -- 1. Catat Komisi Mitra Marketing (Langsung) jika rate > 0
    IF v_direct_rate > 0 THEN
      v_direct_amount := v_receipts * v_direct_rate;
      INSERT INTO public.marketing_commission_mutations (
        billing_id, warkop_id, partner_id, source_partner_id, kind, receipts_count, rate_per_receipt, total_amount, notes
      ) VALUES (
        NEW.id,
        v_warkop.id,
        v_partner.id,
        v_partner.id,
        'DIRECT',
        v_receipts,
        v_direct_rate,
        v_direct_amount,
        'Komisi Struk ' || COALESCE(v_warkop.nama, 'Tenant') || ' (' || v_receipts || ' struk @ Rp ' || v_direct_rate || ')'
      ) ON CONFLICT (billing_id, kind) DO NOTHING;
    END IF;

    -- 2. Catat Komisi Koordinator Mitra (Bonus Jaringan) jika ada upline dan rate > 0
    IF v_partner.upline_id IS NOT NULL AND v_network_rate > 0 THEN
      SELECT u.id, u.full_name, u.status, u.membership_level
      INTO v_upline
      FROM public.marketing_partners u
      WHERE u.id = v_partner.upline_id;

      IF FOUND AND UPPER(COALESCE(v_upline.membership_level, '')) IN ('KOORDINATOR', 'COORDINATOR') THEN
        v_network_amount := v_receipts * v_network_rate;
        INSERT INTO public.marketing_commission_mutations (
          billing_id, warkop_id, partner_id, source_partner_id, kind, receipts_count, rate_per_receipt, total_amount, notes
        ) VALUES (
          NEW.id,
          v_warkop.id,
          v_upline.id,
          v_partner.id,
          'NETWORK',
          v_receipts,
          v_network_rate,
          v_network_amount,
          'Bonus Jaringan: ' || COALESCE(v_partner.full_name, 'Mitra') || ' - ' || COALESCE(v_warkop.nama, 'Tenant') || ' (' || v_receipts || ' struk @ Rp ' || v_network_rate || ')'
        ) ON CONFLICT (billing_id, kind) DO NOTHING;
      END IF;
    END IF;

  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_saas_billing_paid_commission ON public.saas_billings;
CREATE TRIGGER tr_saas_billing_paid_commission
AFTER UPDATE ON public.saas_billings
FOR EACH ROW
EXECUTE FUNCTION public.handle_saas_billing_paid_commission();

-- 5. RPC report_marketing_network untuk Koordinator Mitra
CREATE OR REPLACE FUNCTION public.report_marketing_network(p_partner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_members JSONB;
  v_total_comm NUMERIC(12, 2);
BEGIN
  -- Hitung total komisi jaringan yang didapat koordinator ini
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_total_comm
  FROM public.marketing_commission_mutations
  WHERE partner_id = p_partner_id AND kind = 'NETWORK';

  -- Daftar mitra bawahan beserta jumlah tenant dan bonus jaringan
  WITH downlines AS (
    SELECT
      p.id,
      p.full_name AS name,
      COALESCE(p.city_area, 'Wilayah belum diisi') AS area,
      p.status,
      (SELECT COUNT(*) FROM public.warkops w WHERE w.marketing_agent_id = p.id) AS tenants,
      COALESCE((
        SELECT SUM(m.total_amount)
        FROM public.marketing_commission_mutations m
        WHERE m.partner_id = p_partner_id AND m.source_partner_id = p.id AND m.kind = 'NETWORK'
      ), 0) AS network_commission
    FROM public.marketing_partners p
    WHERE p.upline_id = p_partner_id
    ORDER BY p.created_at DESC
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'name', d.name,
    'area', d.area,
    'status', d.status,
    'tenants', d.tenants,
    'networkCommission', d.network_commission
  )), '[]'::jsonb)
  INTO v_members
  FROM downlines d;

  RETURN jsonb_build_object(
    'members', v_members,
    'totalCommission', v_total_comm
  );
END;
$$;

REVOKE ALL ON FUNCTION public.report_marketing_network(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_marketing_network(UUID) TO service_role;
