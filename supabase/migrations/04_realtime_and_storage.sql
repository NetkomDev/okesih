-- ==============================================================================
-- OKESIH.COM - MICRO-SAAS B2B POS & KDS UNTUK WARKOP
-- File: 04_realtime_and_storage.sql
-- Keterangan: Konfigurasi Supabase Realtime WebSockets dan Storage Buckets
--             (bukti-transfer dan qris-warkop).
-- ==============================================================================

-- 1. AKTIFKAN SUPABASE REALTIME REPLICATION
-- Memungkinkan POS, KDS, dan TV menerima update instan via WebSockets
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions, public.waiter_shifts;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. BUCKETS PENYIMPANAN GAMBAR (STORAGE)
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('bukti-transfer', 'bukti-transfer', true),
    ('qris-warkop', 'qris-warkop', true)
ON CONFLICT (id) DO NOTHING;

-- 3. POLISI AKSES STORAGE (RLS)
DO $$
BEGIN
    CREATE POLICY "Public can upload proof"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'bukti-transfer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
    CREATE POLICY "Public can view proof and qris"
    ON storage.objects FOR SELECT
    USING (bucket_id IN ('bukti-transfer', 'qris-warkop'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
