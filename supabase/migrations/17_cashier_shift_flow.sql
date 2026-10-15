-- Link trusted POS devices, cashier accounts, shifts, and transactions.

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES public.device_installations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now());

-- Shifts created by the legacy flow had no authenticated cashier/device and
-- cannot be resumed safely. Close them before enforcing one active shift.
UPDATE public.shifts
SET status = 'CLOSED',
    closed_at = COALESCE(closed_at, timezone('utc', now())),
    notes = concat_ws(E'\n', NULLIF(notes, ''), 'Ditutup saat migrasi ke sesi kasir terautentikasi.')
WHERE status = 'OPEN' AND (opened_by IS NULL OR device_id IS NULL);

WITH ranked_open_shifts AS (
  SELECT id, row_number() OVER (PARTITION BY warkop_id ORDER BY opened_at DESC, id DESC) AS position
  FROM public.shifts
  WHERE status = 'OPEN'
)
UPDATE public.shifts
SET status = 'CLOSED',
    closed_at = COALESCE(closed_at, timezone('utc', now())),
    notes = concat_ws(E'\n', NULLIF(notes, ''), 'Shift duplikat ditutup saat migrasi.')
WHERE id IN (SELECT id FROM ranked_open_shifts WHERE position > 1);

CREATE UNIQUE INDEX IF NOT EXISTS uq_shifts_one_open_per_tenant
  ON public.shifts (warkop_id)
  WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS idx_shifts_opened_by_status
  ON public.shifts (opened_by, status, opened_at DESC);

CREATE OR REPLACE FUNCTION public.start_cashier_shift(
  p_warkop_id UUID,
  p_member_id UUID,
  p_device_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_member RECORD;
  v_device RECORD;
  v_existing RECORD;
  v_shift RECORD;
BEGIN
  SELECT id, display_name, username INTO v_member
  FROM public.warkop_members
  WHERE id = p_member_id
    AND warkop_id = p_warkop_id
    AND role = 'KASIR'
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Akun kasir tidak aktif atau tidak terdaftar pada usaha ini';
  END IF;

  SELECT id, device_name INTO v_device
  FROM public.device_installations
  WHERE id = p_device_id
    AND warkop_id = p_warkop_id
    AND device_type = 'POS'
    AND status = 'ACTIVE'
    AND expires_at > timezone('utc', now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perangkat kasir tidak aktif';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_warkop_id::text));

  SELECT s.id, s.opened_by, s.device_id, s.opened_at, m.display_name, m.username
    INTO v_existing
  FROM public.shifts s
  LEFT JOIN public.warkop_members m ON m.id = s.opened_by
  WHERE s.warkop_id = p_warkop_id AND s.status = 'OPEN'
  ORDER BY s.opened_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.opened_by = p_member_id AND v_existing.device_id = p_device_id THEN
      RETURN jsonb_build_object(
        'id', v_existing.id,
        'openedAt', v_existing.opened_at,
        'cashierId', p_member_id,
        'cashierName', COALESCE(v_existing.display_name, v_existing.username),
        'deviceId', p_device_id,
        'deviceName', v_device.device_name,
        'resumed', true
      );
    END IF;
    RAISE EXCEPTION 'SHIFT_ALREADY_OPEN:%', COALESCE(v_existing.display_name, v_existing.username, 'Kasir lain');
  END IF;

  INSERT INTO public.shifts (warkop_id, opened_by, device_id, status, opened_at, last_activity_at)
  VALUES (p_warkop_id, p_member_id, p_device_id, 'OPEN', timezone('utc', now()), timezone('utc', now()))
  RETURNING id, opened_at INTO v_shift;

  INSERT INTO public.audit_logs (warkop_id, actor_user_id, device_id, action, target_type, target_id, metadata)
  SELECT p_warkop_id, user_id, p_device_id, 'CASHIER_SHIFT_OPENED', 'shift', v_shift.id,
         jsonb_build_object('cashier_name', COALESCE(display_name, username), 'device_name', v_device.device_name)
  FROM public.warkop_members WHERE id = p_member_id;

  RETURN jsonb_build_object(
    'id', v_shift.id,
    'openedAt', v_shift.opened_at,
    'cashierId', p_member_id,
    'cashierName', COALESCE(v_member.display_name, v_member.username),
    'deviceId', p_device_id,
    'deviceName', v_device.device_name,
    'resumed', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.end_cashier_shift(
  p_shift_id UUID,
  p_member_id UUID,
  p_actual_cash_deposited NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_shift RECORD;
  v_result JSONB;
  v_expected_cash NUMERIC := 0;
BEGIN
  SELECT id, warkop_id, opened_by, device_id, status INTO v_shift
  FROM public.shifts
  WHERE id = p_shift_id
  FOR UPDATE;

  IF NOT FOUND OR v_shift.status <> 'OPEN' THEN
    RAISE EXCEPTION 'Shift kasir tidak aktif';
  END IF;

  IF v_shift.opened_by <> p_member_id THEN
    RAISE EXCEPTION 'Shift ini dimiliki kasir lain';
  END IF;

  IF p_actual_cash_deposited < 0 THEN
    RAISE EXCEPTION 'Nominal kas fisik tidak valid';
  END IF;

  SELECT COALESCE(SUM(total_harga), 0) INTO v_expected_cash
  FROM public.transactions
  WHERE shift_id = p_shift_id
    AND payment_method = 'CASH'
    AND status_pesanan NOT IN ('VOID', 'REJECTED');

  SELECT public.close_shift(p_shift_id, p_actual_cash_deposited, p_notes) INTO v_result;

  UPDATE public.shifts
  SET total_cash_expected = v_expected_cash,
      difference = p_actual_cash_deposited - v_expected_cash,
      last_activity_at = timezone('utc', now())
  WHERE id = p_shift_id;

  INSERT INTO public.audit_logs (warkop_id, actor_user_id, device_id, action, target_type, target_id, metadata)
  SELECT v_shift.warkop_id, user_id, v_shift.device_id, 'CASHIER_SHIFT_CLOSED', 'shift', p_shift_id,
         jsonb_build_object('actual_cash_deposited', p_actual_cash_deposited)
  FROM public.warkop_members WHERE id = p_member_id;

  RETURN v_result || jsonb_build_object(
    'total_cash_expected', v_expected_cash,
    'actual_cash_deposited', p_actual_cash_deposited,
    'difference', p_actual_cash_deposited - v_expected_cash
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.start_cashier_shift(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.end_cashier_shift(UUID, UUID, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.close_shift(UUID, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_cashier_shift(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.end_cashier_shift(UUID, UUID, NUMERIC, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.close_shift(UUID, NUMERIC, TEXT) TO service_role;

DROP POLICY IF EXISTS "Staff can manage shifts" ON public.shifts;
DROP POLICY IF EXISTS "Tenant members can view shifts" ON public.shifts;
CREATE POLICY "Tenant members can view shifts"
ON public.shifts FOR SELECT TO authenticated
USING (warkop_id = public.current_user_warkop_id());

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
