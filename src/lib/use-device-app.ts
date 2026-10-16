"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cacheDeviceSnapshot, clearDeviceData, enqueueDeviceOperation, listDeviceOperations, readDeviceSnapshot, removeDeviceOperation } from "@/lib/device-offline";
import { createCashierClient, createClient } from "@/lib/supabase/client";

export type DeviceOrder = {
  id: string; table_number: string; nomor_antrean: number; total_harga: number; payment_method: "QRIS" | "CASH";
  payment_proof_url: string | null; status_pesanan: string; waiter_name: string | null; created_at: string; updated_at: string;
  items: { id: string; nama_menu: string; harga_satuan: number; qty: number; notes: string | null }[];
};

export type DeviceBootstrap = {
  serverTime: string;
  device: { id: string; name: string; type: "POS" | "KDS"; expiresAt: string };
  profile: { id: string; nama: string; slug: string; is_active: boolean; logo_url: string | null; offline_limit_hours: number; queue_dismiss_seconds: number };
  menus: { id: string; nama: string; harga: number; kategori: string; desc_menu: string | null; is_available: boolean }[];
  tables: { id: string; label: string }[];
  waiters: { id: string; name: string }[];
  shift: { id: string; opened_at: string; status: string } | null;
  orders: DeviceOrder[];
  historyOrders?: DeviceOrder[];
};

type Pairing = { pairingId: string; pollSecret: string; code: string; expiresAt: string };

export type CashierOrderInput = {
  tableNumber: string;
  paymentMethod: "QRIS" | "CASH";
  items: { menuId: string; qty: number; notes: string }[];
};

async function deviceHeaders(type: "POS" | "KDS") {
  if (type !== "POS") return { "Content-Type": "application/json", "X-Device-Type": type };
  const cashierToken = (await createCashierClient().auth.getSession()).data.session?.access_token;
  const clientToken = (await createClient().auth.getSession()).data.session?.access_token;
  const token = cashierToken || clientToken;
  return { "Content-Type": "application/json", "X-Device-Type": type, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export function useDeviceApp(type: "POS" | "KDS") {
  const [data, setData] = useState<DeviceBootstrap | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [online, setOnline] = useState(true);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState("");
  const syncing = useRef(false);

  const flushQueue = useCallback(async () => {
    if (syncing.current || !navigator.onLine) return;
    syncing.current = true;
    try {
      const operations = await listDeviceOperations(type);
      setPendingCount(operations.length);
      for (const operation of operations) {
        const response = await fetch(operation.path, { method: "POST", headers: await deviceHeaders(type), body: JSON.stringify(operation.body) });
        if (response.status === 401) {
          const body = await response.json().catch(() => ({}));
          setError(body.error || "Sesi operator berakhir. Masuk kembali untuk menyinkronkan perubahan.");
          break;
        }
        if (!response.ok && response.status >= 500) break;
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          setError(body.error || "Satu perubahan offline gagal disinkronkan.");
        }
        await removeDeviceOperation(operation.id);
      }
      setPendingCount((await listDeviceOperations(type)).length);
    } finally { syncing.current = false; }
  }, [type]);

  const refresh = useCallback(async (quiet = false) => {
    try {
      const response = await fetch("/api/device/bootstrap", { cache: "no-store", headers: { "X-Device-Type": type } });
      if (response.status === 401) { setAuthorized(false); setData(null); await clearDeviceData(type); return; }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Data perangkat gagal dimuat.");
      setAuthorized(true); setData(body); setCachedAt(null); setError("");
      await cacheDeviceSnapshot(type, body);
      await flushQueue();
    } catch (reason) {
      const cached = await readDeviceSnapshot<DeviceBootstrap>(type);
      if (cached) { setAuthorized(true); setData(cached.value); setCachedAt(cached.cachedAt); }
      else if (!quiet) setError(reason instanceof Error ? reason.message : "Data perangkat gagal dimuat.");
    }
  }, [flushQueue, type]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => { setOnline(navigator.onLine); void refresh(); }, 0);
    const timer = window.setInterval(() => void refresh(true), 3000);
    const handleOnline = () => { setOnline(true); void flushQueue(); void refresh(true); };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline); window.addEventListener("offline", handleOffline);
    return () => { window.clearTimeout(initialTimer); window.clearInterval(timer); window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, [flushQueue, refresh]);

  useEffect(() => {
    const profileId = data?.profile?.id;
    if (!profileId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`device-orders-${type}-${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `warkop_id=eq.${profileId}`,
        },
        () => {
          void refresh(true);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [data?.profile?.id, refresh, type]);

  useEffect(() => {
    if (!pairing) return;
    const timer = window.setInterval(async () => {
      const response = await fetch("/api/device/pairing", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pairing) });
      const body = await response.json();
      if (body.status === "APPROVED") {
        window.clearInterval(timer);
        setPairing(null);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("okesih_just_paired_" + type, "true");
        }
        await refresh();
      }
      else if (["EXPIRED", "REJECTED"].includes(body.status)) { window.clearInterval(timer); setPairing(null); setError("Kode pairing berakhir. Buat kode baru."); }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [pairing, refresh]);

  const beginPairing = async (deviceName: string) => {
    setError("");
    const response = await fetch("/api/device/pairing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceType: type, deviceName }) });
    const body = await response.json();
    if (!response.ok) return setError(body.error || "Kode pairing gagal dibuat.");
    setPairing(body);
  };

  const transitionOrder = async (orderId: string, status: "COOKING" | "READY" | "DONE" | "REJECTED") => {
    const idempotencyKey = crypto.randomUUID();
    const body = { orderId, status, idempotencyKey, ...(type === "POS" && data?.shift?.id ? { shiftId: data.shift.id } : {}) };
    if (!navigator.onLine) {
      const offlineSince = cachedAt ? new Date(cachedAt).getTime() : Date.now();
      const offlineLimitMs = Number(data?.profile.offline_limit_hours || 0) * 60 * 60_000;
      if (!offlineLimitMs || Date.now() - offlineSince > offlineLimitMs) {
        throw new Error("Batas operasi offline telah habis. Sambungkan internet untuk memperbarui izin perangkat.");
      }
      await enqueueDeviceOperation({ id: idempotencyKey, deviceType: type, path: "/api/device/orders", body, createdAt: new Date().toISOString() });
      setPendingCount((await listDeviceOperations(type)).length);
      setData((current) => current ? { ...current, orders: current.orders.map((order) => order.id === orderId ? { ...order, status_pesanan: status } : order) } : current);
      return;
    }
    const response = await fetch("/api/device/orders", { method: "POST", headers: await deviceHeaders(type), body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Status pesanan gagal diperbarui.");
    await refresh(true);
  };

  const createCashierOrder = async (input: CashierOrderInput) => {
    if (!navigator.onLine) throw new Error("Pesanan langsung memerlukan koneksi agar segera masuk ke layar dapur.");
    const response = await fetch("/api/device/cashier-orders", {
      method: "POST",
      headers: await deviceHeaders(type),
      body: JSON.stringify({ ...input, idempotencyKey: crypto.randomUUID() }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Pesanan kasir gagal disimpan.");
    await refresh(true);
    return result.order as { id: string; nomor_antrean: number; total_harga: number; status_pesanan: string };
  };

  return { data, authorized, pairing, online, cachedAt, pendingCount, error, setError, beginPairing, transitionOrder, createCashierOrder, refresh };
}
