"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useAuthGuard, logoutUser } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";
import PwaInstallButton from "@/components/PwaInstallButton";
import PwaRoleInstallModal from "@/components/PwaRoleInstallModal";
import PwaRoleMismatchModal from "@/components/PwaRoleMismatchModal";


type MenuItem = { id: string; name: string; price: number; category: string; description: string; isAvailable: boolean };
type Staff = { id: string; username: string; name: string; role: "KASIR" | "DAPUR"; status: "ACTIVE" | "INACTIVE"; onShift: boolean };
type Waiter = { id: string; name: string; phone: string | null; is_active: boolean };
type BusinessTable = { id: string; label: string; sort_order: number; is_active: boolean };
type Profile = { id: string; nama: string; slug: string; is_active: boolean; logo_url: string | null; qris_image_url: string | null; qris_merchant_name: string | null };
type Metrics = { receiptCount: number; cash: number; qris: number; total: number; billing: { tagihan_pokok: number; kode_unik: number; total_tagihan: number; status_bayar: string } | null };
type RevenuePeriod = "day" | "week" | "month" | "year";
type RevenueData = { period: RevenuePeriod; series: { label: string; value: number }[]; total: number; average: number; transactionCount: number };
type ActiveCashier = { shiftId: string; memberId: string; name: string; deviceName: string; openedAt: string; lastActivityAt: string };
type DashboardData = { profile: Profile; menus: MenuItem[]; staff: Staff[]; waiters: Waiter[]; tables: BusinessTable[]; metrics: Metrics; activeCashier: ActiveCashier | null };
type DeviceInstallation = { id: string; device_type: "POS" | "KDS"; device_name: string; status: "ACTIVE" | "REVOKED" | "EXPIRED"; paired_at: string; last_seen_at: string; expires_at: string; revoked_at: string | null };
type OwnerOnboarding = { password_changed_at: string | null; owner_pwa_installed_at: string | null; completed_at: string | null };
type StickerConfig = {
  qrSize: number;
  businessNameSize: number;
  tableLabelSize: number;
  tablePosition: "top" | "bottom";
  tableOffset: number;
  showBusinessName: boolean;
  showInstruction: boolean;
  instructionSize: number;
  instructionText: string;
  selectedTableId: string;
};

const DEFAULT_STICKER_CONFIG: StickerConfig = {
  qrSize: 180,
  businessNameSize: 18,
  tableLabelSize: 28,
  tablePosition: "top",
  tableOffset: 4,
  showBusinessName: true,
  showInstruction: true,
  instructionSize: 12,
  instructionText: "Scan untuk melihat menu & memesan",
  selectedTableId: "",
};

function formatTableDisplay(label: string) {
  const clean = (label || "").trim();
  if (!clean) return "Meja";
  if (/^meja\b/i.test(clean)) return clean;
  return `Meja ${clean}`;
}

const ownerDashboardCache = new Map<string, DashboardData>();

async function ownerFetch(path: string, init?: RequestInit) {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sesi login owner berakhir. Silakan login kembali.");
  const response = await fetch(path, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
  const responseText = await response.text();
  let payload;
  try { payload = responseText ? JSON.parse(responseText) : {}; }
  catch { if (!response.ok) throw new Error(`Server gagal memproses permintaan (${response.status}).`); }
  if (!response.ok) throw new Error(payload.error || "Permintaan gagal diproses.");
  return payload;
}

function validateImage(file: File, maxSize: number, label: string) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error(`${label} harus berupa PNG, JPG, atau WebP.`);
  if (file.size > maxSize) throw new Error(`${label} maksimal ${Math.round(maxSize / 1024 / 1024)} MB.`);
}

function money(value: number) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char);
}

