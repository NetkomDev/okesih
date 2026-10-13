-- Global platform configuration. A singleton row keeps every client on the
-- same commercial and operational defaults without duplicating constants.
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id TEXT PRIMARY KEY DEFAULT 'global' CHECK (id = 'global'),
    global_queue_dismiss_seconds INTEGER NOT NULL DEFAULT 60
        CHECK (global_queue_dismiss_seconds BETWEEN 10 AND 600),
    saas_fee_per_receipt INTEGER NOT NULL DEFAULT 50
        CHECK (saas_fee_per_receipt BETWEEN 0 AND 100000),
    default_marketing_commission INTEGER NOT NULL DEFAULT 15
        CHECK (default_marketing_commission BETWEEN 0 AND 100000),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.platform_settings (id)
VALUES ('global')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read platform settings" ON public.platform_settings;
CREATE POLICY "Public can read platform settings"
ON public.platform_settings FOR SELECT
USING (TRUE);

-- Writes are intentionally performed only by the server-side service role
-- after the API verifies that the authenticated user is a super admin.

-- Replace the legacy close-shift calculation that hard-coded Rp50. Existing
-- billings remain immutable; every newly closed shift uses the active setting.
CREATE OR REPLACE FUNCTION public.close_shift(
    p_shift_id UUID,
    p_actual_cash_deposited NUMERIC DEFAULT 0,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_shift RECORD;
    v_warkop RECORD;
    v_total_transactions INTEGER := 0;
    v_saas_fee INTEGER := 50;
    v_tagihan_pokok NUMERIC := 0;
    v_kode_unik INTEGER := 0;
    v_total_tagihan NUMERIC := 0;
    v_today DATE := CURRENT_DATE;
BEGIN
    SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shift dengan ID % tidak ditemukan', p_shift_id;
    END IF;

    SELECT * INTO v_warkop FROM public.warkops WHERE id = v_shift.warkop_id;
    SELECT saas_fee_per_receipt INTO v_saas_fee
    FROM public.platform_settings WHERE id = 'global';
    v_saas_fee := COALESCE(v_saas_fee, 50);

    SELECT COUNT(*) INTO v_total_transactions
    FROM public.transactions
    WHERE shift_id = p_shift_id
      AND status_pesanan NOT IN ('VOID', 'REJECTED');

    v_tagihan_pokok := v_total_transactions * v_saas_fee;
    v_kode_unik := floor(random() * (v_warkop.unique_code_range_end - v_warkop.unique_code_range_start + 1) + v_warkop.unique_code_range_start);
    v_total_tagihan := v_tagihan_pokok + v_kode_unik;

    UPDATE public.shifts
    SET closed_at = timezone('utc'::text, now()),
        actual_cash_deposited = p_actual_cash_deposited,
        notes = COALESCE(p_notes, notes),
        status = 'CLOSED'
    WHERE id = p_shift_id;

    INSERT INTO public.saas_billings (
        warkop_id, tanggal, total_transactions, tagihan_pokok,
        kode_unik, total_tagihan, status_bayar, grace_until
    ) VALUES (
        v_shift.warkop_id, v_today, v_total_transactions, v_tagihan_pokok,
        v_kode_unik, v_total_tagihan, 'UNPAID',
        timezone('utc'::text, now()) + INTERVAL '12 hours'
    )
    ON CONFLICT (warkop_id, tanggal) DO UPDATE
    SET total_transactions = saas_billings.total_transactions + EXCLUDED.total_transactions,
        tagihan_pokok = saas_billings.tagihan_pokok + EXCLUDED.tagihan_pokok,
        total_tagihan = saas_billings.tagihan_pokok + EXCLUDED.tagihan_pokok + saas_billings.kode_unik;

    RETURN jsonb_build_object(
        'shift_id', p_shift_id,
        'total_transactions', v_total_transactions,
        'saas_fee_per_receipt', v_saas_fee,
        'tagihan_pokok', v_tagihan_pokok,
        'kode_unik', v_kode_unik,
        'total_tagihan', v_total_tagihan,
        'status', 'CLOSED'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
