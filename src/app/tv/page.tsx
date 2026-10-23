"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";

interface ReadyQueueItem {
  id?: string;
  ticketNumber: number;
  tableNumber: string;
  readyAt: number; // timestamp ms
}

interface CookingQueueItem {
  id?: string;
  ticketNumber: number;
  tableNumber: string;
}

export default function TvQueuePage() {
  const [warkopSlug, setWarkopSlug] = useState<string>("");
  const [warkopName, setWarkopName] = useState<string>("WARKOP KITA");
  const [warkopLogo, setWarkopLogo] = useState<string | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [autoDismissSeconds, setAutoDismissSeconds] = useState<number>(60);
  const [cookingQueue, setCookingQueue] = useState<CookingQueueItem[]>([]);
  const [readyQueue, setReadyQueue] = useState<ReadyQueueItem[]>([]);
  const [now, setNow] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [inputSlug, setInputSlug] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioPromptDismissed, setAudioPromptDismissed] = useState<boolean>(false);

  const announcedTicketsRef = useRef<Set<string>>(new Set());
  const hasLoadedOnceRef = useRef<boolean>(false);

  // Play a pleasant two-tone chime
  const playChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const t = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(659.25, t); // E5
      gain1.gain.setValueAtTime(0.25, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(t);
      osc1.stop(t + 0.35);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.frequency.setValueAtTime(830.61, t + 0.18); // G#5
      gain2.gain.setValueAtTime(0.25, t + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(t + 0.18);
      osc2.stop(t + 0.65);
    } catch {
      // Audio might be blocked until user interacts with document
    }
  }, []);

  // Voice calling helper
  const speakQueue = useCallback((num: number, table: string) => {
    playChime();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.setTimeout(() => {
        window.speechSynthesis.cancel();
        const text = `OKESIH, Nomor ${num} untuk Meja ${table}, silakan diambil atau diantar.`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "id-ID";
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      }, 350);
    }
  }, [playChime]);

  // Read slug on initial mount
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const params = new URLSearchParams(window.location.search);
      const paramSlug = params.get("slug") || params.get("warkop");
      const storedSlug = window.localStorage.getItem("okesih_tv_slug");
      const initialSlug = (paramSlug || storedSlug || "").trim().toLowerCase();

      if (initialSlug && initialSlug !== "demo") {
        setWarkopSlug(initialSlug);
        setInputSlug(initialSlug);
      } else {
        // Default demo queue
        const initTime = Date.now();
        setNow(initTime);
        setCookingQueue([
          { ticketNumber: 13, tableNumber: "02" },
          { ticketNumber: 14, tableNumber: "08" },
          { ticketNumber: 15, tableNumber: "03" },
        ]);
        setReadyQueue([
          { ticketNumber: 11, tableNumber: "01", readyAt: initTime - 35000 },
          { ticketNumber: 12, tableNumber: "05", readyAt: initTime - 5000 },
        ]);
        hasLoadedOnceRef.current = true;
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll operational queue if warkopSlug is set
  useEffect(() => {
    if (!warkopSlug || warkopSlug === "demo") return;

    let active = true;

    const fetchQueue = async () => {
      try {
        const res = await fetch(`/api/public/queue/${encodeURIComponent(warkopSlug)}`, { cache: "no-store" });
        if (!res.ok) {
          if (active && res.status === 404) {
            setErrorMessage(`Warkop dengan slug "${warkopSlug}" tidak ditemukan atau tidak aktif.`);
            setIsLive(false);
          }
          return;
        }

        const payload = await res.json();
        if (!active) return;

        setErrorMessage(null);
        setIsLive(!payload.isDemo);
        if (payload.profile) {
          setWarkopName(payload.profile.nama || warkopSlug.toUpperCase());
          setWarkopLogo(payload.profile.logo_url || null);
          if (payload.profile.queue_dismiss_seconds) {
            setAutoDismissSeconds(payload.profile.queue_dismiss_seconds);
          }
        }

        setCookingQueue(
          (payload.cooking || []).map((c: { id?: string; ticketNumber: number; tableNumber: string }) => ({
            id: c.id,
            ticketNumber: c.ticketNumber,
            tableNumber: String(c.tableNumber),
          }))
        );

        const currentReady: ReadyQueueItem[] = (payload.ready || []).map(
          (r: { id?: string; ticketNumber: number; tableNumber: string; readyAt: number }) => ({
            id: r.id,
            ticketNumber: r.ticketNumber,
            tableNumber: String(r.tableNumber),
            readyAt: r.readyAt,
          })
        );

        setReadyQueue(currentReady);

        // Announce newly ready orders
        currentReady.forEach((item) => {
          const key = `${item.ticketNumber}-${item.readyAt}`;
          if (!announcedTicketsRef.current.has(key)) {
            announcedTicketsRef.current.add(key);
            if (hasLoadedOnceRef.current) {
              speakQueue(item.ticketNumber, item.tableNumber);
            }
          }
        });

        hasLoadedOnceRef.current = true;
      } catch (err) {
        console.error("Gagal sinkronisasi antrean TV:", err);
      }
    };

    fetchQueue();
    const interval = window.setInterval(fetchQueue, 3500);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [warkopSlug, speakQueue]);

  // Timer loop: membuang tiket hijau yang usianya sudah melewati autoDismissSeconds
  useEffect(() => {
    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      setReadyQueue((prev) =>
        prev.filter((item) => {
          const elapsedSec = (current - item.readyAt) / 1000;
          return elapsedSec < autoDismissSeconds;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [autoDismissSeconds]);

  // Uji simulasi pesanan baru selesai (hanya mode demo atau pengujian manual)
  const simulateNewReadyOrder = () => {
    const randomTicket = Math.floor(Math.random() * 80) + 20;
    const randomTable = `0${Math.floor(Math.random() * 9) + 1}`;
    const newItem: ReadyQueueItem = {
      ticketNumber: randomTicket,
      tableNumber: randomTable,
      readyAt: Date.now(),
    };
    setReadyQueue((prev) => [newItem, ...prev]);
    speakQueue(randomTicket, randomTable);
  };

  const handleSaveSlug = (slugToSave: string) => {
    const clean = slugToSave.trim().toLowerCase();
    setErrorMessage(null);
    hasLoadedOnceRef.current = false;
    announcedTicketsRef.current.clear();

    if (!clean || clean === "demo") {
      setWarkopSlug("");
      setIsLive(false);
      setWarkopName("WARKOP KITA");
      setWarkopLogo(null);
      window.localStorage.removeItem("okesih_tv_slug");
      window.history.replaceState({}, "", "/tv");
      setIsModalOpen(false);
      return;
    }

    setWarkopSlug(clean);
    window.localStorage.setItem("okesih_tv_slug", clean);
    window.history.replaceState({}, "", `/tv?slug=${encodeURIComponent(clean)}`);
    setIsModalOpen(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#050506",
        color: "#FFF",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Banner Status Operasional / Demo */}
      {!isLive ? (
        <div
          role="note"
          style={{
            padding: "10px 24px",
            background: "#854d0e",
            color: "#FEF08A",
            textAlign: "center",
            fontWeight: 700,
            fontSize: "0.95rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <span>DEMO — Data simulasi. Layar ini belum terhubung ke antrean operasional usaha.</span>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{
              background: "#FFF",
              color: "#78350F",
              border: "none",
              borderRadius: "4px",
              padding: "4px 12px",
              fontWeight: 800,
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Hubungkan ke Warkop Anda
          </button>
        </div>
      ) : (
        <div
          role="status"
          style={{
            padding: "8px 24px",
            background: "rgba(16, 185, 129, 0.15)",
            borderBottom: "1px solid rgba(16, 185, 129, 0.3)",
            color: "#6EE7B7",
            textAlign: "center",
            fontWeight: 700,
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
          }}
        >
          <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#10B981" }} />
          <span>Antrean Operasional Langsung Aktif: <strong>{warkopName}</strong> ({warkopSlug})</span>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{
              background: "transparent",
              color: "#A7F3D0",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              borderRadius: "4px",
              padding: "2px 8px",
              cursor: "pointer",
              fontSize: "0.75rem",
              marginLeft: "0.5rem",
            }}
          >
            Ganti Warkop
          </button>
        </div>
      )}

      {/* Smart TV Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1.25rem 2.5rem",
          borderBottom: "1px solid var(--border-subtle, #27272a)",
          background: "var(--bg-surface-1, #0f0f11)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <Link href="/" style={{ fontSize: "1.75rem", fontWeight: 900, display: "flex", alignItems: "center", gap: "0.75rem", textDecoration: "none", color: "inherit" }}>
            {warkopLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={warkopLogo}
                alt={warkopName}
                style={{ width: "48px", height: "48px", objectFit: "contain", borderRadius: "8px" }}
              />
            ) : (
              <Image
                src="/logo.svg?v=2"
                alt="Logo OKESIH.COM"
                width={48}
                height={48}
                style={{ width: "48px", height: "48px", objectFit: "contain", display: "inline-block" }}
              />
            )}
            <span>
              OKESIH <span style={{ color: "var(--brand-orange-light, #fb923c)" }}>{warkopName}</span>
            </span>
          </Link>
          <span className="badge badge-ready" style={{ fontSize: "0.85rem", padding: "0.35rem 0.85rem", background: "rgba(16, 185, 129, 0.2)", color: "#34D399", borderRadius: "999px" }}>
            ● Layar Antrean Smart TV
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted, #9ca3af)" }}>
            Auto-Dismiss: <strong style={{ color: "#10B981" }}>{autoDismissSeconds}s</strong>
          </div>
          <button
            onClick={simulateNewReadyOrder}
            className="btn-primary"
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.85rem",
              background: "#EA580C",
              color: "#FFF",
              border: "none",
              borderRadius: "6px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ⚡ Test Suara Panggilan
          </button>
        </div>
      </header>

      {/* Main Split Screen */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1.35fr", gap: "1px", background: "var(--border-subtle, #27272a)" }}>
        {/* Kolom Kiri: Sedang Diracik Barista / Dapur */}
        <div style={{ background: "var(--bg-deep-black, #09090b)", padding: "2.5rem", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "2rem" }}>
            <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#F59E0B" }} />
            <h2 style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.02em", color: "#FBBF24", margin: 0 }}>
              SEDANG DIRACIK
            </h2>
            <span style={{ fontSize: "1.1rem", color: "#D97706", fontWeight: 700, marginLeft: "auto" }}>
              {cookingQueue.length} pesanan
            </span>
          </div>

          {cookingQueue.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#71717a", fontSize: "1.25rem" }}>
              Tidak ada pesanan yang sedang diracik.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "1.25rem" }}>
              {cookingQueue.map((item, idx) => (
                <div
                  key={item.id || `${item.ticketNumber}-${idx}`}
                  className="glass-panel"
                  style={{
                    padding: "1.5rem 1rem",
                    textAlign: "center",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "12px",
                    background: "rgba(255, 255, 255, 0.03)",
                  }}
                >
                  <div style={{ fontSize: "2.5rem", fontWeight: 900, color: "#E5E7EB" }}>
                    #{item.ticketNumber < 10 ? `00${item.ticketNumber}` : `0${item.ticketNumber}`}
                  </div>
                  <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--brand-orange-light, #fb923c)", marginTop: "0.35rem" }}>
                    {item.tableNumber === "Kasir" ? "KASIR" : `MEJA #${item.tableNumber}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kolom Kanan: SIAP DIAMBIL / DIANTAR (HIJAU & AUTO-DISMISS) */}
        <div style={{ background: "rgba(16, 185, 129, 0.05)", padding: "2.5rem", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#10B981" }} />
              <h2 style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.02em", color: "#34D399", margin: 0 }}>
                SIAP DIAMBIL / DIANTAR ☕
              </h2>
            </div>
            <span style={{ fontSize: "0.85rem", color: "var(--text-dim, #6b7280)" }}>
              *Menghilang otomatis setelah {autoDismissSeconds} detik
            </span>
          </div>

          {readyQueue.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim, #6b7280)", fontSize: "1.25rem" }}>
              Belum ada pesanan yang siap.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1.5rem" }}>
              {readyQueue.map((item, idx) => {
                const remainingSec = Math.max(0, Math.ceil(autoDismissSeconds - (now - item.readyAt) / 1000));
                return (
                  <div
                    key={item.id || `${item.ticketNumber}-${idx}`}
                    className="glass-panel"
                    style={{
                      padding: "2rem 1.5rem",
                      textAlign: "center",
                      borderRadius: "16px",
                      border: "2px solid #10B981",
                      background: "rgba(16, 185, 129, 0.18)",
                      boxShadow: "0 10px 30px rgba(16, 185, 129, 0.25)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.5s ease",
                    }}
                  >
                    <div style={{ fontSize: "4rem", fontWeight: 900, color: "#10B981", lineHeight: 1 }}>
                      #{item.ticketNumber < 10 ? `00${item.ticketNumber}` : `0${item.ticketNumber}`}
                    </div>

                    <div
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 900,
                        color: "#FFFFFF",
                        background: "#059669",
                        padding: "0.3rem 1rem",
                        borderRadius: "999px",
                        marginTop: "0.75rem",
                      }}
                    >
                      {item.tableNumber === "Kasir" ? "KASIR" : `MEJA #${item.tableNumber}`}
                    </div>

                    <div style={{ fontSize: "0.75rem", color: "#A7F3D0", marginTop: "0.75rem" }}>
                      Menghilang dalam {remainingSec}s
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Audio permission reminder for unattended smart TVs */}
      {!audioPromptDismissed && (
        <div
          style={{
            position: "fixed",
            bottom: "16px",
            right: "16px",
            background: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: "8px",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            zIndex: 40,
          }}
        >
          <span style={{ fontSize: "0.85rem", color: "#d4d4d8" }}>🔊 Pastikan suara TV aktif</span>
          <button
            type="button"
            onClick={() => {
              playChime();
              setAudioPromptDismissed(true);
            }}
            style={{
              background: "#059669",
              color: "#FFF",
              border: "none",
              borderRadius: "4px",
              padding: "4px 10px",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Aktifkan Suara
          </button>
        </div>
      )}

      {/* Modal Hubungkan Warkop */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: "16px",
              padding: "2rem",
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
            }}
          >
            <h3 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 0.5rem 0", color: "#F4F4F5" }}>
              Hubungkan Layar Antrean TV
            </h3>
            <p style={{ fontSize: "0.9rem", color: "#A1A1AA", margin: "0 0 1.5rem 0", lineHeight: 1.5 }}>
              Masukkan slug usaha warkop Anda (contoh: <code>warkop-berkah</code>) untuk menampilkan antrean pesanan real-time dari dapur dan kasir.
            </p>

            {errorMessage && (
              <div style={{ background: "#7f1d1d", color: "#fca5a5", padding: "10px 14px", borderRadius: "8px", fontSize: "0.85rem", marginBottom: "1rem" }}>
                {errorMessage}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveSlug(inputSlug);
              }}
            >
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#D4D4D8", marginBottom: "6px" }}>
                Slug Warkop
              </label>
              <input
                type="text"
                value={inputSlug}
                onChange={(e) => setInputSlug(e.target.value)}
                placeholder="misal: warkop-berkah"
                autoFocus
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 14px",
                  background: "#09090b",
                  border: "1px solid #52525b",
                  borderRadius: "8px",
                  color: "#FFF",
                  fontSize: "1rem",
                  marginBottom: "1.5rem",
                }}
              />

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => handleSaveSlug("demo")}
                  style={{
                    background: "transparent",
                    color: "#A1A1AA",
                    border: "1px solid #52525b",
                    borderRadius: "8px",
                    padding: "8px 16px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Mode Demo
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    background: "transparent",
                    color: "#D4D4D8",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 16px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  style={{
                    background: "#059669",
                    color: "#FFF",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 20px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Hubungkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
