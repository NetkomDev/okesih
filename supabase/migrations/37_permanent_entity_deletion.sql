BEGIN;
-- Durable external cleanup: a failed Storage/Auth request is retried, never forgotten.
CREATE TABLE public.entity_deletion_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 entity_type text NOT NULL CHECK(entity_type IN ('TENANT','MARKETING')),
 entity_id uuid NOT NULL,
 user_ids uuid[] NOT NULL DEFAULT '{}',
 objects jsonb NOT NULL DEFAULT '[]',
 prefixes jsonb NOT NULL DEFAULT '[]',
 created_at timestamptz NOT NULL DEFAULT now(),
 attempted_at timestamptz,
 UNIQUE(entity_type,entity_id)
);
ALTER TABLE public.entity_deletion_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.entity_deletion_jobs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.entity_deletion_jobs TO service_role;

CREATE OR REPLACE FUNCTION public.guard_commission_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' AND (current_setting('okesih.archive_tenant',true)=OLD.warkop_id::text
   OR current_setting('okesih.delete_partner',true)=OLD.partner_id::text
   OR current_setting('okesih.delete_partner',true)=OLD.source_partner_id::text) THEN RETURN OLD; END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Mutasi komisi bersifat permanen dan tidak dapat diubah atau dihapus.' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION public.delete_entity_permanently(p_type text,p_id uuid,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE job uuid; users uuid[]; files jsonb; folders jsonb; affected integer:=0; partner uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor AND raw_app_meta_data->>'role'='SUPERADMIN') THEN RAISE EXCEPTION 'Akses Super Admin diperlukan.' USING ERRCODE='42501'; END IF;
 IF p_type NOT IN ('TENANT','MARKETING') THEN RAISE EXCEPTION 'Jenis data tidak valid.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_type||p_id::text,0));
 SELECT id INTO job FROM public.entity_deletion_jobs WHERE entity_type=p_type AND entity_id=p_id;
 IF FOUND THEN RETURN jsonb_build_object('jobId',job,'duplicate',true); END IF;
 IF p_type='TENANT' THEN
   SELECT marketing_agent_id INTO partner FROM public.warkops WHERE id=p_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Tenant tidak ditemukan.' USING ERRCODE='P0002'; END IF;
   PERFORM 1 FROM public.marketing_partners WHERE id IN (SELECT partner_id FROM public.marketing_commission_mutations WHERE warkop_id=p_id) ORDER BY id FOR UPDATE;
   PERFORM 1 FROM public.shifts WHERE warkop_id=p_id ORDER BY id FOR UPDATE;
   SELECT coalesce(array_agg(u.id),'{}') INTO users FROM auth.users u WHERE
     u.id<>p_actor AND u.raw_app_meta_data->>'role' IN ('OWNER','KASIR','DAPUR')
     AND (EXISTS(SELECT 1 FROM public.warkop_members WHERE warkop_id=p_id AND user_id=u.id) OR u.raw_app_meta_data->>'warkop_id'=p_id::text)
     AND NOT EXISTS(SELECT 1 FROM public.warkop_members WHERE user_id=u.id AND warkop_id<>p_id)
     AND NOT EXISTS(SELECT 1 FROM public.marketing_partners WHERE user_id=u.id);
   folders:=jsonb_build_array(
     jsonb_build_object('bucket','menu-images','path',p_id||'/'),
     jsonb_build_object('bucket','business-logos','path',p_id||'/'),
     jsonb_build_object('bucket','qris-warkop','path',p_id||'/'),
     jsonb_build_object('bucket','bukti-transfer','path',p_id||'/'),
     jsonb_build_object('bucket','bukti-transfer','path','saas-billings/'||p_id||'/'));
   SELECT coalesce(jsonb_agg(jsonb_build_object('bucket',bucket,'path',path)),'[]') INTO files FROM (
     SELECT 'menu-images' AS bucket,image_url AS path FROM public.menus WHERE warkop_id=p_id AND image_url IS NOT NULL
     UNION SELECT 'business-logos',logo_url FROM public.warkops WHERE id=p_id AND logo_url IS NOT NULL
     UNION SELECT 'qris-warkop',qris_image_url FROM public.warkops WHERE id=p_id AND qris_image_url IS NOT NULL
     UNION SELECT 'bukti-transfer',payment_proof_url FROM public.transactions WHERE warkop_id=p_id AND payment_proof_url IS NOT NULL
     UNION SELECT 'bukti-transfer',bukti_transfer_url FROM public.saas_billings WHERE warkop_id=p_id AND bukti_transfer_url IS NOT NULL
   ) f;
   PERFORM set_config('okesih.archive_tenant',p_id::text,true);
   DELETE FROM public.marketing_commission_mutations WHERE warkop_id=p_id;
   DELETE FROM public.saas_billings WHERE warkop_id=p_id;
   DELETE FROM public.transactions WHERE warkop_id=p_id;
   DELETE FROM public.waiter_shifts WHERE warkop_id=p_id;
   DELETE FROM public.shifts WHERE warkop_id=p_id;
   DELETE FROM public.tenant_applications WHERE warkop_id=p_id;
   -- All tenant-owned tables have ON DELETE CASCADE, including devices and outbox.
   DELETE FROM public.warkops WHERE id=p_id;
   IF partner IS NOT NULL THEN UPDATE public.marketing_partners SET total_tenants_acquired=(SELECT count(*) FROM public.warkops WHERE marketing_agent_id=partner) WHERE id=partner; END IF;
   PERFORM set_config('okesih.archive_tenant','',true);
 ELSE
   PERFORM 1 FROM public.marketing_partners WHERE id=p_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Mitra tidak ditemukan.' USING ERRCODE='P0002'; END IF;
   SELECT coalesce(array_agg(u.id),'{}') INTO users FROM auth.users u JOIN public.marketing_partners p ON p.user_id=u.id
     WHERE p.id=p_id AND u.id<>p_actor AND u.raw_app_meta_data->>'role'='MARKETING'
     AND NOT EXISTS(SELECT 1 FROM public.warkop_members WHERE user_id=u.id)
     AND NOT EXISTS(SELECT 1 FROM public.marketing_partners WHERE user_id=u.id AND id<>p_id);
   folders:=jsonb_build_array(jsonb_build_object('bucket','partner-photos','path',p_id||'/'));
   SELECT coalesce(jsonb_agg(jsonb_build_object('bucket','partner-photos','path',profile_photo_url)),'[]') INTO files
     FROM public.marketing_partners WHERE id=p_id AND profile_photo_url IS NOT NULL;
   PERFORM 1 FROM public.marketing_partners WHERE id IN (SELECT partner_id FROM public.marketing_commission_mutations WHERE source_partner_id=p_id) ORDER BY id FOR UPDATE;
   PERFORM set_config('okesih.delete_partner',p_id::text,true);
   DELETE FROM public.marketing_commission_mutations WHERE partner_id=p_id OR source_partner_id=p_id;
   UPDATE public.marketing_partners SET upline_id=NULL WHERE upline_id=p_id;
   UPDATE public.warkops SET marketing_agent_id=NULL,marketing_commission_per_receipt=0 WHERE marketing_agent_id=p_id;
   GET DIAGNOSTICS affected=ROW_COUNT;
   DELETE FROM public.tenant_applications WHERE marketing_partner_id=p_id;
   DELETE FROM public.marketing_commission_withdrawals WHERE marketing_partner_id=p_id;
   DELETE FROM public.audit_logs WHERE target_id=p_id OR actor_user_id=ANY(users);
   IF to_regclass('public.marketing_agents') IS NOT NULL THEN EXECUTE 'DELETE FROM public.marketing_agents WHERE id=$1' USING p_id; END IF;
   DELETE FROM public.marketing_partners WHERE id=p_id;
   PERFORM set_config('okesih.delete_partner','',true);
 END IF;
 DELETE FROM public.auth_handoff_codes WHERE user_id=ANY(users);
 INSERT INTO public.entity_deletion_jobs(entity_type,entity_id,user_ids,objects,prefixes)
 VALUES(p_type,p_id,users,files,folders) RETURNING id INTO job;
 RETURN jsonb_build_object('jobId',job,'detachedTenantsCount',affected);
