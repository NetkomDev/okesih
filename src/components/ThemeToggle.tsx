"use client";

import { useEffect, useState } from "react";

interface ThemeToggleProps {
  className?: string;
  showText?: boolean;
}

export default function ThemeToggle({ className = "", showText = false }: ThemeToggleProps) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const currentTheme = document.documentElement.getAttribute("data-theme") as "dark" | "light";
    if (currentTheme) {
      setTheme(currentTheme);
    } else {
      const savedTheme = localStorage.getItem("okesih-theme") as "dark" | "light" | null;
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);
      } else {
        const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
        const initial = prefersLight ? "light" : "dark";
        setTheme(initial);
        document.documentElement.setAttribute("data-theme", initial);
      }
    }

    const handleStorageOrCustom = () => {
      const active = document.documentElement.getAttribute("data-theme") as "dark" | "light";
      if (active) setTheme(active);
    };

    window.addEventListener("theme-change", handleStorageOrCustom);
    window.addEventListener("storage", handleStorageOrCustom);
    return () => {
      window.removeEventListener("theme-change", handleStorageOrCustom);
      window.removeEventListener("storage", handleStorageOrCustom);
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("okesih-theme", nextTheme);
    window.dispatchEvent(new Event("theme-change"));
  };

  if (!mounted) {
    // Render placeholder with same size to avoid layout shift
    return (
      <button
        type="button"
        className={`theme-toggle-btn ${className}`}
        aria-label="Ganti Tema Warna"
        style={{
          width: showText ? "auto" : "38px",
          height: "38px",
          borderRadius: "10px",
          background: "rgba(255, 255, 255, 0.05)",
          border: "1px solid var(--border-subtle)",
          padding: showText ? "0.45rem 0.85rem" : "0",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <span style={{ opacity: 0.5 }}>🌙</span>
      </button>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn ${className}`}
      aria-label={isDark ? "Beralih ke Tema Terang" : "Beralih ke Tema Gelap"}
      title={isDark ? "Beralih ke Tema Terang (Light Mode)" : "Beralih ke Tema Gelap (Dark Mode)"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.45rem",
        height: "38px",
        padding: showText ? "0.45rem 0.95rem" : "0 0.65rem",
        borderRadius: "10px",
        background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)",
        border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.12)"}`,
        color: isDark ? "#FBBF24" : "#4F46E5",
        cursor: "pointer",
        fontSize: "0.85rem",
        fontWeight: 700,
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {isDark ? (
        // Tema Gelap Aktif -> Tampilkan Icon Bulan (🌙) mengikuti tema yang sedang aktif
        <>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "#38BDF8" }}
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
          {showText && <span style={{ color: "var(--text-pure-white)" }}>Mode Gelap</span>}
        </>
      ) : (
        // Tema Terang Aktif -> Tampilkan Icon Matahari (☀️) mengikuti tema yang sedang aktif
        <>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "#F59E0B" }}
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
          {showText && <span style={{ color: "var(--text-pure-white)" }}>Mode Terang</span>}
        </>
      )}
    </button>
  );
}
