-- WhatsApp Web outbox untuk worker yang berjalan di perangkat super admin.
-- Tidak ada policy publik: tabel hanya dapat diakses menggunakan service role.

ALTER TABLE public.warkops
    ADD COLUMN IF NOT EXISTS owner_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS owner_phone VARCHAR(30);

CREATE TABLE IF NOT EXISTS public.whatsapp_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warkop_id UUID REFERENCES public.warkops(id) ON DELETE CASCADE,
    recipient_phone VARCHAR(30) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    claimed_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.whatsapp_outbox ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS whatsapp_outbox_pending_idx
    ON public.whatsapp_outbox (status, created_at);

-- Claim atomik mencegah satu pesan dikirim dua kali jika ada lebih dari satu worker.
CREATE OR REPLACE FUNCTION public.claim_next_whatsapp_message()
RETURNS SETOF public.whatsapp_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    claimed_id UUID;
BEGIN
    SELECT id INTO claimed_id
    FROM public.whatsapp_outbox
    WHERE status = 'PENDING'
       OR (status = 'PROCESSING' AND claimed_at < timezone('utc', now()) - interval '5 minutes')
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    IF claimed_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    UPDATE public.whatsapp_outbox
    SET status = 'PROCESSING',
        attempts = attempts + 1,
        claimed_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    WHERE id = claimed_id
    RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_whatsapp_message() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_whatsapp_message() TO service_role;

