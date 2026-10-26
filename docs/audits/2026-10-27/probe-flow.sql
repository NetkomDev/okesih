\set ON_ERROR_STOP on
-- Run only after scripts/test-database.sh on a disposable local database.
BEGIN;
SET LOCAL timezone = 'UTC';
DO $$
DECLARE
 w uuid:=gen_random_uuid(); partner uuid:=gen_random_uuid(); cashier uuid:=gen_random_uuid();
 device uuid:=gen_random_uuid(); shift1 uuid:=gen_random_uuid(); shift2 uuid:=gen_random_uuid();
 menu uuid:=gen_random_uuid(); oid uuid; bill uuid; baseline bigint; actual bigint;
 input jsonb; result jsonb; report jsonb;
BEGIN
 IF current_database()<>'okesih_remediation_test' THEN RAISE EXCEPTION 'Disposable database required'; END IF;
 SELECT (public.get_superadmin_analytics('today')->>'receipts')::bigint INTO baseline;
 INSERT INTO public.marketing_partners(id,full_name,phone,city_area,referral_code,bank_account_number,bank_account_name,status)
 VALUES(partner,'Flow probe','0','Test','flow-'||partner,'0','Test','ACTIVE');
 INSERT INTO public.warkops(id,nama,slug,marketing_agent_id,marketing_commission_per_receipt)
 VALUES(w,'Flow probe','flow-'||w,partner,15);
 INSERT INTO public.warkop_members(id,warkop_id,username,role) VALUES(cashier,w,'flow-cashier','KASIR');
 INSERT INTO public.device_installations(id,warkop_id,device_type,device_name,token_hash,expires_at)
 VALUES(device,w,'POS','Flow probe',encode(extensions.digest(device::text,'sha256'),'hex'),now()+interval '1 day');
 INSERT INTO public.shifts(id,warkop_id,opened_by,device_id) VALUES(shift1,w,cashier,device);
 INSERT INTO public.warkop_tables(warkop_id,label) VALUES(w,'1');
 INSERT INTO public.menus(id,warkop_id,nama,harga,kategori) VALUES(menu,w,'Coffee',10000,'Drink');
 input:=jsonb_build_object('idempotencyKey',gen_random_uuid(),'tableNumber','1','paymentMethod','CASH',
   'items',jsonb_build_array(jsonb_build_object('menuId',menu,'qty',2)));
 result:=public.create_order_v2(w,input,'flow-hash','flow-token'); oid:=(result->>'id')::uuid;
 actual:=(public.get_superadmin_analytics('today')->>'receipts')::bigint-baseline;
 IF actual<>1 OR (public.report_transaction_summary(w)->>'receiptCount')::integer<>0 THEN
   RAISE EXCEPTION 'Pending discrepancy not reproduced: %',actual;
 END IF;
 RAISE NOTICE 'REPRODUCED F01: pending order adds 1 Super Admin receipt, 0 Owner receipts';
 input:=jsonb_build_object('idempotencyKey',gen_random_uuid(),'orderId',oid,'status','COOKING','shiftId',shift1);
 PERFORM public.transition_order_v2(w,device,cashier,input,'flow-transition');
 IF NOT EXISTS(SELECT FROM public.transactions WHERE id=oid AND waiter_name LIKE 'Kasir:%') THEN
   RAISE EXCEPTION 'Cashier marker discrepancy not reproduced';
 END IF;
 IF (public.report_transaction_summary(w)->>'cash')::numeric<>20000 THEN RAISE EXCEPTION 'Cash summary unexpected'; END IF;
 RAISE NOTICE 'REPRODUCED F03: customer CASH confirmation gets Kasir marker and contributes Rp20000 before collection event';
 result:=public.close_shift(shift1,0,'Audit probe'); bill:=(result->>'billing_id')::uuid;
 IF EXISTS(SELECT FROM public.marketing_commission_mutations WHERE billing_id=bill) THEN RAISE EXCEPTION 'Unexpected unpaid commission'; END IF;
 RAISE NOTICE 'VERIFIED: COOKING order is billed on close; UNPAID billing creates no commission';
 INSERT INTO public.shifts(id,warkop_id,opened_by,device_id) VALUES(shift2,w,cashier,device);
 result:=public.close_shift(shift2,0,'Empty audit shift');
 IF (result->>'total_transactions')::integer<>0 OR (result->>'total_tagihan')::numeric<=0 THEN
   RAISE EXCEPTION 'Empty shift billing not reproduced';
 END IF;
 RAISE NOTICE 'REPRODUCED F09: empty shift creates positive bill from unique code, amount=%',result->>'total_tagihan';
 report:=public.report_superadmin_tenants(1,25,'flow-'||w,'');
 IF jsonb_array_length(report->'data')<>2 OR (report->'pagination'->>'total')::integer<>1 THEN
   RAISE EXCEPTION 'Duplicate tenant rows not reproduced: %',report;
 END IF;
 RAISE NOTICE 'REPRODUCED F02: 1 tenant, 2 same-day bills => 2 directory rows but pagination total 1';
 UPDATE public.transactions SET created_at=((now() AT TIME ZONE 'Asia/Makassar')::date::timestamp AT TIME ZONE 'Asia/Makassar')-interval '1 minute' WHERE id=oid;
 IF (public.report_owner_revenue(w,'day')->>'total')::numeric<>0 THEN RAISE EXCEPTION 'Date attribution discrepancy not reproduced'; END IF;
 RAISE NOTICE 'REPRODUCED F06: confirmed today but created yesterday => today Owner revenue 0';
END $$;
ROLLBACK;
