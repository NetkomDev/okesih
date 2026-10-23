"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { isStandaloneApp } from "@/lib/pwa-routing";
import { installPwaExitGuard, pwaExitScope, type ExitWindow } from "@/lib/pwa-exit-guard";
import styles from "./PwaBackExitGuard.module.css";

function ExitWarning({ dismiss }: { dismiss: () => void }) {
  const backdrop = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const siblings = Array.from(document.body.children).filter(
      (node): node is HTMLElement => node instanceof HTMLElement && node !== backdrop.current,
    );
    const inert = siblings.map(node => node.inert);
    siblings.forEach(node => { node.inert = true; });
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => {
      siblings.forEach((node, i) => { node.inert = inert[i]; });
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <div ref={backdrop} className={styles.backdrop} onClick={event => {
      if (event.target === event.currentTarget) dismiss();
    }}>
      <div ref={dialog} className={styles.dialog} role="alertdialog" aria-modal="true"
        aria-labelledby="pwa-exit-message" tabIndex={-1} onKeyDown={event => {
          if (event.key === "Tab") event.preventDefault();
          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); dismiss(); }
        }}>
        <p id="pwa-exit-message">Tekan kembali sekali lagi untuk menutup aplikasi</p>
      </div>
    </div>, document.body,
  );
}

export default function PwaBackExitGuard() {
  const scope = pwaExitScope(usePathname() ?? "");
  const [warning, setWarning] = useState(false);
  const controller = useRef<ReturnType<typeof installPwaExitGuard> | null>(null);
  useEffect(() => {
    if (!scope || !/Android/i.test(navigator.userAgent) || !isStandaloneApp()) return;
    const guard = installPwaExitGuard(window as ExitWindow, scope, setWarning);
    controller.current = guard;
    return () => { guard.dispose(); controller.current = null; };
  }, [scope]);
  return warning && scope ? <ExitWarning dismiss={() => controller.current?.dismiss()} /> : null;
}
