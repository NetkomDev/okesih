\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
 admin_id uuid:=gen_random_uuid(); coord uuid:=gen_random_uuid(); direct uuid:=gen_random_uuid(); child uuid:=gen_random_uuid(); pending uuid:=gen_random_uuid();
 wc uuid:=gen_random_uuid(); wd uuid:=gen_random_uuid(); wn uuid:=gen_random_uuid(); b uuid; req uuid; result jsonb;
BEGIN
 INSERT INTO auth.users(id,raw_app_meta_data) VALUES(admin_id,'{"role":"SUPERADMIN"}'),(coord,'{"role":"MARKETING"}'),(direct,'{"role":"MARKETING"}'),(child,'{"role":"MARKETING"}');
 INSERT INTO public.marketing_partners(id,user_id,full_name,phone,city_area,referral_code,bank_account_number,bank_account_name,status,membership_level)
 VALUES(coord,coord,'Coordinator','628100000001','QA','QA-'||coord,'0012345','Coordinator','ACTIVE','COORDINATOR'),
 (direct,direct,'Standalone','628100000002','QA','QA-'||direct,'0012345','Standalone','ACTIVE','MITRA');
 INSERT INTO public.marketing_partners(id,user_id,full_name,phone,city_area,referral_code,bank_account_number,bank_account_name,status,membership_level,upline_id)
 VALUES(child,child,'Recruit','628100000003','QA','QA-'||child,'0012345','Recruit','ACTIVE','MITRA',coord),
 (pending,NULL,'Pending','628100000004','QA','QA-'||pending,'0012345','Pending','PENDING','MITRA',coord);
 UPDATE public.platform_settings SET default_marketing_commission=20,coordinator_commission_per_receipt=5,saas_fee_per_receipt=50 WHERE id='global';
 INSERT INTO public.warkops(id,nama,slug,marketing_agent_id) VALUES(wc,'Coordinator tenant','qa-'||wc,coord),(wd,'Standalone tenant','qa-'||wd,direct),(wn,'Recruit tenant','qa-'||wn,child);
 -- Unpaid receipts never become withdrawable.
 INSERT INTO public.saas_billings(warkop_id,tanggal,total_transactions,tagihan_pokok,kode_unik,total_tagihan,status_bayar) VALUES(wn,current_date,100,5000,123,5123,'UNPAID') RETURNING id INTO b;
 IF EXISTS(SELECT FROM public.marketing_commission_mutations WHERE billing_id=b) THEN RAISE EXCEPTION 'Unpaid commission'; END IF;
 BEGIN PERFORM public.request_marketing_commission_withdrawal(child,1); RAISE EXCEPTION 'Unpaid withdrawal allowed' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 UPDATE public.saas_billings SET status_bayar='PAID' WHERE id=b;
 IF (SELECT sum(total_amount) FROM public.marketing_commission_mutations WHERE partner_id=child)<>2000 THEN RAISE EXCEPTION 'Direct recruit amount wrong'; END IF;
 IF (SELECT sum(total_amount) FROM public.marketing_commission_mutations WHERE partner_id=coord)<>500 THEN RAISE EXCEPTION 'Coordinator bonus wrong'; END IF;
 UPDATE public.saas_billings SET status_bayar='PAID' WHERE id=b;
 IF (SELECT count(*) FROM public.marketing_commission_mutations WHERE billing_id=b)<>2 THEN RAISE EXCEPTION 'Duplicate credit'; END IF;
 BEGIN UPDATE public.saas_billings SET total_transactions=200 WHERE id=b; RAISE EXCEPTION 'Paid bill mutable' USING ERRCODE='XX000'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE public.marketing_commission_mutations SET total_amount=1 WHERE billing_id=b; RAISE EXCEPTION 'Ledger mutable' USING ERRCODE='XX000'; EXCEPTION WHEN check_violation THEN NULL; END;
 -- Coordinator direct receipts get DIRECT only, standalone gets no NETWORK.
 INSERT INTO public.saas_billings(warkop_id,tanggal,total_transactions,tagihan_pokok,kode_unik,total_tagihan,status_bayar) VALUES(wc,current_date,100,5000,124,5124,'PAID'),(wd,current_date,100,5000,125,5125,'PAID');
 IF (SELECT sum(total_amount) FROM public.marketing_commission_mutations WHERE partner_id=coord)<>2500 THEN RAISE EXCEPTION 'Coordinator combined amount wrong'; END IF;
 IF (SELECT sum(total_amount) FROM public.marketing_commission_mutations WHERE partner_id=direct)<>2000 THEN RAISE EXCEPTION 'Standalone amount wrong'; END IF;
 IF EXISTS(SELECT FROM public.marketing_commission_mutations WHERE warkop_id IN(wc,wd) AND kind='NETWORK') THEN RAISE EXCEPTION 'Self or standalone network bonus'; END IF;
 result:=public.report_marketing_network(coord);
 IF jsonb_array_length(result->'members')<>2 OR (result->>'totalCommission')::numeric<>500 THEN RAISE EXCEPTION 'Network report incorrect'; END IF;
 result:=public.report_marketing_dashboard(coord);
 IF (result->'totals'->>'availableCommission')::numeric<>2500 THEN RAISE EXCEPTION 'Dashboard omits network bonus'; END IF;
 -- Atomic reservations, rejection releases funds, repeated approval cannot double-pay.
 result:=public.request_marketing_commission_withdrawal(coord,2000);req:=(result->>'id')::uuid;
 IF (result->>'available_balance')::numeric<>500 THEN RAISE EXCEPTION 'Reservation incorrect'; END IF;
 BEGIN PERFORM public.request_marketing_commission_withdrawal(coord,501); RAISE EXCEPTION 'Overdraw allowed' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 BEGIN PERFORM public.review_marketing_commission_withdrawal(req,'PAID',child); RAISE EXCEPTION 'Unauthorized review' USING ERRCODE='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM public.review_marketing_commission_withdrawal(req,'REJECTED',admin_id);
 result:=public.request_marketing_commission_withdrawal(coord,2500);req:=(result->>'id')::uuid;
 UPDATE public.marketing_partners SET status='INACTIVE' WHERE id=coord;
 BEGIN PERFORM public.review_marketing_commission_withdrawal(req,'PAID',admin_id); RAISE EXCEPTION 'Inactive payout' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 UPDATE public.marketing_partners SET status='ACTIVE' WHERE id=coord;
 PERFORM public.review_marketing_commission_withdrawal(req,'PAID',admin_id);
 BEGIN PERFORM public.review_marketing_commission_withdrawal(req,'PAID',admin_id); RAISE EXCEPTION 'Double payout' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 IF (SELECT commission_paid FROM public.marketing_partners WHERE id=coord)<>2500 THEN RAISE EXCEPTION 'Paid counter incorrect'; END IF;
 BEGIN PERFORM public.delete_marketing_partner_safely(child,admin_id); RAISE EXCEPTION 'Deleted financial history' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 IF NOT EXISTS(SELECT FROM public.warkops WHERE id=wn AND marketing_agent_id=child) THEN RAISE EXCEPTION 'Partial delete'; END IF;
 UPDATE public.marketing_partners SET membership_level='COORDINATOR' WHERE id=child;
 IF (SELECT upline_id FROM public.marketing_partners WHERE id=child)<>coord THEN RAISE EXCEPTION 'Promotion detached upline'; END IF;
 BEGIN UPDATE public.marketing_partners SET membership_level='MITRA' WHERE id=coord; RAISE EXCEPTION 'Coordinator demoted with children' USING ERRCODE='XX000'; EXCEPTION WHEN check_violation THEN NULL; END;
 -- Rate changes apply to future settlements, never rewrite previous credits.
 UPDATE public.platform_settings SET default_marketing_commission=18,coordinator_commission_per_receipt=7 WHERE id='global';
 INSERT INTO public.saas_billings(warkop_id,tanggal,total_transactions,tagihan_pokok,kode_unik,total_tagihan,status_bayar) VALUES(wn,current_date+1,10,500,126,626,'PAID');
 IF (SELECT sum(total_amount) FROM public.marketing_commission_mutations WHERE partner_id=child)<>2180 THEN RAISE EXCEPTION 'Historical direct rate changed'; END IF;
 IF (SELECT sum(total_amount) FROM public.marketing_commission_mutations WHERE partner_id=coord)<>2570 THEN RAISE EXCEPTION 'Historical network rate changed'; END IF;
 -- A suspended coordinator gets no new network credit; the active child still earns directly.
 UPDATE public.marketing_partners SET status='INACTIVE' WHERE id=coord;
 INSERT INTO public.saas_billings(warkop_id,tanggal,total_transactions,tagihan_pokok,kode_unik,total_tagihan,status_bayar) VALUES(wn,current_date+2,10,500,127,627,'PAID');
 IF (SELECT sum(total_amount) FROM public.marketing_commission_mutations WHERE partner_id=coord)<>2570 THEN RAISE EXCEPTION 'Inactive coordinator credited'; END IF;
 IF (SELECT sum(total_amount) FROM public.marketing_commission_mutations WHERE partner_id=child)<>2360 THEN RAISE EXCEPTION 'Active recruit lost direct credit'; END IF;
 UPDATE public.marketing_partners SET status='ACTIVE' WHERE id=coord;
 BEGIN UPDATE public.platform_settings SET default_marketing_commission=49,coordinator_commission_per_receipt=5 WHERE id='global'; RAISE EXCEPTION 'Rates exceed fee' USING ERRCODE='XX000'; EXCEPTION WHEN check_violation THEN NULL; END;
 UPDATE public.platform_settings SET default_marketing_commission=0,coordinator_commission_per_receipt=0 WHERE id='global';
 INSERT INTO public.saas_billings(warkop_id,tanggal,total_transactions,tagihan_pokok,kode_unik,total_tagihan,status_bayar) VALUES(wn,current_date+3,10,500,128,628,'PAID') RETURNING id INTO b;
 IF EXISTS(SELECT FROM public.marketing_commission_mutations WHERE billing_id=b) THEN RAISE EXCEPTION 'Zero rate ignored'; END IF;
 -- A stale/invalid preexisting reservation must not be paid merely because it is pending.
 INSERT INTO public.marketing_commission_withdrawals(marketing_partner_id,amount,bank_name,bank_account_number,bank_account_name) VALUES(coord,5000,'BRI','0012345','Coordinator') RETURNING id INTO req;
 BEGIN PERFORM public.review_marketing_commission_withdrawal(req,'PAID',admin_id); RAISE EXCEPTION 'Stale balance paid' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 PERFORM public.review_marketing_commission_withdrawal(req,'REJECTED',admin_id);
 IF has_function_privilege('anon','public.delete_marketing_partner_safely(uuid,uuid)','EXECUTE') OR has_table_privilege('anon','public.marketing_commission_mutations','INSERT') THEN RAISE EXCEPTION 'Public finance access'; END IF;
 RAISE NOTICE 'KorMit assertions passed: settlement, reports, rates, reservation, review, history, authorization, hierarchy.';
