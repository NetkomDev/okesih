BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
ALTER TABLE public.transactions
 ADD COLUMN payment_status text NOT NULL DEFAULT 'LEGACY_UNVERIFIED' CHECK(payment_status IN ('PENDING','PAID','LEGACY_UNVERIFIED')),
 ADD COLUMN payment_received_at timestamptz,
 ADD COLUMN payment_received_by uuid REFERENCES public.warkop_members(id) ON DELETE SET NULL,
 ADD COLUMN payment_shift_id uuid;
ALTER TABLE public.shifts ADD CONSTRAINT shifts_id_warkop_id_key UNIQUE(id, warkop_id);
ALTER TABLE public.transactions ADD CONSTRAINT payment_shift_tenant_fk FOREIGN KEY(payment_shift_id,warkop_id) REFERENCES public.shifts(id,warkop_id);
-- Existing QRIS confirmation is evidence of the cashier's check, not bank settlement.
UPDATE public.transactions SET payment_status='PAID',payment_received_at=confirmed_at,payment_shift_id=shift_id
 WHERE payment_method='QRIS' AND confirmed_at IS NOT NULL AND status_pesanan IN ('COOKING','READY','DONE');
UPDATE public.transactions SET payment_status='PENDING' WHERE status_pesanan='AWAITING_CONFIRMATION';
-- Cash is backfilled only when the original POS creation recorded enough received cash.
UPDATE public.transactions t SET payment_status='PAID',payment_received_at=t.confirmed_at,payment_shift_id=t.shift_id
 FROM public.audit_logs a WHERE a.warkop_id=t.warkop_id AND a.target_id=t.id AND a.action='ORDER_CREATED'
 AND a.device_id IS NOT NULL AND t.order_source='POS' AND t.payment_method='CASH'
 AND jsonb_typeof(a.metadata->'cash_received')='number' AND (a.metadata->>'cash_received')::numeric>=t.total_harga;
