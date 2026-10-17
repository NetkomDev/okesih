-- One-time, encrypted handoff for establishing host-only sessions on internal subdomains.

CREATE TABLE IF NOT EXISTS public.auth_handoff_codes (
    code_hash CHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_role TEXT NOT NULL CHECK (user_role IN ('SUPERADMIN', 'OWNER', 'MARKETING', 'KASIR', 'DAPUR')),
    target_surface TEXT NOT NULL CHECK (target_surface IN ('SUPERADMIN', 'OWNER', 'MARKETING', 'POS', 'KDS')),
    encrypted_session TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_auth_handoff_expiry
    ON public.auth_handoff_codes (expires_at);

ALTER TABLE public.auth_handoff_codes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.auth_handoff_codes FROM anon, authenticated;
GRANT ALL ON TABLE public.auth_handoff_codes TO service_role;
