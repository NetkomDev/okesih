\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.marketing_partners(full_name,phone,city_area,referral_code,bank_account_number,bank_account_name,status)
SELECT 'Directory QA '||lpad(n::text,4,'0'),'6281234567890','Kota QA','DIR-'||gen_random_uuid(),'0012345678','QA',
 CASE n%3 WHEN 0 THEN 'ACTIVE' WHEN 1 THEN 'PENDING' ELSE 'INACTIVE' END FROM generate_series(1,1205) n;
DO $$
DECLARE first_page jsonb; second_page jsonb; result jsonb;
BEGIN
 first_page:=public.report_superadmin_marketing_page(1,10,'Directory QA','ALL');
 second_page:=public.report_superadmin_marketing_page(2,10,'Directory QA','ALL');
 IF jsonb_array_length(first_page->'data')<>10 OR (first_page->'pagination'->>'total')::int<>1205 OR (first_page->'pagination'->>'totalPages')::int<>121 THEN RAISE EXCEPTION 'Incorrect pagination'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(first_page->'data') a JOIN jsonb_array_elements(second_page->'data') b ON a->>'id'=b->>'id') THEN RAISE EXCEPTION 'Pages overlap'; END IF;
 IF first_page IS DISTINCT FROM public.report_superadmin_marketing_page(1,10,'Directory QA','ALL') THEN RAISE EXCEPTION 'Unstable ordering'; END IF;
 result:=public.report_superadmin_marketing_page(999,10,'Directory QA','ALL');
 IF (result->'pagination'->>'page')::int<>121 OR jsonb_array_length(result->'data')<>5 THEN RAISE EXCEPTION 'Last page clamp incorrect'; END IF;
 result:=public.report_superadmin_marketing_page(1,10,'Directory QA','ACTIVE');
 IF (result->'pagination'->>'total')::int<>401 OR (result->'counts'->>'ALL')::int<>1205 OR (result->'counts'->>'PENDING')::int<>402 THEN RAISE EXCEPTION 'Counts are not dataset-wide'; END IF;
 IF EXISTS(SELECT FROM jsonb_array_elements(result->'data') x WHERE x->>'status'<>'ACTIVE') THEN RAISE EXCEPTION 'Status filter incorrect'; END IF;
 result:=public.report_superadmin_marketing_page(1,10,'Directory QA 1205','ALL');
 IF jsonb_array_length(result->'data')<>1 THEN RAISE EXCEPTION 'Search did not reach the entire dataset'; END IF;
 result:=public.report_superadmin_marketing_page(4,10,'no-match-directory-qa','ALL');
 IF jsonb_array_length(result->'data')<>0 OR (result->'pagination'->>'page')::int<>1 THEN RAISE EXCEPTION 'Empty state incorrect'; END IF;
 IF has_function_privilege('anon','public.report_superadmin_marketing_page(integer,integer,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Private directory public'; END IF;
 RAISE NOTICE 'Directory tests passed: 1205 records, stable pages, filters, global counts, distant search, empty state, access.';
END $$;
ROLLBACK;
