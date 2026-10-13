-- Persistensi lengkap portal owner: profil QRIS, staf, waiter, dan meja.

ALTER TABLE public.warkops
    ADD COLUMN IF NOT EXISTS qris_merchant_name VARCHAR(180);

ALTER TABLE public.warkop_members
    ADD COLUMN IF NOT EXISTS display_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.waiters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warkop_id UUID NOT NULL REFERENCES public.warkops(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (warkop_id, name)
);

CREATE TABLE IF NOT EXISTS public.warkop_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warkop_id UUID NOT NULL REFERENCES public.warkops(id) ON DELETE CASCADE,
    label VARCHAR(30) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (warkop_id, label)
);

CREATE INDEX IF NOT EXISTS idx_waiters_warkop ON public.waiters (warkop_id);
CREATE INDEX IF NOT EXISTS idx_warkop_tables_warkop ON public.warkop_tables (warkop_id, sort_order);

ALTER TABLE public.waiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warkop_tables ENABLE ROW LEVEL SECURITY;

-- Semua mutasi portal owner melalui Route Handler yang memverifikasi token owner.
-- Tidak ada policy anon/authenticated agar akses langsung dari browser ditolak.

-- QRIS memakai tepat satu objek kanonis per tenant: <warkop_id>/current.
DO $$
BEGIN
    CREATE POLICY "Owner portal service can manage qris"
    ON storage.objects FOR ALL
    TO service_role
    USING (bucket_id = 'qris-warkop')
    WITH CHECK (bucket_id = 'qris-warkop');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
