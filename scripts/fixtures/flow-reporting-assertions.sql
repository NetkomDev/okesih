\set ON_ERROR_STOP on
BEGIN;
SET LOCAL timezone='UTC';
DO $$
DECLARE w uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); partner uuid:=gen_random_uuid(); upline uuid:=gen_random_uuid();
 s1 uuid:=gen_random_uuid(); s2 uuid:=gen_random_uuid(); b1 uuid:=gen_random_uuid(); b2 uuid:=gen_random_uuid();
 base jsonb; report jsonb; fee numeric; direct_rate numeric; network_rate numeric;
 today date:=(now() AT TIME ZONE 'Asia/Makassar')::date;
BEGIN
 IF current_database()<>'okesih_remediation_test' THEN RAISE EXCEPTION 'Disposable database required'; END IF;
 base:=public.get_superadmin_analytics('today');
 SELECT saas_fee_per_receipt,default_marketing_commission,coordinator_commission_per_receipt INTO fee,direct_rate,network_rate FROM public.platform_settings WHERE id='global';
 INSERT INTO auth.users(id) VALUES(upline);
 INSERT INTO public.marketing_partners(id,user_id,full_name,phone,city_area,referral_code,bank_account_number,bank_account_name,status,membership_level)
 VALUES(upline,upline,'Flow upline','0','Test','flow-'||upline,'0','Test','ACTIVE','COORDINATOR');
 INSERT INTO public.marketing_partners(id,full_name,phone,city_area,referral_code,bank_account_number,bank_account_name,status,upline_id)
 VALUES(partner,'Flow direct','0','Test','flow-'||partner,'0','Test','ACTIVE',upline);
 INSERT INTO public.warkops(id,nama,slug,marketing_agent_id,marketing_commission_per_receipt)
 VALUES(w,'Flow reporting','flow-'||w,partner,999),(other,'Other','flow-'||other,NULL,0);
 INSERT INTO public.shifts(id,warkop_id,status) VALUES(s1,w,'CLOSED'),(s2,w,'CLOSED');
 INSERT INTO public.transactions(warkop_id,shift_id,total_harga,payment_method,status_pesanan,nomor_antrean)
 SELECT w,s1,100,'CASH','DONE',n FROM generate_series(1,1205) n;
 INSERT INTO public.transactions(warkop_id,total_harga,payment_method,status_pesanan,nomor_antrean)
 VALUES(w,99999,'CASH','AWAITING_CONFIRMATION',1206),(w,99999,'CASH','REJECTED',1207);
 UPDATE public.transactions SET payment_status='PAID',payment_shift_id=s1 WHERE warkop_id=w AND status_pesanan='DONE';
 report:=public.get_superadmin_analytics('today');
 IF (report->>'receipts')::bigint-(base->>'receipts')::bigint<>1205 THEN RAISE EXCEPTION 'Invalid receipts counted'; END IF;
 IF (report->>'marketingCommission')::numeric<>(base->>'marketingCommission')::numeric THEN RAISE EXCEPTION 'Estimated commission leaked'; END IF;
 IF public.report_shift_cash(w,s1)<>120500 OR public.report_shift_cash(other,s1)<>0 THEN RAISE EXCEPTION 'Shift sum capped or crossed tenant'; END IF;
 INSERT INTO public.saas_billings(id,warkop_id,shift_id,tanggal,total_transactions,tagihan_pokok,kode_unik,total_tagihan,status_bayar)
 VALUES(b1,w,s1,today,2,2*fee,100,2*fee+100,'PAID'),(b2,w,s2,today,3,3*fee,101,3*fee+101,'UNPAID');
 report:=public.get_superadmin_analytics('today');
 IF (report->>'grossBilling')::numeric-(base->>'grossBilling')::numeric<>5*fee THEN RAISE EXCEPTION 'Issued total mismatch'; END IF;
 IF (report->>'paidBilling')::numeric-(base->>'paidBilling')::numeric<>2*fee THEN RAISE EXCEPTION 'Paid total mismatch'; END IF;
 IF (report->>'outstandingBilling')::numeric-(base->>'outstandingBilling')::numeric<>3*fee THEN RAISE EXCEPTION 'Outstanding mismatch'; END IF;
 IF (report->>'marketingCommission')::numeric-(base->>'marketingCommission')::numeric<>2*(direct_rate+network_rate) THEN RAISE EXCEPTION 'Ledger mismatch'; END IF;
 IF (report->>'netRevenue')::numeric-(base->>'netRevenue')::numeric<>2*(fee-direct_rate-network_rate) THEN RAISE EXCEPTION 'Realized margin mismatch'; END IF;
 IF (SELECT sum((x->>'commission')::numeric) FROM jsonb_array_elements(report->'series') x)<>(report->>'marketingCommission')::numeric THEN RAISE EXCEPTION 'Series differs from KPI'; END IF;
 report:=public.report_superadmin_tenants(1,25,'flow-'||w,'');
 IF jsonb_array_length(report->'data')<>1 OR (report->'pagination'->>'total')::int<>1 THEN RAISE EXCEPTION 'Tenant duplicated'; END IF;
 IF (report->'data'->0->>'totalSaasBilling')::numeric<>5*fee OR report->'data'->0->>'paymentStatus'<>'UNPAID' THEN RAISE EXCEPTION 'Mixed billing incorrect'; END IF;
 UPDATE public.saas_billings SET status_bayar='PENDING_REVIEW' WHERE id=b2;
 IF public.report_superadmin_tenants(1,25,'flow-'||w,'')->'data'->0->>'paymentStatus'<>'PENDING_REVIEW' THEN RAISE EXCEPTION 'Pending review lost'; END IF;
 IF public.report_superadmin_tenants(1,25,'flow-'||other,'')->'data'->0->>'paymentStatus'<>'NO_BILLING' THEN RAISE EXCEPTION 'No billing reported as debt'; END IF;
 UPDATE public.warkops SET marketing_commission_per_receipt=777 WHERE id=w;
 IF (public.get_superadmin_analytics('today')->>'marketingCommission')::numeric<>(base->>'marketingCommission')::numeric+2*(direct_rate+network_rate) THEN RAISE EXCEPTION 'Current tenant rate rewrote historical result'; END IF;
 -- Settlement of an older bill belongs to today's realized income, not today's issued bills.
 INSERT INTO public.saas_billings(warkop_id,tanggal,total_transactions,tagihan_pokok,kode_unik,total_tagihan,status_bayar)
 VALUES(other,today-40,1,fee,102,fee+102,'PAID');
 report:=public.get_superadmin_analytics('today');
 IF (report->>'grossBilling')::numeric-(base->>'grossBilling')::numeric<>5*fee OR (report->>'paidBilling')::numeric-(base->>'paidBilling')::numeric<>3*fee THEN RAISE EXCEPTION 'Issue and settlement dates mixed'; END IF;
 IF has_function_privilege('anon','public.report_shift_cash(uuid,uuid)','EXECUTE') OR has_function_privilege('authenticated','public.get_superadmin_analytics(text)','EXECUTE') THEN RAISE EXCEPTION 'Reporting privileges exposed'; END IF;
 RAISE NOTICE 'PASS flow reporting: valid receipts, actual direct/network ledger, issuance/settlement, multishift aggregation, 1205 cash rows, tenant scope, ACL';
END $$;
ROLLBACK;
