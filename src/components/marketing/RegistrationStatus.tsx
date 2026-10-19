import { APP_ENTRY_PATHS, appUrl } from "@/lib/app-origins";
import type { MarketingRegistration } from "@/lib/marketing-registration-types";

export default function RegistrationStatus({ registration }: { registration: MarketingRegistration }) {
  const active = registration.status === "ACTIVE";
  const pending = registration.status === "PENDING";
  const details = [
    ["Nama lengkap", registration.fullName],
    ["Nomor WhatsApp", `+${registration.phone}`],
    ["Email", registration.email || "—"],
    ["Kota / wilayah", registration.cityArea],
    ["Bank / e-wallet", registration.bankName],
    ["Nomor rekening / HP", registration.bankAccountNumber],
    ["Pemilik rekening", registration.bankAccountName],
    ["Catatan pengalaman / target usaha", registration.experienceNotes || "—"],
    ["Kode referral", registration.referralCode],
    ["Tanggal pendaftaran", new Date(registration.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Makassar" }) + " WITA"],
  ];

  return <section className="marketing-registration-status">
    <div className="marketing-registration-summary" role="status">
      <h2>{active ? "Anda telah diterima sebagai mitra marketing" : pending ? "Pendaftaran Anda menunggu verifikasi" : "Status kemitraan Anda belum aktif"}</h2>
      <p>{active ? `Selamat, ${registration.fullName}. ${registration.applicationReady ? "Silakan buka aplikasi marketing dan masuk menggunakan akun yang diberikan Admin." : "Admin sedang menyiapkan akses aplikasi marketing Anda."}` : pending ? "Data Anda sudah tersimpan. Admin akan memeriksa pendaftaran dan menghubungi Anda melalui WhatsApp." : "Hubungi Admin melalui WhatsApp untuk mengetahui tindak lanjut pendaftaran Anda."}</p>
    </div>
    <ol className="marketing-registration-steps" aria-label="Tahapan pendaftaran">
      <li data-complete="true"><strong>1. Data tersimpan</strong><span>Pendaftaran telah masuk ke sistem.</span></li>
      <li data-complete={active} aria-current={pending ? "step" : undefined}><strong>2. Verifikasi Admin</strong><span>{active ? "Pendaftaran disetujui." : pending ? "Menunggu pemeriksaan dan persetujuan." : "Kemitraan belum aktif. Hubungi Admin."}</span></li>
      <li data-complete={registration.applicationReady} aria-current={active && !registration.applicationReady ? "step" : undefined}><strong>3. Akses aplikasi marketing</strong><span>{registration.applicationReady ? "Akun marketing siap digunakan." : "Tersedia setelah persetujuan dan aktivasi akun."}</span></li>
    </ol>
    <h2>Data pendaftaran Anda</h2>
    <dl className="marketing-registration-details">{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className="marketing-registration-actions">
      {registration.applicationReady && <a className="btn-primary" href={appUrl("MARKETING", APP_ENTRY_PATHS.MARKETING)}>Buka aplikasi marketing →</a>}
      <a className="btn-secondary" href={registration.whatsappUrl}>{pending ? "Buka WhatsApp Admin" : "Hubungi Admin"}</a>
    </div>
    {pending && <p className="marketing-registration-hint">Jika belum, tekan Kirim pada pesan WhatsApp yang telah disiapkan. Status di halaman ini diperbarui berdasarkan keputusan Admin.</p>}
    <p className="marketing-registration-hint">Buka kembali halaman ini menggunakan browser yang sama untuk melihat data dan status pendaftaran Anda.</p>
  </section>;
}
