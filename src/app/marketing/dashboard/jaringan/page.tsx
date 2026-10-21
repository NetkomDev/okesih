"use client";
import { useCallback, useEffect, useState } from "react";
import { useMarketingData } from "../MarketingContext";
import MarketingLoading from "../MarketingLoading";
import "../marketing-dashboard.css";
type Network = { referralUrl: string; members: Array<{ id: string; name: string; area: string; status: string; tenants: number; networkCommission: number }>; totalCommission: number };
export default function MarketingNetworkPage() {
  const { data: dashboard, loading, isAuthorized } = useMarketingData();
  const [data, setData] = useState<Network | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/marketing/network", { cache: "no-store", signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Jaringan gagal dimuat.");
      if (!signal?.aborted) { setData(result.data); setError(""); }
    } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Jaringan gagal dimuat."); }
  }, []);
  useEffect(() => {
    if (!isAuthorized || dashboard?.profile.membershipLevel !== "COORDINATOR") return;
    const controller = new AbortController();
    const initial = window.setTimeout(() => void load(controller.signal), 0);
    const sync = () => { if (document.visibilityState === "visible") void load(controller.signal); };
    const timer = window.setInterval(sync, 30000);
    window.addEventListener("focus", sync);
    return () => { controller.abort(); clearTimeout(initial); clearInterval(timer); window.removeEventListener("focus", sync); };
  }, [isAuthorized, dashboard?.profile.membershipLevel, load]);
  if (!isAuthorized || loading) return <MarketingLoading />;
  const shareText = [
    "Mau penghasilan tambahan tanpa modal? 💰",
    "",
    "Gabung jadi Mitra Marketing OKESIH.COM, aplikasi kasir & menu QR untuk warkop, kafe, dan resto.",
    "",
    "✅ Daftar 100% gratis",
    "✅ Komisi otomatis dari setiap struk tenant binaan Anda",
    "✅ Tenant terkunci di akun Anda dengan kode referral resmi",
    "✅ Kerja fleksibel, pantau komisi langsung dari HP",
    "",
    `Daftar lewat link undangan saya${dashboard?.profile.name ? ` (${dashboard.profile.name})` : ""}:`,
  ].join("\n");
  const shareReferral = async () => {
    if (!data) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Gabung Mitra Marketing OKESIH.COM", text: shareText, url: data.referralUrl });
        setNotice("");
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setNotice("Menu bagikan gagal dibuka. Coba lagi.");
      }
      return;
    }
    try { await navigator.clipboard.writeText(`${shareText}\n${data.referralUrl}`); setNotice("Perangkat ini belum mendukung menu bagikan. Narasi dan link telah disalin, silakan tempel di media sosial."); }
    catch { setNotice("Perangkat ini belum mendukung menu bagikan. Salin link secara manual."); }
  };
  return <main className="mkt-shell"><div className="mkt-container">
    <div className="mkt-subpage-header"><div className="mkt-subpage-title-box"><h1>Jaringan Saya</h1><p>Bina mitra Anda dan pantau bonus dari tagihan tenant yang telah lunas.</p></div></div>
    <section className="mkt-panel" style={{ position: "relative", marginTop: "-30px" }}>
      {dashboard?.profile.membershipLevel !== "COORDINATOR" ? <p>Fitur jaringan tersedia setelah Anda diangkat menjadi Koordinator Mitra oleh Super Admin.</p> : <>
        {error && <div role="alert" className="mkt-alert error">{error}<button onClick={() => void load()}>Coba lagi</button></div>}
        {!data && !error && <p role="status">Memuat jaringan…</p>}
        {data && <>
          <h2>Undang Mitra Marketing</h2><p>Bagikan link berikut. Pendaftaran mitra tetap melalui verifikasi Super Admin.</p>
          <label className="mkt-form" style={{ margin: "16px 0" }}>Link referral
            <span style={{ display: "flex", gap: "8px", alignItems: "stretch" }}>
              <input readOnly value={data.referralUrl} onFocus={e => e.target.select()} style={{ flex: 1, minWidth: 0 }} />
              <button type="button" onClick={() => void shareReferral()} aria-label="Bagikan link referral" title="Bagikan" style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: "6px", padding: "0 14px", border: "1px solid rgba(13,148,136,.3)", borderRadius: "10px", background: "rgba(13,148,136,.12)", color: "#0f766e", fontWeight: 800, fontSize: "13px", cursor: "pointer" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                Bagikan
              </button>
            </span>
          </label>
          <button className="mkt-primary" onClick={async () => { try { await navigator.clipboard.writeText(data.referralUrl); setNotice("Link referral tersalin."); } catch { setNotice("Pilih teks link lalu salin secara manual."); } }}>Salin link referral</button>
          {notice && <p role="status">{notice}</p>}
          <p style={{ marginTop: "20px" }}><b>{data.members.length}</b> mitra · Bonus jaringan terkredit <b>Rp {data.totalCommission.toLocaleString("id-ID")}</b></p>
          <div className="mkt-table-scroll"><table className="mkt-table"><thead><tr><th>Mitra</th><th>Status</th><th>Tenant</th><th>Bonus jaringan</th></tr></thead><tbody>
            {data.members.map(member => <tr key={member.id}><td><strong>{member.name}</strong><span>{member.area}</span></td><td>{member.status === "ACTIVE" ? "Aktif" : member.status === "PENDING" ? "Menunggu persetujuan" : "Nonaktif"}</td><td>{member.tenants}</td><td>Rp {member.networkCommission.toLocaleString("id-ID")}</td></tr>)}
          </tbody></table></div>
          {!data.members.length && <p>Belum ada mitra di jaringan Anda. Bagikan link referral untuk mulai mengundang.</p>}
        </>}
      </>}
    </section>
  </div></main>;
}
