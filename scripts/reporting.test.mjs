import test from 'node:test';
import { witaRange } from '../src/lib/reporting-dates.ts';
import assert from 'node:assert/strict';
import { historyQuerySchema, paginationSchema } from '../src/lib/reporting.ts';

test('pagination is bounded and rejects fractional or negative pages',()=>{
  assert.deepEqual(paginationSchema.parse({}),{page:1,pageSize:25});
  for(const input of [{page:0},{page:-1},{page:1.5},{page:'abc'},{pageSize:101},{pageSize:0}]) assert.equal(paginationSchema.safeParse(input).success,false);
});
test('history filters validate dates and finite enum values',()=>{
  for(const input of [{period:'custom'},{period:'custom',start:'2026-10-19',end:'2026-10-18'},{period:'custom',start:'2026-02-30',end:'2026-03-01'},{status:'DROP'},{payment:'bitcoin'},{search:'a'.repeat(121)}]) assert.equal(historyQuerySchema.safeParse(input).success,false);
});
test('WITA midnight has an exclusive next-day boundary regardless of browser timezone',()=>{
  assert.deepEqual(witaRange({period:'today'},new Date('2026-10-17T16:00:00Z')),{start:'2026-10-17T16:00:00.000Z',end:'2026-10-18T16:00:00.000Z'});
  assert.deepEqual(witaRange({period:'today'},new Date('2026-10-17T15:59:59Z')),{start:'2026-10-16T16:00:00.000Z',end:'2026-10-17T16:00:00.000Z'});
});
test('week starts Monday and spans seven WITA days',()=>{
  assert.deepEqual(witaRange({period:'this_week'},new Date('2026-10-18T02:00:00Z')),{start:'2026-10-11T16:00:00.000Z',end:'2026-10-18T16:00:00.000Z'});
});
test('leap month, year rollover and inclusive custom dates',()=>{
  assert.deepEqual(witaRange({period:'this_month'},new Date('2024-02-20T00:00:00Z')),{start:'2024-01-31T16:00:00.000Z',end:'2024-02-29T16:00:00.000Z'});
  assert.deepEqual(witaRange({period:'this_year'},new Date('2026-12-31T16:00:00Z')),{start:'2026-12-31T16:00:00.000Z',end:'2027-12-31T16:00:00.000Z'});
  assert.deepEqual(witaRange({period:'custom',start:'2026-10-18',end:'2026-10-18'}),{start:'2026-10-17T16:00:00.000Z',end:'2026-10-18T16:00:00.000Z'});
  assert.deepEqual(witaRange({period:'all'}),{start:null,end:null});
});
