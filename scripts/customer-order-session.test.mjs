import test from 'node:test';
import assert from 'node:assert/strict';
import { readCustomerOrders, rememberCustomerOrder, resolveCustomerTable } from '../src/lib/customer-order-session.ts';
import { orderPaymentLabel } from '../src/lib/order-payment.ts';
const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
const order = (id = 'one', savedAt = Date.now()) => ({ order: { id, queueNumber: 1, total: 20000 }, token: 'x'.repeat(40), tableId: 'a', tableNumber: '1', paymentMethod: 'CASH', savedAt });
test('refresh restores access and amount; tenant scopes cannot mix', () => {
  const store = storage(); const input = order();
  rememberCustomerOrder(store, 'tenant-a', input);
  assert.deepEqual(readCustomerOrders(store, 'tenant-a'), [input]);
  assert.deepEqual(readCustomerOrders(store, 'tenant-b'), []);
});
test('history deduplicates retries and is bounded; corrupted and expired sessions are ignored', () => {
  const store = storage();
  for (let i = 0; i < 12; i++) rememberCustomerOrder(store, 'a', order(String(i)));
  rememberCustomerOrder(store, 'a', order('11'));
  assert.equal(readCustomerOrders(store, 'a').length, 10);
  assert.equal(new Set(readCustomerOrders(store, 'a').map(row => row.order.id)).size, 10);
  assert.deepEqual(readCustomerOrders(store, 'a', Date.now() + 25 * 3600000), []);
  store.setItem('okesih-orders:a', '{bad'); assert.deepEqual(readCustomerOrders(store, 'a'), []);
});
test('unavailable storage never masks a successfully created order', () => {
  const store = { getItem() { throw Error('blocked'); }, setItem() { throw Error('full'); } };
  assert.equal(rememberCustomerOrder(store, 'a', order()).length, 1);
});
test('explicit invalid QR never falls back to cached table or another label', () => {
  const tables = [{ id: 'a', label: 'Baru' }, { id: 'b', label: '2' }];
  assert.equal(resolveCustomerTable(tables, { id: 'missing', label: '2', explicit: true }, { id: 'a' }), undefined);
  assert.equal(resolveCustomerTable(tables, { id: '', label: 'old', explicit: true }, { id: 'a' }), undefined);
  assert.equal(resolveCustomerTable(tables, { id: 'a', label: '', explicit: true })?.label, 'Baru');
  assert.equal(resolveCustomerTable(tables, { id: '', label: ' 2 ', explicit: true })?.id, 'b');
  assert.equal(resolveCustomerTable(tables, { id: '', label: '', explicit: false }, { id: 'a' })?.id, 'a');
});
test('payment labels depend on recorded payment, never the confirming cashier or source', () => {
  assert.equal(orderPaymentLabel({ payment_method: 'CASH', payment_status: 'PENDING', order_source: 'POS' }), 'TUNAI · BELUM DIBAYAR');
  assert.equal(orderPaymentLabel({ payment_method: 'CASH', payment_status: 'PAID', order_source: 'CUSTOMER_QR' }), 'TUNAI · LUNAS');
  assert.match(orderPaymentLabel({ payment_method: 'CASH' }), /PERIKSA PEMBAYARAN LAMA/);
  assert.equal(orderPaymentLabel({ payment_method: 'QRIS', payment_status: 'PAID' }), 'QRIS · DIKONFIRMASI');
});


test('blocked browser storage preserves uncertain request keys within the page', async () => {
  const { resilientIntentStorage, orderIntentKey, completeOrderIntent } = await import('../src/lib/order-intent.ts');
  const store = resilientIntentStorage(() => { throw Error('Storage denied'); });
  const first = await orderIntentKey(store, 'customer:tenant:table', { qty: 1 });
  assert.equal(await orderIntentKey(store, 'customer:tenant:table', { qty: 1 }), first);
  assert.notEqual(await orderIntentKey(store, 'customer:other:table', { qty: 1 }), first);
  completeOrderIntent(store, 'customer:tenant:table');
  assert.notEqual(await orderIntentKey(store, 'customer:tenant:table', { qty: 1 }), first);
});
test('failed intent cleanup never reports a successful order as failed or replays stale storage', async () => {
  const { resilientIntentStorage, orderIntentKey, completeOrderIntent } = await import('../src/lib/order-intent.ts');
  const underlying = storage();
  const store = resilientIntentStorage(() => ({ ...underlying, removeItem() { throw Error('Read only'); } }));
  const first = await orderIntentKey(store, 'payment:order', { cash: 20000 });
  assert.doesNotThrow(() => completeOrderIntent(store, 'payment:order'));
  assert.notEqual(await orderIntentKey(store, 'payment:order', { cash: 20000 }), first);
});