CREATE OR REPLACE FUNCTION public.create_order_v2(p_warkop_id uuid,p_input jsonb,p_hash text,p_token_hash text,p_proof_path text DEFAULT NULL,p_device_id uuid DEFAULT NULL,p_member_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t public.transactions%ROWTYPE; m public.menus%ROWTYPE; s public.shifts%ROWTYPE;
 member public.warkop_members%ROWTYPE; item jsonb; total numeric:=0; q integer; label text; quantity integer;
BEGIN
 PERFORM 1 FROM public.warkops WHERE id=p_warkop_id AND is_active AND archived_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Usaha nonaktif.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(p_warkop_id::text));
 SELECT * INTO t FROM public.transactions WHERE warkop_id=p_warkop_id AND idempotency_key=(p_input->>'idempotencyKey')::uuid;
 IF FOUND THEN
  IF t.request_hash IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  RETURN jsonb_build_object('id',t.id,'queueNumber',t.nomor_antrean,'nomor_antrean',t.nomor_antrean,'total',t.total_harga,'total_harga',t.total_harga,'status_pesanan',t.status_pesanan,'duplicate',true);
 END IF;
 IF p_device_id IS NOT NULL THEN
  PERFORM 1 FROM public.device_installations WHERE id=p_device_id AND warkop_id=p_warkop_id AND device_type='POS' AND status='ACTIVE' AND expires_at>now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Perangkat tidak aktif.'; END IF;
  SELECT * INTO member FROM public.warkop_members WHERE id=p_member_id AND warkop_id=p_warkop_id AND role='KASIR' AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kasir tidak aktif.'; END IF;
  SELECT * INTO s FROM public.shifts WHERE warkop_id=p_warkop_id AND device_id=p_device_id AND opened_by=p_member_id AND status='OPEN' FOR UPDATE;
  IF NOT FOUND OR s.id IS DISTINCT FROM (p_input->>'shiftId')::uuid THEN RAISE EXCEPTION 'Shift pesanan tidak aktif.'; END IF;
  label:=p_input->>'tableNumber';
 ELSE
  SELECT wt.label INTO label FROM public.warkop_tables wt WHERE wt.warkop_id=p_warkop_id AND wt.is_active AND
   (CASE WHEN p_input->>'tableId' IS NOT NULL THEN wt.id=(p_input->>'tableId')::uuid ELSE wt.label=p_input->>'tableNumber' END);
  IF label IS NULL THEN RAISE EXCEPTION 'Meja tidak valid.'; END IF;
  IF p_input->>'paymentMethod'='QRIS' AND p_proof_path IS NULL THEN RAISE EXCEPTION 'Bukti QRIS diperlukan.'; END IF;
 END IF;
 IF p_input->>'idempotencyKey' IS NULL OR p_hash IS NULL OR p_token_hash IS NULL OR p_input->>'paymentMethod' IS NULL OR label IS NULL OR jsonb_typeof(p_input->'items') IS DISTINCT FROM 'array' OR p_input->>'paymentMethod' NOT IN ('CASH','QRIS') OR length(label) NOT BETWEEN 1 AND 20 OR jsonb_array_length(p_input->'items') NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Pesanan tidak valid.'; END IF;
 -- Hold menu rows stable for the total and item snapshots.
 PERFORM 1 FROM public.menus WHERE warkop_id=p_warkop_id AND id IN (SELECT (x->>'menuId')::uuid FROM jsonb_array_elements(p_input->'items') x) ORDER BY id FOR SHARE;
 FOR item IN SELECT * FROM jsonb_array_elements(p_input->'items') LOOP
  quantity:=(item->>'qty')::integer;
  IF quantity IS NULL OR quantity NOT BETWEEN 1 AND 99 OR length(coalesce(item->>'notes',''))>300 THEN RAISE EXCEPTION 'Item tidak valid.'; END IF;
  SELECT * INTO m FROM public.menus WHERE id=(item->>'menuId')::uuid AND warkop_id=p_warkop_id AND is_available;
  IF NOT FOUND OR m.harga<0 THEN RAISE EXCEPTION 'Menu tidak tersedia.'; END IF;
  total:=total+m.harga*quantity;
 END LOOP;
 IF total<=0 THEN RAISE EXCEPTION 'Total tidak valid.'; END IF;
 IF p_device_id IS NOT NULL AND p_input->>'paymentMethod'='CASH' AND coalesce((p_input->>'cashReceived')::numeric,0)<total THEN RAISE EXCEPTION 'Pembayaran tunai kurang.'; END IF;
 SELECT coalesce(max(nomor_antrean),0)+1 INTO q FROM public.transactions WHERE warkop_id=p_warkop_id AND created_at>=(date_trunc('day',now() AT TIME ZONE 'Asia/Makassar') AT TIME ZONE 'Asia/Makassar');
 INSERT INTO public.transactions(warkop_id,shift_id,waiter_name,table_number,nomor_antrean,total_harga,payment_method,payment_proof_url,status_pesanan,idempotency_key,customer_access_token_hash,request_hash,confirmed_at,order_source,payment_status,payment_received_at,payment_received_by,payment_shift_id)
 VALUES(p_warkop_id,s.id,CASE WHEN member.id IS NOT NULL THEN 'Kasir: '||coalesce(member.display_name,member.username) END,label,q,total,(p_input->>'paymentMethod')::payment_method_type,p_proof_path,
 CASE WHEN p_device_id IS NULL THEN 'AWAITING_CONFIRMATION'::order_status ELSE 'COOKING'::order_status END,(p_input->>'idempotencyKey')::uuid,p_token_hash,p_hash,CASE WHEN p_device_id IS NOT NULL THEN now() END,CASE WHEN p_device_id IS NULL THEN 'CUSTOMER_QR' ELSE 'POS' END,CASE WHEN p_device_id IS NULL THEN 'PENDING' ELSE 'PAID' END,CASE WHEN p_device_id IS NOT NULL THEN now() END,member.id,s.id) RETURNING * INTO t;
 FOR item IN SELECT * FROM jsonb_array_elements(p_input->'items') LOOP
  SELECT * INTO m FROM public.menus WHERE id=(item->>'menuId')::uuid;
  INSERT INTO public.transaction_items(transaction_id,menu_id,nama_menu,harga_satuan,qty,notes) VALUES(t.id,m.id,m.nama,m.harga,(item->>'qty')::integer,nullif(item->>'notes',''));
 END LOOP;
 INSERT INTO public.audit_logs(warkop_id,actor_user_id,device_id,action,target_type,target_id,metadata) VALUES(p_warkop_id,member.user_id,p_device_id,'ORDER_CREATED','transaction',t.id,jsonb_build_object('total',total,'shift_id',s.id,'cash_received',p_input->'cashReceived'));
 IF s.id IS NOT NULL THEN UPDATE public.shifts SET last_activity_at=now() WHERE id=s.id; END IF;
 RETURN jsonb_build_object('id',t.id,'queueNumber',q,'nomor_antrean',q,'total',total,'total_harga',total,'status_pesanan',t.status_pesanan,'duplicate',false);
