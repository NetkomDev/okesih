-- OKESIH v4: multi-PWA device trust, secure public orders, audit, and idempotency.

CREATE TABLE IF NOT EXISTS public.owner_onboarding (
    warkop_id UUID PRIMARY KEY REFERENCES public.warkops(id) ON DELETE CASCADE,
    owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    password_changed_at TIMESTAMPTZ,
    owner_pwa_installed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.device_pairing_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warkop_id UUID REFERENCES public.warkops(id) ON DELETE CASCADE,
    device_type TEXT NOT NULL CHECK (device_type IN ('POS', 'KDS')),
    device_name VARCHAR(100) NOT NULL,
    code_hash CHAR(64) NOT NULL UNIQUE,
    poll_secret_hash CHAR(64) NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'CONSUMED', 'EXPIRED', 'REJECTED')),
    expires_at TIMESTAMPTZ NOT NULL,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.device_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warkop_id UUID NOT NULL REFERENCES public.warkops(id) ON DELETE CASCADE,
    pairing_request_id UUID UNIQUE REFERENCES public.device_pairing_requests(id) ON DELETE SET NULL,
    device_type TEXT NOT NULL CHECK (device_type IN ('POS', 'KDS')),
    device_name VARCHAR(100) NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
    paired_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    paired_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()) + INTERVAL '180 days'),
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.operation_idempotency (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warkop_id UUID NOT NULL REFERENCES public.warkops(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.device_installations(id) ON DELETE CASCADE,
    idempotency_key UUID NOT NULL,
    operation VARCHAR(80) NOT NULL,
    response JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (warkop_id, device_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warkop_id UUID REFERENCES public.warkops(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    device_id UUID REFERENCES public.device_installations(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(60),
    target_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS customer_access_token_hash CHAR(64),
    ADD COLUMN IF NOT EXISTS idempotency_key UUID,
    ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now());

CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_warkop_idempotency
    ON public.transactions (warkop_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_customer_token ON public.transactions (customer_access_token_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_warkop_status_created ON public.transactions (warkop_id, status_pesanan, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_pairing_pending ON public.device_pairing_requests (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_device_installations_tenant ON public.device_installations (warkop_id, device_type, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON public.audit_logs (warkop_id, created_at DESC);

ALTER TABLE public.owner_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_pairing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Close the legacy anonymous transaction surface. Public traffic must use the
-- validated Route Handlers, while service_role remains able to perform work.
DROP POLICY IF EXISTS "Public customer can insert order" ON public.transactions;
DROP POLICY IF EXISTS "Public customer can select their order" ON public.transactions;
DROP POLICY IF EXISTS "Public customer can insert transaction items" ON public.transaction_items;
DROP POLICY IF EXISTS "Public customer can view transaction items" ON public.transaction_items;
DROP POLICY IF EXISTS "Public can upload proof" ON storage.objects;
DROP POLICY IF EXISTS "Public can view proof and qris" ON storage.objects;

UPDATE storage.buckets SET public = false WHERE id = 'bukti-transfer';
UPDATE storage.buckets SET public = true WHERE id = 'qris-warkop';

DO $$
BEGIN
    CREATE POLICY "Public can view tenant qris"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'qris-warkop');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Atomic creation avoids half-written orders and duplicate queue numbers.
CREATE OR REPLACE FUNCTION public.create_customer_order(
    p_warkop_id UUID,
    p_table_number TEXT,
    p_payment_method payment_method_type,
    p_payment_proof_url TEXT,
    p_items JSONB,
    p_total NUMERIC,
    p_idempotency_key UUID,
    p_customer_token_hash TEXT
) RETURNS JSONB AS $$
DECLARE
    v_transaction_id UUID;
    v_queue INTEGER;
    v_existing RECORD;
    v_item JSONB;
BEGIN
    SELECT id, nomor_antrean, total_harga INTO v_existing
    FROM public.transactions
    WHERE warkop_id = p_warkop_id AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
        RETURN jsonb_build_object('id', v_existing.id, 'queueNumber', v_existing.nomor_antrean, 'total', v_existing.total_harga, 'duplicate', true);
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext(p_warkop_id::text));
    SELECT COALESCE(MAX(nomor_antrean), 0) + 1 INTO v_queue
    FROM public.transactions
    WHERE warkop_id = p_warkop_id AND created_at >= date_trunc('day', timezone('utc', now()));

    INSERT INTO public.transactions (
        warkop_id, table_number, nomor_antrean, total_harga, payment_method,
        payment_proof_url, status_pesanan, idempotency_key, customer_access_token_hash
    ) VALUES (
        p_warkop_id, p_table_number, v_queue, p_total, p_payment_method,
        p_payment_proof_url, 'AWAITING_CONFIRMATION', p_idempotency_key, p_customer_token_hash
    ) RETURNING id INTO v_transaction_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.transaction_items (transaction_id, menu_id, nama_menu, harga_satuan, qty, notes)
        VALUES (
            v_transaction_id,
            (v_item->>'menu_id')::uuid,
            v_item->>'name',
            (v_item->>'price')::numeric,
            (v_item->>'qty')::integer,
            NULLIF(v_item->>'notes', '')
        );
    END LOOP;

    INSERT INTO public.audit_logs (warkop_id, action, target_type, target_id, metadata)
    VALUES (p_warkop_id, 'CUSTOMER_ORDER_CREATED', 'transaction', v_transaction_id,
            jsonb_build_object('table', p_table_number, 'payment_method', p_payment_method, 'total', p_total));

    RETURN jsonb_build_object('id', v_transaction_id, 'queueNumber', v_queue, 'total', p_total, 'duplicate', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.create_customer_order(UUID, TEXT, payment_method_type, TEXT, JSONB, NUMERIC, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_customer_order(UUID, TEXT, payment_method_type, TEXT, JSONB, NUMERIC, UUID, TEXT) TO service_role;

-- Keep updated_at consistent for order polling and conflict detection.
CREATE OR REPLACE FUNCTION public.touch_transaction_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.touch_transaction_updated_at();

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.device_installations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
