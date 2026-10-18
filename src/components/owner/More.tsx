"use client";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import PwaInstallButton from "@/components/PwaInstallButton";
import { appUrl } from "@/lib/app-origins";
import { logoutUser } from "@/lib/auth-helpers";
import OwnerIcon from "./Icon";
import { useOwnerSession } from "./provider";
export default function More() {
  const { onboardingAction } = useOwnerSession();
  return (
    <div className="owner-more-page">
      <section className="owner-settings-group" aria-label="Pengaturan usaha">
        <Link href="/owner/pin" prefetch={false}>
          <span className="owner-setting-icon">
            <OwnerIcon name="shield" />
          </span>
          <div>
            <b>PIN keamanan</b>
            <small>Lindungi histori dan rekap penjualan</small>
          </div>
          <OwnerIcon name="arrow" />
        </Link>
        <Link href="/owner/devices" prefetch={false}>
          <span className="owner-setting-icon">
            <OwnerIcon name="device" />
          </span>
          <div>
            <b>Perangkat kasir & dapur</b>
            <small>Pairing dan kelola akses perangkat</small>
          </div>
          <OwnerIcon name="arrow" />
        </Link>
      </section>
      <section className="owner-settings-group">
        <div className="owner-setting-row">
          <div>
            <b>Tampilan aplikasi</b>
            <small>Pilih tema yang nyaman untuk Anda</small>
          </div>
          <ThemeToggle />
        </div>
        <div className="owner-setting-row">
          <div>
            <b>Pasang aplikasi Owner</b>
            <small>Akses langsung dari layar utama</small>
          </div>
          <PwaInstallButton
            label="Install"
            compact
            onInstalled={() =>
              void onboardingAction({ action: "pwa_installed" })
            }
          />
        </div>
      </section>
      <section
        className="owner-settings-group"
        aria-label="Aplikasi operasional"
      >
        <a
          href={appUrl("POS", "/pos")}
          target="_blank"
          rel="noopener noreferrer"
        >
          <OwnerIcon name="cash" />
          <div>
            <b>Buka aplikasi kasir</b>
            <small>Terbuka di jendela baru</small>
          </div>
          <OwnerIcon name="arrow" />
        </a>
        <a
          href={appUrl("KDS", "/kds")}
          target="_blank"
          rel="noopener noreferrer"
        >
          <OwnerIcon name="device" />
          <div>
            <b>Buka layar dapur</b>
            <small>Terbuka di jendela baru</small>
          </div>
          <OwnerIcon name="arrow" />
        </a>
      </section>
      <button className="owner-signout" onClick={logoutUser}>
        <OwnerIcon name="logout" />
        Keluar dari akun
      </button>
    </div>
  );
}
