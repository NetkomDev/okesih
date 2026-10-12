-- ==============================================================================
-- OKESIH.COM - MICRO-SAAS B2B POS & KDS UNTUK WARKOP
-- File: 02_functions_triggers.sql
-- Keterangan: Fungsi penutupan shift waiters (rekonsiliasi kas), penutupan shift kasir,
--             dan kalkulasi tagihan SaaS Rp 50/struk + kode unik.
-- ==============================================================================

-- 1. FUNGSI TUTUP SHIFT WAITERS (REKONSILIASI KAS LACI KASIR)
CREATE OR REPLACE FUNCTION public.close_waiter_shift(
    p_waiter_shift_id UUID,
    p_actual_cash_deposited NUMERIC,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_waiter_shift RECORD;
    v_total_cash_expected NUMERIC := 0;
    v_difference NUMERIC := 0;
BEGIN
    -- Ambil data sesi shift waiters
    SELECT * INTO v_waiter_shift
    FROM public.waiter_shifts
    WHERE id = p_waiter_shift_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Waiter shift dengan ID % tidak ditemukan', p_waiter_shift_id;
    END IF;

    -- Hitung akumulasi uang tunai dari pesanan TUNAI yang ditangani waiters ini
    SELECT COALESCE(SUM(total_harga), 0) INTO v_total_cash_expected
    FROM public.transactions
    WHERE waiter_shift_id = p_waiter_shift_id
      AND payment_method = 'CASH'
      AND status_pesanan NOT IN ('VOID', 'REJECTED');

    -- Hitung selisih kas fisik vs sistem (Selisih = Uang Fisik - Harapan Sistem)
    v_difference := p_actual_cash_deposited - v_total_cash_expected;

    -- Update rekaman shift waiters
    UPDATE public.waiter_shifts
    SET ended_at = timezone('utc'::text, now()),
        total_cash_expected = v_total_cash_expected,
        actual_cash_deposited = p_actual_cash_deposited,
        difference = v_difference,
        notes = COALESCE(p_notes, notes),
        status = 'ENDED'
    WHERE id = p_waiter_shift_id;

    RETURN jsonb_build_object(
        'waiter_shift_id', p_waiter_shift_id,
        'waiter_name', v_waiter_shift.waiter_name,
        'total_cash_expected', v_total_cash_expected,
        'actual_cash_deposited', p_actual_cash_deposited,
        'difference', v_difference,
        'status', 'ENDED'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. FUNGSI TUTUP SHIFT KASIR & GENERATE TAGIHAN SAAS RP 50 PER STRUK
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

    -- Hitung total transaksi sah pada shift ini
    SELECT COUNT(*) INTO v_total_transactions
    FROM public.transactions
    WHERE shift_id = p_shift_id
      AND status_pesanan NOT IN ('VOID', 'REJECTED');

    -- Biaya SaaS Rp 50 per bon/struk tercetak
    v_tagihan_pokok := v_total_transactions * 50;

    -- Ambil kode unik acak dalam alokasi permanen warkop tersebut
    v_kode_unik := floor(random() * (v_warkop.unique_code_range_end - v_warkop.unique_code_range_start + 1) + v_warkop.unique_code_range_start);
    v_total_tagihan := v_tagihan_pokok + v_kode_unik;

    -- Tutup shift kasir
    UPDATE public.shifts
    SET closed_at = timezone('utc'::text, now()),
        actual_cash_deposited = p_actual_cash_deposited,
        notes = COALESCE(p_notes, notes),
        status = 'CLOSED'
    WHERE id = p_shift_id;

    -- Buat atau perbarui tagihan harian saas_billings
    INSERT INTO public.saas_billings (
        warkop_id,
        tanggal,
        total_transactions,
        tagihan_pokok,
        kode_unik,
        total_tagihan,
        status_bayar,
        grace_until
    )
    VALUES (
        v_shift.warkop_id,
        v_today,
        v_total_transactions,
        v_tagihan_pokok,
        v_kode_unik,
        v_total_tagihan,
        'UNPAID',
        timezone('utc'::text, now()) + INTERVAL '12 hours'
    )
    ON CONFLICT (warkop_id, tanggal) DO UPDATE
    SET total_transactions = saas_billings.total_transactions + EXCLUDED.total_transactions,
        tagihan_pokok = saas_billings.tagihan_pokok + EXCLUDED.tagihan_pokok,
        total_tagihan = saas_billings.tagihan_pokok + EXCLUDED.tagihan_pokok + saas_billings.kode_unik;

    RETURN jsonb_build_object(
        'shift_id', p_shift_id,
        'total_transactions', v_total_transactions,
        'tagihan_pokok', v_tagihan_pokok,
        'kode_unik', v_kode_unik,
        'total_tagihan', v_total_tagihan,
        'status', 'CLOSED'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