END $$;
REVOKE ALL ON FUNCTION public.delete_entity_permanently(text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.delete_entity_permanently(text,uuid,uuid) TO service_role;
-- Synchronize older production report definitions so legacy archives are labelled correctly.
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
      'totalSaasBilling',coalesce(b.tagihan_pokok,0),'paymentStatus',CASE WHEN b.status_bayar='PAID' THEN 'PAID' ELSE 'UNPAID' END,
      'status',CASE WHEN w.archived_at IS NOT NULL THEN 'ARCHIVED' WHEN w.is_active THEN 'ACTIVE' ELSE 'SUSPENDED' END,'joinedAt',w.created_at) AS row
    FROM page_rows w LEFT JOIN public.marketing_partners m ON m.id=w.marketing_agent_id LEFT JOIN receipts r ON r.warkop_id=w.id
    LEFT JOIN public.saas_billings b ON b.warkop_id=w.id AND b.tanggal=(SELECT today FROM settings)
  ) SELECT jsonb_build_object('data',coalesce((SELECT jsonb_agg(row ORDER BY created_at DESC,id DESC) FROM mapped),'[]'::jsonb),
    'pagination',jsonb_build_object('page',s.page,'pageSize',s.size,'total',(SELECT count(*) FROM filtered),'totalPages',greatest(1,ceil((SELECT count(*) FROM filtered)::numeric/s.size))),
    'totalTenants',(SELECT count(*) FROM public.warkops),
    'provinces',(SELECT coalesce(jsonb_agg(province ORDER BY province),'[]'::jsonb) FROM (SELECT DISTINCT coalesce(nullif(province,''),'Belum diatur') AS province FROM public.warkops) p)) FROM settings s;
$$;
COMMIT;
