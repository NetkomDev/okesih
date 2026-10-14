-- Portal PWA marketing: satu akun Auth terikat ke tepat satu mitra.
ALTER TABLE public.marketing_partners
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS username VARCHAR(100);

-- Kolom afiliasi ini sudah dipakai aplikasi produksi; deklarasikan juga di
-- migration agar instalasi database baru tidak bergantung pada perubahan manual.
ALTER TABLE public.warkops
  ADD COLUMN IF NOT EXISTS marketing_agent_id UUID REFERENCES public.marketing_partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marketing_commission_per_receipt NUMERIC(10, 2) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS marketing_partners_user_id_unique
  ON public.marketing_partners (user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS marketing_partners_username_unique
  ON public.marketing_partners (lower(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS warkops_marketing_agent_idx
  ON public.warkops (marketing_agent_id, created_at DESC);
