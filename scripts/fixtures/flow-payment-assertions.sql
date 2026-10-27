\set ON_ERROR_STOP on
BEGIN;
SET LOCAL timezone='UTC';
DO $$
DECLARE w uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); owner_id uuid:=gen_random_uuid(); admin_id uuid:=gen_random_uuid();
 cashier uuid:=gen_random_uuid(); device uuid:=gen_random_uuid(); kitchen uuid:=gen_random_uuid(); shift uuid:=gen_random_uuid(); empty_shift uuid:=gen_random_uuid(); menu uuid:=gen_random_uuid();
 partner uuid:=gen_random_uuid(); coord uuid:=gen_random_uuid(); replacement uuid:=gen_random_uuid();
 oid uuid; bill uuid; input jsonb; pay jsonb; result jsonb; rate numeric; bonus numeric; fee numeric; old_date timestamptz;
BEGIN
 IF current_database()<>'okesih_remediation_test' THEN RAISE EXCEPTION 'Disposable database required'; END IF;
 INSERT INTO auth.users(id,raw_app_meta_data) VALUES(owner_id,'{}'),(admin_id,'{"role":"SUPERADMIN"}'),(coord,'{"role":"MARKETING"}');
 INSERT INTO public.marketing_partners(id,user_id,full_name,phone,city_area,referral_code,bank_account_number,bank_account_name,status,membership_level)
 VALUES(coord,coord,'Flow coordinator','0','QA','flow-'||coord,'0','QA','ACTIVE','COORDINATOR');
 INSERT INTO public.marketing_partners(id,full_name,phone,city_area,referral_code,bank_account_number,bank_account_name,status,upline_id)
 VALUES(partner,'Flow partner','0','QA','flow-'||partner,'0','QA','ACTIVE',coord),(replacement,'Replacement','0','QA','flow-'||replacement,'0','QA','ACTIVE',NULL);
 INSERT INTO public.warkops(id,nama,slug,marketing_agent_id) VALUES(w,'Flow','flow-'||w,partner),(other,'Other','flow-'||other,NULL);
 INSERT INTO public.warkop_members(warkop_id,user_id,username,role) VALUES(w,owner_id,'owner','OWNER');
 INSERT INTO public.warkop_members(id,warkop_id,username,role) VALUES(cashier,w,'cashier','KASIR');
 INSERT INTO public.device_installations(id,warkop_id,device_type,device_name,token_hash,expires_at)
 VALUES(device,w,'POS','Flow POS',encode(extensions.digest(device::text,'sha256'),'hex'),now()+interval '1 day'),
 (kitchen,w,'KDS','Flow KDS',encode(extensions.digest(kitchen::text,'sha256'),'hex'),now()+interval '1 day');
 INSERT INTO public.shifts(id,warkop_id,opened_by,device_id) VALUES(shift,w,cashier,device);
 INSERT INTO public.warkop_tables(warkop_id,label) VALUES(w,'1');
 INSERT INTO public.menus(id,warkop_id,nama,harga,kategori) VALUES(menu,w,'Coffee',10000,'Drink');
 input:=jsonb_build_object('idempotencyKey',gen_random_uuid(),'tableNumber','1','paymentMethod','CASH','items',jsonb_build_array(jsonb_build_object('menuId',menu,'qty',2)));
 result:=public.create_order_v2(w,input,'flow-create','token'); oid:=(result->>'id')::uuid;
 IF NOT EXISTS(SELECT FROM public.transactions WHERE id=oid AND order_source='CUSTOMER_QR' AND payment_status='PENDING') THEN RAISE EXCEPTION 'Wrong initial state'; END IF;
 old_date:=((now() AT TIME ZONE 'Asia/Makassar')::date::timestamp AT TIME ZONE 'Asia/Makassar')-interval '1 minute';
 UPDATE public.transactions SET created_at=old_date WHERE id=oid;
 input:=jsonb_build_object('idempotencyKey',gen_random_uuid(),'orderId',oid,'status','COOKING','shiftId',shift);
 PERFORM public.transition_order_v2(w,device,cashier,input,'confirm');
 IF (public.report_owner_revenue(w,'day')->>'total')::numeric<>20000 THEN RAISE EXCEPTION 'Confirmation date not used'; END IF;
 IF public.report_shift_cash(w,shift)<>0 THEN RAISE EXCEPTION 'Uncollected cash counted'; END IF;
 IF (public.report_device_history(w,((now() AT TIME ZONE 'Asia/Makassar')::date::timestamp AT TIME ZONE 'Asia/Makassar'),now()+interval '1 minute')->'pagination'->>'total')::int<>1 THEN RAISE EXCEPTION 'History date differs'; END IF;
 IF NOT EXISTS(SELECT FROM public.transactions WHERE id=oid AND order_source='CUSTOMER_QR') THEN RAISE EXCEPTION 'Confirmation changed origin'; END IF;
 PERFORM public.transition_order_v2(w,kitchen,NULL,jsonb_build_object('idempotencyKey',gen_random_uuid(),'orderId',oid,'status','READY'),'ready');
 BEGIN PERFORM public.transition_order_v2(w,kitchen,NULL,jsonb_build_object('idempotencyKey',gen_random_uuid(),'orderId',oid,'status','DONE'),'done-unpaid'); RAISE EXCEPTION 'Unpaid completed' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 BEGIN PERFORM public.close_shift(shift,0); RAISE EXCEPTION 'Unpaid shift closed' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 pay:=jsonb_build_object('idempotencyKey',gen_random_uuid(),'orderId',oid,'shiftId',shift,'cashReceived',25000);
 BEGIN PERFORM public.record_order_payment(other,device,cashier,pay,'payment'); RAISE EXCEPTION 'Cross tenant payment' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 BEGIN PERFORM public.record_order_payment(w,kitchen,cashier,pay,'payment'); RAISE EXCEPTION 'Kitchen accepted cash' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 BEGIN PERFORM public.record_order_payment(w,device,cashier,pay||'{"cashReceived":1}'::jsonb,'payment-short'); RAISE EXCEPTION 'Short cash accepted' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 result:=public.record_order_payment(w,device,cashier,pay,'payment');
 IF (result->>'change')::numeric<>5000 OR public.report_shift_cash(w,shift)<>20000 THEN RAISE EXCEPTION 'Cash receipt mismatch'; END IF;
 IF NOT (public.record_order_payment(w,device,cashier,pay,'payment')->>'duplicate')::boolean THEN RAISE EXCEPTION 'Payment replay not idempotent'; END IF;
 BEGIN PERFORM public.record_order_payment(w,device,cashier,pay,'changed'); RAISE EXCEPTION 'Hash conflict allowed' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 IF (SELECT count(*) FROM public.audit_logs WHERE target_id=oid AND action='ORDER_PAYMENT_RECORDED')<>1 THEN RAISE EXCEPTION 'Payment audit duplicated'; END IF;
 PERFORM public.transition_order_v2(w,kitchen,NULL,jsonb_build_object('idempotencyKey',gen_random_uuid(),'orderId',oid,'status','DONE'),'done-paid');
 SELECT default_marketing_commission,coordinator_commission_per_receipt,saas_fee_per_receipt INTO rate,bonus,fee FROM public.platform_settings WHERE id='global';
 result:=public.end_cashier_shift(shift,cashier,20000); bill:=(result->>'billing_id')::uuid;
 IF (result->>'total_cash_expected')::numeric<>20000 OR (result->>'difference')::numeric<>0 THEN RAISE EXCEPTION 'Shift reconciliation failed'; END IF;
 IF (SELECT commission_snapshot->>'direct_partner_id' FROM public.saas_billings WHERE id=bill)<>partner::text THEN RAISE EXCEPTION 'Snapshot missing'; END IF;
 UPDATE public.platform_settings SET default_marketing_commission=default_marketing_commission+1 WHERE id='global';
 UPDATE public.warkops SET marketing_agent_id=replacement WHERE id=w;
 UPDATE public.marketing_partners SET status='INACTIVE' WHERE id=coord;
 BEGIN UPDATE public.saas_billings SET commission_snapshot='{}' WHERE id=bill; RAISE EXCEPTION 'Snapshot mutable' USING ERRCODE='XX000'; EXCEPTION WHEN check_violation THEN NULL; END;
 PERFORM public.submit_billing_proof(bill,w,owner_id,'saas-billings/'||w||'/proof.png',encode(extensions.digest(bill::text,'sha256'),'hex'),'QA');
 PERFORM public.review_billing(bill,admin_id,'APPROVE','flow-'||bill,NULL);
 PERFORM public.review_billing(bill,admin_id,'APPROVE','flow-'||bill,NULL);
 IF (SELECT total_amount FROM public.marketing_commission_mutations WHERE billing_id=bill AND partner_id=partner AND kind='DIRECT') IS DISTINCT FROM rate THEN RAISE EXCEPTION 'Direct snapshot not honored'; END IF;
 IF (SELECT total_amount FROM public.marketing_commission_mutations WHERE billing_id=bill AND partner_id=coord AND kind='NETWORK') IS DISTINCT FROM bonus THEN RAISE EXCEPTION 'Network snapshot not honored'; END IF;
 IF EXISTS(SELECT FROM public.marketing_commission_mutations WHERE billing_id=bill AND partner_id=replacement) THEN RAISE EXCEPTION 'New recipient stole old entitlement'; END IF;
 INSERT INTO public.shifts(id,warkop_id,opened_by,device_id) VALUES(empty_shift,w,cashier,device);
 result:=public.close_shift(empty_shift,0);
 IF result->>'billing_id' IS NOT NULL OR (result->>'total_tagihan')::numeric<>0 OR EXISTS(SELECT FROM public.saas_billings WHERE shift_id=empty_shift) THEN RAISE EXCEPTION 'Empty shift charged'; END IF;
 IF public.close_shift(empty_shift,0)->>'billing_id' IS NOT NULL THEN RAISE EXCEPTION 'Empty retry charged'; END IF;
 IF has_function_privilege('anon','public.record_order_payment(uuid,uuid,uuid,jsonb,text)','EXECUTE') THEN RAISE EXCEPTION 'Payment exposed'; END IF;
 RAISE NOTICE 'PASS flow payments: QR source, pending cash, date boundary, cash collection, DONE gate, shift gate, idempotency, snapshot rates/recipients, zero shifts, ACL';
END $$;
ROLLBACK;
