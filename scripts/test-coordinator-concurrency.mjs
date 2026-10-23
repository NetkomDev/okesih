import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const url=process.env.TEST_DATABASE_URL;
if(!url || !/^postgres(?:ql)?:\/\/[^/]*?(?:127\.0\.0\.1|localhost):\d+\/okesih_(?:remediation|kormit)_test$/.test(url))throw Error('Use only a disposable localhost okesih_remediation_test or okesih_kormit_test database.');
function sql(query){return new Promise((resolve,reject)=>{const p=spawn('psql',[url,'-X','-At','-v','ON_ERROR_STOP=1','-c',query]);let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('error',reject);p.on('close',code=>resolve({code,out,err}));});}
const a=randomUUID(),b=randomUUID();
let result=await sql(`INSERT INTO auth.users(id) VALUES('${a}'),('${b}'); INSERT INTO public.marketing_partners(id,user_id,full_name,phone,city_area,referral_code,bank_account_number,bank_account_name,status,membership_level) VALUES('${a}','${a}','Cycle A','628111111111','QA','QA-${a}','0012345','QA','ACTIVE','COORDINATOR'),('${b}','${b}','Cycle B','628111111112','QA','QA-${b}','0012345','QA','ACTIVE','COORDINATOR');`);
assert.equal(result.code,0,result.err);
const links=await Promise.all([sql(`BEGIN; UPDATE public.marketing_partners SET upline_id='${b}' WHERE id='${a}'; SELECT pg_sleep(0.25); COMMIT;`),sql(`UPDATE public.marketing_partners SET upline_id='${a}' WHERE id='${b}';`)]);
assert.equal(links.filter(x=>x.code===0).length,1,JSON.stringify(links));
result=await sql(`UPDATE public.marketing_partners SET coordinator_commission_override=NULL WHERE id IN('${a}','${b}'); UPDATE public.platform_settings SET default_marketing_commission=20,coordinator_commission_per_receipt=5,saas_fee_per_receipt=50 WHERE id='global';`);assert.equal(result.code,0,result.err);
const rates=await Promise.all([sql(`BEGIN; UPDATE public.marketing_partners SET coordinator_commission_override=15 WHERE id='${a}'; SELECT pg_sleep(0.25); COMMIT;`),sql(`UPDATE public.platform_settings SET default_marketing_commission=40 WHERE id='global';`)]);
assert.equal(rates.filter(x=>x.code===0).length,1,JSON.stringify(rates));
result=await sql(`SELECT count(*) FROM public.marketing_partners p CROSS JOIN public.platform_settings s WHERE s.id='global' AND p.coordinator_commission_override+s.default_marketing_commission>s.saas_fee_per_receipt;`);assert.equal(Number(result.out.trim()),0);
await sql(`UPDATE public.marketing_partners SET upline_id=NULL,coordinator_commission_override=NULL WHERE id IN('${a}','${b}'); DELETE FROM public.marketing_partners WHERE id IN('${a}','${b}'); DELETE FROM auth.users WHERE id IN('${a}','${b}'); UPDATE public.platform_settings SET default_marketing_commission=20 WHERE id='global';`);
console.log('Concurrent cycle creation rejected; concurrent global/custom rates preserve fee ceiling.');
