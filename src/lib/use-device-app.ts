"use client";

import { canOperateOffline, syncFailureKind } from "@/lib/offline-policy";
import { orderIntentKey, completeOrderIntent } from "@/lib/order-intent";
import type { QueuedOperation } from "@/lib/device-offline";
import { useCallback, useEffect, useRef, useState } from "react";
import { cacheDeviceSnapshot, clearDeviceData, enqueueDeviceOperation, listDeviceOperations, readDeviceSnapshot, removeDeviceOperation } from "@/lib/device-offline";
import { createCashierClient, createClient } from "@/lib/supabase/client";

export type DeviceOrder = {
  cashier_name?: string;
  payment_status?: "PENDING" | "PAID" | "LEGACY_UNVERIFIED";
  payment_received_at?: string | null;
  order_source?: "CUSTOMER_QR" | "POS" | "LEGACY";
  id: string; table_number: string; nomor_antrean: number; total_harga: number; payment_method: "QRIS" | "CASH";
  payment_proof_url: string | null; status_pesanan: string; waiter_name: string | null; created_at: string; updated_at: string;
  items: { id: string; nama_menu: string; harga_satuan: number; qty: number; notes: string | null }[];
};

export type DeviceBootstrap = {
  serverTime: string;
  metadataVersion?: string;
  metadataModified?: boolean;
  device: { id: string; name: string; type: "POS" | "KDS"; expiresAt: string };
  profile: { id: string; nama: string; slug: string; is_active: boolean; logo_url: string | null; offline_limit_hours: number; queue_dismiss_seconds: number; updated_at?: string };
  menus: { id: string; nama: string; harga: number; kategori: string; desc_menu: string | null; is_available: boolean }[];
  tables: { id: string; label: string }[];
  waiters: { id: string; name: string }[];
  shift: { id: string; opened_at: string; status: string } | null;
  orders: DeviceOrder[];
  historyOrders?: DeviceOrder[];
  hasAuditPin?: boolean;
};

function computeSnapshotVersion(item: DeviceBootstrap): string {
  const ordersSummary = (item.orders || []).map((o) => `${o.id}:${o.status_pesanan}:${o.updated_at}`).join(";");
  const historySummary = (item.historyOrders || []).map((o) => `${o.id}:${o.status_pesanan}:${o.updated_at}`).join(";");
  const shiftKey = item.shift ? `${item.shift.id}:${item.shift.status}` : "none";
  const metaVer = item.metadataVersion || item.profile?.updated_at || "";
  return `${metaVer}|${shiftKey}|${ordersSummary}|${historySummary}`;
}

type Pairing = { pairingId: string; pollSecret: string; code: string; expiresAt: string };

export type CashierOrderInput = {
  tableNumber: string;
  paymentMethod: "QRIS" | "CASH";
  cashReceived?: number;
  items: { menuId: string; qty: number; notes: string }[];
};

