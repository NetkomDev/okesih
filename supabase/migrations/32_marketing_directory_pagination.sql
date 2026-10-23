BEGIN;
CREATE OR REPLACE FUNCTION public.report_superadmin_marketing_page(
 p_page integer DEFAULT 1,p_page_size integer DEFAULT 25,p_search text DEFAULT '',p_status text DEFAULT 'ALL'
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 WITH searched AS (
  SELECT p.* FROM public.marketing_partners p
  WHERE coalesce(p_search,'')='' OR strpos(lower(concat_ws(' ',p.full_name,p.city_area,p.referral_code,p.phone)),lower(p_search))>0
 ), filtered AS (
  SELECT * FROM searched WHERE coalesce(p_status,'ALL')='ALL' OR status=p_status
 ), bounds AS (
  SELECT least(100,greatest(1,p_page_size)) AS size,count(*) AS total FROM filtered
 ), config AS (
  SELECT *,greatest(1,ceil(total::numeric/size))::integer AS pages,
    least(greatest(1,p_page),greatest(1,ceil(total::numeric/size))::integer) AS page FROM bounds
 ), page_rows AS (
  SELECT * FROM filtered ORDER BY created_at DESC,id DESC
  LIMIT (SELECT size FROM config) OFFSET (SELECT (page::bigint-1)*size FROM config)
 ), mapped AS (
  SELECT p.created_at,p.id,to_jsonb(p)||jsonb_build_object(
   'commission_rate',(SELECT default_marketing_commission FROM public.platform_settings WHERE id='global'),
   'coordinator_name',u.full_name,
   'total_tenants_acquired',(SELECT count(*) FROM public.warkops WHERE marketing_agent_id=p.id),
   'total_receipts_generated',(SELECT coalesce(sum(receipts_count),0) FROM public.marketing_commission_mutations WHERE partner_id=p.id AND kind='DIRECT'),
   'total_commission_earned',(SELECT coalesce(sum(total_amount),0) FROM public.marketing_commission_mutations WHERE partner_id=p.id),
   'pending_withdrawal',(SELECT coalesce(sum(amount),0) FROM public.marketing_commission_withdrawals WHERE marketing_partner_id=p.id AND status='PENDING')
  ) AS row FROM page_rows p LEFT JOIN public.marketing_partners u ON u.id=p.upline_id
 ) SELECT jsonb_build_object(
  'data',coalesce((SELECT jsonb_agg(row ORDER BY created_at DESC,id DESC) FROM mapped),'[]'::jsonb),
  'pagination',jsonb_build_object('page',c.page,'pageSize',c.size,'total',c.total,'totalPages',c.pages),
  'counts',jsonb_build_object('ALL',(SELECT count(*) FROM searched),'ACTIVE',(SELECT count(*) FROM searched WHERE status='ACTIVE'),
   'PENDING',(SELECT count(*) FROM searched WHERE status='PENDING'),'INACTIVE',(SELECT count(*) FROM searched WHERE status='INACTIVE'))
 ) FROM config c;
$$;
REVOKE ALL ON FUNCTION public.report_superadmin_marketing_page(integer,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.report_superadmin_marketing_page(integer,integer,text,text) TO service_role;
COMMIT;
