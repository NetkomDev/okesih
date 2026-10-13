-- One canonical business logo per tenant, shared by Customer Menu, POS, and KDS.
ALTER TABLE public.warkops
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('business-logos', 'business-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
  CREATE POLICY "Public can view business logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'business-logos');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Writes are performed only by trusted server-side service-role handlers.
