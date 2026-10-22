"use client";
import { useEffect, useRef, type ReactNode } from "react";

export default function ModalFrame({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const root = frame.current!;
    root.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key !== "Tab") return;
      const nodes = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(node => node.getClientRects().length);
      const first = nodes[0], last = nodes.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root)) { event.preventDefault(); first.focus(); }
    }
    root.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = previousOverflow; root.removeEventListener("keydown", keydown); previousFocus?.focus(); };
  }, []);
  return <div className="sa-modal-backdrop"><div ref={frame} className="sa-modal-frame" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>{children}</div></div>;
}
