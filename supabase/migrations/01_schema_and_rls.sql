-- ==============================================================================
-- OKESIH.COM - MICRO-SAAS B2B POS & KDS UNTUK WARKOP
-- File: 01_schema_and_rls.sql
-- Keterangan: Skema database lengkap dengan multi-tenant RLS, pelacakan waiters,
--             dan pemisahan pembayaran QRIS vs TUNAI.
-- ==============================================================================

-- Aktifkan ekstensi UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMERASI (TYPES)
DO $$ BEGIN
    CREATE TYPE member_role AS ENUM ('OWNER', 'KASIR', 'DAPUR', 'TV');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('AWAITING_CONFIRMATION', 'COOKING', 'READY', 'DONE', 'VOID', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_method_type AS ENUM ('QRIS', 'CASH');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE shift_status AS ENUM ('OPEN', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE waiter_shift_status AS ENUM ('ACTIVE', 'ENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE billing_status AS ENUM ('UNPAID', 'PAID', 'PENDING_REVIEW');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. TABEL WARKOP (TENANT PROFILE)
CREATE TABLE IF NOT EXISTS public.warkops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama VARCHAR(150) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    qris_image_url TEXT,
    queue_dismiss_seconds INTEGER NOT NULL DEFAULT 60,
    unique_code_range_start INTEGER NOT NULL DEFAULT 100,
    unique_code_range_end INTEGER NOT NULL DEFAULT 199,
    offline_limit_hours INTEGER NOT NULL DEFAULT 4,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. TABEL ANGGOTA WARKOP (STAF / USERS LOGIN MULTI-TENANT)
CREATE TABLE IF NOT EXISTS public.warkop_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warkop_id UUID NOT NULL REFERENCES public.warkops(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    role member_role NOT NULL DEFAULT 'KASIR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(warkop_id, username)
);

-- 4. TABEL KATALOG MENU
CREATE TABLE IF NOT EXISTS public.menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warkop_id UUID NOT NULL REFERENCES public.warkops(id) ON DELETE CASCADE,
    nama VARCHAR(150) NOT NULL,
    harga NUMERIC(12, 2) NOT NULL,
    kategori VARCHAR(50) NOT NULL,
    desc_menu TEXT,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. TABEL SESI SHIFT KASIR (HARIAN)
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warkop_id UUID NOT NULL REFERENCES public.warkops(id) ON DELETE CASCADE,
    opened_by UUID REFERENCES public.warkop_members(id),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    closed_at TIMESTAMPTZ,
    status shift_status NOT NULL DEFAULT 'OPEN',
    total_cash_expected NUMERIC(12, 2) DEFAULT 0,
    actual_cash_deposited NUMERIC(12, 2) DEFAULT 0,
    difference NUMERIC(12, 2) DEFAULT 0,
    notes TEXT
);

-- 6. TABEL SESI JAM KERJA WAITERS & REKONSILIASI KAS LACI
CREATE TABLE IF NOT EXISTS public.waiter_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warkop_id UUID NOT NULL REFERENCES public.warkops(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES public.shifts(id) ON DELETE CASCADE,
    waiter_name VARCHAR(100) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    ended_at TIMESTAMPTZ,
    total_cash_expected NUMERIC(12, 2) NOT NULL DEFAULT 0,
    actual_cash_deposited NUMERIC(12, 2) NOT NULL DEFAULT 0,
    difference NUMERIC(12, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    status waiter_shift_status NOT NULL DEFAULT 'ACTIVE'
);

-- 7. TABEL TRANSAKSI PENJUALAN PER BON
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warkop_id UUID NOT NULL REFERENCES public.warkops(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES public.shifts(id),
    waiter_shift_id UUID REFERENCES public.waiter_shifts(id),
    waiter_name VARCHAR(100),
    table_number VARCHAR(20) NOT NULL DEFAULT '01',
    nomor_antrean INTEGER NOT NULL,
    total_harga NUMERIC(12, 2) NOT NULL,
    payment_method payment_method_type NOT NULL DEFAULT 'QRIS',
    payment_proof_url TEXT,
    status_pesanan order_status NOT NULL DEFAULT 'AWAITING_CONFIRMATION',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    synced_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 8. TABEL DETAIL ITEM PESANAN (MENU DETAIL)
CREATE TABLE IF NOT EXISTS public.transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    menu_id UUID REFERENCES public.menus(id),
    nama_menu VARCHAR(150) NOT NULL,
    harga_satuan NUMERIC(12, 2) NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    notes TEXT
);

-- 9. TABEL TAGIHAN SEWA SAAS (RP 50 PER STRUK)
CREATE TABLE IF NOT EXISTS public.saas_billings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warkop_id UUID NOT NULL REFERENCES public.warkops(id) ON DELETE CASCADE,
    tanggal DATE NOT NULL,
    total_transactions INTEGER NOT NULL DEFAULT 0,
    tagihan_pokok NUMERIC(12, 2) NOT NULL DEFAULT 0,
    kode_unik INTEGER NOT NULL,
    total_tagihan NUMERIC(12, 2) NOT NULL,
    status_bayar billing_status NOT NULL DEFAULT 'UNPAID',
    bukti_transfer_url TEXT,
    ocr_raw_text TEXT,
    grace_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(warkop_id, tanggal)
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Aktifkan RLS pada seluruh tabel tenant
ALTER TABLE public.warkops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warkop_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiter_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_billings ENABLE ROW LEVEL SECURITY;

-- Helper function untuk mendeteksi warkop_id staf yang sedang login
CREATE OR REPLACE FUNCTION public.current_user_warkop_id()
RETURNS UUID AS $$
    SELECT warkop_id FROM public.warkop_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 1. Polisi Menu: Publik bisa baca menu warkop (untuk QR meja), staf bisa kelola menu miliknya
CREATE POLICY "Public can view active menus"
ON public.menus FOR SELECT
USING (is_available = true);

CREATE POLICY "Staff can manage menus of their warkop"
ON public.menus FOR ALL
USING (warkop_id = public.current_user_warkop_id());

-- 2. Polisi Warkop: Publik bisa baca profil warkop (slug/nama/QRIS statis), staf bisa baca detail
CREATE POLICY "Public can view warkop basic info"
ON public.warkops FOR SELECT
USING (is_active = true);

-- 3. Polisi Transaksi:
-- Publik (Pelanggan Meja) dapat membuat pesanan baru (INSERT)
CREATE POLICY "Public customer can insert order"
ON public.transactions FOR INSERT
WITH CHECK (true);

-- Publik (Pelanggan Meja) dapat melihat status pesanan miliknya berdasarkan ID
CREATE POLICY "Public customer can select their order"
ON public.transactions FOR SELECT
USING (true);

-- Staf warkop (Kasir, Dapur, TV) dapat mengelola seluruh pesanan warkopnya
CREATE POLICY "Staff can manage warkop transactions"
ON public.transactions FOR ALL
USING (warkop_id = public.current_user_warkop_id());

-- 4. Polisi Transaction Items:
CREATE POLICY "Public customer can insert transaction items"
ON public.transaction_items FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public customer can view transaction items"
ON public.transaction_items FOR SELECT
USING (true);

-- 5. Polisi Shifts & Waiter Shifts:
CREATE POLICY "Staff can manage shifts"
ON public.shifts FOR ALL
USING (warkop_id = public.current_user_warkop_id());

CREATE POLICY "Staff can manage waiter shifts"
ON public.waiter_shifts FOR ALL
USING (warkop_id = public.current_user_warkop_id());

-- 6. Polisi SaaS Billings:
CREATE POLICY "Staff can view their saas billings"
ON public.saas_billings FOR SELECT
USING (warkop_id = public.current_user_warkop_id());