END $$;

CREATE OR REPLACE FUNCTION public.transition_order_v2(p_warkop_id uuid,p_device_id uuid,p_member_id uuid,p_input jsonb,p_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public.device_installations%ROWTYPE; m public.warkop_members%ROWTYPE; s public.shifts%ROWTYPE;
 t public.transactions%ROWTYPE; prior public.operation_idempotency%ROWTYPE; result jsonb; target order_status;
BEGIN
 PERFORM 1 FROM public.warkops WHERE id=p_warkop_id AND is_active AND archived_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Usaha nonaktif.'; END IF;
 SELECT * INTO d FROM public.device_installations WHERE id=p_device_id AND warkop_id=p_warkop_id AND status='ACTIVE' AND expires_at>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'Perangkat tidak aktif.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(p_device_id::text||':'||(p_input->>'idempotencyKey')));
 SELECT * INTO prior FROM public.operation_idempotency WHERE warkop_id=p_warkop_id AND device_id=p_device_id AND idempotency_key=(p_input->>'idempotencyKey')::uuid;
 IF FOUND THEN
  IF prior.request_hash IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
  RETURN prior.response||'{"duplicate":true}'::jsonb;
 END IF;
 IF d.device_type='POS' THEN
  SELECT * INTO m FROM public.warkop_members WHERE id=p_member_id AND warkop_id=p_warkop_id AND role='KASIR' AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kasir tidak aktif.'; END IF;
  SELECT * INTO s FROM public.shifts WHERE id=(p_input->>'shiftId')::uuid AND warkop_id=p_warkop_id AND device_id=d.id AND opened_by=m.id AND status='OPEN' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift perubahan tidak aktif.'; END IF;
 END IF;
 SELECT * INTO t FROM public.transactions WHERE id=(p_input->>'orderId')::uuid AND warkop_id=p_warkop_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pesanan tidak ditemukan.'; END IF;
 target:=(p_input->>'status')::order_status;
 IF NOT ((d.device_type='POS' AND ((t.status_pesanan='AWAITING_CONFIRMATION' AND target IN('COOKING','REJECTED')) OR (t.status_pesanan='READY' AND target='DONE')))
 OR (d.device_type='KDS' AND ((t.status_pesanan='COOKING' AND target='READY') OR (t.status_pesanan='READY' AND target='DONE')))) THEN RAISE EXCEPTION 'Status pesanan sudah berubah atau transisi tidak diizinkan.'; END IF;
 IF target='DONE' AND t.payment_status<>'PAID' THEN RAISE EXCEPTION 'Pembayaran belum dicatat. Minta kasir mencatat pelunasan sebelum menandai sudah diantar.'; END IF;
 UPDATE public.transactions SET status_pesanan=target,
 payment_status=CASE WHEN target='COOKING' AND payment_method='QRIS' THEN 'PAID' ELSE payment_status END,
 payment_received_at=CASE WHEN target='COOKING' AND payment_method='QRIS' THEN now() ELSE payment_received_at END,
 payment_received_by=CASE WHEN target='COOKING' AND payment_method='QRIS' THEN m.id ELSE payment_received_by END,
 payment_shift_id=CASE WHEN target='COOKING' AND payment_method='QRIS' THEN s.id ELSE payment_shift_id END,
 confirmed_at=CASE WHEN target='COOKING' THEN now() ELSE confirmed_at END,
 shift_id=CASE WHEN target='COOKING' THEN s.id ELSE shift_id END,
 waiter_name=CASE WHEN target='COOKING' THEN 'Kasir: '||coalesce(m.display_name,m.username) ELSE waiter_name END
 WHERE id=t.id;
 SELECT jsonb_build_object('success',true,'order',jsonb_build_object('id',id,'status_pesanan',status_pesanan,'updated_at',updated_at)) INTO result FROM public.transactions WHERE id=t.id;
 INSERT INTO public.operation_idempotency(warkop_id,device_id,idempotency_key,operation,response,request_hash) VALUES(p_warkop_id,d.id,(p_input->>'idempotencyKey')::uuid,'ORDER_STATUS_TRANSITION',result,p_hash);
 INSERT INTO public.audit_logs(warkop_id,actor_user_id,device_id,action,target_type,target_id,metadata) VALUES(p_warkop_id,m.user_id,d.id,'ORDER_'||target,'transaction',t.id,jsonb_build_object('from',t.status_pesanan,'to',target,'shift_id',s.id));
 IF s.id IS NOT NULL THEN UPDATE public.shifts SET last_activity_at=now() WHERE id=s.id; END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.record_order_payment(p_warkop_id uuid,p_device_id uuid,p_member_id uuid,p_input jsonb,p_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.shifts%ROWTYPE; m public.warkop_members%ROWTYPE; t public.transactions%ROWTYPE;
 prior public.operation_idempotency%ROWTYPE; result jsonb; received numeric;
BEGIN
 PERFORM 1 FROM public.warkops WHERE id=p_warkop_id AND is_active AND archived_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Usaha nonaktif.'; END IF;
 PERFORM 1 FROM public.device_installations WHERE id=p_device_id AND warkop_id=p_warkop_id AND device_type='POS' AND status='ACTIVE' AND expires_at>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'Perangkat kasir tidak aktif.'; END IF;
 SELECT * INTO m FROM public.warkop_members WHERE id=p_member_id AND warkop_id=p_warkop_id AND role='KASIR' AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Kasir tidak aktif.'; END IF;
 IF p_input->>'idempotencyKey' IS NULL OR p_hash IS NULL THEN RAISE EXCEPTION 'Identitas pembayaran diperlukan.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(p_device_id::text||':'||(p_input->>'idempotencyKey')));
 SELECT * INTO prior FROM public.operation_idempotency WHERE warkop_id=p_warkop_id AND device_id=p_device_id AND idempotency_key=(p_input->>'idempotencyKey')::uuid;
 IF FOUND THEN
   IF prior.request_hash IS DISTINCT FROM p_hash OR prior.operation<>'ORDER_PAYMENT' THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
   RETURN prior.response||'{"duplicate":true}'::jsonb;
 END IF;
 SELECT * INTO s FROM public.shifts WHERE id=(p_input->>'shiftId')::uuid AND warkop_id=p_warkop_id AND device_id=p_device_id AND opened_by=m.id AND status='OPEN' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Shift pembayaran tidak aktif.'; END IF;
 SELECT * INTO t FROM public.transactions WHERE id=(p_input->>'orderId')::uuid AND warkop_id=p_warkop_id FOR UPDATE;
 IF NOT FOUND OR t.status_pesanan NOT IN ('COOKING','READY','DONE') THEN RAISE EXCEPTION 'Pesanan tidak tersedia untuk pelunasan.'; END IF;
 IF t.payment_status='PAID' THEN RAISE EXCEPTION 'Pembayaran sudah dicatat. Sinkronkan pesanan; jangan menerima pembayaran kedua.'; END IF;
 received:=CASE WHEN t.payment_method='CASH' THEN (p_input->>'cashReceived')::numeric ELSE t.total_harga END;
 IF received IS NULL OR received<t.total_harga OR received>1000000000 THEN RAISE EXCEPTION 'Nominal pembayaran tidak mencukupi atau tidak valid.'; END IF;
 UPDATE public.transactions SET payment_status='PAID',payment_received_at=now(),payment_received_by=m.id,payment_shift_id=s.id WHERE id=t.id;
 result:=jsonb_build_object('success',true,'orderId',t.id,'paymentStatus','PAID','change',received-t.total_harga);
 INSERT INTO public.operation_idempotency(warkop_id,device_id,idempotency_key,operation,response,request_hash)
 VALUES(p_warkop_id,p_device_id,(p_input->>'idempotencyKey')::uuid,'ORDER_PAYMENT',result,p_hash);
 INSERT INTO public.audit_logs(warkop_id,actor_user_id,device_id,action,target_type,target_id,metadata)
 VALUES(p_warkop_id,m.user_id,p_device_id,'ORDER_PAYMENT_RECORDED','transaction',t.id,jsonb_build_object('payment_method',t.payment_method,'received',received,'total',t.total_harga,'change',received-t.total_harga,'shift_id',s.id,'previous_status',t.payment_status));
 UPDATE public.shifts SET last_activity_at=now() WHERE id=s.id;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.record_order_payment(uuid,uuid,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_order_payment(uuid,uuid,uuid,jsonb,text) TO service_role;
CREATE OR REPLACE FUNCTION public.report_shift_cash(p_warkop_id uuid,p_shift_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT coalesce(sum(total_harga),0) FROM public.transactions
 WHERE warkop_id=p_warkop_id AND payment_shift_id=p_shift_id AND payment_method='CASH'
   AND payment_status='PAID' AND status_pesanan IN ('COOKING','READY','DONE');
$$;
CREATE INDEX idx_transactions_payment_shift ON public.transactions(payment_shift_id) WHERE payment_method='CASH' AND payment_status='PAID';
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
  WHERE warkop_id=p_warkop_id AND (p_start IS NULL OR coalesce(confirmed_at,created_at)>=p_start) AND (p_end IS NULL OR coalesce(confirmed_at,created_at)<p_end);
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
    SELECT CASE b.period WHEN 'day' THEN date_trunc('day',coalesce(t.confirmed_at,t.created_at) AT TIME ZONE 'Asia/Makassar') + floor(extract(hour FROM coalesce(t.confirmed_at,t.created_at) AT TIME ZONE 'Asia/Makassar')/3)*interval '3 hours'
      WHEN 'year' THEN date_trunc('month',coalesce(t.confirmed_at,t.created_at) AT TIME ZONE 'Asia/Makassar') ELSE date_trunc('day',coalesce(t.confirmed_at,t.created_at) AT TIME ZONE 'Asia/Makassar') END AS bucket,
      sum(t.total_harga) AS amount,count(*) AS receipts
    FROM public.transactions t CROSS JOIN bounds b
    WHERE t.warkop_id=p_warkop_id AND coalesce(t.confirmed_at,t.created_at)>=b.start_at AT TIME ZONE 'Asia/Makassar'
      AND coalesce(t.confirmed_at,t.created_at)<b.end_at AT TIME ZONE 'Asia/Makassar' AND t.status_pesanan IN ('COOKING','READY','DONE')
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
CREATE OR REPLACE FUNCTION public.report_device_history(
  p_warkop_id uuid,p_start timestamptz DEFAULT NULL,p_end timestamptz DEFAULT NULL,
  p_status text DEFAULT 'ALL',p_payment text DEFAULT 'ALL',p_search text DEFAULT '',p_page integer DEFAULT 1,p_page_size integer DEFAULT 25
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  WITH settings AS (SELECT greatest(1,p_page) AS page,least(100,greatest(1,p_page_size)) AS size),
  filtered AS NOT MATERIALIZED (
    SELECT t.id,t.table_number,t.nomor_antrean,t.total_harga,t.payment_method,t.payment_proof_url,t.status_pesanan,t.waiter_name,t.created_at,t.updated_at,t.confirmed_at,t.order_source,t.payment_status,t.payment_received_at,
      coalesce(nullif(regexp_replace(t.waiter_name,'^Kasir:\s*','','i'),''),nullif(m.display_name,''),m.username,'Kasir') AS cashier_name
    FROM public.transactions t LEFT JOIN public.shifts s ON s.id=t.shift_id LEFT JOIN public.warkop_members m ON m.id=s.opened_by
    WHERE t.warkop_id=p_warkop_id AND (p_start IS NULL OR coalesce(t.confirmed_at,t.created_at)>=p_start) AND (p_end IS NULL OR coalesce(t.confirmed_at,t.created_at)<p_end)
      AND (p_status='ALL' OR t.status_pesanan::text=p_status) AND (p_payment='ALL' OR t.payment_method::text=p_payment)
      AND (coalesce(p_search,'')='' OR strpos(lower(concat_ws(' ',t.table_number,t.nomor_antrean,t.waiter_name,m.display_name,m.username,'Kasir')),lower(p_search))>0
        OR EXISTS(SELECT 1 FROM public.transaction_items i WHERE i.transaction_id=t.id AND strpos(lower(i.nama_menu),lower(p_search))>0))
  ), page_rows AS (
    SELECT * FROM filtered ORDER BY created_at DESC,id DESC LIMIT (SELECT size FROM settings) OFFSET (SELECT (page::bigint-1)*size FROM settings)
  ), items AS (
    SELECT i.transaction_id,jsonb_agg(jsonb_build_object('id',i.id,'nama_menu',i.nama_menu,'harga_satuan',i.harga_satuan,'qty',i.qty,'notes',i.notes) ORDER BY i.id) AS rows
    FROM public.transaction_items i JOIN page_rows p ON p.id=i.transaction_id GROUP BY i.transaction_id
  ) SELECT jsonb_build_object('orders',coalesce((SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('items',coalesce(i.rows,'[]'::jsonb)) ORDER BY p.created_at DESC,p.id DESC)
    FROM page_rows p LEFT JOIN items i ON i.transaction_id=p.id),'[]'::jsonb),
    'pagination',jsonb_build_object('page',s.page,'pageSize',s.size,'total',(SELECT count(*) FROM filtered),'totalPages',greatest(1,ceil((SELECT count(*) FROM filtered)::numeric/s.size)))) FROM settings s;
$$;
CREATE OR REPLACE FUNCTION public.get_superadmin_analytics(p_period text DEFAULT 'today')
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 WITH bounds AS (
   SELECT date_trunc(CASE p_period WHEN 'week' THEN 'week' WHEN 'month' THEN 'month' WHEN 'year' THEN 'year' ELSE 'day' END,
     now() AT TIME ZONE 'Asia/Makassar') AT TIME ZONE 'Asia/Makassar' AS start_at, now() AS end_at
 ), receipts AS (
   SELECT (coalesce(t.confirmed_at,t.created_at) AT TIME ZONE 'Asia/Makassar')::date AS day,count(*) AS amount
   FROM public.transactions t CROSS JOIN bounds b
   WHERE coalesce(t.confirmed_at,t.created_at)>=b.start_at AND coalesce(t.confirmed_at,t.created_at)<=b.end_at AND t.status_pesanan IN ('COOKING','READY','DONE') GROUP BY 1
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
    WHERE coalesce(t.confirmed_at,t.created_at)>=s.today::timestamp AT TIME ZONE 'Asia/Makassar' AND coalesce(t.confirmed_at,t.created_at)<(s.today+1)::timestamp AT TIME ZONE 'Asia/Makassar'
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

CREATE OR REPLACE FUNCTION public.end_cashier_shift(
  p_shift_id UUID,
  p_member_id UUID,
  p_actual_cash_deposited NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_shift RECORD;
  v_result JSONB;
  v_expected_cash NUMERIC := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(240025);
  SELECT id, warkop_id, opened_by, device_id, status INTO v_shift
  FROM public.shifts
  WHERE id = p_shift_id
  FOR UPDATE;

  IF NOT FOUND OR v_shift.status <> 'OPEN' THEN
    RAISE EXCEPTION 'Shift kasir tidak aktif';
  END IF;

  IF v_shift.opened_by <> p_member_id THEN
    RAISE EXCEPTION 'Shift ini dimiliki kasir lain';
  END IF;

  IF p_actual_cash_deposited < 0 THEN
    RAISE EXCEPTION 'Nominal kas fisik tidak valid';
  END IF;

  v_expected_cash := public.report_shift_cash(v_shift.warkop_id,p_shift_id);

  SELECT public.close_shift(p_shift_id, p_actual_cash_deposited, p_notes) INTO v_result;

  UPDATE public.shifts
  SET total_cash_expected = v_expected_cash,
      difference = p_actual_cash_deposited - v_expected_cash,
      last_activity_at = timezone('utc', now())
  WHERE id = p_shift_id;

  INSERT INTO public.audit_logs (warkop_id, actor_user_id, device_id, action, target_type, target_id, metadata)
  SELECT v_shift.warkop_id, user_id, v_shift.device_id, 'CASHIER_SHIFT_CLOSED', 'shift', p_shift_id,
         jsonb_build_object('actual_cash_deposited', p_actual_cash_deposited)
  FROM public.warkop_members WHERE id = p_member_id;

  RETURN v_result || jsonb_build_object(
    'total_cash_expected', v_expected_cash,
    'actual_cash_deposited', p_actual_cash_deposited,
    'difference', p_actual_cash_deposited - v_expected_cash
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE INDEX idx_transactions_business_time ON public.transactions((coalesce(confirmed_at,created_at)));
CREATE INDEX idx_transactions_tenant_business_time ON public.transactions(warkop_id,(coalesce(confirmed_at,created_at)));
COMMIT;
