BEGIN;
CREATE OR REPLACE FUNCTION public.report_transaction_summary(
  p_warkop_id uuid, p_start timestamptz DEFAULT NULL, p_end timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'transactionCount', count(*),
    'receiptCount', count(*) FILTER (WHERE status_pesanan IN ('COOKING','READY','DONE')),
    'cash', coalesce(sum(total_harga) FILTER (WHERE status_pesanan IN ('COOKING','READY','DONE') AND payment_method='CASH'),0),
    'qris', coalesce(sum(total_harga) FILTER (WHERE status_pesanan IN ('COOKING','READY','DONE') AND payment_method='QRIS'),0),
    'total', coalesce(sum(total_harga) FILTER (WHERE status_pesanan IN ('COOKING','READY','DONE')),0)
  ) FROM public.transactions
  WHERE warkop_id=p_warkop_id AND (p_start IS NULL OR created_at>=p_start) AND (p_end IS NULL OR created_at<p_end);
$$;
CREATE OR REPLACE FUNCTION public.report_owner_revenue(p_warkop_id uuid, p_period text DEFAULT 'day')
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  WITH config AS (
    SELECT CASE WHEN p_period IN ('day','week','month','year') THEN p_period ELSE 'day' END AS period,
      now() AT TIME ZONE 'Asia/Makassar' AS local_now
  ), bounds AS (
    SELECT period,date_trunc(period,local_now) AS start_at,
      date_trunc(period,local_now)+CASE period WHEN 'day' THEN interval '1 day' WHEN 'week' THEN interval '1 week' WHEN 'month' THEN interval '1 month' ELSE interval '1 year' END AS end_at,
      CASE period WHEN 'day' THEN interval '3 hours' WHEN 'year' THEN interval '1 month' ELSE interval '1 day' END AS step
    FROM config
  ), buckets AS (
    SELECT b.period,g AS bucket FROM bounds b CROSS JOIN LATERAL generate_series(b.start_at,b.end_at-b.step,b.step) g
  ), totals AS (
    SELECT CASE b.period WHEN 'day' THEN date_trunc('day',t.created_at AT TIME ZONE 'Asia/Makassar') + floor(extract(hour FROM t.created_at AT TIME ZONE 'Asia/Makassar')/3)*interval '3 hours'
      WHEN 'year' THEN date_trunc('month',t.created_at AT TIME ZONE 'Asia/Makassar') ELSE date_trunc('day',t.created_at AT TIME ZONE 'Asia/Makassar') END AS bucket,
      sum(t.total_harga) AS amount,count(*) AS receipts
    FROM public.transactions t CROSS JOIN bounds b
    WHERE t.warkop_id=p_warkop_id AND t.created_at>=b.start_at AT TIME ZONE 'Asia/Makassar'
      AND t.created_at<b.end_at AT TIME ZONE 'Asia/Makassar' AND t.status_pesanan IN ('COOKING','READY','DONE')
    GROUP BY 1
  ), series AS (
    SELECT b.bucket,coalesce(t.amount,0) AS value,coalesce(t.receipts,0) AS receipts,
      CASE b.period WHEN 'day' THEN to_char(b.bucket,'HH24')||'.00'
      WHEN 'week' THEN (ARRAY['Min','Sen','Sel','Rab','Kam','Jum','Sab'])[extract(dow FROM b.bucket)::int+1]
      WHEN 'year' THEN (ARRAY['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'])[extract(month FROM b.bucket)::int]
      ELSE extract(day FROM b.bucket)::int::text END AS label
    FROM buckets b LEFT JOIN totals t USING(bucket)
  ) SELECT jsonb_build_object('period',(SELECT period FROM config),
    'series',jsonb_agg(jsonb_build_object('label',label,'value',value) ORDER BY bucket),
    'total',coalesce(sum(value),0),'average',coalesce(round(avg(value) FILTER(WHERE value>0)),0),'transactionCount',coalesce(sum(receipts),0)) FROM series;
