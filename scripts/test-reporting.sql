\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database()<>'okesih_reporting_test' THEN RAISE EXCEPTION 'Use disposable okesih_reporting_test database only'; END IF; END $$;
BEGIN;
INSERT INTO marketing_partners(id,full_name,referral_code,commission_paid) VALUES ('10000000-0000-0000-0000-000000000001','Reporting Partner','REPORT',50);
INSERT INTO warkops(id,nama,slug,owner_name,province,city_regency,is_active,marketing_agent_id,marketing_commission_per_receipt,created_at) VALUES
('20000000-0000-0000-0000-000000000001','Reporting Cafe','report-cafe','Owner Alpha','Sulawesi Selatan','Makassar',true,'10000000-0000-0000-0000-000000000001',15,now()),
('20000000-0000-0000-0000-000000000002','Other Cafe','other-cafe','Owner Beta','Bali','Denpasar',true,NULL,0,now());
INSERT INTO warkops(id,nama,slug,owner_name,province,is_active,created_at)
SELECT md5('tenant-'||g)::uuid,'Tenant '||g,'tenant-'||g,'Owner '||g,'Bali',true,now() FROM generate_series(1,70) g;
INSERT INTO transactions(id,warkop_id,table_number,nomor_antrean,total_harga,payment_method,status_pesanan,created_at,updated_at)
SELECT md5('receipt-'||g)::uuid,'20000000-0000-0000-0000-000000000001','01',g,100,
CASE WHEN g%2=0 THEN 'CASH' ELSE 'QRIS' END,'DONE',date_trunc('day',now() AT TIME ZONE 'Asia/Makassar') AT TIME ZONE 'Asia/Makassar',now()
FROM generate_series(1,1205) g;
INSERT INTO transaction_items(id,transaction_id,nama_menu,harga_satuan,qty)
SELECT md5('item-'||g)::uuid,md5('receipt-'||g)::uuid,CASE WHEN g=1205 THEN 'Rare needle coffee' ELSE 'Kopi' END,100,1 FROM generate_series(1,1205) g;
INSERT INTO transactions(id,warkop_id,table_number,nomor_antrean,total_harga,payment_method,status_pesanan,created_at,updated_at) VALUES
(md5('void')::uuid,'20000000-0000-0000-0000-000000000001','01',1206,999,'CASH','VOID',now(),now()),
(md5('rejected')::uuid,'20000000-0000-0000-0000-000000000001','01',1207,999,'QRIS','REJECTED',now(),now()),
(md5('other')::uuid,'20000000-0000-0000-0000-000000000002','02',1,500000,'CASH','DONE',now(),now()),
(md5('tomorrow')::uuid,'20000000-0000-0000-0000-000000000001','01',1208,900,'CASH','DONE',(date_trunc('day',now() AT TIME ZONE 'Asia/Makassar')+interval '1 day') AT TIME ZONE 'Asia/Makassar',now());
INSERT INTO saas_billings(id,warkop_id,tanggal,tagihan_pokok,status_bayar,created_at) VALUES
(md5('paid')::uuid,'20000000-0000-0000-0000-000000000001',current_date,1000,'PAID',now()),
(md5('unpaid')::uuid,'20000000-0000-0000-0000-000000000001',current_date-1,200,'UNPAID',now()-interval '1 day');
INSERT INTO marketing_commission_withdrawals(id,marketing_partner_id,amount,status,created_at)
SELECT md5('withdrawal-'||g)::uuid,'10000000-0000-0000-0000-000000000001',1,'PENDING',now()-g*interval '1 second' FROM generate_series(1,30) g;
DO $$
DECLARE
  tenant uuid := '20000000-0000-0000-0000-000000000001';
  start_at timestamptz := date_trunc('day',now() AT TIME ZONE 'Asia/Makassar') AT TIME ZONE 'Asia/Makassar';
  result jsonb; first_page jsonb; second_page jsonb; expected numeric; period text;
