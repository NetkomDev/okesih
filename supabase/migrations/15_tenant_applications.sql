-- Pengajuan tenant oleh marketing diverifikasi Super Admin sebelum akun dibuat.
CREATE TABLE IF NOT EXISTS public.tenant_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_partner_id UUID NOT NULL REFERENCES public.marketing_partners(id) ON DELETE CASCADE,
  business_name VARCHAR(150) NOT NULL,
  owner_name VARCHAR(150) NOT NULL,
  owner_phone VARCHAR(30) NOT NULL,
  province VARCHAR(100) NOT NULL,
  city_regency VARCHAR(150) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'APPROVED', 'REJECTED')),
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  warkop_id UUID REFERENCES public.warkops(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.tenant_applications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS tenant_applications_marketing_idx
  ON public.tenant_applications (marketing_partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tenant_applications_status_idx
  ON public.tenant_applications (status, created_at DESC);

DROP TRIGGER IF EXISTS tr_tenant_applications_updated_at ON public.tenant_applications;
CREATE TRIGGER tr_tenant_applications_updated_at
BEFORE UPDATE ON public.tenant_applications
FOR EACH ROW EXECUTE FUNCTION public.handle_marketing_partners_updated_at();
