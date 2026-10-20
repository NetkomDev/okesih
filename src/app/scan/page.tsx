"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import "@/styles/scanner.css";

export default function CustomerScannerPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string>("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [scanning, setScanning] = useState(true);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [externalUrlPrompt, setExternalUrlPrompt] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Play pleasant sound effect on successful scan
  const playSuccessChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Note 1 (E5 / 659Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.12);

      // Note 2 (B5 / 987Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(987.77, now + 0.08);
      gain2.gain.setValueAtTime(0.25, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.28);
    } catch {}
  }, []);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  // Handle detected QR data
  const handleScannedCode = useCallback((rawText: string) => {
    if (!rawText || !scanning) return;
    setScanning(false);
    setScannedResult(rawText);

    // Audio & Haptic feedback
    playSuccessChime();
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([60, 40, 60]);
      }
    } catch {}

    const trimmed = rawText.trim();

    // Check if it's an OKESIH menu link or path
    try {
      // 1. If it's a full URL
      if (/^https?:\/\//i.test(trimmed)) {
        const urlObj = new URL(trimmed);
        const isOkesihHost =
          urlObj.hostname === "okesih.com" ||
          urlObj.hostname.endsWith(".okesih.com") ||
          urlObj.hostname === "okesih.vercel.app" ||
          urlObj.hostname.includes("localhost") ||
          urlObj.hostname.includes("127.0.0.1");

        // If path is a menu route e.g. /menu/warkop-1?t=01
        if (urlObj.pathname.startsWith("/menu/")) {
          const destination = urlObj.pathname + urlObj.search;
          setTimeout(() => {
            router.push(destination);
          }, 600);
          return;
        }

        // If it's an OKESIH host but another public path
        if (isOkesihHost) {
          const destination = urlObj.pathname + urlObj.search;
          setTimeout(() => {
            router.push(destination);
          }, 600);
          return;
        }

        // External domain: confirm with user
        setExternalUrlPrompt(trimmed);
        return;
      }

      // 2. If it's a relative path e.g. /menu/demo?t=01
      if (trimmed.startsWith("/menu/")) {
        setTimeout(() => {
          router.push(trimmed);
        }, 600);
        return;
      }

      // 3. If it's a slug or table parameter e.g. "demo?t=01" or "menu/warkop?t=02"
      if (trimmed.startsWith("menu/")) {
        setTimeout(() => {
          router.push(`/${trimmed}`);
        }, 600);
        return;
      }

      // Fallback: Check if it's a plain slug or contains ?t=
      if (/^[a-zA-Z0-9_-]+(\?.*)?$/.test(trimmed)) {
        setTimeout(() => {
          router.push(`/menu/${trimmed}`);
        }, 600);
        return;
      }

      // If unrecognized, ask user if they want to navigate
      setExternalUrlPrompt(trimmed);
    } catch {
      setExternalUrlPrompt(trimmed);
    }
  }, [scanning, playSuccessChime, router]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError("");
    setScanning(true);
    setScannedResult(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasCamera(false);
      setCameraError("Browser Anda tidak mendukung akses kamera secara langsung.");
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setHasCamera(true);

      // Check torch capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities ? (videoTrack.getCapabilities() as { torch?: boolean }) : {};
        setTorchAvailable(Boolean(capabilities?.torch));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
      }

      // Start scan loop
      const scanLoop = () => {
        if (!videoRef.current || !canvasRef.current) {
          animFrameRef.current = requestAnimationFrame(scanLoop);
          return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });
            if (code && code.data) {
              handleScannedCode(code.data);
              return;
            }
          }
        }
        animFrameRef.current = requestAnimationFrame(scanLoop);
      };

      animFrameRef.current = requestAnimationFrame(scanLoop);
    } catch (err) {
      setHasCamera(false);
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Permission") || msg.includes("denied") || msg.includes("NotAllowedError")) {
        setCameraError("Akses kamera ditolak. Silakan izinkan akses kamera di pengaturan browser Anda.");
      } else {
        setCameraError("Gagal membuka kamera: " + (msg || "Perangkat kamera tidak tersedia"));
      }
    }
  }, [facingMode, handleScannedCode, stopCamera]);

  // Toggle Torch
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !torchOn;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch {}
  };

  // Flip Camera
  const flipCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Process uploaded image file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new window.Image();
    const reader = new FileReader();

    reader.onload = (event) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            handleScannedCode(code.data);
          } else {
            alert("QR Code tidak terdeteksi pada gambar. Pastikan gambar jelas dan coba kembali.");
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    startCamera();

    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  return (
    <div className="scanner-page">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />

      {/* Header */}
      <header className="scanner-header">
        <Link href="/?view=landing" className="scanner-brand">
          <Image src="/logo.svg?v=2" width={38} height={38} alt="OKESIH" priority />
          <div className="scanner-brand-copy">
            <span className="scanner-brand-badge">SCANNER MEJA</span>
            <h1>OKESIH.COM</h1>
          </div>
        </Link>
        <div className="scanner-status-indicator">
          <span className={`scanner-pulse-dot ${scanning ? "active" : "paused"}`} />
          <small>{scanning ? "Siap Pindai" : "Memproses..."}</small>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="scanner-body">
        <div className="scanner-viewport-card">
          {/* Camera Viewfinder */}
          <div className="scanner-camera-container">
            <video
              ref={videoRef}
              className="scanner-video"
              playsInline
              muted
              autoPlay
            />

            {/* Viewfinder Reticle & Laser */}
            <div className="scanner-reticle" aria-hidden="true">
              <div className="reticle-corner top-left" />
              <div className="reticle-corner top-right" />
              <div className="reticle-corner bottom-left" />
              <div className="reticle-corner bottom-right" />
              {scanning && <div className="scanner-laser" />}
            </div>

            {/* Over-camera Controls */}
            <div className="scanner-overlay-controls">
              {torchAvailable && (
                <button
                  type="button"
                  className={`scanner-ctrl-btn ${torchOn ? "active" : ""}`}
                  onClick={toggleTorch}
                  title="Nyalakan Lampu Senter"
                  aria-label="Lampu Senter"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  <span>{torchOn ? "Lampu Nyala" : "Senter"}</span>
                </button>
              )}

              <button
                type="button"
                className="scanner-ctrl-btn"
                onClick={flipCamera}
                title="Ganti Kamera"
                aria-label="Ganti Kamera"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 10c0-4.418-3.582-8-8-8s-8 3.582-8 8c0 2.222.906 4.232 2.37 5.688L4 18h6v-6l-2.293 2.293A5.968 5.968 0 0 1 6 10c0-3.314 2.686-6 6-6s6 2.686 6 6c0 1.657-.672 3.157-1.757 4.243l1.414 1.414A7.962 7.962 0 0 0 20 10z" />
                </svg>
                <span>Putar</span>
              </button>

              <button
                type="button"
                className="scanner-ctrl-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Unggah Foto QR"
                aria-label="Unggah Foto QR"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span>Galeri</span>
              </button>
            </div>

            {/* Scanned Success Overlay */}
            {scannedResult && !externalUrlPrompt && (
              <div className="scanner-success-overlay">
                <div className="scanner-success-badge">
                  <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#10b981" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3>QR Meja Ditemukan!</h3>
                <p>Membuka menu digital...</p>
                <div className="scanner-loading-bar" />
              </div>
            )}

            {/* Error or Denied State */}
            {cameraError && (
              <div className="scanner-camera-fallback">
                <div className="scanner-fallback-icon">📷</div>
                <h3>Akses Kamera Diperlukan</h3>
                <p>{cameraError}</p>
                <div className="scanner-fallback-actions">
                  <button type="button" className="btn-retry" onClick={startCamera}>
                    Coba Aktifkan Kamera Lagi
                  </button>
                  <button
                    type="button"
                    className="btn-upload"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Unggah Gambar QR Code
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Guide Note */}
          <div className="scanner-guide">
            <div className="scanner-guide-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#f4512c" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <div className="scanner-guide-text">
              <strong>Arahkan kamera ke QR Code di meja</strong>
              <p>Menu warkop atau kafe akan langsung terbuka otomatis. Tidak perlu login akun.</p>
            </div>
          </div>
        </div>

      </main>

      {/* External URL Confirmation Modal if scanned non-menu QR */}
      {externalUrlPrompt && (
        <div className="scanner-modal-backdrop" role="dialog" aria-modal="true">
          <div className="scanner-modal-card">
            <span className="scanner-modal-badge">KONTEN QR TERDETEKSI</span>
            <h3>Buka Tautan Terpindai?</h3>
            <p className="scanner-modal-url">{externalUrlPrompt}</p>
            <div className="scanner-modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => {
                  setExternalUrlPrompt(null);
                  setScanning(true);
                  setScannedResult(null);
                }}
              >
                Scan Ulang
              </button>
              <a
                href={externalUrlPrompt}
                className="btn-open-url"
                target="_blank"
                rel="noopener noreferrer"
              >
                Buka Tautan →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
