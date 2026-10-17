-- Alamat lengkap tenant dipakai pada notifikasi pembayaran dan proses review.
-- Nullable agar tenant lama tetap kompatibel; form baru mewajibkan nilainya.

ALTER TABLE public.warkops
  ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE public.tenant_applications
  ADD COLUMN IF NOT EXISTS address TEXT;

-- Hentikan jalur lama yang menekan tombol kirim WhatsApp secara otomatis.
-- Riwayat tetap disimpan untuk audit, tetapi tidak ada job yang dapat diklaim.
UPDATE public.whatsapp_outbox
SET status = 'FAILED',
    last_error = 'Pengiriman otomatis dinonaktifkan; gunakan tautan WhatsApp manual dari aplikasi.',
    updated_at = timezone('utc', now())
WHERE status IN ('PENDING', 'PROCESSING');

CREATE OR REPLACE FUNCTION public.claim_next_whatsapp_message()
RETURNS SETOF public.whatsapp_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN;
END;
$$;