export default function TenantOwnerDashboardPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthorized, loading, roleMismatch } = useAuthGuard(["OWNER"]);

  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [autoHide, setAutoHide] = useState(true);
  const [menuModal, setMenuModal] = useState(false);
  const [staffModal, setStaffModal] = useState(false);
  const [waiterModal, setWaiterModal] = useState(false);
  const [menuForm, setMenuForm] = useState({ name: "", price: "", category: "Kopi", description: "" });
  const [editingMenu, setEditingMenu] = useState<{ id: string; name: string; price: string; category: string; description: string; isAvailable: boolean } | null>(null);
  const [staffForm, setStaffForm] = useState({ username: "", name: "", password: "", role: "KASIR" });
  const [waiterForm, setWaiterForm] = useState({ name: "", phone: "" });
  const [tableInput, setTableInput] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [editingTable, setEditingTable] = useState<BusinessTable | null>(null);
  const [tableEditError, setTableEditError] = useState("");
  const [devices, setDevices] = useState<DeviceInstallation[]>([]);
  const [onboarding, setOnboarding] = useState<OwnerOnboarding | null>(null);
  const [onboardingReady, setOnboardingReady] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>("day");
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const qrisInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const [stickerConfig, setStickerConfig] = useState<StickerConfig>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("okesih_sticker_config");
        if (saved) return { ...DEFAULT_STICKER_CONFIG, ...JSON.parse(saved) };
      } catch {}
    }
    return DEFAULT_STICKER_CONFIG;
  });
  const [previewQrUrl, setPreviewQrUrl] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("okesih_sticker_config", JSON.stringify(stickerConfig));
      } catch {}
    }
  }, [stickerConfig]);

  useEffect(() => {
    let isMounted = true;
    const generatePreview = async () => {
      const slug = data?.profile?.slug || "sample";
      const selectedTable = data?.tables?.find(t => t.id === stickerConfig.selectedTableId) || data?.tables?.[0];
      const tableId = selectedTable?.id || "sample-01";
      const origin = typeof window !== "undefined" ? window.location.origin : "https://okesih.com";
      const url = `${origin}/menu/${slug}?tableId=${encodeURIComponent(tableId)}`;
      try {
        // errorCorrectionLevel: "L" untuk QR Code paling simpel & minim kotak-kotak (mudah discan bahkan saat print non-HD)
        const qr = await QRCode.toDataURL(url, {
          width: Math.max(200, stickerConfig.qrSize * 2),
          margin: 1,
          errorCorrectionLevel: "L",
        });
        if (isMounted) setPreviewQrUrl(qr);
      } catch (e) {
        console.error("Gagal generate preview QR:", e);
      }
    };
    void generatePreview();
    return () => { isMounted = false; };
  }, [data?.profile?.slug, data?.tables, stickerConfig.selectedTableId, stickerConfig.qrSize]);

  const loadDashboard = async () => {
    try {
      setError("");
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Sesi login owner berakhir. Silakan login kembali.");

      const cached = ownerDashboardCache.get(userId);
      if (cached) {
        setData(cached);
        setMerchantName(cached.profile.qris_merchant_name || cached.profile.nama);
        setBusinessName(cached.profile.nama);
      }

      const payload = await ownerFetch("/api/owner/dashboard", { cache: "no-store" });
      ownerDashboardCache.set(userId, payload.data);
      setData(payload.data);
      setMerchantName(payload.data.profile.qris_merchant_name || payload.data.profile.nama);
      setBusinessName(payload.data.profile.nama);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dashboard gagal dimuat.");
    }
  };

  useEffect(() => {
    // Start data synchronization in parallel with the local auth guard.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDashboard();

    // Berlangganan event Realtime Supabase untuk tabel menus dan transactions
    // sehingga status ketersediaan menu (Tersedia / Habis) tersinkron otomatis dengan penjualan kasir
    const supabase = createClient();
    const channel = supabase
      .channel("owner-realtime-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menus" },
        () => {
          void loadDashboard();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        () => {
          void loadDashboard();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shifts" },
        () => {
          void loadDashboard();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const loadDeviceCenter = async () => {
    try {
      const [devicePayload, onboardingPayload] = await Promise.all([
        ownerFetch("/api/owner/devices", { cache: "no-store" }),
        ownerFetch("/api/owner/onboarding", { cache: "no-store" }),
      ]);
      setDevices(devicePayload.devices || []);
      setOnboarding(onboardingPayload.onboarding);
      setOnboardingReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pusat perangkat gagal dimuat.");
    }
  };

  const closeActiveCashierShift = async () => {
    if (!data?.activeCashier) return;
    const amount = window.prompt(`Masukkan kas fisik yang diserahkan oleh ${data.activeCashier.name} (Rp)`, "0");
    if (amount === null) return;
    const actualCash = Number(amount.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(actualCash) || actualCash < 0) return setError("Nominal kas fisik tidak valid.");
    setBusy(true); setError("");
    try {
      await ownerFetch("/api/owner/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId: data.activeCashier.shiftId, actualCash, notes: "Ditutup oleh Owner dari Dashboard Owner." }),
      });
      setNotice("Shift kasir berhasil diakhiri.");
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Shift kasir gagal diakhiri.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!isAuthorized) return;
    const timer = window.setTimeout(() => void loadDeviceCenter(), 0);
    return () => window.clearTimeout(timer);
  }, [isAuthorized]);

  useEffect(() => {
    if (pathname !== "/owner") return;
    const legacyRoutes: Record<string, string> = { "#menu": "/owner/menu", "#staf": "/owner/staff", "#waiter": "/owner/waiters", "#qris": "/owner/qris-tables" };
    const destination = legacyRoutes[window.location.hash];
    if (destination) router.replace(destination);
  }, [pathname, router]);

  useEffect(() => {
    if (!isAuthorized || pathname !== "/owner") return;
    let cancelled = false;
    const loadRevenue = async () => {
      setRevenueLoading(true);
      try {
        const payload = await ownerFetch(`/api/owner/revenue?period=${revenuePeriod}`, { cache: "no-store" });
        if (!cancelled) setRevenueData(payload.data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Grafik omzet gagal dimuat.");
      } finally {
        if (!cancelled) setRevenueLoading(false);
      }
    };
    void loadRevenue();
    return () => { cancelled = true; };
  }, [isAuthorized, pathname, revenuePeriod]);

  const mutate = async (work: () => Promise<unknown>, successMessage?: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try { await work(); await loadDashboard(); if (successMessage) setNotice(successMessage); }
    catch (err) { setError(err instanceof Error ? err.message : "Perubahan gagal disimpan."); }
    finally { setBusy(false); }
  };

  const createMenu = (event: React.FormEvent) => {
    event.preventDefault();
    void mutate(async () => {
      await ownerFetch("/api/owner/menus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...menuForm, price: Number(menuForm.price) }) });
      setMenuModal(false);
      setMenuForm({ name: "", price: "", category: "Kopi", description: "" });
    });
  };

  const updateMenu = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingMenu) return;
    void mutate(async () => {
      await ownerFetch("/api/owner/menus", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingMenu.id,
          name: editingMenu.name,
          price: Number(editingMenu.price),
          category: editingMenu.category,
          description: editingMenu.description,
          isAvailable: editingMenu.isAvailable,
        }),
      });
      setEditingMenu(null);
    });
  };

  const createStaff = (event: React.FormEvent) => {
    event.preventDefault();
    const username = staffForm.username.trim().toLowerCase();
    void mutate(async () => {
      await ownerFetch("/api/owner/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...staffForm, username }) });
      setStaffModal(false);
      setStaffForm({ username: "", name: "", password: "", role: "KASIR" });
    }, `Akun staf @${username} berhasil dibuat.`);
  };

  const createWaiter = (event: React.FormEvent) => {
    event.preventDefault();
    void mutate(async () => {
      await ownerFetch("/api/owner/waiters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(waiterForm) });
      setWaiterModal(false);
      setWaiterForm({ name: "", phone: "" });
    });
  };

  const addTables = () => void mutate(async () => {
    const labels = tableInput.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
    await ownerFetch("/api/owner/tables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ labels }) });
    setTableInput("");
  }, "Daftar meja berhasil disimpan.");

  const uploadQris = (file?: File) => {
    if (!file) return;
    void mutate(async () => {
      try {
        validateImage(file, 3 * 1024 * 1024, "QRIS");
        const form = new FormData();
        form.set("file", file);
        form.set("merchantName", merchantName.trim());
        await ownerFetch("/api/owner/qris", { method: "POST", body: form });
      } finally {
        if (qrisInput.current) qrisInput.current.value = "";
      }
    }, "QRIS berhasil diperbarui.");
  };

  const uploadLogo = (file?: File) => {
    if (!file) return;
    void mutate(async () => {
      try {
        validateImage(file, 2 * 1024 * 1024, "Logo");
        const form = new FormData();
        form.set("file", file);
        await ownerFetch("/api/owner/branding", { method: "POST", body: form });
      } finally {
        if (logoInput.current) logoInput.current.value = "";
      }
    }, "Logo usaha berhasil diperbarui.");
  };

  const saveBusinessName = () => void mutate(
    () => ownerFetch("/api/owner/branding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessName }) }),
    "Nama usaha berhasil disimpan."
  );

  const saveMerchantName = () => void mutate(
    () => ownerFetch("/api/owner/qris", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ merchantName }) }),
    "Nama merchant berhasil disimpan."
  );

  const updateTable = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingTable) return;
    const cleanLabel = editingTable.label.trim().replace(/^meja\s+/i, "").trim() || editingTable.label.trim();
    if (!cleanLabel) {
      setTableEditError("Nama atau nomor meja tidak boleh kosong.");
      return;
    }

    setBusy(true);
    setTableEditError("");
    setError("");
    try {
      await ownerFetch("/api/owner/tables", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingTable.id, label: cleanLabel }),
      });

      ownerDashboardCache.clear();

      setData((prev) => {
        if (!prev) return prev;
        const updatedTables = prev.tables
          .filter((t) => t.id === editingTable.id || t.label.toLowerCase() !== cleanLabel.toLowerCase())
          .map((t) => (t.id === editingTable.id ? { ...t, label: cleanLabel } : t));
        return { ...prev, tables: updatedTables };
      });

      setNotice(`Nama meja berhasil diganti menjadi "${formatTableDisplay(cleanLabel)}".`);
      setEditingTable(null);
      await loadDashboard();
    } catch (err) {
      setTableEditError(err instanceof Error ? err.message : "Gagal memperbarui nama meja.");
    } finally {
      setBusy(false);
    }
  };

  const printTableStickers = async (singleTableId?: string) => {
    if (!data?.tables.length) return setError("Tambahkan meja terlebih dahulu.");
    const tablesToPrint = singleTableId
      ? data.tables.filter((t) => t.id === singleTableId)
      : data.tables;
    if (!tablesToPrint.length) return setError("Meja yang dipilih tidak ditemukan.");

    const cards = await Promise.all(
      tablesToPrint.map(async (table) => {
        const url = `${window.location.origin}/menu/${data.profile.slug}?tableId=${encodeURIComponent(table.id)}`;
        return {
          table,
          url,
          qr: await QRCode.toDataURL(url, {
            width: Math.max(260, stickerConfig.qrSize * 2),
            margin: 1,
            errorCorrectionLevel: "L", // Level L (Low) menghasilkan QR Code paling simpel & minim kotak-kotak agar mudah discan HP walau cetak non-HD
          }),
        };
      })
    );

    const popup = window.open("", "_blank");
    if (!popup) return setError("Izinkan pop-up browser untuk mencetak stiker meja.");

    const isTop = stickerConfig.tablePosition === "top";
    const showBiz = stickerConfig.showBusinessName;
    const showInst = stickerConfig.showInstruction;

    popup.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Stiker Meja ${escapeHtml(data.profile.nama)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 20px; background: #fff; color: #0f172a; }
    .toolbar { margin-bottom: 20px; display: flex; gap: 12px; align-items: center; }
    .print-btn { background: #ea580c; color: #fff; border: 0; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 14px; }
    .toolbar span { font-size: 13px; color: #64748b; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .card {
      border: 2px solid #0f172a;
      border-radius: 16px;
      padding: 18px;
      text-align: center;
      break-inside: avoid;
      background: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    }
    .biz-name {
      font-size: ${stickerConfig.businessNameSize}px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 4px;
      line-height: 1.2;
    }
    .table-label {
      font-size: ${stickerConfig.tableLabelSize}px;
      font-weight: 900;
      color: #0f172a;
      margin-top: ${stickerConfig.tableOffset}px;
      margin-bottom: ${stickerConfig.tableOffset}px;
      line-height: 1.1;
      letter-spacing: -0.5px;
    }
    .qr-img {
      width: ${stickerConfig.qrSize}px;
      height: ${stickerConfig.qrSize}px;
      display: block;
      margin: 4px auto;
    }
    .instruction {
      font-size: ${stickerConfig.instructionSize}px;
      font-weight: 600;
      color: #334155;
      margin-top: 6px;
    }
    .url {
      font-size: 9px;
      color: #64748b;
      margin-top: 4px;
      word-break: break-all;
    }
    @media print {
      body { margin: 0; }
      .toolbar { display: none; }
      .grid { gap: 14px; }
      .card { page-break-inside: avoid; border: 2px solid #000; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="print-btn" onclick="window.print()">🖨️ Cetak Stiker Meja</button>
    <span>(Format sesuai hasil preview live di Dashboard Owner)</span>
  </div>
  <div class="grid">
    ${cards
      .map(
        ({ table, url, qr }) => `
      <div class="card">
        ${showBiz ? `<div class="biz-name">${escapeHtml(data.profile.nama)}</div>` : ""}
        ${isTop ? `<div class="table-label">${escapeHtml(formatTableDisplay(table.label))}</div>` : ""}
        <img class="qr-img" src="${qr}" alt="QR ${escapeHtml(formatTableDisplay(table.label))}"/>
        ${!isTop ? `<div class="table-label">${escapeHtml(formatTableDisplay(table.label))}</div>` : ""}
        ${showInst ? `<div class="instruction">${escapeHtml(stickerConfig.instructionText || "Scan untuk melihat menu & memesan")}</div>` : ""}
        <div class="url">${escapeHtml(url)}</div>
      </div>
    `
      )
      .join("")}
  </div>
  <script>window.onload=()=>window.print()</script>
</body>
</html>`);
    popup.document.close();
  };

  const deviceAction = async (body: Record<string, unknown>) => {
    setBusy(true); setError("");
    try {
      await ownerFetch("/api/owner/devices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setPairingCode("");
      await loadDeviceCenter();
    } catch (err) { setError(err instanceof Error ? err.message : "Perangkat gagal diperbarui."); }
    finally { setBusy(false); }
  };

  const onboardingAction = async (body: Record<string, unknown>) => {
    setBusy(true); setError("");
    try {
      const payload = await ownerFetch("/api/owner/onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setOnboarding(payload.onboarding);
      if (body.action === "change_password") setNewPassword("");
    } catch (err) { setError(err instanceof Error ? err.message : "Onboarding gagal diperbarui."); }
    finally { setBusy(false); }
  };

  if (roleMismatch) {
    return (
      <PwaRoleMismatchModal
        isOpen={true}
        pwaKind={roleMismatch.pwaKind}
      />
    );
  }

  if (loading || !isAuthorized || !data) return (
    <div className="owner-loading" role="status" aria-label="Menyiapkan portal owner OKESIH">
      <div className="owner-loading-brand">
        <span className="owner-loading-halo" />
        <img src="/okesih-logo-animated.svg" alt="OKESIH.COM" />
        <div className="owner-loading-wordmark"><b>OKESIH</b><small>.COM</small></div>
        <div className="owner-loading-progress"><i /></div>
        {error && <button onClick={() => void loadDashboard()}>Coba Lagi</button>}
      </div>
    </div>
  );

  const { profile, metrics } = data;
  const categorySuggestions = Array.from(new Set(["Kopi", "Dingin", "Makanan", "Camilan", "Lainnya", ...data.menus.map((menu) => menu.category)])).sort((a, b) => a.localeCompare(b, "id"));
  const revenueSeries = revenueData?.series || [];
  const revenueMaximum = Math.max(...revenueSeries.map((item) => item.value), 1);
  const chartWidth = 900;
  const chartHeight = 230;
  const chartPadding = 18;
  const revenuePoints = revenueSeries.map((item, index) => {
    const x = revenueSeries.length <= 1 ? chartWidth / 2 : chartPadding + (index / (revenueSeries.length - 1)) * (chartWidth - chartPadding * 2);
    const y = chartHeight - chartPadding - (item.value / revenueMaximum) * (chartHeight - chartPadding * 2);
    return { ...item, x, y };
  });
  const linePath = revenuePoints.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const areaPath = revenuePoints.length ? `${linePath} L${revenuePoints.at(-1)?.x},${chartHeight - chartPadding} L${revenuePoints[0].x},${chartHeight - chartPadding} Z` : "";
  const view = pathname.endsWith("/menu") ? "menu" : pathname.endsWith("/staff") ? "staff" : pathname.endsWith("/waiters") ? "waiters" : pathname.endsWith("/qris-tables") ? "qris-tables" : pathname.endsWith("/devices") ? "devices" : "overview";
  const navItems = [
    { icon: "⌂", label: "Home", mobileLabel: "Home", href: "/owner", itemView: "overview" },
    { icon: "♟", label: "Akun Staf", mobileLabel: "Staf", href: "/owner/staff", itemView: "staff" },
    { icon: "◫", label: "Katalog Menu", mobileLabel: "Katalog", href: "/owner/menu", itemView: "menu" },
    { icon: "⌁", label: "Perangkat", mobileLabel: "Perangkat", href: "/owner/devices", itemView: "devices" },
    { icon: "▣", label: "QRIS & Meja", mobileLabel: "Qris & Meja", href: "/owner/qris-tables", itemView: "qris-tables" },
  ];

  return (
    <div className={`owner-shell ${sidebarExpanded ? "sidebar-open" : "sidebar-closed"}`}>
      {/* Popup Install Otomatis Pasca Login Khusus Owner */}
      <PwaRoleInstallModal pwaKind="owner" />

      <aside className="owner-sidebar" onMouseEnter={() => autoHide && setSidebarExpanded(true)} onMouseLeave={() => autoHide && setSidebarExpanded(false)}>

        <div className="owner-sidebar-head"><span className="owner-sidebar-mark">O</span><b>OWNER SPACE</b><button className="owner-sidebar-toggle" onClick={() => setSidebarExpanded((value) => !value)} aria-label="Buka atau ciutkan sidebar">☰</button></div>
        <nav>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={view === item.itemView ? "active" : ""}
              aria-current={view === item.itemView ? "page" : undefined}
            >
              <span>{item.icon}</span>
              <b className="owner-nav-desktop-label">{item.label}</b>
              <b className="owner-nav-mobile-label">{item.mobileLabel}</b>
            </Link>
          ))}
        </nav>
        <div className="owner-sidebar-footer">
          <button type="button" className="owner-sidebar-logout" onClick={logoutUser} title="Keluar dari Akun Owner" aria-label="Keluar dari akun owner">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span>Keluar</span>
          </button>
          <label className="owner-autohide"><input type="checkbox" checked={autoHide} onChange={(event) => setAutoHide(event.target.checked)} /><span>Auto-hide</span></label>
        </div>
      </aside>

      <div className="owner-content">
        <header className={`owner-topbar ${view === "overview" ? "is-home" : "is-subpage"}`}>
          {view === "overview" ? (
            <>
              <div className="owner-brand">
                <img src={profile.logo_url || "/logo.svg?v=2"} alt={profile.logo_url ? `Logo ${profile.nama}` : "OKESIH"}/>
                <div>
                  <strong>{profile.nama}</strong>
                  <small>PORTAL OWNER BISNIS</small>
                </div>
                <span className="owner-status">● {profile.is_active ? "Buka & Beroperasi" : "Tidak Aktif"}</span>
              </div>
              <div className="owner-home-divider" aria-hidden="true" />
            </>
          ) : (
            <div className="owner-subpage-title">
              <h1>
                {view === "menu"
                  ? "Katalog Menu"
                  : view === "staff"
                  ? "Akun Staf"
                  : view === "waiters"
                  ? "Daftar Waiter"
                  : view === "qris-tables"
                  ? "QRIS & Meja"
                  : view === "devices"
                  ? "Perangkat & PWA"
                  : "Portal Owner"}
              </h1>
              <p>
                {view === "menu"
                  ? "Kelola menu, varian, harga jual, dan ketersediaan stok"
                  : view === "staff"
                  ? "Kelola akun login staf kasir dan barista/dapur"
                  : view === "waiters"
                  ? "Kelola daftar pelayan aktif usaha Anda"
                  : view === "qris-tables"
                  ? "Identitas toko, QRIS statis, dan cetak stiker meja"
                  : view === "devices"
                  ? "Pairing perangkat POS tablet kasir dan layar KDS dapur"
                  : ""}
              </p>
            </div>
          )}
          <div className="owner-actions"><ThemeToggle/><PwaInstallButton label="Install Owner" compact onInstalled={() => void onboardingAction({ action: "pwa_installed" })}/><Link href="/pos" target="_blank" rel="noopener noreferrer" className="btn-secondary">Layar Kasir</Link><Link href="/kds" target="_blank" rel="noopener noreferrer" className="btn-secondary">Layar Dapur</Link></div>
        </header>

        <main className="owner-main">
          {error && <div className="owner-error">{error}<button onClick={() => setError("")}>×</button></div>}
          {notice && <div className="owner-success">{notice}<button onClick={() => setNotice("")}>×</button></div>}
          {view === "overview" && <section id="ringkasan">
            <div className="owner-section-heading"><div><h1>Ringkasan Penjualan Hari Ini</h1><p>Pantau omzet tunai vs QRIS, kas di laci kasir, dan pembayaran sewa OKESIH.</p></div></div>
            <div className={`owner-cashier-status ${data.activeCashier ? "is-active" : ""}`}>
              <div><small>KASIR SAAT INI</small>{data.activeCashier ? <><b>● {data.activeCashier.name}</b><span>{data.activeCashier.deviceName} · mulai {new Date(data.activeCashier.openedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span></> : <><b>Belum ada shift aktif</b><span>Kasir perlu masuk pada perangkat POS yang sudah dipairing.</span></>}</div>
              {data.activeCashier && <button className="btn-secondary" disabled={busy} onClick={() => void closeActiveCashierShift()}>Akhiri Shift</button>}
            </div>
            <div className="owner-metrics">
              <article className="metric-revenue"><span className="metric-icon">↗</span><small>TOTAL OMZET PENJUALAN</small><strong>{money(metrics.total)}</strong><p>{metrics.receiptCount} transaksi hari ini</p></article>
              <article className="metric-payment"><span className="metric-icon">◈</span><small>RINCIAN PEMBAYARAN</small><b>Tunai <em>{money(metrics.cash)}</em></b><b>QRIS <em>{money(metrics.qris)}</em></b></article>
              <article className="metric-cash"><span className="metric-icon">▤</span><small>UANG FISIK DI LACI KASIR</small><strong className="green">{money(metrics.cash)}</strong><p>Nilai berdasarkan pembayaran tunai</p></article>
              <article className="metric-billing"><span className="metric-icon">◎</span><small>SEWA SAAS OKESIH</small><strong className="yellow">{money(Number(metrics.billing?.total_tagihan || 0))}</strong><p>{metrics.billing?.status_bayar || "Belum ditagihkan"}</p></article>
            </div>
            <section className={`owner-revenue-chart ${revenueLoading ? "is-loading" : ""}`} aria-labelledby="owner-chart-title">
              <header>
                <div><span>ANALITIK PENJUALAN</span><h2 id="owner-chart-title">Grafik Omzet Penjualan</h2><p>Pergerakan omzet dari transaksi tunai dan QRIS yang sudah tercatat.</p></div>
                <div className="owner-chart-filters" aria-label="Filter periode grafik omzet">
                  {(["day", "week", "month", "year"] as RevenuePeriod[]).map((period) => <button key={period} className={revenuePeriod === period ? "active" : ""} onClick={() => setRevenuePeriod(period)}>{({ day: "Hari", week: "Minggu", month: "Bulan", year: "Tahun" })[period]}</button>)}
                </div>
              </header>
              <div className="owner-chart-stats">
                <div><small>Total periode</small><strong>{money(revenueData?.total || 0)}</strong></div>
                <div><small>Rata-rata</small><b>{money(revenueData?.average || 0)}</b></div>
                <div><small>Transaksi</small><b>{revenueData?.transactionCount || 0} struk</b></div>
              </div>
              <div className="owner-line-chart">
                <div className="owner-y-axis"><span>{money(revenueMaximum)}</span><span>{money(Math.round(revenueMaximum / 2))}</span><span>Rp 0</span></div>
                <div className="owner-plot">
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" role="img" aria-label={`Grafik omzet periode ${revenuePeriod}`}>
                    <defs><linearGradient id="ownerRevenueArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f4512c" stopOpacity="0.3"/><stop offset="100%" stopColor="#f4512c" stopOpacity="0.02"/></linearGradient></defs>
                    <line x1="0" y1="18" x2="900" y2="18" className="chart-grid-line"/><line x1="0" y1="115" x2="900" y2="115" className="chart-grid-line"/><line x1="0" y1="212" x2="900" y2="212" className="chart-grid-line"/>
                    {areaPath && <path d={areaPath} fill="url(#ownerRevenueArea)"/>}
                    {linePath && <path d={linePath} className="chart-revenue-line"/>}
                    {revenuePoints.map((point, index) => <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r="5" className="chart-revenue-point"><title>{point.label}: {money(point.value)}</title></circle>)}
                  </svg>
                  <div className="owner-x-axis">{revenueSeries.map((item, index) => <span key={`${item.label}-${index}`}>{item.label}</span>)}</div>
                  {!revenueLoading && revenueData?.transactionCount === 0 && <div className="owner-chart-empty"><b>Belum ada transaksi</b><span>Grafik akan terisi otomatis ketika penjualan tercatat.</span></div>}
                </div>
              </div>
            </section>
            <div className="owner-quick-grid">
              {[
                { icon: "◫", label: "Katalog Menu", desc: "Kelola daftar menu, varian, dan harga jual warkop", href: "/owner/menu" },
                { icon: "♟", label: "Akun Staf", desc: "Kelola akun login kasir dan barista / dapur", href: "/owner/staff" },
                { icon: "♙", label: "Waiter", desc: "Kelola daftar pelayan sesuai kondisi nyata usaha", href: "/owner/waiters" },
                { icon: "▣", label: "QRIS & Meja", desc: "Atur QRIS statis dan cetak stiker QR meja", href: "/owner/qris-tables" },
                { icon: "⌁", label: "Perangkat & PWA", desc: "Pairing perangkat POS, KDS, dan status aplikasi", href: "/owner/devices" },
              ].map((item) => (
                <Link key={item.href} href={item.href}>
                  <span>{item.icon}</span>
                  <div>
                    <b>{item.label}</b>
                    <small>{item.desc}</small>
                  </div>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="owner-quick-arrow" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>
                </Link>
              ))}
            </div>

            {/* Tombol Keluar Akun Owner di Bagian Bawah Halaman Home */}
            <div className="owner-home-logout-wrap">
              <button
                type="button"
                onClick={logoutUser}
                className="owner-home-logout-btn"
                title="Keluar dari Akun Owner"
                aria-label="Keluar dari akun owner"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Keluar dari Akun Owner</span>
              </button>
            </div>
          </section>}

          {view === "menu" && <section id="menu" className="owner-panel owner-page-panel owner-menu-catalog-page">
            <div className="owner-section-heading owner-menu-heading">
              <div className="owner-menu-heading-title">
                <h2>Katalog Menu</h2>
              </div>
              <div className="owner-menu-actions">
                <Link
                  href={`/menu/${profile.slug}${data.tables[0] ? `?tableId=${encodeURIComponent(data.tables[0].id)}` : ""}`}
                  target="_blank"
                  className="owner-menu-btn owner-menu-btn-preview"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  <span>
                    Preview Menu
                    <small>Pelanggan</small>
                  </span>
                </Link>
                <button
                  type="button"
                  className="owner-menu-btn owner-menu-btn-add"
                  onClick={() => setMenuModal(true)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span>
                    Tambah
                    <small>Menu Baru</small>
                  </span>
                </button>
              </div>
            </div>

            {/* Desktop / Tablet Table View */}
            <div className="owner-table-wrap owner-menu-desktop-table">
              <table>
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Kategori</th>
                    <th>Harga</th>
                    <th>Deskripsi</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.menus.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState icon="◫" title="Katalog masih kosong" text="Tambahkan menu pertama agar langsung tampil di kasir dan menu pelanggan." />
                      </td>
                    </tr>
                  )}
                  {data.menus.map((menu) => (
                    <tr key={menu.id}>
                      <td><b>{menu.name}</b></td>
                      <td><span className="owner-category">{menu.category}</span></td>
                      <td><strong>{money(menu.price)}</strong></td>
                      <td>{menu.description}</td>
                      <td>
                        <button
                          className={menu.isAvailable ? "pill active" : "pill"}
                          disabled={busy}
                          onClick={() => void mutate(() => ownerFetch("/api/owner/menus", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: menu.id, isAvailable: !menu.isAvailable }) }))}
                        >
                          {menu.isAvailable ? "● Tersedia" : "○ Habis"}
                        </button>
                      </td>
                      <td>
                        <button
                          className="link-button"
                          onClick={() => setEditingMenu({
                            id: menu.id,
                            name: menu.name,
                            price: String(menu.price),
                            category: menu.category,
                            description: menu.description === "-" ? "" : menu.description,
                            isAvailable: menu.isAvailable,
                          })}
                        >
                          Edit
                        </button>
                        <button className="link-button danger" onClick={() => confirm(`Hapus ${menu.name}?`) && void mutate(() => ownerFetch(`/api/owner/menus?id=${menu.id}`, { method: "DELETE" }))}>Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile PWA Card List View */}
            <div className="owner-menu-mobile-list">
              {data.menus.length === 0 && (
                <EmptyState icon="◫" title="Katalog masih kosong" text="Tambahkan menu pertama agar langsung tampil di kasir dan menu pelanggan." />
              )}
              {data.menus.map((menu) => (
                <article key={menu.id} className={`owner-menu-card ${menu.isAvailable ? "is-available" : "is-out"}`}>
                  <div className="owner-menu-card-head">
                    <div className="owner-menu-card-title">
                      <b>{menu.name}</b>
                      <span className="owner-category">{menu.category}</span>
                    </div>
                    <strong className="owner-menu-card-price">{money(menu.price)}</strong>
                  </div>
                  {menu.description && (
                    <p className="owner-menu-card-desc">{menu.description}</p>
                  )}
                  <div className="owner-menu-card-footer">
                    <button
                      type="button"
                      className={`pill ${menu.isAvailable ? "active" : ""}`}
                      disabled={busy}
                      onClick={() => void mutate(() => ownerFetch("/api/owner/menus", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: menu.id, isAvailable: !menu.isAvailable }) }))}
                    >
                      {menu.isAvailable ? "● Tersedia" : "○ Habis"}
                    </button>
                    <div className="owner-menu-card-actions">
                      <button
                        type="button"
                        className="owner-menu-btn-edit"
                        onClick={() => setEditingMenu({
                          id: menu.id,
                          name: menu.name,
                          price: String(menu.price),
                          category: menu.category,
                          description: menu.description === "-" ? "" : menu.description,
                          isAvailable: menu.isAvailable,
                        })}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="owner-menu-btn-delete"
                        onClick={() => confirm(`Hapus ${menu.name}?`) && void mutate(() => ownerFetch(`/api/owner/menus?id=${menu.id}`, { method: "DELETE" }))}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>}

          {view === "staff" && <section id="staf" className="owner-panel owner-page-panel">
            <div className="owner-section-heading"><div><h2>Manajemen Akun Staf (Kasir &amp; Barista, dll.)</h2><p>Akun login staf tersimpan dan terisolasi untuk usaha ini.</p></div><button className="btn-primary" onClick={() => setStaffModal(true)}>+ Tambah Staf</button></div>
            <div className="owner-table-wrap"><table><thead><tr><th>Username</th><th>Nama</th><th>Peran</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{data.staff.length === 0 && <tr><td colSpan={5}><EmptyState icon="♟" title="Belum ada akun staf" text="Buat akun kasir atau barista agar akses operasional terpisah dan aman." /></td></tr>}{data.staff.map((staff) => <tr key={staff.id}><td><b>{staff.username}</b></td><td>{staff.name}</td><td><span className="owner-category">{staff.role}</span></td><td><span className={staff.onShift ? "owner-dot shift" : staff.status === "ACTIVE" ? "owner-dot active" : "owner-dot"}>{staff.onShift ? "● Sedang shift" : staff.status === "ACTIVE" ? "● Aktif" : "○ Nonaktif"}</span></td><td><button className="link-button" onClick={() => { const password = prompt(`Password baru untuk ${staff.username} (minimal 6 karakter)`); if (password) void mutate(() => ownerFetch("/api/owner/staff", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: staff.id, password }) })); }}>Reset Password</button>{staff.onShift && <button className="link-button danger" disabled={busy} onClick={() => void closeActiveCashierShift()}>Akhiri Shift</button>}<button className="link-button" disabled={staff.onShift} onClick={() => void mutate(() => ownerFetch("/api/owner/staff", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: staff.id, isActive: staff.status !== "ACTIVE" }) }))}>{staff.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}</button></td></tr>)}</tbody></table></div>
          </section>}

          {view === "waiters" && <section id="waiter" className="owner-panel owner-page-panel">
            <div className="owner-section-heading"><div><h2>Daftar Waiter</h2><p>Kelola pelayan sesuai kondisi nyata usaha.</p></div><button className="btn-primary" onClick={() => setWaiterModal(true)}>+ Tambah Waiter</button></div>
            <div className="owner-card-grid">{data.waiters.length === 0 && <EmptyState icon="♙" title="Daftar waiter masih kosong" text="Tambahkan waiter sesuai kondisi aktual usaha Anda." />}{data.waiters.map((waiter) => <article key={waiter.id} className="owner-small-card"><span className="owner-avatar">{waiter.name.slice(0, 1).toUpperCase()}</span><b>{waiter.name}</b><span>{waiter.phone || "Tanpa nomor telepon"}</span><button className="link-button danger" onClick={() => confirm(`Hapus ${waiter.name}?`) && void mutate(() => ownerFetch(`/api/owner/waiters?id=${waiter.id}`, { method: "DELETE" }))}>Hapus</button></article>)}</div>
          </section>}

          {view === "qris-tables" && <section id="qris" className="owner-settings-grid owner-page-panel owner-qris-page">
            <article className="owner-panel owner-branding-panel">
              <h2>Identitas &amp; Logo Usaha</h2><p>Logo aktif otomatis tampil pada menu pelanggan, layar Kasir, dan layar Dapur. Jika belum diunggah, sistem menggunakan logo OKESIH.</p>
              <div className="owner-logo-preview"><img src={profile.logo_url || "/logo.svg?v=2"} alt={profile.logo_url ? `Logo ${profile.nama}` : "Logo OKESIH"}/></div>
              <label>Nama Usaha<input maxLength={150} value={businessName} onChange={(event) => setBusinessName(event.target.value)} /></label>
              <button disabled={busy || businessName.trim().length < 2 || businessName.trim() === profile.nama} className="btn-secondary owner-save-field" onClick={saveBusinessName}>Simpan Nama Usaha</button>
              <input ref={logoInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadLogo(event.target.files?.[0])}/>
              <div className="owner-branding-actions"><button disabled={busy} className="btn-primary" onClick={() => logoInput.current?.click()}>{busy ? "Menyimpan..." : profile.logo_url ? "Ganti Logo Usaha" : "Upload Logo Usaha"}</button>{profile.logo_url && <button disabled={busy} className="btn-secondary" onClick={() => confirm("Hapus logo usaha dan gunakan logo OKESIH?") && void mutate(() => ownerFetch("/api/owner/branding", { method: "DELETE" }), "Logo usaha berhasil dihapus.")}>Gunakan Logo OKESIH</button>}</div>
              <small>PNG, JPG, atau WebP · Maksimal 2 MB · Disarankan rasio 1:1.</small>
            </article>

            <article className="owner-panel">
              <h2>QRIS Statis Toko</h2><p>Satu gambar aktif per tenant. Gambar baru otomatis menggantikan gambar lama tanpa duplikasi.</p>
              {profile.qris_image_url ? <img className="owner-qris-preview" src={profile.qris_image_url} alt={`QRIS ${profile.nama}`}/> : <div className="owner-qris-placeholder">Belum ada QRIS</div>}
              <label>Nama Merchant<input maxLength={180} value={merchantName} onChange={(event) => setMerchantName(event.target.value)} /></label>
              <button disabled={busy || !merchantName.trim() || merchantName.trim() === (profile.qris_merchant_name || profile.nama)} className="btn-secondary owner-save-field" onClick={saveMerchantName}>Simpan Nama Merchant</button>
              <input ref={qrisInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadQris(event.target.files?.[0])}/>
              <button disabled={busy || !merchantName.trim()} className="btn-primary" onClick={() => qrisInput.current?.click()}>{busy ? "Menyimpan..." : "Upload / Ganti QRIS"}</button>
            </article>

            <article className="owner-panel">
              <h2>Cetak Stiker QR Code Meja</h2><p>Masukkan nomor atau nama meja sesuai kondisi nyata, dipisahkan koma atau baris baru.</p>
              <div className="owner-table-input"><textarea rows={3} value={tableInput} onChange={(event) => setTableInput(event.target.value)} placeholder="Contoh: 01, 02, Teras 1, VIP"/><button disabled={busy || !tableInput.trim()} className="btn-primary" onClick={addTables}>Tambah Meja</button></div>
              <div className="owner-table-chips">{data.tables.map((table) => <span key={table.id}><Link target="_blank" href={`/menu/${profile.slug}?tableId=${encodeURIComponent(table.id)}`}>{formatTableDisplay(table.label)}</Link><button aria-label={`Edit meja ${table.label}`} onClick={() => { setTableEditError(""); setEditingTable({ ...table, label: table.label.replace(/^meja\s+/i, "") }); }}>✎</button><button aria-label={`Hapus meja ${table.label}`} onClick={() => confirm(`Hapus meja ${table.label}?`) && void mutate(() => ownerFetch(`/api/owner/tables?id=${table.id}`, { method: "DELETE" }), "Meja berhasil dihapus.")}>×</button></span>)}</div>
              <button className="btn-primary" disabled={!data.tables.length} onClick={() => void printTableStickers()}>🖨️ Cetak Semua Stiker QR Meja</button>
            </article>

            <article className="owner-panel owner-sticker-preview-card">
              <div className="owner-sticker-header">
                <div>
                  <h2>Preview &amp; Desain Stiker QR Meja</h2>
                  <p>QR code otomatis dibuat simpel agar mudah discan HP walau diprint non-HD. Geser kontrol di bawah untuk melihat perubahan secara live.</p>
                </div>
                <button
                  type="button"
                  className="owner-btn-reset-sticker"
                  onClick={() => setStickerConfig({ ...DEFAULT_STICKER_CONFIG, selectedTableId: stickerConfig.selectedTableId })}
                  title="Kembalikan ukuran dan posisi ke pengaturan default"
                >
                  ↺ Reset Desain
                </button>
              </div>

              {/* Selector Meja Sampel */}
              <div className="owner-sticker-sample-bar">
                <label>
                  <span>Pilih Meja Contoh:</span>
                  <select
                    value={stickerConfig.selectedTableId}
                    onChange={(e) => setStickerConfig({ ...stickerConfig, selectedTableId: e.target.value })}
                  >
                    {data.tables.length === 0 ? (
                      <option value="">(Contoh Meja 01)</option>
                    ) : (
                      data.tables.map((table) => (
                        <option key={table.id} value={table.id}>
                          {formatTableDisplay(table.label)}
                        </option>
                      ))
                    )}
                  </select>
                </label>
              </div>

              {/* Live Preview Display Box */}
              <div className="owner-sticker-preview-viewport">
                <div className="owner-sticker-badge-live">● LIVE PREVIEW</div>
                <div className="owner-sticker-sheet">
                  {stickerConfig.showBusinessName && (
                    <div
                      className="owner-sticker-biz-name"
                      style={{ fontSize: `${stickerConfig.businessNameSize}px` }}
                    >
                      {businessName || profile.nama}
                    </div>
                  )}

                  {stickerConfig.tablePosition === "top" && (
                    <div
                      className="owner-sticker-table-label"
                      style={{
                        fontSize: `${stickerConfig.tableLabelSize}px`,
                        marginTop: `${stickerConfig.tableOffset}px`,
                        marginBottom: `${stickerConfig.tableOffset}px`,
                      }}
                    >
                      {formatTableDisplay((data.tables.find((t) => t.id === stickerConfig.selectedTableId) || data.tables[0])?.label || "01")}
                    </div>
                  )}

                  <div className="owner-sticker-qr-wrapper">
                    {previewQrUrl ? (
                      <img
                        src={previewQrUrl}
                        alt="QR Code Meja"
                        style={{
                          width: `${stickerConfig.qrSize}px`,
                          height: `${stickerConfig.qrSize}px`,
                        }}
                      />
                    ) : (
                      <div
                        className="owner-sticker-qr-loading"
                        style={{
                          width: `${stickerConfig.qrSize}px`,
                          height: `${stickerConfig.qrSize}px`,
                        }}
                      >
                        Membuat QR simpel...
                      </div>
                    )}
                  </div>

                  {stickerConfig.tablePosition === "bottom" && (
                    <div
                      className="owner-sticker-table-label"
                      style={{
                        fontSize: `${stickerConfig.tableLabelSize}px`,
                        marginTop: `${stickerConfig.tableOffset}px`,
                        marginBottom: `${stickerConfig.tableOffset}px`,
                      }}
                    >
                      {formatTableDisplay((data.tables.find((t) => t.id === stickerConfig.selectedTableId) || data.tables[0])?.label || "01")}
                    </div>
                  )}

                  {stickerConfig.showInstruction && (
                    <div
                      className="owner-sticker-instruction"
                      style={{ fontSize: `${stickerConfig.instructionSize}px` }}
                    >
                      {stickerConfig.instructionText || "Scan untuk melihat menu & memesan"}
                    </div>
                  )}

                  <div className="owner-sticker-url">
                    {typeof window !== "undefined" ? window.location.origin : "https://okesih.com"}/menu/{profile.slug}?tableId={(data.tables.find((t) => t.id === stickerConfig.selectedTableId) || data.tables[0])?.id || "sample"}
                  </div>
                </div>
              </div>

              {/* Real-time Controls */}
              <div className="owner-sticker-controls">
                <div className="owner-sticker-control-group">
                  <div className="owner-sticker-control-header">
                    <span>Ukuran QR Code</span>
                    <b>{stickerConfig.qrSize} px</b>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="260"
                    step="5"
                    value={stickerConfig.qrSize}
                    onChange={(e) => setStickerConfig({ ...stickerConfig, qrSize: Number(e.target.value) })}
                  />
                  <div className="owner-sticker-slider-hints"><span>Kecil (100px)</span><span>Besar (260px)</span></div>
                </div>

                <div className="owner-sticker-control-group">
                  <div className="owner-sticker-control-header">
                    <span>Ukuran Nomor Meja</span>
                    <b>{stickerConfig.tableLabelSize} px</b>
                  </div>
                  <input
                    type="range"
                    min="16"
                    max="48"
                    step="1"
                    value={stickerConfig.tableLabelSize}
                    onChange={(e) => setStickerConfig({ ...stickerConfig, tableLabelSize: Number(e.target.value) })}
                  />
                  <div className="owner-sticker-slider-hints"><span>Kecil (16px)</span><span>Sangat Besar (48px)</span></div>
                </div>

                <div className="owner-sticker-control-group">
                  <div className="owner-sticker-control-header">
                    <span>Posisi Nomor Meja</span>
                    <b>{stickerConfig.tablePosition === "top" ? "Di Atas QR Code" : "Di Bawah QR Code"}</b>
                  </div>
                  <div className="owner-sticker-position-switch">
                    <button
                      type="button"
                      className={stickerConfig.tablePosition === "top" ? "active" : ""}
                      onClick={() => setStickerConfig({ ...stickerConfig, tablePosition: "top" })}
                    >
                      ▲ Di Atas QR Code
                    </button>
                    <button
                      type="button"
                      className={stickerConfig.tablePosition === "bottom" ? "active" : ""}
                      onClick={() => setStickerConfig({ ...stickerConfig, tablePosition: "bottom" })}
                    >
                      ▼ Di Bawah QR Code
                    </button>
                  </div>
                </div>

                <div className="owner-sticker-control-group">
                  <div className="owner-sticker-control-header">
                    <span>Geser Vertikal Posisi Nomor Meja</span>
                    <b>{stickerConfig.tableOffset} px</b>
                  </div>
                  <input
                    type="range"
                    min="-12"
                    max="30"
                    step="1"
                    value={stickerConfig.tableOffset}
                    onChange={(e) => setStickerConfig({ ...stickerConfig, tableOffset: Number(e.target.value) })}
                  />
                  <div className="owner-sticker-slider-hints"><span>Mendekat (-12px)</span><span>Menjauh (+30px)</span></div>
                </div>

                <div className="owner-sticker-control-group">
                  <div className="owner-sticker-control-header">
                    <span>Ukuran Nama Usaha</span>
                    <b>{stickerConfig.businessNameSize} px</b>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="30"
                    step="1"
                    value={stickerConfig.businessNameSize}
                    onChange={(e) => setStickerConfig({ ...stickerConfig, businessNameSize: Number(e.target.value) })}
                  />
                  <div className="owner-sticker-slider-hints"><span>Kecil (12px)</span><span>Besar (30px)</span></div>
                </div>

                <div className="owner-sticker-toggles">
                  <label className="owner-sticker-checkbox">
                    <input
                      type="checkbox"
                      checked={stickerConfig.showBusinessName}
                      onChange={(e) => setStickerConfig({ ...stickerConfig, showBusinessName: e.target.checked })}
                    />
                    <span>Tampilkan Nama Usaha</span>
                  </label>
                  <label className="owner-sticker-checkbox">
                    <input
                      type="checkbox"
                      checked={stickerConfig.showInstruction}
                      onChange={(e) => setStickerConfig({ ...stickerConfig, showInstruction: e.target.checked })}
                    />
                    <span>Tampilkan Petunjuk Scan</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="owner-sticker-actions">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!data.tables.length}
                  onClick={() => void printTableStickers()}
                >
                  🖨️ Cetak Semua Meja ({data.tables.length})
                </button>
                {data.tables.length > 0 && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      const cur = data.tables.find((t) => t.id === stickerConfig.selectedTableId) || data.tables[0];
                      if (cur) void printTableStickers(cur.id);
                    }}
                  >
                    Cetak {formatTableDisplay((data.tables.find((t) => t.id === stickerConfig.selectedTableId) || data.tables[0])?.label || "01")} Saja
                  </button>
                )}
              </div>
            </article>
          </section>}

          {view === "devices" && <section className="owner-device-page owner-page-panel">
            <div className="owner-section-heading"><div><h1>Perangkat &amp; PWA</h1><p>Pasangkan tablet Kasir dan layar Dapur tanpa membagikan password Owner.</p></div><PwaInstallButton label="Install Aplikasi Owner" onInstalled={() => void onboardingAction({ action: "pwa_installed" })}/></div>
            <div className="owner-device-setup">
              <article className="owner-panel"><span className="device-step">01</span><h2>Buka aplikasi di perangkat tujuan</h2><p>Pada tablet Kasir buka <b>okesih.com/pos</b>. Pada layar dapur buka <b>okesih.com/kds</b>, kemudian pilih Buat Kode Pairing.</p><div className="owner-device-links"><Link href="/pos" target="_blank" rel="noopener noreferrer">Buka Kasir ↗</Link><Link href="/kds" target="_blank" rel="noopener noreferrer">Buka KDS ↗</Link></div></article>
              <article className="owner-panel"><span className="device-step">02</span><h2>Setujui kode pairing</h2><p>Masukkan enam digit yang tampil pada perangkat. Kode hanya berlaku lima menit dan sekali pakai.</p><div className="owner-pair-form"><input inputMode="numeric" maxLength={6} placeholder="000000" value={pairingCode} onChange={(event) => setPairingCode(event.target.value.replace(/\D/g, ""))}/><button className="btn-primary" disabled={busy || pairingCode.length !== 6} onClick={() => void deviceAction({ action: "approve", code: pairingCode })}>{busy ? "Memproses..." : "Setujui Perangkat"}</button></div></article>
            </div>
            <article className="owner-panel owner-device-list"><div className="owner-section-heading"><div><h2>Perangkat Terdaftar</h2><p>Cabut akses segera jika perangkat hilang atau tidak lagi digunakan.</p></div>{devices.some((device) => device.status === "ACTIVE") && <button className="link-button danger" onClick={() => confirm("Cabut seluruh perangkat Kasir dan KDS?") && void deviceAction({ action: "revoke_all" })}>Cabut Semua</button>}</div>
              {devices.length === 0 ? <EmptyState icon="⌁" title="Belum ada perangkat" text="Buka Kasir atau KDS pada perangkat tujuan untuk memulai pairing."/> : <div className="owner-device-grid">{devices.map((device) => <div key={device.id} className={`owner-device-card ${device.status.toLowerCase()}`}><span>{device.device_type === "POS" ? "▤" : "♨"}</span><div><small>{device.device_type === "POS" ? "KASIR / POS" : "DAPUR / KDS"}</small><b>{device.device_name}</b><p>Terakhir aktif {new Date(device.last_seen_at).toLocaleString("id-ID")}</p><em>{device.status === "ACTIVE" ? "● Aktif" : device.status === "REVOKED" ? "○ Dicabut" : "○ Kedaluwarsa"}</em></div>{device.status === "ACTIVE" && <button className="link-button danger" onClick={() => confirm(`Cabut akses ${device.device_name}?`) && void deviceAction({ action: "revoke", deviceId: device.id })}>Cabut</button>}{device.status === "REVOKED" && <button className="link-button danger" onClick={() => confirm(`Hapus permanen ${device.device_name}?`) && void deviceAction({ action: "delete", deviceId: device.id })}>Hapus</button>}</div>)}</div>}
            </article>
          </section>}
        </main>
      </div>

      {onboardingReady && onboarding && !onboarding.completed_at && <div className="owner-onboarding-backdrop"><section className="owner-onboarding-card"><img src="/logo.svg?v=2" alt="OKESIH"/><small>SELAMAT DATANG DI OKESIH</small><h2>Siapkan akun Owner Anda</h2>{!onboarding.password_changed_at ? <><p>Demi keamanan, ganti password awal yang diberikan Super Admin sebelum menggunakan dashboard.</p><label>Password baru<input type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Minimal 8 karakter"/></label><button className="btn-primary" disabled={busy || newPassword.length < 8} onClick={() => void onboardingAction({ action: "change_password", password: newPassword })}>{busy ? "Menyimpan..." : "Ganti Password & Lanjut"}</button></> : <><p>Pasang Dashboard Owner agar OKESIH dapat dibuka langsung dari layar utama. Browser tetap akan meminta persetujuan Anda.</p><PwaInstallButton label="Install OKESIH Owner" onInstalled={() => void onboardingAction({ action: "pwa_installed" })}/><button className="btn-secondary" disabled={busy} onClick={() => void onboardingAction({ action: "complete" })}>Lanjut ke Dashboard</button></>}{error && <div className="owner-error">{error}</div>}</section></div>}

      {menuModal && <Modal title="Tambah Menu" onClose={() => setMenuModal(false)}><form onSubmit={createMenu}><input required placeholder="Nama menu" value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}/><input required min="1" type="number" placeholder="Harga" value={menuForm.price} onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })}/><label className="owner-category-field">Kategori<input required list="owner-menu-categories" maxLength={50} placeholder="Pilih atau ketik kategori baru" value={menuForm.category} onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}/><small>Pilih kategori yang ada atau ketik kategori baru.</small></label><datalist id="owner-menu-categories">{categorySuggestions.map((item) => <option key={item} value={item}/>)}</datalist><textarea placeholder="Deskripsi" value={menuForm.description} onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}/><div className="owner-modal-actions"><button type="button" className="btn-secondary" onClick={() => setMenuModal(false)}>Batal</button><button disabled={busy} className="btn-primary" type="submit">Oke</button></div></form></Modal>}
      {editingMenu && <Modal title="Edit Menu" onClose={() => setEditingMenu(null)}><form onSubmit={updateMenu}><label className="owner-category-field">Nama Menu<input required placeholder="Nama menu" value={editingMenu.name} onChange={(e) => setEditingMenu({ ...editingMenu, name: e.target.value })}/></label><label className="owner-category-field">Harga (Rp)<input required min="1" type="number" placeholder="Harga" value={editingMenu.price} onChange={(e) => setEditingMenu({ ...editingMenu, price: e.target.value })}/></label><label className="owner-category-field">Kategori<input required list="owner-menu-categories-edit" maxLength={50} placeholder="Pilih atau ketik kategori baru" value={editingMenu.category} onChange={(e) => setEditingMenu({ ...editingMenu, category: e.target.value })}/><small>Pilih kategori yang ada atau ketik kategori baru.</small></label><datalist id="owner-menu-categories-edit">{categorySuggestions.map((item) => <option key={item} value={item}/>)}</datalist><label className="owner-category-field">Deskripsi<textarea placeholder="Deskripsi menu" value={editingMenu.description} onChange={(e) => setEditingMenu({ ...editingMenu, description: e.target.value })}/></label><label className="owner-category-field" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "10px", marginTop: "4px" }}><input type="checkbox" checked={editingMenu.isAvailable} onChange={(e) => setEditingMenu({ ...editingMenu, isAvailable: e.target.checked })} style={{ width: "20px", height: "20px", margin: 0 }}/><span>Status Menu Tersedia untuk Dipesan</span></label><div className="owner-modal-actions"><button type="button" className="btn-secondary" onClick={() => setEditingMenu(null)}>Batal</button><button disabled={busy} className="btn-primary" type="submit">{busy ? "Menyimpan..." : "Oke"}</button></div></form></Modal>}
      {editingTable && (
        <Modal title="Edit Nama Meja" onClose={() => { setEditingTable(null); setTableEditError(""); }}>
          <form onSubmit={updateTable}>
            {tableEditError && (
              <div className="owner-error" style={{ marginBottom: "12px", padding: "10px 12px", fontSize: "12px" }}>
                {tableEditError}
              </div>
            )}
            <label className="owner-category-field">
              Nama / Nomor Meja
              <input
                required
                autoFocus
                maxLength={30}
                value={editingTable.label}
                onChange={(event) => {
                  setTableEditError("");
                  setEditingTable({ ...editingTable, label: event.target.value });
                }}
                placeholder="Contoh: 01, VIP 1, Teras"
              />
              <small style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "4px" }}>
                Ketik nomor atau nama saja. Kata &quot;Meja&quot; otomatis ditambahkan pada stiker dan QR code.
              </small>
            </label>
            <div className="owner-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => { setEditingTable(null); setTableEditError(""); }}
              >
                Batal
              </button>
              <button
                disabled={busy || !editingTable.label.trim()}
                className="btn-primary"
                type="submit"
              >
                {busy ? "Menyimpan ke Supabase..." : "Simpan Perubahan"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {staffModal && <Modal title="Tambah Akun Staf" onClose={() => { if (!busy) setStaffModal(false); }}><form onSubmit={createStaff} className="owner-staff-form"><label>Username<input required minLength={3} maxLength={40} pattern="[a-z0-9][a-z0-9._-]*[a-z0-9_-]" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" placeholder="Contoh: kasir.baru" value={staffForm.username} onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value.toLowerCase() })}/><small>Gunakan huruf kecil, angka, titik, garis bawah, atau tanda hubung.</small></label><label>Nama staf<input required minLength={2} maxLength={150} autoComplete="name" placeholder="Nama lengkap staf" value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}/></label><label>Password awal<input required minLength={6} maxLength={72} type="password" autoComplete="new-password" placeholder="Minimal 6 karakter" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}/></label><label>Peran<select value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}><option value="KASIR">Kasir POS</option><option value="DAPUR">Barista / Dapur</option></select></label><div className="owner-modal-actions"><button type="button" className="btn-secondary" disabled={busy} onClick={() => setStaffModal(false)}>Batal</button><button disabled={busy} className="btn-primary" type="submit">{busy ? "Membuat akun..." : "Buat Akun"}</button></div></form></Modal>}
      {waiterModal && <Modal title="Tambah Waiter" onClose={() => setWaiterModal(false)}><form onSubmit={createWaiter}><input required placeholder="Nama waiter" value={waiterForm.name} onChange={(e) => setWaiterForm({ ...waiterForm, name: e.target.value })}/><input inputMode="tel" placeholder="Nomor telepon" value={waiterForm.phone} onChange={(e) => setWaiterForm({ ...waiterForm, phone: e.target.value })}/><div className="owner-modal-actions"><button type="button" className="btn-secondary" onClick={() => setWaiterModal(false)}>Batal</button><button disabled={busy} className="btn-primary" type="submit">Oke</button></div></form></Modal>}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="owner-modal-backdrop"><div className="owner-modal"><header><h3>{title}</h3><button onClick={onClose}>×</button></header>{children}</div></div>;
}

function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="owner-empty"><span>{icon}</span><div><b>{title}</b><p>{text}</p></div></div>;
}
