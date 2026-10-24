import { z } from "zod";
import { paginationSchema } from "../src/lib/reporting.ts";
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { NextResponse } from 'next/server';
import { recruitmentSchema } from '../src/lib/marketing-recruitment.ts';
import * as whatsapp from '../src/lib/whatsapp.ts';
import * as profileModule from '../src/lib/marketing-profile.ts';
import * as affiliateModule from '../src/lib/affiliate.ts';
import { randomDigits } from '../src/lib/generated-credentials.ts';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY='test-service-key';
class DeviceApiError extends Error { constructor(message,status) {super(message);this.status=status;} }
const id='19e09b4a-dd38-4afd-a413-ad608745941c';
const applicant={requestId:id,fullName:'Mitra Baru',phone:'081234567890',cityArea:'Makassar',bankName:'BRI',bankAccountNumber:'00123456',bankAccountName:'Mitra Baru'};
const request=(body,origin='https://www.okesih.com')=>new Request('https://www.okesih.com/api/marketing/network',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
function fixture({role='MARKETING',level='COORDINATOR',status='ACTIVE',rpcError=null,existing=null,upline=null,override=null}={}) {
 const calls=[];
 const partner={id:'coordinator-id',full_name:'Koordinator',phone:'6289999999999',referral_code:'MKT-MAK-123',membership_level:level,status,coordinator_commission_override:override,upline_id:upline,user_id:'auth',notes_admin:'[LEVEL:COORDINATOR]'};
 const db={from(table){let op='select',value,filters={};const q={select(){return q},eq(k,v){filters[k]=v;return q},is(){return q},insert(v){op='insert';value=v;return q},update(v){op='update';value=v;return q},async maybeSingle(){return run()},async single(){return run()},then(a,b){return run().then(a,b)}};
 async function run(){calls.push({table,op,value,filters});
 if(table==='platform_settings')return {data:{default_marketing_commission:20,coordinator_commission_per_receipt:5,saas_fee_per_receipt:50},error:null};
 if(table==='marketing_partners'){
  if(op==='insert'){existing={...value};return {data:existing,error:null};}
  if(op==='update'){existing={...existing,...value};return {data:existing,error:null};}
  return {data:filters.user_id ? partner : existing,error:null};
 }
 return {data:null,error:null};}return q;},async rpc(name,args){calls.push({rpc:name,args});return {data:rpcError?null:{members:[],totalCommission:0},error:rpcError}},auth:{admin:{deleteUser:async()=>({error:null})}}};
 function route(file){const source=ts.transpileModule(fs.readFileSync(new URL('../src/app/api/'+file+'/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const modules={'@/lib/marketing-profile':profileModule,'@/lib/affiliate':affiliateModule,'zod': { z }, '@/lib/reporting': { paginationSchema }, 'next/server':{NextResponse},'@supabase/supabase-js':{createClient:()=>db},'@/lib/supabase/admin':{createAdminClient:()=>db},'@/lib/supabase/server':{createServerSupabaseClient:async()=>({auth:{getUser:async()=>({data:{user:role?{id:'auth',app_metadata:{role}}:null}})}})},'@/lib/device-auth':{DeviceApiError,assertSameOrigin(req){if(req.headers.get('origin')!==new URL(req.url).origin)throw new DeviceApiError('Lintas situs',403)}},'@/lib/marketing-recruitment':{recruitmentSchema},'@/lib/generated-credentials':{randomDigits},'@/lib/whatsapp':whatsapp,'@/lib/app-origins':{APP_ORIGINS:{PUBLIC:'https://www.okesih.com'}},'@/lib/create-account':{createAccount:async(_db,username)=>({username,data:{user:{id:'new-auth'}},error:null})}};
 const exports={};new Function('require','exports',source)(name=>{if(!modules[name])throw Error(name);return modules[name]},exports);return exports; }
 return {route,calls};
}
test('KorMit rejects nonmarketing, inactive and legacy notes-only coordinator identities',async()=>{
 for(const config of [{role:null},{role:'OWNER'},{level:'MITRA'},{status:'INACTIVE'}]){
 const f=fixture(config);const response=await f.route('marketing/network').POST(request(applicant));assert.ok([401,403].includes(response.status));assert.equal(f.calls.some(c=>c.op==='insert'),false);}
});
test('KorMit validates phone, bank account and origin before insert',async()=>{
 const f=fixture();const api=f.route('marketing/network');
 for(const fields of [{phone:'abc'},{bankAccountNumber:'123abc'},{requestId:'bad'}])assert.equal((await api.POST(request({...applicant,...fields}))).status,400);
 assert.equal((await api.POST(request(applicant,'https://evil.test'))).status,403);
 assert.equal(f.calls.some(c=>c.op==='insert'),false);
});
test('KorMit saves pending recruit under session parent; retries preserve the same application and keep credentials private',async()=>{
 const f=fixture(),api=f.route('marketing/network');
 const response=await api.POST(request({...applicant,uplineId:'attacker',status:'ACTIVE',password:'123456'}));assert.equal(response.status,200);
 const saved=f.calls.find(c=>c.op==='insert').value;
 assert.equal(saved.upline_id,'coordinator-id');assert.equal(saved.status,'PENDING');assert.equal(saved.membership_level,'MITRA');assert.equal(saved.phone,'6281234567890');assert.equal(saved.bank_account_number,'00123456');assert.equal(saved.password,undefined);
 const body=await response.json();assert.equal(body.data.password,undefined);assert.equal(new URL(body.data.whatsappUrl).pathname,'/'+whatsapp.getSuperAdminWhatsAppNumber());
 assert.equal((await api.POST(request(applicant))).status,200);assert.equal(f.calls.filter(c=>c.op==='insert').length,1);
});
test('KorMit cannot reuse another coordinators registration UUID',async()=>{
 const f=fixture({existing:{id,upline_id:'other'}});assert.equal((await f.route('marketing/network').POST(request(applicant))).status,409);assert.equal(f.calls.some(c=>c.op==='insert'),false);
});
test('network report failure is visible; never returns a fabricated empty balance',async()=>{
 const f=fixture({rpcError:{code:'PGRST202'}});assert.equal((await f.route('marketing/network').GET()).status,503);
});
test('withdrawal RPC refusal never falls back to direct insertion',async()=>{
 for(const [code,status] of [['P0001',409],['P0002',403],['22023',400],['PGRST202',503]]){
 const f=fixture({rpcError:{code,message:'Rejected'}});const r=await f.route('marketing/withdrawals').POST(request({amount:200}));assert.equal(r.status,status);assert.equal(f.calls.some(c=>c.op==='insert'),false);}
});
test('Super Admin approval sends six-digit temporary credentials to the new recruit, never the coordinator',async()=>{
 const f=fixture({role:'SUPERADMIN',existing:{id,full_name:'Mitra Baru',phone:'6281234567890',status:'PENDING',user_id:null,referral_code:'MKT-MAK-456',membership_level:'MITRA',upline_id:'coordinator-id'}});
 const response=await f.route('superadmin/marketing').PATCH(request({id,status:'ACTIVE'}));assert.equal(response.status,200);
 const body=await response.json();const wa=new URL(body.whatsappUrl);assert.equal(wa.pathname,'/6281234567890');assert.match(wa.searchParams.get('text'),/marketing_\d{3}/);assert.match(wa.searchParams.get('text'),/^Password sementara: \d{6}$/m);
 assert.equal(body.data.upline_id,'coordinator-id');
});

test('Super Admin directory routes paginated search to SQL and preserves the legacy tenant selector',async()=>{
 const f=fixture({role:'SUPERADMIN'}), api=f.route('superadmin/marketing');
 let response=await api.GET(new Request('https://admin.okesih.com/api/superadmin/marketing?page=2&pageSize=10&search=Makassar&status=ACTIVE'));
 assert.equal(response.status,200);assert.deepEqual(f.calls.at(-1),{rpc:'report_superadmin_marketing_page',args:{p_page:2,p_page_size:10,p_search:'Makassar',p_status:'ACTIVE'}});
 response=await api.GET(new Request('https://admin.okesih.com/api/superadmin/marketing'));
 assert.equal(response.status,200);assert.equal(f.calls.at(-1).rpc,'report_superadmin_marketing');
 for(const query of ['page=0','page=1&pageSize=1000','page=1&status=ADMIN','page=NaN']){
   const before=f.calls.length;assert.equal((await api.GET(new Request('https://admin.okesih.com/api/superadmin/marketing?'+query))).status,400);assert.equal(f.calls.length,before);
 }
});


test('Coordinator with an upline can recruit; posted parent is ignored', async()=>{
 const f=fixture({upline:'ancestor'});const r=await f.route('marketing/network').POST(request({...applicant,uplineId:'ancestor'}));
 assert.equal(r.status,200);assert.equal(f.calls.find(c=>c.op==='insert').value.upline_id,'coordinator-id');
 assert.equal((await f.route('marketing/network').GET()).status,200);
});
test('Promotion preserves parent and saves null, zero or custom coordinator rate atomically',async()=>{
 for(const rate of [null,0,7]){
 const f=fixture({role:'SUPERADMIN',existing:{id,user_id:'auth',full_name:'Mitra B',phone:'6281234567890',status:'ACTIVE',membership_level:'MITRA',upline_id:'A'}});
 const response=await f.route('superadmin/marketing').PATCH(request({id,membershipLevel:'COORDINATOR',coordinatorCommissionOverride:rate}));assert.equal(response.status,200);
 const body=await response.json();assert.equal(body.data.upline_id,'A');assert.equal(body.data.coordinator_commission_override,rate);assert.equal(body.data.membership_level,'COORDINATOR');
 const wa=new URL(body.whatsappUrl);assert.equal(wa.pathname,'/6281234567890');assert.ok(wa.searchParams.get('text').includes('Rp '+(rate??5)+'/struk'));assert.match(wa.searchParams.get('text'),/Admin OKESIH/);
 }
});
test('Invalid or excessive coordinator bonuses fail before mutation',async()=>{
 for(const rate of [-1,1.5,31,'7',true]){
 const f=fixture({role:'SUPERADMIN',existing:{id,user_id:'auth',phone:'6281234567890',status:'ACTIVE',membership_level:'MITRA',upline_id:'A'}});
 assert.equal((await f.route('superadmin/marketing').PATCH(request({id,membershipLevel:'COORDINATOR',coordinatorCommissionOverride:rate}))).status,400);assert.equal(f.calls.some(c=>c.op==='update'),false);
 }
});

test('Marketing profile displays custom, zero and global coordinator rates',async()=>{
 for(const rate of [null,0,7]){
  const f=fixture({upline:'A',override:rate});const response=await f.route('marketing/profile').GET();assert.equal(response.status,200);assert.equal((await response.json()).profile.coordinatorCommissionRate,rate??5);
 }
});
test('Public referral lookup accepts a coordinator who has an upline',async()=>{
 const f=fixture({existing:{full_name:'B',referral_code:'MKT-B',status:'ACTIVE',user_id:'B-auth',membership_level:'COORDINATOR',upline_id:'A'}});
 const response=await f.route('marketing/referral').GET(new Request('https://www.okesih.com/api/marketing/referral?ref=MKT-B'));assert.equal(response.status,200);assert.equal((await response.json()).data.code,'MKT-B');
});
