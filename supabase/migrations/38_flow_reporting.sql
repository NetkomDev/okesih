BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE OR REPLACE FUNCTION public.get_superadmin_analytics(p_period text DEFAULT 'today')
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 WITH bounds AS (
   SELECT date_trunc(CASE p_period WHEN 'week' THEN 'week' WHEN 'month' THEN 'month' WHEN 'year' THEN 'year' ELSE 'day' END,
     now() AT TIME ZONE 'Asia/Makassar') AT TIME ZONE 'Asia/Makassar' AS start_at, now() AS end_at
 ), receipts AS (
   SELECT (t.created_at AT TIME ZONE 'Asia/Makassar')::date AS day,count(*) AS amount
   FROM public.transactions t CROSS JOIN bounds b
   WHERE t.created_at>=b.start_at AND t.created_at<=b.end_at AND t.status_pesanan IN ('COOKING','READY','DONE') GROUP BY 1
 ), issued AS (
   SELECT s.tanggal AS day,sum(s.tagihan_pokok) AS gross,
     coalesce(sum(s.tagihan_pokok) FILTER(WHERE s.status_bayar<>'PAID'),0) AS outstanding
   FROM public.saas_billings s CROSS JOIN bounds b
   WHERE s.tanggal BETWEEN (b.start_at AT TIME ZONE 'Asia/Makassar')::date AND (b.end_at AT TIME ZONE 'Asia/Makassar')::date GROUP BY 1
 ), paid AS (
   SELECT (s.commission_settled_at AT TIME ZONE 'Asia/Makassar')::date AS day,sum(s.tagihan_pokok) AS amount
   FROM public.saas_billings s CROSS JOIN bounds b
   WHERE s.status_bayar='PAID' AND s.commission_settled_at>=b.start_at AND s.commission_settled_at<=b.end_at GROUP BY 1
 ), commissions AS (
   SELECT (m.created_at AT TIME ZONE 'Asia/Makassar')::date AS day,
     coalesce(sum(m.total_amount) FILTER(WHERE m.kind='DIRECT'),0) AS direct,
     coalesce(sum(m.total_amount) FILTER(WHERE m.kind='NETWORK'),0) AS network
   FROM public.marketing_commission_mutations m CROSS JOIN bounds b
   WHERE m.billing_id IS NOT NULL AND m.kind IN ('DIRECT','NETWORK') AND m.created_at>=b.start_at AND m.created_at<=b.end_at GROUP BY 1
 ), series AS (
   SELECT d::date AS day,coalesce(r.amount,0) AS receipts,coalesce(i.gross,0) AS gross,
     coalesce(i.outstanding,0) AS outstanding,coalesce(p.amount,0) AS paid,
     coalesce(c.direct,0) AS direct,coalesce(c.network,0) AS network,
     coalesce(c.direct,0)+coalesce(c.network,0) AS commission
   FROM bounds b CROSS JOIN LATERAL generate_series((b.start_at AT TIME ZONE 'Asia/Makassar')::date::timestamp,
     (b.end_at AT TIME ZONE 'Asia/Makassar')::date::timestamp,interval '1 day') d
   LEFT JOIN receipts r ON r.day=d::date LEFT JOIN issued i ON i.day=d::date
   LEFT JOIN paid p ON p.day=d::date LEFT JOIN commissions c ON c.day=d::date
 ), regions AS (
   SELECT coalesce(nullif(province,''),'Belum diatur') AS province,count(*) AS total,count(*) FILTER(WHERE is_active) AS active
   FROM public.warkops GROUP BY 1
 ) SELECT jsonb_build_object('period',p_period,'startAt',b.start_at,'endAt',b.end_at,
   'activeTenants',(SELECT count(*) FROM public.warkops WHERE is_active),
   'newTenants',(SELECT count(*) FROM public.warkops WHERE created_at>=b.start_at AND created_at<=b.end_at),
   'receipts',(SELECT coalesce(sum(receipts),0) FROM series),
   'grossBilling',(SELECT coalesce(sum(gross),0) FROM series),
   'outstandingBilling',(SELECT coalesce(sum(outstanding),0) FROM series),
   'paidBilling',(SELECT coalesce(sum(paid),0) FROM series),
   'directCommission',(SELECT coalesce(sum(direct),0) FROM series),
   'networkCommission',(SELECT coalesce(sum(network),0) FROM series),
   'marketingCommission',(SELECT coalesce(sum(commission),0) FROM series),
   'netRevenue',(SELECT coalesce(sum(paid-commission),0) FROM series),
   'regions',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY total DESC,province),'[]') FROM regions r),
   'series',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY day),'[]') FROM series s)
 ) FROM bounds b;