$$;
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
CREATE OR REPLACE FUNCTION public.report_marketing_dashboard(p_partner_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  WITH tenants AS (SELECT * FROM public.warkops WHERE marketing_agent_id=p_partner_id),
  receipts AS (
    SELECT t.warkop_id, count(*) AS amount
    FROM public.transactions t JOIN tenants w ON w.id=t.warkop_id
    WHERE t.status_pesanan IN ('COOKING','READY','DONE') GROUP BY t.warkop_id
  ),
  billings AS (
    SELECT b.warkop_id, bool_or(b.status_bayar<>'PAID') AS unpaid,
      coalesce(sum(b.tagihan_pokok) FILTER(WHERE b.status_bayar<>'PAID'),0) AS amount
    FROM public.saas_billings b JOIN tenants w ON w.id=b.warkop_id GROUP BY b.warkop_id
  ),
  mutations_per_tenant AS (
    SELECT m.warkop_id, coalesce(sum(m.total_amount), 0) AS commission
    FROM public.marketing_commission_mutations m
    WHERE m.partner_id = p_partner_id
    GROUP BY m.warkop_id
  ),
  mapped AS (
    SELECT w.id, w.created_at, coalesce(r.amount, 0) AS receipts,
      coalesce(mpt.commission, 0) AS commission,
      coalesce(b.unpaid, false) AS unpaid,
      jsonb_build_object(
        'id', w.id, 'name', w.nama, 'slug', w.slug, 'ownerName', coalesce(w.owner_name, ''),
        'phone', w.owner_phone, 'address', w.address, 'province', coalesce(w.province, ''),
        'cityRegency', coalesce(w.city_regency, ''),
        'status', CASE WHEN w.is_active THEN 'ACTIVE' ELSE 'SUSPENDED' END,
        'paymentStatus', CASE WHEN coalesce(b.unpaid, false) THEN 'UNPAID' ELSE 'PAID' END,
        'unpaidAmount', coalesce(b.amount, 0),
        'commissionPerReceipt', coalesce(w.marketing_commission_per_receipt, 0),
        'joinedAt', w.created_at, 'receipts', coalesce(r.amount, 0),
        'commission', coalesce(mpt.commission, 0)
      ) AS row
    FROM tenants w
    LEFT JOIN receipts r ON r.warkop_id = w.id
    LEFT JOIN billings b ON b.warkop_id = w.id
    LEFT JOIN mutations_per_tenant mpt ON mpt.warkop_id = w.id
  ),
  totals AS (
    SELECT count(*) AS tenants, count(*) FILTER(WHERE unpaid) AS unpaid, count(*) FILTER(WHERE NOT unpaid) AS paid,
      coalesce(sum(receipts), 0) AS receipts,
      coalesce((SELECT sum(total_amount) FROM public.marketing_commission_mutations WHERE partner_id = p_partner_id), 0) AS commission
    FROM mapped
  ),
  pending AS (
    SELECT coalesce(sum(amount), 0) AS amount
    FROM public.marketing_commission_withdrawals
    WHERE marketing_partner_id = p_partner_id AND status = 'PENDING'
  )
  SELECT jsonb_build_object(
    'tenants', coalesce((SELECT jsonb_agg(row ORDER BY created_at DESC, id DESC) FROM mapped), '[]'::jsonb),
    'applications', coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY created_at DESC, id DESC) FROM (
      SELECT id, business_name, owner_name, owner_phone, address, province, city_regency, status, review_notes, created_at, warkop_id
      FROM public.tenant_applications WHERE marketing_partner_id = p_partner_id
    ) a), '[]'::jsonb),
    'withdrawals', coalesce((SELECT jsonb_agg(to_jsonb(w) ORDER BY created_at DESC, id DESC) FROM (
      SELECT id, amount, status, bank_name, bank_account_number, bank_account_name, notes, reviewed_at, created_at
      FROM public.marketing_commission_withdrawals
      WHERE marketing_partner_id = p_partner_id ORDER BY created_at DESC, id DESC LIMIT 25
    ) w), '[]'::jsonb),
    'totals', jsonb_build_object(
      'tenants', t.tenants,
      'pending', (SELECT count(*) FROM public.tenant_applications WHERE marketing_partner_id = p_partner_id AND status IN ('PENDING', 'PROCESSING')),
      'unpaidTenants', t.unpaid,
      'paidTenants', t.paid,
      'receipts', t.receipts,
      'commission', t.commission,
      'pendingWithdrawal', p.amount,
      'availableCommission', greatest(0, t.commission - coalesce((SELECT commission_paid FROM public.marketing_partners WHERE id = p_partner_id), 0) - p.amount)
    )
  ) FROM totals t CROSS JOIN pending p;
