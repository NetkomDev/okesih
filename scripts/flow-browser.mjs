// Local browser integration with synthetic API responses only. No production writes.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const base=process.env.FLOW_BASE_URL || 'http://127.0.0.1:3210';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw Error('Local server required');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || '/tmp/okesih-flow-browser/node_modules/playwright/index.mjs').href);
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
const page=await context.newPage();
const table='11111111-1111-4111-8111-111111111111',menu='22222222-2222-4222-8222-222222222222';
let label='1', creates=0;
const token='test-customer-token-'.repeat(3);
await page.route('**/api/public/menu/**',route=>route.fulfill({json:{profile:{nama:'Uji Flow',slug:'flow-qa',logo_url:null,qris_image_url:null,qris_merchant_name:'QA'},menus:[{id:menu,nama:'Kopi QA',harga:20000,kategori:'Minuman',desc_menu:''}],tables:[{id:table,label}]}}));
await page.route('**/api/public/orders',async route=>{
 const input=route.request().postDataJSON();assert.equal(input.tableId,table);assert.equal(input.paymentMethod,'CASH');assert.ok(input.idempotencyKey);
 creates++;await route.fulfill({status:201,json:{order:{id:`order-${creates}`,queueNumber:creates,total:20000},customerToken:token}});
});
await page.route('**/api/public/orders/*',route=>{
 assert.equal(route.request().headers().authorization,`Bearer ${token}`);
 return route.fulfill({json:{order:{status_pesanan:route.request().url().endsWith('order-1')?'DONE':'AWAITING_CONFIRMATION',payment_status:route.request().url().endsWith('order-1')?'PAID':'PENDING'}}});
});
async function sendCash(){
 await page.getByRole('button',{name:'Tambah Kopi QA',exact:true}).click();
 await page.getByRole('button',{name:'Lihat ringkasan pesanan'}).click();
 await page.getByRole('button',{name:'Tunai',exact:false}).click();
 await page.getByRole('button',{name:'Kirim Pesanan'}).click();
}
try{
 await page.goto(`${base}/menu/flow-qa?t=1`, { waitUntil: "domcontentloaded", timeout: 60000 });
 await sendCash();await page.getByRole('heading',{name:'Pesanan selesai'}).waitFor();
 await page.reload({ waitUntil: "domcontentloaded" });await page.getByRole('heading',{name:'Pesanan selesai'}).waitFor();
 assert.equal(creates,1);
 await page.getByRole('button',{name:'Pesan Sekarang'}).click();await sendCash();
 await page.getByRole('heading',{name:'Menunggu konfirmasi kasir'}).waitFor();assert.equal(creates,2);
 await page.goto(`${base}/menu/flow-qa?t=invalid`, { waitUntil: "domcontentloaded" });
 await page.getByText('QR meja tidak valid atau meja sudah nonaktif. Silakan scan ulang QR meja.').waitFor();
 await page.getByRole('button',{name:'Tambah Kopi QA',exact:true}).click();await page.getByRole('button',{name:'Lihat ringkasan pesanan'}).click();
 await page.getByRole('button',{name:'Scan QR Meja untuk Memesan'}).waitFor();assert.equal(creates,2);
 await page.evaluate(()=>sessionStorage.removeItem('okesih-orders:flow-qa'));label='Meja Baru';
 await page.goto(`${base}/menu/flow-qa?tid=${table}`, { waitUntil: "domcontentloaded" });
 await page.getByRole('button',{name:'Tambah Kopi QA',exact:true}).click();await page.getByRole('button',{name:'Lihat ringkasan pesanan'}).click();
 await page.getByRole('button',{name:'Kirim Pesanan'}).waitFor();await page.getByText('Meja Baru',{exact:true}).first().waitFor();
 console.log('PASS browser customer: submit, reload recovery, second-order reset, invalid QR isolation, stable ID after rename');
 const kds=await context.newPage();let paid=false,done=false,posts=[];
 await kds.clock.install();
 await kds.route('**/api/device/bootstrap*',route=>route.fulfill({json:{serverTime:new Date().toISOString(),device:{id:'device',name:'QA KDS',type:'KDS',expiresAt:new Date(Date.now()+86400000).toISOString()},profile:{id:'tenant',nama:'QA',slug:'qa',is_active:true,offline_limit_hours:4,queue_dismiss_seconds:1},menus:[],tables:[],waiters:[],shift:null,hasAuditPin:false,orders:done?[]:[{id:'order-kds',table_number:'1',nomor_antrean:8,total_harga:20000,payment_method:'CASH',payment_status:paid?'PAID':'PENDING',order_source:'CUSTOMER_QR',status_pesanan:'READY',waiter_name:'Kasir: QA',created_at:new Date(Date.now()-120000).toISOString(),updated_at:new Date(Date.now()-120000).toISOString(),items:[{id:'i',nama_menu:'Kopi QA',harga_satuan:20000,qty:1,notes:null}]}]}}));
 await kds.route('**/api/device/orders',route=>{posts.push(route.request().postDataJSON());done=true;return route.fulfill({json:{success:true}})});
 await kds.goto(`${base}/kds`, { waitUntil: "domcontentloaded", timeout: 60000 });await kds.getByText('TUNAI · BELUM DIBAYAR',{exact:true}).waitFor();
 assert.equal(await kds.getByRole('button',{name:'✓ Sudah Diantar'}).isDisabled(),true);
 await kds.clock.runFor(65000);assert.equal(posts.length,0);
 paid=true;await kds.getByTitle('Sinkronkan pesanan terbaru').click();
 await kds.getByText('TUNAI · LUNAS',{exact:true}).waitFor();
 await kds.getByRole('button',{name:'✓ Sudah Diantar'}).click();
 await kds.waitForFunction(()=>!document.body.innerText.includes('TUNAI · LUNAS'));
 assert.equal(posts.length,1);assert.equal(posts[0].status,'DONE');
 console.log('PASS browser KDS: confirming cashier does not imply paid, no timed DONE, unpaid completion disabled, paid manual completion');
}finally{await browser.close()}