$$;
REVOKE ALL ON FUNCTION public.get_superadmin_analytics(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_superadmin_analytics(text) TO service_role;

CREATE OR REPLACE FUNCTION public.report_superadmin_tenants(
  p_page integer DEFAULT 1,p_page_size integer DEFAULT 25,p_search text DEFAULT '',p_province text DEFAULT ''
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  WITH settings AS (
    SELECT greatest(1,p_page) AS page,least(100,greatest(1,p_page_size)) AS size,
      (now() AT TIME ZONE 'Asia/Makassar')::date AS today
  ), tenants AS (
    SELECT w.*,coalesce(nullif(w.owner_name,''),o.username,'Owner Warkop') AS owner_label
    FROM public.warkops w LEFT JOIN LATERAL (
      SELECT username FROM public.warkop_members WHERE warkop_id=w.id AND role='OWNER' ORDER BY created_at,id LIMIT 1
    ) o ON true
    WHERE (coalesce(p_province,'') IN ('','ALL') OR coalesce(w.province,'Belum diatur')=p_province)
  ), filtered AS (
    SELECT * FROM tenants WHERE coalesce(p_search,'')='' OR strpos(lower(concat_ws(' ',nama,slug,owner_label,province,city_regency)),lower(p_search))>0
  ), page_rows AS (
    SELECT * FROM filtered ORDER BY created_at DESC,id DESC LIMIT (SELECT size FROM settings) OFFSET (SELECT (page::bigint-1)*size FROM settings)
  ), receipts AS (
    SELECT t.warkop_id,count(*) AS amount FROM public.transactions t JOIN page_rows w ON w.id=t.warkop_id CROSS JOIN settings s
    WHERE t.created_at>=s.today::timestamp AT TIME ZONE 'Asia/Makassar' AND t.created_at<(s.today+1)::timestamp AT TIME ZONE 'Asia/Makassar'
      AND t.status_pesanan IN ('COOKING','READY','DONE') GROUP BY t.warkop_id
  ), mapped AS (
    SELECT w.created_at,w.id,jsonb_build_object('id',w.id,'name',w.nama,'slug',w.slug,'ownerName',w.owner_label,
      'phone',CASE WHEN coalesce(w.owner_phone,'')<>'' THEN '+'||w.owner_phone ELSE 'Belum diatur' END,
      'address',coalesce(w.address,''),'province',coalesce(nullif(w.province,''),'Belum diatur'),'cityRegency',coalesce(nullif(w.city_regency,''),'Belum diatur'),
      'uniqueCodeRange',coalesce(w.unique_code_range_start,100)||' - '||coalesce(w.unique_code_range_end,199),
      'marketingAgentId',coalesce(w.marketing_agent_id::text,'direct'),
      'marketingAgentName',CASE WHEN m.id IS NULL THEN 'Direct HQ (Tanpa Marketing)' ELSE m.full_name||' ('||m.referral_code||')' END,
      'commissionPerReceipt',coalesce(w.marketing_commission_per_receipt,0),'todayTransactions',coalesce(r.amount,0),
      'totalSaasBilling',coalesce(b.tagihan_pokok,0),'paymentStatus',coalesce(b.status_bayar,'NO_BILLING'),
      'status',CASE WHEN w.archived_at IS NOT NULL THEN 'ARCHIVED' WHEN w.is_active THEN 'ACTIVE' ELSE 'SUSPENDED' END,'joinedAt',w.created_at) AS row
    FROM page_rows w LEFT JOIN public.marketing_partners m ON m.id=w.marketing_agent_id LEFT JOIN receipts r ON r.warkop_id=w.id
    LEFT JOIN LATERAL (
      SELECT sum(sb.tagihan_pokok) AS tagihan_pokok,
        CASE WHEN count(*)=0 THEN 'NO_BILLING' WHEN bool_and(sb.status_bayar='PAID') THEN 'PAID'
          WHEN bool_or(sb.status_bayar='PENDING_REVIEW') THEN 'PENDING_REVIEW' ELSE 'UNPAID' END AS status_bayar
      FROM public.saas_billings sb WHERE sb.warkop_id=w.id AND sb.tanggal=(SELECT today FROM settings)
    ) b ON true
  ) SELECT jsonb_build_object('data',coalesce((SELECT jsonb_agg(row ORDER BY created_at DESC,id DESC) FROM mapped),'[]'::jsonb),
    'pagination',jsonb_build_object('page',s.page,'pageSize',s.size,'total',(SELECT count(*) FROM filtered),'totalPages',greatest(1,ceil((SELECT count(*) FROM filtered)::numeric/s.size))),
    'totalTenants',(SELECT count(*) FROM public.warkops),
    'provinces',(SELECT coalesce(jsonb_agg(province ORDER BY province),'[]'::jsonb) FROM (SELECT DISTINCT coalesce(nullif(province,''),'Belum diatur') AS province FROM public.warkops) p)) FROM settings s;
$$;

CREATE FUNCTION public.report_shift_cash(p_warkop_id uuid,p_shift_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT coalesce(sum(t.total_harga),0) FROM public.transactions t
 JOIN public.shifts s ON s.id=t.shift_id AND s.warkop_id=t.warkop_id
 WHERE t.warkop_id=p_warkop_id AND s.id=p_shift_id AND t.payment_method='CASH'
   AND t.status_pesanan IN ('COOKING','READY','DONE');
$$;
REVOKE ALL ON FUNCTION public.report_shift_cash(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.report_shift_cash(uuid,uuid) TO service_role;
CREATE INDEX idx_billings_settled_at ON public.saas_billings(commission_settled_at) WHERE status_bayar='PAID';
CREATE INDEX idx_commission_created_at ON public.marketing_commission_mutations(created_at) WHERE billing_id IS NOT NULL;
COMMIT;
