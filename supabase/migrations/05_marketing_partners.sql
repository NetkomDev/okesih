-- ==============================================================================
-- OKESIH.COM - MIGRATION 05: MARKETING PARTNERS (HIRING / REKRUTMEN LAPANGAN)
-- File: supabase/migrations/05_marketing_partners.sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(100),
    city_area VARCHAR(100) NOT NULL,
    referral_code VARCHAR(50) UNIQUE NOT NULL,
    bank_name VARCHAR(50) NOT NULL DEFAULT 'BCA',
    bank_account_number VARCHAR(50) NOT NULL,
    bank_account_name VARCHAR(150) NOT NULL,
    experience_notes TEXT,
    commission_rate NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
    total_tenants_acquired INTEGER NOT NULL DEFAULT 0,
    total_receipts_generated INTEGER NOT NULL DEFAULT 0,
    total_commission_earned NUMERIC(12, 2) NOT NULL DEFAULT 0,
    commission_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    notes_admin TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security
ALTER TABLE public.marketing_partners ENABLE ROW LEVEL SECURITY;

-- Policy 1: Publik siapapun dapat mengajukan pendaftaran (INSERT)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'marketing_partners' AND policyname = 'Public can register as marketing partner'
    ) THEN
        CREATE POLICY "Public can register as marketing partner"
        ON public.marketing_partners FOR INSERT
        WITH CHECK (true);
    END IF;
END $$;

-- Policy 2: Siapapun dapat membaca data marketing (untuk validasi kode referral & portal admin)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'marketing_partners' AND policyname = 'Public can view marketing partners'
    ) THEN
        CREATE POLICY "Public can view marketing partners"
        ON public.marketing_partners FOR SELECT
        USING (true);
    END IF;
END $$;

-- Policy 3: Service role / Authenticated bisa update
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'marketing_partners' AND policyname = 'Service and admin can update marketing partners'
    ) THEN
        CREATE POLICY "Service and admin can update marketing partners"
        ON public.marketing_partners FOR ALL
        USING (true);
    END IF;
END $$;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.handle_marketing_partners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_marketing_partners_updated_at ON public.marketing_partners;
CREATE TRIGGER tr_marketing_partners_updated_at
BEFORE UPDATE ON public.marketing_partners
FOR EACH ROW
EXECUTE FUNCTION public.handle_marketing_partners_updated_at();

-- Masukkan beberapa data contoh marketing agar pemetaan langsung terlihat di super admin
INSERT INTO public.marketing_partners (
    full_name, phone, email, city_area, referral_code, bank_name, bank_account_number, bank_account_name, status, commission_rate, total_tenants_acquired, total_receipts_generated, total_commission_earned
) VALUES 
(
    'Hendra Pratama', '081234889900', 'hendra@marketing.okesih.com', 'Jakarta Selatan & Depok', 'MKT-JAKSEL', 'BCA', '8829102931', 'Hendra Pratama', 'ACTIVE', 15.00, 2, 560, 8400.00
),
(
    'Bambang Irawan', '085677881122', 'bambang@marketing.okesih.com', 'Surabaya & Sidoarjo', 'MKT-SBY', 'BRI', '012901928374', 'Bambang Irawan', 'ACTIVE', 15.00, 1, 310, 4650.00
),
(
    'Rian Ardiansyah', '081399887766', 'rian.ard@gmail.com', 'Bandung Kota & Cimahi', 'MKT-BDG', 'Mandiri', '1310019283741', 'Rian Ardiansyah', 'PENDING', 15.00, 0, 0, 0.00
)
ON CONFLICT (referral_code) DO NOTHING;