END $$;
ROLLBACK;

BEGIN;
DO $$
DECLARE w uuid:=gen_random_uuid(); owner_id uuid:=gen_random_uuid(); admin_id uuid:=gen_random_uuid(); partner uuid:=gen_random_uuid(); member uuid:=gen_random_uuid(); shift uuid:=gen_random_uuid(); second_shift uuid:=gen_random_uuid(); bill uuid; result jsonb;
BEGIN
 INSERT INTO auth.users(id,raw_app_meta_data) VALUES(owner_id,'{}'),(admin_id,'{"role":"SUPERADMIN"}');
 INSERT INTO public.marketing_partners(id,full_name,phone,city_area,referral_code,bank_account_number,bank_account_name,status) VALUES(partner,'Billing test','628111111111','QA','QA-'||partner,'0012345','QA','ACTIVE');
 INSERT INTO public.warkops(id,nama,slug,marketing_agent_id) VALUES(w,'Billing test','qa-'||w,partner);
 INSERT INTO public.warkop_members(id,warkop_id,user_id,username,role) VALUES(member,w,owner_id,'QA','OWNER');
 INSERT INTO public.shifts(id,warkop_id,opened_by) VALUES(shift,w,member);
 INSERT INTO public.transactions(warkop_id,shift_id,status_pesanan,total_harga,payment_method,nomor_antrean) VALUES(w,shift,'DONE',10000,'CASH',1),(w,shift,'VOID',10000,'CASH',2),(w,shift,'REJECTED',10000,'CASH',3),(w,shift,'AWAITING_CONFIRMATION',10000,'CASH',4);
 result:=public.close_shift(shift,10000,NULL); bill:=(result->>'billing_id')::uuid;
 IF (result->>'total_transactions')::int<>1 THEN RAISE EXCEPTION 'Invalid receipts billed'; END IF;
 IF (public.close_shift(shift,10000,NULL)->>'billing_id')::uuid<>bill THEN RAISE EXCEPTION 'Repeated close duplicates billing'; END IF;
 PERFORM public.submit_billing_proof(bill,w,owner_id,'saas-billings/'||w||'/test.png',repeat('c',64),'QA');
 IF EXISTS(SELECT FROM public.marketing_commission_mutations WHERE billing_id=bill) THEN RAISE EXCEPTION 'Proof upload prematurely credits commission'; END IF;
 PERFORM public.review_billing(bill,admin_id,'APPROVE','QA-'||bill,NULL);
 PERFORM public.review_billing(bill,admin_id,'APPROVE','QA-'||bill,NULL);
 IF (SELECT count(*) FROM public.marketing_commission_mutations WHERE billing_id=bill)<>1 THEN RAISE EXCEPTION 'Review duplicate commission'; END IF;
 INSERT INTO public.shifts(id,warkop_id,opened_by) VALUES(second_shift,w,member);
 result:=public.close_shift(second_shift,0,NULL);
 IF (result->>'billing_id')::uuid=bill THEN RAISE EXCEPTION 'Second shift overwrote settled billing'; END IF;
 IF (SELECT total_transactions FROM public.saas_billings WHERE id=bill)<>1 THEN RAISE EXCEPTION 'Settled receipt count changed'; END IF;
 RAISE NOTICE 'Billing → proof → approval → commission assertions passed.';
END $$;
ROLLBACK;
