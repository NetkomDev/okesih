ALTER TABLE public.warkops
    ADD COLUMN IF NOT EXISTS province VARCHAR(100),
    ADD COLUMN IF NOT EXISTS city_regency VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_warkops_province ON public.warkops (province);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions (created_at);
CREATE INDEX IF NOT EXISTS idx_saas_billings_tanggal ON public.saas_billings (tanggal);

CREATE OR REPLACE FUNCTION public.get_superadmin_analytics(p_period TEXT DEFAULT 'today')
RETURNS JSONB AS $$
DECLARE
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_local_now TIMESTAMP := timezone('Asia/Makassar', now());
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ := timezone('utc'::text, now());
    v_result JSONB;
BEGIN
    v_start := CASE p_period
        WHEN 'today' THEN (date_trunc('day', v_local_now) AT TIME ZONE 'Asia/Makassar')
        WHEN 'week' THEN (date_trunc('week', v_local_now) AT TIME ZONE 'Asia/Makassar')
        WHEN 'month' THEN (date_trunc('month', v_local_now) AT TIME ZONE 'Asia/Makassar')
        WHEN 'year' THEN (date_trunc('year', v_local_now) AT TIME ZONE 'Asia/Makassar')
        ELSE (date_trunc('day', v_local_now) AT TIME ZONE 'Asia/Makassar')
    END;

    WITH valid_transactions AS (
        SELECT t.id, t.warkop_id, t.created_at,
               COALESCE(w.marketing_commission_per_receipt, 0)::NUMERIC AS commission_rate
        FROM public.transactions t
        JOIN public.warkops w ON w.id = t.warkop_id
        WHERE t.created_at >= v_start AND t.created_at <= v_end
          AND t.status_pesanan NOT IN ('VOID', 'REJECTED')
    ),
    summary AS (
        SELECT
            (SELECT COUNT(*) FROM public.warkops WHERE is_active = TRUE) AS active_tenants,
            (SELECT COUNT(*) FROM public.warkops WHERE created_at >= v_start AND created_at <= v_end) AS new_tenants,
            (SELECT COUNT(*) FROM valid_transactions) AS receipts,
            COALESCE((SELECT SUM(tagihan_pokok) FROM public.saas_billings
                      WHERE tanggal >= timezone('Asia/Makassar', v_start)::DATE
                        AND tanggal <= timezone('Asia/Makassar', v_end)::DATE), 0) AS gross_billing,
            COALESCE((SELECT SUM(commission_rate) FROM valid_transactions), 0) AS marketing_commission
    ),
    regions AS (
        SELECT COALESCE(province, 'Belum diatur') AS province,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE is_active) AS active
        FROM public.warkops
        GROUP BY COALESCE(province, 'Belum diatur')
        ORDER BY COUNT(*) DESC, province ASC
    ),
    daily_transactions AS (
        SELECT timezone('Asia/Makassar', created_at)::DATE AS day,
               COUNT(*) AS receipts,
               SUM(commission_rate) AS commission
        FROM valid_transactions
        GROUP BY 1
    ),
    daily_billings AS (
        SELECT tanggal AS day, SUM(tagihan_pokok) AS gross
        FROM public.saas_billings
        WHERE tanggal >= timezone('Asia/Makassar', v_start)::DATE
          AND tanggal <= timezone('Asia/Makassar', v_end)::DATE
        GROUP BY tanggal
    ),
    series AS (
        SELECT d::DATE AS day,
               COALESCE(t.receipts, 0) AS receipts,
               COALESCE(b.gross, 0) AS gross,
               COALESCE(t.commission, 0) AS commission
        FROM generate_series(
            timezone('Asia/Makassar', v_start)::DATE,
            timezone('Asia/Makassar', v_end)::DATE,
            INTERVAL '1 day'
        ) d
        LEFT JOIN daily_transactions t ON t.day = d::DATE
        LEFT JOIN daily_billings b ON b.day = d::DATE
        ORDER BY d
    )
    SELECT jsonb_build_object(
        'period', p_period,
        'startAt', v_start,
        'endAt', v_end,
        'activeTenants', s.active_tenants,
        'newTenants', s.new_tenants,
        'receipts', s.receipts,
        'grossBilling', s.gross_billing,
        'marketingCommission', s.marketing_commission,
        'netRevenue', s.gross_billing - s.marketing_commission,
        'regions', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM regions r), '[]'::JSONB),
        'series', COALESCE((SELECT jsonb_agg(to_jsonb(ds)) FROM series ds), '[]'::JSONB)
    ) INTO v_result
    FROM summary s;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.get_superadmin_analytics(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_superadmin_analytics(TEXT) TO service_role;

