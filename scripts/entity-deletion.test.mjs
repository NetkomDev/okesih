import test from 'node:test';
import assert from 'node:assert/strict';
import { permanentlyDeleteEntity, processEntityDeletionJobs } from '../src/lib/entity-deletion.ts';

function fixture({ failStorage = false, failAuth = false, shared = false } = {}) {
 const id='00000000-0000-4000-8000-000000000001';
 const files=new Set(Array.from({length:205},(_,i)=>`menu-images/${id}/${String(i).padStart(3,'0')}.webp`));
 files.add(`menu-images/${id}/nested/deeper/file.webp`); files.add('menu-images/other/keep.webp');
 let job={id:'job',entity_id:id,entity_type:'TENANT',user_ids:['owner'],objects:[],prefixes:[{bucket:'menu-images',path:`${id}/`}]};
 const calls=[]; const flags={failStorage,failAuth,shared};
 const db={
  rpc:async(name,args)=>{calls.push({name,args});return{data:{jobId:'job'}}},
  from(table){let op='select';const q={select:()=>q,order:()=>q,limit:()=>q,eq:()=>q,in:()=>q,update:()=>{op='update';return q},delete:()=>{op='delete';return q},then(resolve,reject){if(table==='entity_deletion_jobs'){if(op==='delete')job=null;return Promise.resolve({data:op==='select'?(job?[job]:[]):null,error:null}).then(resolve,reject)}return Promise.resolve({data:table==='warkop_members'&&flags.shared?[{user_id:'owner'}]:[],error:null}).then(resolve,reject)}};return q;},
  storage:{from(bucket){return{
   getPublicUrl:path=>({data:{publicUrl:`https://project.supabase.co/storage/v1/object/public/${bucket}/${path}`}}),
   list:async(prefix,{limit,offset})=>{if(flags.failStorage)return{error:new Error('Storage unavailable')};const base=`${bucket}/${prefix.replace(/\/$/,'')}/`;const entries=new Map();for(const f of [...files].sort()){if(!f.startsWith(base))continue;const relative=f.slice(base.length),name=relative.split('/')[0];entries.set(name,{name,id:relative.includes('/')?null:name});}return{data:[...entries.values()].slice(offset,offset+limit)}},
   remove:async paths=>{if(flags.failStorage)return{error:new Error('Storage unavailable')};for(const path of paths)files.delete(`${bucket}/${path}`);calls.push({remove:paths});return{error:null}},
  }}},
  auth:{admin:{deleteUser:async userId=>{calls.push({deleteUser:userId});return flags.failAuth?{error:{status:503}}:{error:null}}}}
 };
 return {db,flags,files,calls,getJob:()=>job,id};
}

test('deletion cleans more than one Storage page and nested folders, keeps other tenant files',async()=>{
 const f=fixture();const result=await permanentlyDeleteEntity(f.db,'TENANT',f.id,'admin');
 assert.equal(result.cleanupPending,false);assert.equal(f.getJob(),null);assert.deepEqual([...f.files],['menu-images/other/keep.webp']);assert(f.calls.some(x=>x.deleteUser==='owner'));
});
test('Storage failure remains queued and is fully retried',async()=>{
 const f=fixture({failStorage:true});assert.equal((await permanentlyDeleteEntity(f.db,'TENANT',f.id,'admin')).cleanupPending,true);assert(f.getJob());assert(!f.calls.some(x=>x.deleteUser));f.flags.failStorage=false;assert.deepEqual(await processEntityDeletionJobs(f.db),{pending:0,completed:1});assert.equal(f.getJob(),null);
});
test('Auth failure never reports complete; retry cleans it without deleting shared accounts',async()=>{
 const f=fixture({failAuth:true});assert.equal((await permanentlyDeleteEntity(f.db,'TENANT',f.id,'admin')).cleanupPending,true);assert(f.getJob());f.flags.failAuth=false;await processEntityDeletionJobs(f.db);assert.equal(f.getJob(),null);
 const shared=fixture({shared:true});await permanentlyDeleteEntity(shared.db,'TENANT',shared.id,'admin');assert(!shared.calls.some(x=>x.deleteUser));assert.equal(shared.getJob(),null);
});
test('malformed or cross-tenant cleanup paths never remove another tenant file',async()=>{
 const f=fixture();f.getJob().objects=[{bucket:'menu-images',path:'other/keep.webp'}];assert.equal((await processEntityDeletionJobs(f.db)).pending,1);assert(f.files.has('menu-images/other/keep.webp'));assert(f.getJob());
});
test('a database failure never starts external cleanup',async()=>{
 const f=fixture();f.db.rpc=async()=>({error:new Error('transaction failed')});await assert.rejects(()=>permanentlyDeleteEntity(f.db,'TENANT',f.id,'admin'));assert.equal(f.calls.length,0);assert.equal(f.files.size,207);
});
