import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const url=process.env.TEST_DATABASE_URL;
if(!url || !/^postgres(?:ql)?:\/\/[^/]*?(?:127\.0\.0\.1|localhost):\d+\/okesih_(?:remediation|kormit)_test$/.test(url))throw Error('Use only a disposable localhost okesih_remediation_test or okesih_kormit_test database.');
function sql(query){return new Promise((resolve,reject)=>{const p=spawn('psql',[url,'-X','-At','-v','ON_ERROR_STOP=1','-c',query]);let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('error',reject);p.on('close',code=>resolve({code,out,err}));});}
const partner=randomUUID(),tenant=randomUUID(),admin=randomUUID();
let result=await sql(`BEGIN; INSERT INTO auth.users(id,raw_app_meta_data) VALUES('${admin}','{"role":"SUPERADMIN"}'); INSERT INTO public.marketing_partners(id,full_name,phone,city_area,referral_code,bank_account_number,bank_account_name,status) VALUES('${partner}','Concurrency test','628111111111','QA','QA-${partner}','0012345','QA','ACTIVE'); INSERT INTO public.warkops(id,nama,slug,marketing_agent_id) VALUES('${tenant}','Concurrency test','qa-${tenant}','${partner}'); UPDATE public.platform_settings SET default_marketing_commission=20,coordinator_commission_per_receipt=5,saas_fee_per_receipt=50 WHERE id='global'; INSERT INTO public.saas_billings(warkop_id,tanggal,total_transactions,tagihan_pokok,kode_unik,total_tagihan,status_bayar) VALUES('${tenant}',current_date,100,5000,100,5100,'PAID'); COMMIT;`);
assert.equal(result.code,0,result.err);
const requests=await Promise.all([sql(`BEGIN; SELECT id FROM public.marketing_partners WHERE id='${partner}' FOR UPDATE; SELECT pg_sleep(0.25); SELECT public.request_marketing_commission_withdrawal('${partner}',1500); COMMIT;`),sql(`SELECT public.request_marketing_commission_withdrawal('${partner}',1500);`)]);
assert.equal(requests.filter(x=>x.code===0).length,1,JSON.stringify(requests));
result=await sql(`SELECT id FROM public.marketing_commission_withdrawals WHERE marketing_partner_id='${partner}' AND status='PENDING';`);const withdrawal=result.out.trim();assert.match(withdrawal,/^[a-f0-9-]{36}$/);
const approvals=await Promise.all([sql(`SELECT public.review_marketing_commission_withdrawal('${withdrawal}','PAID','${admin}');`),sql(`SELECT public.review_marketing_commission_withdrawal('${withdrawal}','PAID','${admin}');`)]);
assert.equal(approvals.filter(x=>x.code===0).length,1,JSON.stringify(approvals));
result=await sql(`SELECT commission_paid FROM public.marketing_partners WHERE id='${partner}';`);assert.equal(Number(result.out.trim()),1500);
console.log('Concurrent requests: one reservation only; concurrent approval: one payout only. Disposable fixtures retained.');