async function deviceHeaders(type: "POS" | "KDS") {
  if (type !== "POS") return { "Content-Type": "application/json", "X-Device-Type": type };
  const cashierToken = (await createCashierClient().auth.getSession()).data.session?.access_token;
  const clientToken = (await createClient().auth.getSession()).data.session?.access_token;
  const token = cashierToken || clientToken;
  return { "Content-Type": "application/json", "X-Device-Type": type, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export function useDeviceApp(type: "POS" | "KDS", includeHistory = true) {
  const [data, setData] = useState<DeviceBootstrap | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [online, setOnline] = useState(true);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState("");
  const snapshot = useRef<DeviceBootstrap | null>(null);
  const syncing = useRef(false);
  const [pendingOperations, setPendingOperations] = useState<QueuedOperation[]>([]);
  const pollDelay = useRef(3000);
  const refreshInFlight = useRef<Promise<void> | null>(null);

  const flushQueue = useCallback(async () => {
    if (syncing.current || !navigator.onLine) return;
    syncing.current = true;
    try {
      const operations = await listDeviceOperations(type);
      setPendingCount(operations.length); setPendingOperations(operations);
      for (const operation of operations) {
        if (operation.deviceId !== snapshot.current?.device.id) {
          await enqueueDeviceOperation({ ...operation, blocked: true, failure: "Perubahan berasal dari pairing lama. Periksa pesanan sebelum mengabaikannya." });
          continue;
        }
        if (operation.blocked) break;
        let response: Response;
        try {
          response = await fetch(operation.path, { method: "POST", headers: await deviceHeaders(type), body: JSON.stringify(operation.body) });
        } catch { setError("Koneksi terputus. Perubahan tetap tersimpan untuk disinkronkan."); break; }
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const failure = body.error || "Perubahan belum dapat disinkronkan.";
          await enqueueDeviceOperation({ ...operation, failure, blocked: syncFailureKind(response.status) === "blocked" });
          setError(failure); break;
        }
        await removeDeviceOperation(operation.id);
      }
      const remaining = await listDeviceOperations(type);
      setPendingCount(remaining.length); setPendingOperations(remaining);
    } finally { syncing.current = false; }
  }, [type]);

  const refresh = useCallback((quiet = false): Promise<void> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const pending = (async () => {
      try {
        void includeHistory;
        const currentMetaVer = snapshot.current?.metadataVersion || snapshot.current?.profile?.updated_at || "";
        const queryParams = new URLSearchParams();

        if (currentMetaVer) queryParams.set("meta_version", currentMetaVer);

        const response = await fetch(`/api/device/bootstrap?${queryParams.toString()}`, {
          cache: "no-store",
          headers: { "X-Device-Type": type },
        });
        if (response.status === 401 || response.status === 403) {
          const failure = await response.json().catch(() => ({}));
          const removedDeviceId = failure.code === "DEVICE_REMOVED"
            ? snapshot.current?.device.id || (await readDeviceSnapshot<DeviceBootstrap>(type))?.value.device.id
            : undefined;
          setAuthorized(false); setData(null); snapshot.current = null;
          await clearDeviceData(type);
          if (failure.code === "DEVICE_REMOVED" && removedDeviceId) {
            for (const operation of await listDeviceOperations(type)) {
              if (operation.deviceId === removedDeviceId) await removeDeviceOperation(operation.id);
            }
            const remaining = await listDeviceOperations(type);
            setPendingCount(remaining.length); setPendingOperations(remaining);
          }
          setError(failure.code === "DEVICE_REMOVED" ? "Perangkat atau tenant telah dihapus permanen. Data lokal perangkat dibersihkan." : "Akses perangkat tidak aktif. Perubahan tertunda tetap disimpan.");
          return;
        }
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Data perangkat gagal dimuat.");

        // Jika metadata warkop tidak berubah, pertahankan daftar menu, meja, dan pelayan dari snapshot yang sudah ada
        const next: DeviceBootstrap = {
          ...snapshot.current,
          ...body,
          historyOrders: [],
          menus: body.menus ?? snapshot.current?.menus ?? [],
          tables: body.tables ?? snapshot.current?.tables ?? [],
          waiters: body.waiters ?? snapshot.current?.waiters ?? [],
          metadataVersion: body.metadataVersion || snapshot.current?.metadataVersion,
        };

        snapshot.current = next;
        const pendingOps = await listDeviceOperations(type);
        const pendingOrders = next.orders.map((order) => {
          const changes = pendingOps.filter((op) => op.deviceId === next.device.id && op.body.orderId === order.id && !op.blocked);
          return changes.length ? { ...order, status_pesanan: String(changes.at(-1)!.body.status) } : order;
        });
        setAuthorized(true); setData({ ...next, orders: pendingOrders }); setCachedAt(null); setError("");
        pollDelay.current = next.orders.length ? 3000 : 15_000;

        const dataVersion = computeSnapshotVersion(next);
        await cacheDeviceSnapshot(type, next, { dataVersion });
        await flushQueue();
      } catch (reason) {
        pollDelay.current = Math.min(60_000, pollDelay.current * 2);
        const cached = await readDeviceSnapshot<DeviceBootstrap>(type);
        if (cached && canOperateOffline(cached.value)) {
          const ops = await listDeviceOperations(type);
          const restored = { ...cached.value, historyOrders: [], orders: cached.value.orders.map((order) => {
            const last = ops.filter((op) => op.deviceId === cached.value.device.id && op.body.orderId === order.id && !op.blocked).at(-1);
            return last ? { ...order, status_pesanan: String(last.body.status) } : order;
          }) };
          snapshot.current = restored; setAuthorized(true); setData(restored); setCachedAt(cached.value.serverTime);
          setPendingCount(ops.length); setPendingOperations(ops);
        } else { setAuthorized(false); setData(null); if (!quiet) setError(reason instanceof Error ? reason.message : "Izin offline berakhir. Sambungkan internet."); }
      }
    })();
    refreshInFlight.current = pending;
    void pending.finally(() => { refreshInFlight.current = null; }).catch(() => {});
    return pending;
  }, [flushQueue, includeHistory, type]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => { setOnline(navigator.onLine); void refresh(); }, 0);
    // Keep the 3-second fallback: device realtime delivery depends on RLS.
    const refreshVisible = () => {
      if (navigator.onLine && document.visibilityState === "visible") void refresh(true);
    };
    let timer: ReturnType<typeof setTimeout>;
    let disposed = false;
    const poll = async () => {
      if (navigator.onLine && document.visibilityState === "visible") await refresh(true);
      if (!disposed) timer = setTimeout(poll, pollDelay.current);
    };
    timer = setTimeout(poll, pollDelay.current);
    const handleOnline = () => { setOnline(true); refreshVisible(); };
    document.addEventListener("visibilitychange", refreshVisible);
    const handleOffline = () => { setOnline(false); setCachedAt(snapshot.current?.serverTime || null); };
    window.addEventListener("online", handleOnline); window.addEventListener("offline", handleOffline);
    return () => { disposed = true; window.clearTimeout(initialTimer); clearTimeout(timer); document.removeEventListener("visibilitychange", refreshVisible); window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, [flushQueue, refresh, type]);

  useEffect(() => {
    const profileId = data?.profile?.id;
    if (!profileId) return;
    const supabase = type === "POS" ? createCashierClient() : createClient();
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
          if (navigator.onLine && document.visibilityState === "visible") void refresh(true);
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
  }, [pairing, refresh, type]);

  const beginPairing = async (deviceName: string) => {
    setError("");
    const response = await fetch("/api/device/pairing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceType: type, deviceName }) });
    const body = await response.json();
    if (!response.ok) return setError(body.error || "Kode pairing gagal dibuat.");
    setPairing(body);
  };

  const transitionOrder = async (orderId: string, status: "COOKING" | "READY" | "DONE" | "REJECTED") => {
    if (!data || (!navigator.onLine && !canOperateOffline(snapshot.current))) throw new Error("Batas operasi offline telah habis. Sambungkan internet.");
    const intent = { orderId, status, ...(type === "POS" && data.shift?.id ? { shiftId: data.shift.id } : {}) };
    const scope = `transition:${data.device.id}:${orderId}:${status}`;
    const idempotencyKey = await orderIntentKey(localStorage, scope, intent);
    const body = { ...intent, idempotencyKey };
    // Persist before network submission, including uncertain online responses.
    await enqueueDeviceOperation({ id: idempotencyKey, deviceType: type, deviceId: data.device.id, path: "/api/device/orders", body, createdAt: new Date().toISOString() });
    const ops = await listDeviceOperations(type); setPendingCount(ops.length); setPendingOperations(ops);
    if (!navigator.onLine) {
      setData((current) => current ? { ...current, orders: current.orders.map((order) => order.id === orderId ? { ...order, status_pesanan: status } : order) } : current);
      return;
    }
    const response = await fetch("/api/device/orders", { method: "POST", headers: await deviceHeaders(type), body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) {
      await enqueueDeviceOperation({ id: idempotencyKey, deviceType: type, deviceId: data.device.id, path: "/api/device/orders", body, createdAt: new Date().toISOString(), failure: result.error, blocked: syncFailureKind(response.status) === "blocked" });
      throw new Error(result.error || "Status pesanan gagal diperbarui.");
    }
    await removeDeviceOperation(idempotencyKey);
    completeOrderIntent(localStorage, scope);
    // A read started before this write may contain stale data.
    await refreshInFlight.current;
    await refresh(true);
  };

  const createCashierOrder = async (input: CashierOrderInput) => {
    if (!navigator.onLine) throw new Error("Pesanan langsung memerlukan koneksi agar segera masuk ke layar dapur.");
    if (!data?.shift?.id) throw new Error("Shift belum aktif.");
    const scope = `cashier:${data.device.id}:${data.shift.id}`;
    const intent = { ...input, shiftId: data.shift.id };
    const response = await fetch("/api/device/cashier-orders", {
      method: "POST",
      headers: await deviceHeaders(type),
      body: JSON.stringify({ ...intent, idempotencyKey: await orderIntentKey(localStorage, scope, intent) }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Pesanan kasir gagal disimpan.");
    completeOrderIntent(localStorage, scope);
    // A read started before this write may contain stale data.
    await refreshInFlight.current;
    await refresh(true);
    return result.order as { id: string; nomor_antrean: number; total_harga: number; status_pesanan: string };
  };

  const recordPayment = async (orderId: string, cashReceived?: number) => {
    if (type !== "POS" || !navigator.onLine || !data?.shift?.id) throw new Error("Pencatatan pembayaran memerlukan kasir, shift aktif, dan koneksi internet.");
    const scope = `payment:${data.device.id}:${orderId}`;
    const intent = { orderId, shiftId: data.shift.id, ...(cashReceived === undefined ? {} : { cashReceived }) };
    const response = await fetch("/api/device/payments", {
      method: "POST", headers: await deviceHeaders(type),
      body: JSON.stringify({ ...intent, idempotencyKey: await orderIntentKey(localStorage, scope, intent) }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Pembayaran gagal dicatat.");
    completeOrderIntent(localStorage, scope);
    await refreshInFlight.current; await refresh(true);
    return result as { change: number };
  };

  const resolveOperation = async (id: string, discard: boolean) => {
    const operation = (await listDeviceOperations(type)).find((op) => op.id === id);
    if (!operation) return;
    if (discard) await removeDeviceOperation(id);
    else await enqueueDeviceOperation({ ...operation, blocked: false, failure: undefined });
    await refresh();
  };
  return { pendingOperations, resolveOperation, data, authorized, pairing, online, cachedAt, pendingCount, error, setError, beginPairing, transitionOrder, createCashierOrder, recordPayment, refresh };
}
