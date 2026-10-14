"use client";

import { useCallback, useEffect, useState } from "react";
import { INDONESIA_PROVINCES } from "@/lib/indonesia-regions";
import { logoutUser, useAuthGuard } from "@/lib/auth-helpers";
import PwaInstallButton from "@/components/PwaInstallButton";

type Tenant = { id: string; name: string; slug: string; ownerName: string; province: string; cityRegency: string; status: string; joinedAt: string; receipts: number; commission: number };
type Dashboard = { profile: { name: string; referralCode: string; area: string; commissionRate: number; commissionPaid: number }; tenants: Tenant[]; totals: { tenants: number; receipts: number; commission: number } };

const money = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;

export default function MarketingDashboardPage() {
  const { isAuthorized, loading } = useAuthGuard(["MARKETING"]);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", ownerName: "", phone: "", province: "", cityRegency: "" });

  const load = useCallback(async () => {
    const response = await fetch("/api/marketing/dashboard", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Dashboard gagal dimuat.");
    setData(payload.data);
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;
    const timer = window.setTimeout(() => { void load().catch((cause) => setError(cause.message)); }, 0);
    return () => window.clearTimeout(timer);
  }, [isAuthorized, load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/marketing/dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Tenant gagal didaftarkan.");
      setForm({ name: "", ownerName: "", phone: "", province: "", cityRegency: "" });
      await load();
      alert(`Tenant berhasil didaftarkan. Kredensial owner telah diantrekan ke WhatsApp ${form.phone}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Terjadi kesalahan."); }
    finally { setSaving(false); }
  };

  if (loading || !isAuthorized || !data) return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#07130f", color: "white" }}>{error || "Memuat dashboard marketing..."}</main>;

  const card = { background: "#fff", border: "1px solid #dce9e3", borderRadius: 18, padding: "1.25rem", boxShadow: "0 12px 32px rgba(6,78,59,.07)" } as const;
  const input = { width: "100%", padding: ".8rem .9rem", border: "1px solid #cbd5e1", borderRadius: 10, fontSize: ".92rem", background: "white", color: "#0f172a" } as const;
  return (
    <main style={{ minHeight: "100vh", background: "#f3f8f5", color: "#10231b", padding: "clamp(1rem,3vw,2.5rem)" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <header style={{ background: "linear-gradient(135deg,#064e3b,#059669)", color: "white", borderRadius: 22, padding: "1.5rem", display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div><div style={{ opacity: .8, fontSize: ".78rem", fontWeight: 800 }}>MITRA MARKETING OKESIH</div><h1 style={{ margin: ".25rem 0", fontSize: "clamp(1.4rem,4vw,2rem)" }}>Halo, {data.profile.name}</h1><div>{data.profile.referralCode} · {data.profile.area}</div></div>
          <div style={{ display: "flex", gap: ".6rem", alignItems: "center" }}><PwaInstallButton label="Install Aplikasi" compact /><button onClick={() => void logoutUser()} style={{ padding: ".7rem 1rem", border: "1px solid rgba(255,255,255,.5)", borderRadius: 10, background: "transparent", color: "white", fontWeight: 700 }}>Keluar</button></div>
        </header>

        {error && <div style={{ marginTop: "1rem", padding: "1rem", background: "#fee2e2", color: "#991b1b", borderRadius: 12 }}>{error}</div>}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "1rem", margin: "1rem 0" }}>
          {[['Tenant binaan', data.totals.tenants], ['Total struk', data.totals.receipts], ['Komisi berjalan', money(data.totals.commission)], ['Sudah dicairkan', money(data.profile.commissionPaid)]].map(([label,value]) => <div key={String(label)} style={card}><div style={{ color: "#64748b", fontSize: ".8rem", fontWeight: 700 }}>{label}</div><div style={{ color: "#047857", fontSize: "1.55rem", fontWeight: 900, marginTop: ".35rem" }}>{value}</div></div>)}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "minmax(280px,.85fr) minmax(0,1.4fr)", gap: "1rem", alignItems: "start" }} className="marketing-grid">
          <form onSubmit={submit} style={card}>
            <h2 style={{ marginTop: 0 }}>Daftarkan Tenant Baru</h2><p style={{ color: "#64748b", fontSize: ".85rem" }}>Tenant otomatis terafiliasi ke akun Anda. Kredensial owner dikirim lewat WhatsApp.</p>
            <div style={{ display: "grid", gap: ".8rem" }}>
              <input required placeholder="Nama usaha" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input} />
              <input required placeholder="Nama pemilik / owner" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} style={input} />
              <input required inputMode="tel" placeholder="WhatsApp owner (08...)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={input} />
              <select required value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} style={input}><option value="">Pilih provinsi</option>{INDONESIA_PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}</select>
              <input required placeholder="Kota / Kabupaten" value={form.cityRegency} onChange={(e) => setForm({ ...form, cityRegency: e.target.value })} style={input} />
              <button disabled={saving} style={{ ...input, border: 0, background: "#059669", color: "white", fontWeight: 900, cursor: saving ? "wait" : "pointer" }}>{saving ? "Mendaftarkan..." : "Daftarkan & Kirim WhatsApp"}</button>
            </div>
          </form>

          <section style={card}><h2 style={{ marginTop: 0 }}>Usaha yang Saya Daftarkan</h2>{data.tenants.length === 0 ? <p style={{ color: "#64748b" }}>Belum ada tenant binaan.</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}><thead><tr>{["Usaha","Wilayah","Status","Struk","Komisi"].map((head) => <th key={head} style={{ textAlign: "left", padding: ".75rem", borderBottom: "1px solid #dce9e3", color: "#64748b", fontSize: ".78rem" }}>{head}</th>)}</tr></thead><tbody>{data.tenants.map((tenant) => <tr key={tenant.id}><td style={{ padding: ".85rem .75rem", borderBottom: "1px solid #eef2f0" }}><strong>{tenant.name}</strong><div style={{ color: "#64748b", fontSize: ".75rem" }}>{tenant.ownerName}</div></td><td style={{ padding: ".85rem .75rem", borderBottom: "1px solid #eef2f0" }}>{tenant.cityRegency}, {tenant.province}</td><td style={{ padding: ".85rem .75rem", borderBottom: "1px solid #eef2f0", color: tenant.status === "ACTIVE" ? "#059669" : "#dc2626", fontWeight: 800 }}>{tenant.status}</td><td style={{ padding: ".85rem .75rem", borderBottom: "1px solid #eef2f0" }}>{tenant.receipts}</td><td style={{ padding: ".85rem .75rem", borderBottom: "1px solid #eef2f0", fontWeight: 800 }}>{money(tenant.commission)}</td></tr>)}</tbody></table></div>}</section>
        </section>
      </div>
      <style jsx>{`@media(max-width:800px){.marketing-grid{grid-template-columns:1fr!important}}`}</style>
    </main>
  );
}
