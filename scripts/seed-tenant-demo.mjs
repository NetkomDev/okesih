import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const slug = process.argv[2] || "risolinan";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Environment Supabase belum lengkap.");

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const sha = (value) => createHash("sha256").update(value).digest("hex");
const uuid = (value) => {
  const hex = sha(value).slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16], 16) & 3) | 8).toString(16);
  const raw = hex.join("");
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
};
const makassarIso = (year, month, day, hour, minute = 0) => new Date(Date.UTC(year, month - 1, day, hour - 8, minute)).toISOString();
const localNow = new Date(Date.now() + 8 * 60 * 60_000);
const year = localNow.getUTCFullYear();
const month = localNow.getUTCMonth() + 1;
const day = localNow.getUTCDate();
const today = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

async function must(query, label) {
  const result = await query;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

const profile = await must(db.from("warkops").select("id,nama,slug").eq("slug", slug).maybeSingle(), "Tenant");
if (!profile) throw new Error(`Tenant dengan slug ${slug} tidak ditemukan.`);
const warkopId = profile.id;

await must(db.from("warkops").update({
  qris_merchant_name: `${profile.nama.toUpperCase()} — DEMO`,
  qris_image_url: `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(`OKESIH-DEMO-${slug.toUpperCase()}-BUKAN-UNTUK-PEMBAYARAN`)}`,
}).eq("id", warkopId), "QRIS demo");

const menuSeed = [
  ["Risol Mayo Premium", 12000, "Makanan", "Risol renyah dengan smoked beef, telur, dan mayo creamy."],
  ["Risol Ragout Ayam", 10000, "Makanan", "Isian ayam dan sayur lembut dengan kulit renyah."],
  ["Paket Risol Berdua", 32000, "Paket", "Empat risol pilihan untuk dinikmati berdua."],
  ["Kentang Goreng", 15000, "Camilan", "Kentang renyah dengan saus sambal dan mayo."],
  ["Kopi Susu Gula Aren", 18000, "Kopi", "Espresso, susu segar, dan gula aren."],
  ["Americano", 14000, "Kopi", "Espresso dengan air panas, tersedia panas atau dingin."],
  ["Es Teh Lemon", 12000, "Minuman", "Teh segar dengan perasan lemon."],
  ["Cokelat Creamy", 17000, "Minuman", "Cokelat pekat dan susu segar."],
];
const existingMenus = await must(db.from("menus").select("id,nama,harga").eq("warkop_id", warkopId), "Baca menu");
const existingMenuNames = new Set(existingMenus.map((item) => item.nama));
const missingMenus = menuSeed.filter(([name]) => !existingMenuNames.has(name)).map(([nama, harga, kategori, desc_menu]) => ({ warkop_id: warkopId, nama, harga, kategori, desc_menu, is_available: true }));
if (missingMenus.length) await must(db.from("menus").insert(missingMenus), "Tambah menu");
const menus = await must(db.from("menus").select("id,nama,harga").eq("warkop_id", warkopId).in("nama", menuSeed.map(([name]) => name)), "Menu demo");

await must(db.from("waiters").upsert([
  { warkop_id: warkopId, name: "Alya", phone: "081234560101", is_active: true },
  { warkop_id: warkopId, name: "Bima", phone: "081234560102", is_active: true },
  { warkop_id: warkopId, name: "Citra", phone: "081234560103", is_active: true },
], { onConflict: "warkop_id,name" }), "Waiter");

const tableSeed = Array.from({ length: 12 }, (_, index) => ({ warkop_id: warkopId, label: String(index + 1).padStart(2, "0"), sort_order: index + 1, is_active: true }));
await must(db.from("warkop_tables").upsert(tableSeed, { onConflict: "warkop_id,label" }), "Meja");

await must(db.from("warkop_members").upsert([
  { warkop_id: warkopId, username: "kasir.demo", display_name: "Nadia Kasir", role: "KASIR", is_active: true },
  { warkop_id: warkopId, username: "dapur.demo", display_name: "Raka Barista", role: "DAPUR", is_active: true },
], { onConflict: "warkop_id,username" }), "Staf demo");

const transactionSpecs = [];
const addTransaction = (key, createdAt, total, paymentMethod, status = "DONE") => transactionSpecs.push({ key, createdAt, total, paymentMethod, status });

for (let targetMonth = 1; targetMonth < month; targetMonth += 1) {
  addTransaction(`year-${targetMonth}-a`, makassarIso(year, targetMonth, 8, 10), 54000 + targetMonth * 3500, targetMonth % 2 ? "QRIS" : "CASH");
  addTransaction(`year-${targetMonth}-b`, makassarIso(year, targetMonth, 19, 16), 76000 + targetMonth * 4200, targetMonth % 2 ? "CASH" : "QRIS");
}
for (let targetDay = 2; targetDay < day; targetDay += Math.max(1, Math.floor(day / 10))) {
  addTransaction(`month-${targetDay}-a`, makassarIso(year, month, targetDay, 9), 28000 + targetDay * 1700, targetDay % 2 ? "CASH" : "QRIS");
  addTransaction(`month-${targetDay}-b`, makassarIso(year, month, targetDay, 17, 30), 41000 + targetDay * 2100, targetDay % 2 ? "QRIS" : "CASH");
}
const todayOrders = [
  ["today-08", 8, 32000, "CASH", "DONE"],
  ["today-10", 10, 47000, "QRIS", "DONE"],
  ["today-12", 12, 68000, "CASH", "DONE"],
  ["today-14", 14, 39000, "QRIS", "AWAITING_CONFIRMATION"],
  ["today-16", 16, 82000, "QRIS", "COOKING"],
  ["today-18", 18, 56000, "CASH", "READY"],
  ["today-20", 20, 73000, "QRIS", "DONE"],
];
for (const [key, hour, total, method, status] of todayOrders) addTransaction(key, makassarIso(year, month, day, hour), total, method, status);

const transactionKeys = transactionSpecs.map((item) => uuid(`okesih-demo:${slug}:${item.key}`));
const existingTransactions = await must(db.from("transactions").select("id,idempotency_key").eq("warkop_id", warkopId).in("idempotency_key", transactionKeys), "Cek transaksi");
const existingKeys = new Set(existingTransactions.map((item) => item.idempotency_key));
const toInsert = transactionSpecs.map((item, index) => ({ item, idempotencyKey: transactionKeys[index] })).filter(({ idempotencyKey }) => !existingKeys.has(idempotencyKey)).map(({ item, idempotencyKey }, index) => ({
  warkop_id: warkopId,
  table_number: String((index % 12) + 1).padStart(2, "0"),
  nomor_antrean: 100 + index,
  total_harga: item.total,
  payment_method: item.paymentMethod,
  status_pesanan: item.status,
  idempotency_key: idempotencyKey,
  customer_access_token_hash: sha(`customer:${idempotencyKey}`),
  confirmed_at: item.status === "AWAITING_CONFIRMATION" ? null : item.createdAt,
  created_at: item.createdAt,
  updated_at: item.createdAt,
}));

let insertedTransactions = [];
if (toInsert.length) insertedTransactions = await must(db.from("transactions").insert(toInsert).select("id,total_harga,idempotency_key"), "Transaksi");
if (insertedTransactions.length) {
  const items = insertedTransactions.flatMap((transaction, index) => {
    const first = menus[index % menus.length];
    const second = menus[(index + 2) % menus.length];
    const firstQty = 2;
    return [
      { transaction_id: transaction.id, menu_id: first.id, nama_menu: first.nama, harga_satuan: Number(first.harga), qty: firstQty, notes: index % 3 === 0 ? "Saus dipisah" : null },
      { transaction_id: transaction.id, menu_id: second.id, nama_menu: second.nama, harga_satuan: Math.max(0, Number(transaction.total_harga) - Number(first.harga) * firstQty), qty: 1, notes: null },
    ];
  });
  await must(db.from("transaction_items").insert(items), "Item transaksi");
}

await must(db.from("saas_billings").upsert({ warkop_id: warkopId, tanggal: today, total_transactions: todayOrders.length, tagihan_pokok: todayOrders.length * 50, kode_unik: 127, total_tagihan: todayOrders.length * 50 + 127, status_bayar: "UNPAID" }, { onConflict: "warkop_id,tanggal" }), "Billing");

const deviceSeed = [
  { warkop_id: warkopId, device_type: "POS", device_name: "Tablet Kasir Utama", token_hash: sha(`demo-device:${slug}:pos`), status: "ACTIVE", last_seen_at: new Date().toISOString(), expires_at: new Date(Date.now() + 150 * 86_400_000).toISOString() },
  { warkop_id: warkopId, device_type: "KDS", device_name: "Layar Dapur", token_hash: sha(`demo-device:${slug}:kds`), status: "ACTIVE", last_seen_at: new Date(Date.now() - 8 * 60_000).toISOString(), expires_at: new Date(Date.now() + 150 * 86_400_000).toISOString() },
];
for (const device of deviceSeed) {
  const exists = await must(db.from("device_installations").select("id").eq("token_hash", device.token_hash).maybeSingle(), "Cek perangkat");
  if (!exists) await must(db.from("device_installations").insert(device), "Perangkat");
}

console.log(JSON.stringify({ tenant: profile.nama, slug: profile.slug, menus: menus.length, waiters: 3, tables: tableSeed.length, staff: 2, transactionsAdded: insertedTransactions.length, billingDate: today, devices: deviceSeed.length }, null, 2));
