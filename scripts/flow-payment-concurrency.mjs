import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const db=process.env.TEST_DATABASE_URL;
if(db!=='postgresql:///okesih_remediation_test' || !process.env.PGHOST?.startsWith('/tmp/okesih-flow-pg.')) throw Error('Use only the disposable audit PostgreSQL socket and database');
const ids=Object.fromEntries(['tenant','member','device','shift','order'].map(k=>[k,randomUUID()]));
function sql(query){return new Promise((resolve,reject)=>{const p=spawn('psql',[db,'-X','-At','-v','ON_ERROR_STOP=1','-c',query]);let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('error',reject);p.on('close',code=>resolve({code,out,err}));});}
const {tenant,member,device,shift,order}=ids;
let result=await sql(`INSERT INTO public.warkops(id,nama,slug) VALUES('${tenant}','Concurrency QA','concurrency-${tenant}');
INSERT INTO public.warkop_members(id,warkop_id,username,role) VALUES('${member}','${tenant}','QA','KASIR');
INSERT INTO public.device_installations(id,warkop_id,device_type,device_name,token_hash,expires_at) VALUES('${device}','${tenant}','POS','QA','${device}',now()+interval '1 day');
INSERT INTO public.shifts(id,warkop_id,opened_by,device_id) VALUES('${shift}','${tenant}','${member}','${device}');
INSERT INTO public.transactions(id,warkop_id,shift_id,total_harga,payment_method,status_pesanan,nomor_antrean,payment_status) VALUES('${order}','${tenant}','${shift}',1000,'CASH','READY',1,'PENDING');`);
assert.equal(result.code,0,result.err);
try{
 const calls=await Promise.all([1,2].map(n=>sql(`SET statement_timeout='5s'; SELECT public.record_order_payment('${tenant}','${device}','${member}', '${JSON.stringify({orderId:order,shiftId:shift,idempotencyKey:randomUUID(),cashReceived:1000})}'::jsonb,'hash-${n}');`)));
 assert.equal(calls.filter(r=>r.code===0).length,1,JSON.stringify(calls));
 assert.ok(calls.some(r=>r.err.includes('Pembayaran sudah dicatat')),JSON.stringify(calls));
 result=await sql(`SELECT public.report_shift_cash('${tenant}','${shift}'),(SELECT count(*) FROM public.audit_logs WHERE target_id='${order}' AND action='ORDER_PAYMENT_RECORDED');`);
 assert.deepEqual(result.out.trim().split('|').map(Number),[1000,1]);
 console.log('PASS concurrency: two independent payments race; exactly one succeeds and cash/audit counted once');
}finally{
 const cleanup=await sql(`DELETE FROM public.transactions WHERE id='${order}'; DELETE FROM public.warkops WHERE id='${tenant}';`);
 assert.equal(cleanup.code,0,cleanup.err);
}
