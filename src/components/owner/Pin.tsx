"use client";
import { useEffect, useState } from "react";
import { ownerFetch } from "./helpers";
import OwnerIcon from "./Icon";

export default function PinFeature() {
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void ownerFetch("/api/owner/security-pin", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((result) => {
        if (!controller.signal.aborted) setHasPin(Boolean(result.hasPin));
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason.message);
      });
    return () => controller.abort();
  }, [attempt]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!/^\d{4,6}$/.test(pin))
      return setError("Gunakan 4–6 angka untuk PIN Anda.");
    if (pin !== confirmation)
      return setError("Konfirmasi PIN belum cocok. Periksa sekali lagi.");
    setBusy(true);
    try {
      await ownerFetch("/api/owner/security-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      setHasPin(true);
      setPin("");
      setConfirmation("");
      setShowPin(false);
      setNotice("PIN tersimpan. Histori kasir kini terlindungi.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "PIN belum berhasil disimpan.",
      );
    } finally {
      setBusy(false);
    }
  };
  const disable = async () => {
    if (
      !window.confirm(
        "Nonaktifkan PIN? Histori dan rekap penjualan di kasir dapat dibuka tanpa PIN.",
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await ownerFetch("/api/owner/security-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable" }),
      });
      setHasPin(false);
      setPin("");
      setConfirmation("");
      setNotice("Proteksi PIN telah dinonaktifkan.");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "PIN gagal dinonaktifkan.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="owner-security-page">
      <section className="owner-security-intro">
        <div className="owner-security-symbol">
          <OwnerIcon name="shield" width={34} height={34} />
        </div>
        <h2>Laporan usaha, tetap privat.</h2>
        <p>
          Atur PIN untuk membuka histori pesanan dan rekap penjualan di aplikasi
          kasir.
        </p>
        <span
          className={`owner-protection-status ${hasPin === true ? "is-active" : ""}`}
        >
          <i />
          {hasPin === null
            ? "Memeriksa proteksi..."
            : hasPin
              ? "Proteksi PIN aktif"
              : "Proteksi belum aktif"}
        </span>
      </section>
      {error && (
        <div className="owner-error" role="alert">
          {error}
          {hasPin === null && (
            <button
              onClick={() => {
                setError("");
                setAttempt((value) => value + 1);
              }}
            >
              Coba lagi
            </button>
          )}
        </div>
      )}
      {notice && (
        <div className="owner-success" role="status">
          <OwnerIcon name="check" />
          {notice}
        </div>
      )}
      <section className="owner-pin-form-card">
        <div className="owner-pin-form-heading">
          <h3>{hasPin ? "Perbarui PIN" : "Buat PIN keamanan"}</h3>
          <span>4–6 angka</span>
        </div>
        <form onSubmit={save}>
          <label htmlFor="owner-new-pin">
            {hasPin ? "PIN baru" : "PIN keamanan"}
          </label>
          <div className="owner-pin-input">
            <input
              id="owner-new-pin"
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              pattern="[0-9]{4,6}"
              minLength={4}
              maxLength={6}
              autoComplete="new-password"
              required
              value={pin}
              onChange={(event) =>
                setPin(event.target.value.replace(/\D/g, ""))
              }
              placeholder="Masukkan PIN"
              aria-describedby="owner-pin-hint"
              disabled={busy || hasPin === null}
            />
            <button
              type="button"
              onClick={() => setShowPin((value) => !value)}
              aria-label={showPin ? "Sembunyikan PIN" : "Tampilkan PIN"}
              aria-pressed={showPin}
            >
              <OwnerIcon name="eye" />
            </button>
          </div>
          <label htmlFor="owner-confirm-pin">Ulangi PIN</label>
          <div className="owner-pin-input">
            <input
              id="owner-confirm-pin"
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              pattern="[0-9]{4,6}"
              minLength={4}
              maxLength={6}
              autoComplete="new-password"
              required
              value={confirmation}
              onChange={(event) =>
                setConfirmation(event.target.value.replace(/\D/g, ""))
              }
              placeholder="Masukkan kembali PIN"
              disabled={busy || hasPin === null}
            />
            {confirmation.length >= 4 && pin === confirmation && (
              <OwnerIcon name="check" className="owner-pin-matched" />
            )}
          </div>
          <p id="owner-pin-hint">
            Bagikan PIN hanya kepada orang yang boleh melihat laporan penjualan.
          </p>
          <button
            className="owner-save-pin"
            disabled={
              busy ||
              hasPin === null ||
              pin.length < 4 ||
              confirmation.length < 4
            }
          >
            {busy
              ? "Menyimpan..."
              : hasPin
                ? "Simpan PIN baru"
                : "Aktifkan proteksi PIN"}
            <OwnerIcon name="shield" width={18} height={18} />
          </button>
        </form>
      </section>
      <aside className="owner-pin-note">
        <OwnerIcon name="shield" />
        <div>
          <b>Pesanan tetap berjalan seperti biasa</b>
          <p>
            PIN hanya melindungi akses histori dan rekap. Kasir tetap bisa
            menerima dan memproses pesanan.
          </p>
        </div>
      </aside>
      {hasPin && (
        <button
          className="owner-disable-pin"
          disabled={busy}
          onClick={() => void disable()}
        >
          Nonaktifkan proteksi PIN
        </button>
      )}
    </div>
  );
}