BEGIN
  result := report_transaction_summary(tenant,start_at,start_at+interval '1 day');
  ASSERT (result->>'receiptCount')::int=1205, 'summary truncated or included invalid statuses';
  ASSERT (result->>'transactionCount')::int=1207, 'all-status count incorrect';
  ASSERT (result->>'total')::numeric=120500, 'tenant isolation or midnight boundary failed';
  ASSERT (result->>'cash')::numeric=60200 AND (result->>'qris')::numeric=60300, 'payment totals incorrect';
  result := report_transaction_summary('ffffffff-ffff-ffff-ffff-ffffffffffff',NULL,NULL);
  ASSERT (result->>'total')::numeric=0 AND (result->>'receiptCount')::int=0, 'empty tenant must return zeros';
  FOREACH period IN ARRAY ARRAY['day','week','month','year'] LOOP
    result := report_owner_revenue(tenant,period);
    SELECT coalesce(sum(total_harga),0) INTO expected FROM transactions WHERE warkop_id=tenant AND status_pesanan NOT IN ('VOID','REJECTED')
      AND created_at>=date_trunc(period,now() AT TIME ZONE 'Asia/Makassar') AT TIME ZONE 'Asia/Makassar'
      AND created_at<(date_trunc(period,now() AT TIME ZONE 'Asia/Makassar')+('1 '||period)::interval) AT TIME ZONE 'Asia/Makassar';
    ASSERT (result->>'total')::numeric=expected, 'revenue mismatch '||period;
    ASSERT (SELECT sum((value->>'value')::numeric) FROM jsonb_array_elements(result->'series'))=expected, 'bucket sum mismatch';
  END LOOP;
  ASSERT jsonb_array_length(report_owner_revenue(tenant,'day')->'series')=8, 'day buckets';
  ASSERT jsonb_array_length(report_owner_revenue(tenant,'week')->'series')=7, 'week buckets';
  ASSERT jsonb_array_length(report_owner_revenue(tenant,'year')->'series')=12, 'year buckets';
  first_page := report_device_history(tenant,start_at,start_at+interval '1 day','ALL','ALL','',1,25);
  second_page := report_device_history(tenant,start_at,start_at+interval '1 day','ALL','ALL','',2,25);
  ASSERT (first_page#>>'{pagination,total}')::int=1207, 'history truncated';
  ASSERT jsonb_array_length(first_page->'orders')=25 AND jsonb_array_length(second_page->'orders')=25, 'page size';
  ASSERT NOT EXISTS(SELECT 1 FROM jsonb_array_elements(first_page->'orders') a JOIN jsonb_array_elements(second_page->'orders') b ON a->>'id'=b->>'id'), 'timestamp ties duplicate pages';
  result := report_device_history(tenant,start_at,start_at+interval '1 day','DONE','QRIS','Rare needle',1,25);
  ASSERT (result#>>'{pagination,total}')::int=1 AND result#>>'{orders,0,id}'=md5('receipt-1205')::uuid::text, 'search must include records beyond 200';
  ASSERT jsonb_array_length(result#>'{orders,0,items}')=1, 'item details';
  result := report_device_history(tenant,start_at,start_at+interval '1 day','DONE','CASH','Rare needle',1,25);
  ASSERT (result#>>'{pagination,total}')::int=0, 'combined filters';
  result := report_device_history(tenant,NULL,NULL,'ALL','ALL','%',1,25);
  ASSERT (result#>>'{pagination,total}')::int=0, 'literal wildcard search';
  result := report_superadmin_tenants(1,25,'Reporting','Sulawesi Selatan');
  ASSERT (result#>>'{pagination,total}')::int=1 AND (result->>'totalTenants')::int=72, 'global vs page count';
  ASSERT (result#>>'{data,0,todayTransactions}')::int=1205, 'tenant transaction aggregation';
  result := report_superadmin_tenants(2,25,'','');
  ASSERT jsonb_array_length(result->'data')=25 AND (result#>>'{pagination,totalPages}')::int=3, 'tenant pagination';
  result := report_marketing_dashboard('10000000-0000-0000-0000-000000000001');
  ASSERT (result#>>'{totals,receipts}')::int=1206, 'marketing all-time valid transactions';
  ASSERT (result#>>'{totals,commission}')::numeric=18090, 'commission mismatch';
  ASSERT (result#>>'{totals,pendingWithdrawal}')::numeric=30 AND jsonb_array_length(result->'withdrawals')=25, 'pending balance must not use history limit';
  ASSERT (result#>>'{totals,availableCommission}')::numeric=18010, 'available balance';
  ASSERT (result#>>'{tenants,0,unpaidAmount}')::numeric=200, 'paid billing included in debt';
  ASSERT result#>>'{tenants,0,paymentStatus}'='UNPAID', 'older unpaid billing status';
  ASSERT NOT has_function_privilege('anon','public.report_device_history(uuid,timestamptz,timestamptz,text,text,text,integer,integer)','EXECUTE'), 'anon grant';
  ASSERT NOT has_function_privilege('authenticated','public.report_marketing_dashboard(uuid)','EXECUTE'), 'authenticated grant';
  ASSERT has_function_privilege('service_role','public.report_owner_revenue(uuid,text)','EXECUTE'), 'server grant';
  RAISE NOTICE 'PASS: aggregates >1000, history >200, stable pages, filters, WITA, isolation, debt, withdrawals >25, grants';
END $$;
ROLLBACK;
