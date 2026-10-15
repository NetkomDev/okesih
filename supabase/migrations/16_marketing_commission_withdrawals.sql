-- Pencairan komisi marketing dengan reservasi saldo dan verifikasi Super Admin.
CREATE TABLE IF NOT EXISTS public.marketing_commission_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_partner_id UUID NOT NULL REFERENCES public.marketing_partners(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PAID', 'REJECTED')),
  bank_name VARCHAR(50) NOT NULL,
  bank_account_number VARCHAR(50) NOT NULL,
  bank_account_name VARCHAR(150) NOT NULL,
  notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS marketing_withdrawals_partner_idx
  ON public.marketing_commission_withdrawals (marketing_partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_withdrawals_status_idx
  ON public.marketing_commission_withdrawals (status, created_at DESC);

ALTER TABLE public.marketing_commission_withdrawals ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS tr_marketing_commission_withdrawals_updated_at
  ON public.marketing_commission_withdrawals;
CREATE TRIGGER tr_marketing_commission_withdrawals_updated_at
BEFORE UPDATE ON public.marketing_commission_withdrawals
FOR EACH ROW EXECUTE FUNCTION public.handle_marketing_partners_updated_at();

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

  SELECT COALESCE(SUM(w.marketing_commission_per_receipt), 0)
  INTO v_earned
  FROM public.transactions t
  JOIN public.warkops w ON w.id = t.warkop_id
  WHERE w.marketing_agent_id = p_marketing_partner_id
    AND t.status_pesanan::TEXT NOT IN ('VOID', 'REJECTED');

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

CREATE OR REPLACE FUNCTION public.review_marketing_commission_withdrawal(
  p_withdrawal_id UUID,
  p_decision TEXT,
  p_admin_id UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_withdrawal public.marketing_commission_withdrawals%ROWTYPE;
  v_decision TEXT := upper(trim(p_decision));
BEGIN
  IF v_decision NOT IN ('PAID', 'REJECTED') THEN
    RAISE EXCEPTION 'Keputusan pencairan tidak valid.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_withdrawal
  FROM public.marketing_commission_withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengajuan pencairan tidak ditemukan.' USING ERRCODE = 'P0002';
  END IF;
  IF v_withdrawal.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Pengajuan pencairan sudah diproses.' USING ERRCODE = 'P0001';
  END IF;

  IF v_decision = 'PAID' THEN
    UPDATE public.marketing_partners
    SET commission_paid = COALESCE(commission_paid, 0) + v_withdrawal.amount
    WHERE id = v_withdrawal.marketing_partner_id;
  END IF;

  UPDATE public.marketing_commission_withdrawals
  SET status = v_decision,
      notes = NULLIF(trim(COALESCE(p_notes, '')), ''),
      reviewed_by = p_admin_id,
      reviewed_at = timezone('utc', now())
  WHERE id = v_withdrawal.id;

  RETURN jsonb_build_object('id', v_withdrawal.id, 'status', v_decision, 'amount', v_withdrawal.amount);
END;
$$;

REVOKE ALL ON FUNCTION public.request_marketing_commission_withdrawal(UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_marketing_commission_withdrawal(UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_marketing_commission_withdrawal(UUID, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.review_marketing_commission_withdrawal(UUID, TEXT, UUID, TEXT) TO service_role;
