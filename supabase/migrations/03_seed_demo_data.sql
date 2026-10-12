-- ==============================================================================
-- OKESIH.COM - MICRO-SAAS B2B POS & KDS UNTUK WARKOP
-- File: 03_seed_demo_data.sql
-- Keterangan: Data demo awal (Warkop Giras Nusantara, Menu Lengkap, Sesi Shift,
--             dan Waiters Aktif) untuk pengujian langsung di Supabase.
-- ==============================================================================

DO $$
DECLARE
    v_warkop_id UUID;
    v_shift_id UUID;
    v_waiter_shift_id UUID;
BEGIN
    -- 1. Insert Tenant Demo Warkop
    INSERT INTO public.warkops (
        nama,
        slug,
        qris_image_url,
        queue_dismiss_seconds,
        unique_code_range_start,
        unique_code_range_end,
        offline_limit_hours,
        is_active
    )
    VALUES (
        'Warkop Giras Nusantara',
        'giras-nusantara',
        'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=00020101021126570014ID.LINKAJA.WWW01189360091100210001000215ID10293847565204549953033605802ID5920WARKOP+GIRAS+NUSANT6007JAKARTA61051234062070703A016304',
        60,
        100,
        199,
        4,
        true
    )
    ON CONFLICT (slug) DO UPDATE SET nama = EXCLUDED.nama
    RETURNING id INTO v_warkop_id;

    -- 2. Insert Menu Demo Warkop
    INSERT INTO public.menus (warkop_id, nama, harga, kategori, desc_menu, is_available) VALUES
    (v_warkop_id, 'Kopi Hitam Tubruk Giras', 5000, 'Kopi', 'Robusta giling halus diseduh air mendidih kental khas warkop.', true),
    (v_warkop_id, 'Kopi Susu Panas Legendaris', 7000, 'Kopi', 'Susu kental manis berpadu espresso tubruk aroma sedap.', true),
    (v_warkop_id, 'Es Teh Manis Jumbo', 5000, 'Dingin', 'Teh melati wangi dingin segar porsi gelas besar.', true),
    (v_warkop_id, 'Extra Joss Susu Dingin', 8000, 'Dingin', 'Minuman energi segar dicampur susu dan es batu kristal.', true),
    (v_warkop_id, 'Indomie Goreng + Telur', 12000, 'Makanan', 'Indomie goreng dengan topping telur dan sawi hijau.', true),
    (v_warkop_id, 'Indomie Kuah Kari Dobel Telur', 16000, 'Makanan', 'Kuah kari kental dengan 2 butir telur setengah matang.', true),
    (v_warkop_id, 'Roti Bakar Coklat Keju', 10000, 'Camilan', 'Roti tawar tebal panggang mentega dengan meses dan parutan keju.', true),
    (v_warkop_id, 'Gorengan Tempe / Bakwan (3 Pcs)', 5000, 'Camilan', 'Gorengan renyah hangat disajikan dengan cabai rawit hijau.', true)
    ON CONFLICT DO NOTHING;

    -- 3. Insert Shift Kasir Terbuka (Open Shift)
    INSERT INTO public.shifts (warkop_id, opened_at, status)
    VALUES (v_warkop_id, timezone('utc'::text, now()), 'OPEN')
    RETURNING id INTO v_shift_id;

    -- 4. Insert Shift Waiters Aktif (Rian)
    INSERT INTO public.waiter_shifts (
        warkop_id,
        shift_id,
        waiter_name,
        started_at,
        total_cash_expected,
        actual_cash_deposited,
        difference,
        status,
        notes
    )
    VALUES (
        v_warkop_id,
        v_shift_id,
        'Rian',
        timezone('utc'::text, now()),
        0,
        0,
        0,
        'ACTIVE',
        'Shift pagi dimulai, laci uang modal disiapkan.'
    )
    RETURNING id INTO v_waiter_shift_id;

    RAISE NOTICE 'Demo Warkop berhasil dibuat dengan ID: %, Shift: %, Waiters Shift: %', v_warkop_id, v_shift_id, v_waiter_shift_id;
END $$;