$$;
CREATE OR REPLACE FUNCTION public.current_user_warkop_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT (array_agg(m.warkop_id))[1] FROM public.warkop_members m JOIN public.warkops w ON w.id=m.warkop_id
 WHERE m.user_id=auth.uid() AND m.is_active AND w.is_active HAVING count(*)=1;
$$;
ALTER TABLE public.menus ADD CONSTRAINT menus_price_nonnegative CHECK(harga>=0) NOT VALID;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_total_nonnegative CHECK(total_harga>=0) NOT VALID;
ALTER TABLE public.transaction_items ADD CONSTRAINT items_values_valid CHECK(qty>0 AND harga_satuan>=0) NOT VALID;
ALTER TABLE public.shifts ADD CONSTRAINT shifts_id_tenant_unique UNIQUE(id,warkop_id);
ALTER TABLE public.menus ADD CONSTRAINT menus_id_tenant_unique UNIQUE(id,warkop_id);
ALTER TABLE public.transactions ADD CONSTRAINT transactions_id_tenant_unique UNIQUE(id,warkop_id);
ALTER TABLE public.transactions ADD CONSTRAINT transaction_shift_tenant_fk FOREIGN KEY(shift_id,warkop_id) REFERENCES public.shifts(id,warkop_id) NOT VALID;
ALTER TABLE public.transaction_items ADD COLUMN warkop_id uuid;
UPDATE public.transaction_items i SET warkop_id=t.warkop_id FROM public.transactions t WHERE t.id=i.transaction_id;
ALTER TABLE public.transaction_items ALTER COLUMN warkop_id SET NOT NULL;
CREATE FUNCTION public.assign_item_tenant() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 SELECT warkop_id INTO NEW.warkop_id FROM public.transactions WHERE id=NEW.transaction_id;
 RETURN NEW;
END $$;
CREATE TRIGGER assign_item_tenant BEFORE INSERT OR UPDATE ON public.transaction_items FOR EACH ROW EXECUTE FUNCTION public.assign_item_tenant();
ALTER TABLE public.transaction_items ADD CONSTRAINT item_transaction_tenant_fk FOREIGN KEY(transaction_id,warkop_id) REFERENCES public.transactions(id,warkop_id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.transaction_items ADD CONSTRAINT item_menu_tenant_fk FOREIGN KEY(menu_id,warkop_id) REFERENCES public.menus(id,warkop_id) NOT VALID;
ALTER TABLE public.menus VALIDATE CONSTRAINT menus_price_nonnegative;
ALTER TABLE public.transactions VALIDATE CONSTRAINT transactions_total_nonnegative;
ALTER TABLE public.transactions VALIDATE CONSTRAINT transaction_shift_tenant_fk;
ALTER TABLE public.transaction_items VALIDATE CONSTRAINT items_values_valid;
ALTER TABLE public.transaction_items VALIDATE CONSTRAINT item_transaction_tenant_fk;
ALTER TABLE public.transaction_items VALIDATE CONSTRAINT item_menu_tenant_fk;
CREATE FUNCTION public.approve_device_pairing(p_warkop_id uuid,p_actor uuid,p_code_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.device_pairing_requests%ROWTYPE; d public.device_installations%ROWTYPE;
BEGIN
 PERFORM 1 FROM public.warkops WHERE id=p_warkop_id AND is_active AND archived_at IS NULL FOR SHARE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.warkop_members WHERE warkop_id=p_warkop_id AND user_id=p_actor AND role='OWNER' AND is_active) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO p FROM public.device_pairing_requests WHERE code_hash=p_code_hash AND status='PENDING' AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Kode pairing tidak valid atau sudah digunakan.'; END IF;
 INSERT INTO public.device_installations(warkop_id,pairing_request_id,device_type,device_name,token_hash,paired_by,expires_at)
 VALUES(p_warkop_id,p.id,p.device_type,p.device_name,p.poll_secret_hash,p_actor,now()+interval '180 days') RETURNING * INTO d;
 UPDATE public.device_pairing_requests SET warkop_id=p_warkop_id,status='APPROVED',approved_by=p_actor,approved_at=now() WHERE id=p.id;
 INSERT INTO public.audit_logs(warkop_id,actor_user_id,device_id,action,target_type,target_id) VALUES(p_warkop_id,p_actor,d.id,'DEVICE_PAIRED','device',d.id);
 RETURN to_jsonb(d)-'token_hash';
END $$;
REVOKE ALL ON FUNCTION public.approve_device_pairing(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.approve_device_pairing(uuid,uuid,text) TO service_role;
COMMIT;
