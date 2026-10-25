import test from 'node:test';
import assert from 'node:assert/strict';
import { marketingProfileUpdateSchema, marketingProfile } from '../src/lib/marketing-profile.ts';
import { isApiAllowedOnSurface } from '../src/lib/app-origins.ts';

test('profile endpoint is available only on marketing surface', () => {
  for (const surface of ['PUBLIC', 'SUPERADMIN', 'OWNER', 'POS', 'KDS']) assert.equal(isApiAllowedOnSurface('/api/marketing/profile', surface), false);
  assert.equal(isApiAllowedOnSurface('/api/marketing/profile', 'MARKETING'), true);
});
const valid = { fullName: 'Nama Mitra', phone: '081234567890', cityArea: 'Makassar', bankName: 'BCA', bankAccountNumber: '0012345678', bankAccountName: 'Nama Mitra' };
test('profile validation normalizes phone while preserving account leading zeros', () => {
  const data = marketingProfileUpdateSchema.parse(valid);
  assert.equal(data.phone, '6281234567890');
  assert.equal(data.bankAccountNumber, '0012345678');
  for (const patch of [{phone:'123'}, {fullName:' '}, {cityArea:''}, {bankAccountNumber:'12abc'}, {bankAccountName:''}]) assert.equal(marketingProfileUpdateSchema.safeParse({...valid,...patch}).success,false);
});
test('reject mixed and privileged updates; keep password exactly as entered', () => {
  for (const input of [{...valid,username:'another'}, {...valid,status:'ACTIVE'}, {}, {username:'valid_name',newPassword:'short'}, {username:'bad name'}]) assert.equal(marketingProfileUpdateSchema.safeParse(input).success, false);
  const password = '  password value  ';
  assert.equal(marketingProfileUpdateSchema.parse({username:'Valid_Name',newPassword:password}).newPassword,password);
});
test('profile uses authoritative auth username, real tenant count and zero commission', () => {
  const data = marketingProfile({ id:'partner',user_id:'user',username:'stale',commission_rate:'0', total_tenants_acquired:99, status:'ACTIVE', bank_account_number:'00123' }, 3, 'actual@okesih.local');
  assert.equal(data.username,'actual'); assert.equal(data.totalTenants,3); assert.equal(data.commissionRate,0); assert.equal(data.bankAccountNumber,'00123');
});

import fs from 'node:fs';
import ts from 'typescript';
import { NextResponse } from 'next/server';
const source = ts.transpileModule(fs.readFileSync(new URL('../src/app/api/marketing/profile/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture({ authError = false, dbError = false } = {}) {
  const calls=[];
  let row={id:'partner',user_id:'user',username:'oldname',full_name:'Mitra',phone:'6281234567890',city_area:'Makassar',referral_code:'MKT-1',bank_name:'BCA',bank_account_number:'00123',bank_account_name:'Mitra',commission_rate:0,status:'ACTIVE',updated_at:'before'};
  const admin={
    from(table) {
      let operation='read', values;
      const q={select(){return q;},eq(){return q;},update(v){operation='update';values=v;return q;},insert(v){operation='insert';values=v;return q;},maybeSingle(){return q;},then(resolve,reject){
        calls.push({table,operation,values});
        if(table==='warkops') return Promise.resolve({count:3,error:null}).then(resolve,reject);
        if(operation==='update') {
          if(dbError) return Promise.resolve({data:null,error:{code:'23505'}}).then(resolve,reject);
          row={...row,...values,updated_at:'after'};
        }
        return Promise.resolve({data:{...row},error:null}).then(resolve,reject);
      }};return q;
    },
    auth:{admin:{async updateUserById(id,values){calls.push({auth:values});return {error:authError?{message:'duplicate'}:null};}}},
  };
  class ApiError extends Error {constructor(message,status){super(message);this.status=status;}}
  const modules={
    'next/server':{NextResponse},
    '@/lib/supabase/server':{createServerSupabaseClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'user',email:'oldname@okesih.local',app_metadata:{role:'MARKETING'}}}})}})},
    '@/lib/supabase/admin':{createAdminClient:()=>admin},
    '@/lib/device-auth':{DeviceApiError:ApiError,assertSameOrigin(){}},
    '@/lib/marketing-profile':{marketingProfile,marketingProfileUpdateSchema},
  };
  const exports={}; new Function('require','exports',source)(name=>modules[name],exports);
  return {calls,route:exports,row:()=>row};
}
const patch = body => new Request('https://sales.okesih.com/api/marketing/profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('GET returns database values and disables caching',async()=>{
  const {route}=fixture(); const r=await route.GET();
  assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');
  const {profile}=await r.json();assert.equal(profile.totalTenants,3);assert.equal(profile.commissionRate,0);
});
test('invalid combined credential request never mutates either database',async()=>{
  const {route,calls}=fixture();const r=await route.PATCH(patch({username:'newname',newPassword:'bad'}));
  assert.equal(r.status,400);assert.equal(calls.some(c=>c.auth||c.operation==='update'),false);
});
test('database failure prevents auth mutation',async()=>{
  const {route,calls}=fixture({dbError:true}); const r=await route.PATCH(patch({username:'newname',newPassword:'valid password'}));
  assert.equal(r.status,409);assert.equal(calls.some(c=>c.auth),false);
});
test('auth failure restores the previous database username',async()=>{
  const {route,row}=fixture({authError:true});const r=await route.PATCH(patch({username:'newname',newPassword:'valid password'}));
  assert.equal(r.status,400);assert.equal(row().username,'oldname');
});
test('credential save uses one auth update and profile save returns normalized data',async()=>{
  const {route,calls}=fixture();const r=await route.PATCH(patch({username:'newname',newPassword:' valid password '}));
  assert.equal(r.status,200);assert.deepEqual(calls.filter(c=>c.auth).map(c=>c.auth),[{email:'newname@okesih.local',email_confirm:true,password:' valid password '}]);
  const saved=await route.PATCH(patch(valid));assert.equal(saved.status,200);assert.equal((await saved.json()).profile.phone,'6281234567890');
});

test('coordinator photo endpoint is available only on the Marketing PWA', () => {
  const path = '/api/marketing/profile/photo';
  assert.equal(isApiAllowedOnSurface(path, 'MARKETING'), true);
  for (const surface of ['PUBLIC', 'SUPERADMIN', 'OWNER', 'POS', 'KDS']) {
    assert.equal(isApiAllowedOnSurface(path, surface), false);
  }
  assert.equal(isApiAllowedOnSurface('/api/marketing/profile/photo-other', 'MARKETING'), false);
});
