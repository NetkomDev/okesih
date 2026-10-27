\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.fail_permanent_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('okesih.test_delete_fail',true)='true' THEN RAISE EXCEPTION 'Injected delete failure'; END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER test_delete_fail BEFORE DELETE ON public.warkops FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_permanent_delete();
DO $$
DECLARE admin_id uuid:=gen_random_uuid(); owner_id uuid:=gen_random_uuid(); shared uuid:=gen_random_uuid();
 w uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); financial uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); child uuid:=gen_random_uuid();
 bill uuid; result jsonb; job uuid;
BEGIN
 INSERT INTO auth.users(id,raw_app_meta_data) VALUES(admin_id,'{"role":"SUPERADMIN"}'),(owner_id,'{"role":"OWNER"}'),(shared,'{"role":"OWNER"}'),(p,'{"role":"MARKETING"}');
 INSERT INTO public.marketing_partners(id,user_id,full_name,phone,city_area,referral_code,bank_account_number,bank_account_name,status,membership_level)
 VALUES(p,p,'Delete test','0','QA','QA-'||p,'0','QA','ACTIVE','COORDINATOR');
 INSERT INTO public.marketing_partners(id,full_name,phone,city_area,referral_code,bank_account_number,bank_account_name,status,upline_id)
 VALUES(child,'Child','0','QA','QA-'||child,'0','QA','ACTIVE',p);
 INSERT INTO public.warkops(id,nama,slug,marketing_agent_id) VALUES(w,'Empty','qa-'||w,p),(other,'Keep','qa-'||other,p),(financial,'Finance','qa-'||financial,p);
 INSERT INTO public.warkop_members(warkop_id,user_id,username,role) VALUES(w,owner_id,'owner','OWNER'),(w,shared,'shared','OWNER'),(other,shared,'shared','OWNER');
 INSERT INTO public.saas_billings(warkop_id,tanggal,total_transactions,tagihan_pokok,kode_unik,total_tagihan,status_bayar)
 VALUES(financial,current_date,10,500,101,601,'UNPAID') RETURNING id INTO bill;
 BEGIN PERFORM public.delete_entity_permanently('TENANT',financial,admin_id); RAISE EXCEPTION 'Deleted billing history' USING ERRCODE='XX000'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN PERFORM public.delete_entity_permanently('MARKETING',p,admin_id); RAISE EXCEPTION 'Deleted future commission entitlement' USING ERRCODE='XX000'; EXCEPTION WHEN check_violation THEN NULL; END;
 UPDATE public.saas_billings SET status_bayar='PAID' WHERE id=bill;
 BEGIN PERFORM public.delete_entity_permanently('MARKETING',p,admin_id); RAISE EXCEPTION 'Deleted paid ledger' USING ERRCODE='XX000'; EXCEPTION WHEN check_violation THEN NULL; END;
 IF NOT EXISTS(SELECT FROM public.saas_billings WHERE id=bill) OR NOT EXISTS(SELECT FROM public.marketing_commission_mutations WHERE billing_id=bill) THEN RAISE EXCEPTION 'Partial finance deletion'; END IF;
 BEGIN PERFORM public.delete_entity_permanently('TENANT',w,owner_id); RAISE EXCEPTION 'Unauthorized deletion' USING ERRCODE='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('okesih.test_delete_fail','true',true);
 BEGIN PERFORM public.delete_entity_permanently('TENANT',w,admin_id); RAISE EXCEPTION 'Expected rollback' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 IF NOT EXISTS(SELECT FROM public.warkops WHERE id=w) OR EXISTS(SELECT FROM public.entity_deletion_jobs WHERE entity_id=w) THEN RAISE EXCEPTION 'Deletion partially committed'; END IF;
 PERFORM set_config('okesih.test_delete_fail','false',true);
 result:=public.delete_entity_permanently('TENANT',w,admin_id); job:=(result->>'jobId')::uuid;
 IF EXISTS(SELECT FROM public.warkops WHERE id=w) OR NOT EXISTS(SELECT FROM public.warkops WHERE id=other) THEN RAISE EXCEPTION 'Wrong tenant removed'; END IF;
 IF (SELECT user_ids FROM public.entity_deletion_jobs WHERE id=job)<>ARRAY[owner_id] THEN RAISE EXCEPTION 'Shared user selected for deletion'; END IF;
 IF (public.delete_entity_permanently('TENANT',w,admin_id)->>'jobId')::uuid<>job THEN RAISE EXCEPTION 'Retry not idempotent'; END IF;
 result:=public.delete_entity_permanently('MARKETING',child,admin_id);
 IF EXISTS(SELECT FROM public.marketing_partners WHERE id=child) OR NOT EXISTS(SELECT FROM public.marketing_partners WHERE id=p) THEN RAISE EXCEPTION 'Nonfinancial partner deletion failed'; END IF;
 IF has_function_privilege('service_role','public.archive_tenant_and_purge_finance(uuid,uuid)','EXECUTE') OR has_function_privilege('authenticated','public.delete_entity_permanently(text,uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Deletion bypass privilege'; END IF;
 RAISE NOTICE 'PASS retention: unpaid entitlement, paid history, atomic rollback, empty entity deletion, shared Auth, idempotency, ACL';
END $$;
ROLLBACK;
