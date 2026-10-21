BEGIN;
ALTER TABLE public.transactions ADD COLUMN request_hash text;
ALTER TABLE public.operation_idempotency ADD COLUMN request_hash text;
-- Disable the obsolete entry point; the v2 function validates tenant, menu and shift.
REVOKE ALL ON FUNCTION public.create_customer_order(uuid,text,payment_method_type,text,jsonb,numeric,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.create_order_v2(p_warkop_id uuid,p_input jsonb,p_hash text,p_token_hash text,p_proof_path text DEFAULT NULL,p_device_id uuid DEFAULT NULL,p_member_id uuid DEFAULT NULL)
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
 INSERT INTO public.transactions(warkop_id,shift_id,waiter_name,table_number,nomor_antrean,total_harga,payment_method,payment_proof_url,status_pesanan,idempotency_key,customer_access_token_hash,request_hash,confirmed_at)
 VALUES(p_warkop_id,s.id,CASE WHEN member.id IS NOT NULL THEN 'Kasir: '||coalesce(member.display_name,member.username) END,label,q,total,(p_input->>'paymentMethod')::payment_method_type,p_proof_path,
 CASE WHEN p_device_id IS NULL THEN 'AWAITING_CONFIRMATION'::order_status ELSE 'COOKING'::order_status END,(p_input->>'idempotencyKey')::uuid,p_token_hash,p_hash,CASE WHEN p_device_id IS NOT NULL THEN now() END) RETURNING * INTO t;
 FOR item IN SELECT * FROM jsonb_array_elements(p_input->'items') LOOP
  SELECT * INTO m FROM public.menus WHERE id=(item->>'menuId')::uuid;
  INSERT INTO public.transaction_items(transaction_id,menu_id,nama_menu,harga_satuan,qty,notes) VALUES(t.id,m.id,m.nama,m.harga,(item->>'qty')::integer,nullif(item->>'notes',''));
 END LOOP;
 INSERT INTO public.audit_logs(warkop_id,actor_user_id,device_id,action,target_type,target_id,metadata) VALUES(p_warkop_id,member.user_id,p_device_id,'ORDER_CREATED','transaction',t.id,jsonb_build_object('total',total,'shift_id',s.id,'cash_received',p_input->'cashReceived'));
 IF s.id IS NOT NULL THEN UPDATE public.shifts SET last_activity_at=now() WHERE id=s.id; END IF;
 RETURN jsonb_build_object('id',t.id,'queueNumber',q,'nomor_antrean',q,'total',total,'total_harga',total,'status_pesanan',t.status_pesanan,'duplicate',false);
END $$;
CREATE FUNCTION public.transition_order_v2(p_warkop_id uuid,p_device_id uuid,p_member_id uuid,p_input jsonb,p_hash text)
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
 UPDATE public.transactions SET status_pesanan=target,
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
REVOKE ALL ON FUNCTION public.create_order_v2(uuid,jsonb,text,text,text,uuid,uuid),public.transition_order_v2(uuid,uuid,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_v2(uuid,jsonb,text,text,text,uuid,uuid),public.transition_order_v2(uuid,uuid,uuid,jsonb,text) TO service_role;
COMMIT;
