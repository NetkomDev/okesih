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
 w uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); child uuid:=gen_random_uuid(); menu uuid:=gen_random_uuid();
 bill uuid; result jsonb; job uuid; r record; remains bigint;
BEGIN
 INSERT INTO auth.users(id,raw_app_meta_data) VALUES(admin_id,'{"role":"SUPERADMIN"}'),(owner_id,'{"role":"OWNER"}'),(shared,'{"role":"OWNER"}'),(p,'{"role":"MARKETING"}');
 INSERT INTO public.marketing_partners(id,user_id,full_name,phone,city_area,referral_code,bank_account_number,bank_account_name,status,membership_level)
 VALUES(p,p,'Delete test','0','QA','QA-'||p,'0','QA','ACTIVE','COORDINATOR');
 INSERT INTO public.marketing_partners(id,full_name,phone,city_area,referral_code,bank_account_number,bank_account_name,status,upline_id)
 VALUES(child,'Child test','0','QA','QA-'||child,'0','QA','ACTIVE',p);
 INSERT INTO public.warkops(id,nama,slug,marketing_agent_id) VALUES(w,'Delete test','qa-'||w,p),(other,'Keep test','qa-'||other,p);
 INSERT INTO public.warkop_members(warkop_id,user_id,username,role) VALUES(w,owner_id,'owner','OWNER'),(w,shared,'shared','OWNER'),(other,shared,'shared','OWNER');
 INSERT INTO public.menus(id,warkop_id,nama,harga,kategori,image_url) VALUES(menu,w,'Coffee',100,'Drink','https://project.supabase.co/storage/v1/object/public/menu-images/'||w||'/photo.webp');
 INSERT INTO public.warkop_tables(warkop_id,label) VALUES(w,'1');
 INSERT INTO public.device_installations(warkop_id,device_type,device_name,token_hash,expires_at) VALUES(w,'POS','Test',repeat('f',64),now()+interval '1 day');
 INSERT INTO public.saas_billings(warkop_id,tanggal,total_transactions,tagihan_pokok,kode_unik,total_tagihan,status_bayar) VALUES(w,current_date,10,500,101,601,'PAID') RETURNING id INTO bill;
 INSERT INTO public.transactions(warkop_id,status_pesanan,total_harga,payment_method,nomor_antrean) VALUES(w,'DONE',100,'CASH',1);
 INSERT INTO public.tenant_applications(marketing_partner_id,warkop_id,business_name,owner_name,owner_phone,address,province,city_regency) VALUES(p,w,'Delete','Owner','0','QA','QA','QA');
 BEGIN PERFORM public.delete_entity_permanently('TENANT',w,owner_id); RAISE EXCEPTION 'Unauthorized deletion' USING ERRCODE='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('okesih.test_delete_fail','true',true);
 BEGIN PERFORM public.delete_entity_permanently('TENANT',w,admin_id); RAISE EXCEPTION 'Expected rollback' USING ERRCODE='XX000'; EXCEPTION WHEN raise_exception THEN NULL; END;
 IF NOT EXISTS(SELECT FROM public.saas_billings WHERE id=bill) OR EXISTS(SELECT FROM public.entity_deletion_jobs WHERE entity_id=w) THEN RAISE EXCEPTION 'Deletion partially committed'; END IF;
 PERFORM set_config('okesih.test_delete_fail','false',true);
 UPDATE public.warkops SET archived_at=now(),is_active=false WHERE id=w;
 result:=public.delete_entity_permanently('TENANT',w,admin_id); job:=(result->>'jobId')::uuid;
 IF EXISTS(SELECT FROM public.warkops WHERE id=w) THEN RAISE EXCEPTION 'Tenant still exists'; END IF;
 FOR r IN SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='warkop_id' LOOP
   EXECUTE format('SELECT count(*) FROM public.%I WHERE warkop_id=$1',r.table_name) INTO remains USING w;
   IF remains<>0 THEN RAISE EXCEPTION 'Tenant residual in %',r.table_name; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT FROM public.warkops WHERE id=other AND is_active) THEN RAISE EXCEPTION 'Other tenant removed'; END IF;
 IF (SELECT user_ids FROM public.entity_deletion_jobs WHERE id=job)<>ARRAY[owner_id] THEN RAISE EXCEPTION 'Incorrect Auth cleanup selection'; END IF;
 IF (public.delete_entity_permanently('TENANT',w,admin_id)->>'jobId')::uuid<>job THEN RAISE EXCEPTION 'Retry not idempotent'; END IF;
 IF EXISTS(SELECT FROM jsonb_array_elements(public.report_superadmin_tenants(1,100,'','')->'data') x WHERE x->>'id'=w::text) THEN RAISE EXCEPTION 'Deleted tenant in report'; END IF;
 -- Permanent partner deletion must allow paid financial history, preserve other tenants and recruits.
 INSERT INTO public.saas_billings(warkop_id,tanggal,total_transactions,tagihan_pokok,kode_unik,total_tagihan,status_bayar) VALUES(other,current_date,10,500,102,602,'PAID');
 INSERT INTO public.marketing_commission_withdrawals(marketing_partner_id,amount,bank_name,bank_account_number,bank_account_name,status) VALUES(p,10,'Bank','0','Test','PAID');
 UPDATE public.marketing_partners SET commission_paid=10 WHERE id=p;
 result:=public.delete_entity_permanently('MARKETING',p,admin_id);
 IF EXISTS(SELECT FROM public.marketing_partners WHERE id=p) OR EXISTS(SELECT FROM public.marketing_commission_mutations WHERE partner_id=p OR source_partner_id=p) OR EXISTS(SELECT FROM public.marketing_commission_withdrawals WHERE marketing_partner_id=p) THEN RAISE EXCEPTION 'Partner residual'; END IF;
 IF NOT EXISTS(SELECT FROM public.warkops WHERE id=other AND is_active AND marketing_agent_id IS NULL) OR NOT EXISTS(SELECT FROM public.marketing_partners WHERE id=child AND upline_id IS NULL) THEN RAISE EXCEPTION 'Independent tenant/recruit affected'; END IF;
 IF (result->>'detachedTenantsCount')::int<>1 THEN RAISE EXCEPTION 'Incorrect detached count'; END IF;
 IF has_function_privilege('authenticated','public.delete_entity_permanently(text,uuid,uuid)','EXECUTE') OR has_table_privilege('anon','public.entity_deletion_jobs','SELECT') THEN RAISE EXCEPTION 'Public deletion privilege'; END IF;
 RAISE NOTICE 'PASS permanent deletion: atomic rollback, paid history, tenant cascades, shared Auth, idempotency, directory, recruits, ACL';
END $$;
ROLLBACK;
