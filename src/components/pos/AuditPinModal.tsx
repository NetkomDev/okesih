"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import type { AuditPinProps } from "./types";

export default function AuditPinModal({ onClose, onVerified }: AuditPinProps) {
const pinModalOpen = true;
const setPinModalOpen = useCallback((open: boolean) => { if (!open) onClose(); }, [onClose]);
const requestRef = useRef<AbortController | null>(null);
useEffect(() => () => requestRef.current?.abort(), []);
const [pinInput, setPinInput] = useState("");
const [pinError, setPinError] = useState("");
const [pinChecking, setPinChecking] = useState(false);
const [pinShaking, setPinShaking] = useState(false);
const triggerPinShake = () => {
    setPinShaking(true);
    window.setTimeout(() => setPinShaking(false), 500);
  };
const verifyAuditPin = useCallback(async (e?: React.FormEvent, customPin?: string) => {
    if (e) e.preventDefault();
    if (requestRef.current) return;
    const pinToVerify = customPin !== undefined ? customPin : pinInput;
    if (!pinToVerify.trim()) {
      setPinError("Masukkan PIN keamanan");
      triggerPinShake();
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setPinChecking(true);
    setPinError("");
    try {
      const res = await fetch("/api/device/audit-pin", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinToVerify }),
      });
      const data = await res.json();
      if (controller.signal.aborted) return;
      if (!res.ok || !data.verified) {
        setPinError(data.error || "PIN tidak sesuai. Hubungi Owner.");
        setPinInput(""); // Langsung kosongkan isian PIN agar siap diisi kembali
        triggerPinShake(); // Efek visual bergetar pada modal
        return;
      }
      // PIN benar: segera buka akses dan beralih ke History Pesanan
      onVerified(pinToVerify.trim());
      
      setPinModalOpen(false);
      setPinInput("");
      setPinError("");
      
    } catch {
      if (controller.signal.aborted) return;
      setPinError("Gagal memeriksa PIN. Pastikan koneksi terhubung.");
      setPinInput("");
      triggerPinShake();
    } finally {
      requestRef.current = null;
      if (!controller.signal.aborted) setPinChecking(false);
    }
  }, [pinInput, onVerified, setPinModalOpen]);
useEffect(() => {
    if (!pinModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        if (pinInput.length < 6 && !requestRef.current) {
          const next = pinInput + e.key;
          setPinInput(next); setPinError("");
          if (next.length === 6) void verifyAuditPin(undefined, next);
        }
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setPinInput((prev) => prev.slice(0, -1));
        setPinError("");
      } else if (e.key === "Escape") {
        e.preventDefault();
        setPinModalOpen(false);
        setPinInput("");
        setPinError("");
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (pinInput.length >= 4) {
          void verifyAuditPin();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pinInput, pinModalOpen, setPinModalOpen, verifyAuditPin]);
return (pinModalOpen && (
      <div className="ops-modal-backdrop">
        <section className={`pos-pin-modal ${pinShaking ? "shake" : ""}`}>
          <button
            className="ops-modal-close"
            onClick={() => {
              setPinModalOpen(false);
              setPinError("");
              setPinInput("");
            }}
          >
            ×
          </button>

          <div className="pos-pin-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <h2 className="pos-pin-title">Akses Terproteksi</h2>
          <p className="pos-pin-desc">
            Halaman Histori &amp; Rekap Audit dikunci. Masukkan PIN keamanan Owner untuk membuka akses.
          </p>

          <form onSubmit={verifyAuditPin}>
            {/* Indikator Titik PIN */}
            <div className="pos-pin-dots">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <div
                  key={index}
                  className={`pos-pin-dot ${index < pinInput.length ? "filled" : ""}`}
                />
              ))}
            </div>

            {pinError && (
              <div className="pos-pin-error">
                <span>⚠️</span>
                <span>{pinError}</span>
              </div>
            )}

            {/* Tombol Numpad Layar Sentuh / Tablet / POS */}
            <div className="pos-pin-numpad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  className="pos-pin-num-btn"
                  onClick={() => {
                    if (pinInput.length < 6) {
                      const next = pinInput + String(num);
                      setPinInput(next);
                      setPinError("");
                      if (next.length === 6) {
                        void verifyAuditPin(undefined, next);
                      }
                    }
                  }}
                  disabled={pinChecking}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                className="pos-pin-num-btn special"
                onClick={() => {
                  setPinInput("");
                  setPinError("");
                }}
                disabled={pinChecking || !pinInput}
              >
                Reset
              </button>
              <button
                type="button"
                className="pos-pin-num-btn"
                onClick={() => {
                  if (pinInput.length < 6) {
                    const next = pinInput + "0";
                    setPinInput(next);
                    setPinError("");
                    if (next.length === 6) {
                      void verifyAuditPin(undefined, next);
                    }
                  }
                }}
                disabled={pinChecking}
              >
                0
              </button>
              <button
                type="button"
                className="pos-pin-num-btn special"
                onClick={() => {
                  setPinInput((prev) => prev.slice(0, -1));
                  setPinError("");
                }}
                disabled={pinChecking || !pinInput}
              >
                ⌫ Hapus
              </button>
            </div>

            <div className="pos-pin-actions">
              <button
                type="button"
                className="pos-pin-btn-cancel"
                onClick={() => {
                  setPinModalOpen(false);
                  setPinError("");
                  setPinInput("");
                }}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={pinChecking || pinInput.length < 4}
                className="pos-pin-btn-submit"
              >
                {pinChecking ? "Memeriksa..." : "Buka Akses →"}
              </button>
            </div>
          </form>
        </section>
      </div>
    ));
}
