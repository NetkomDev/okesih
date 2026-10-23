"use client";

import { useRef } from "react";
import { ownerWhatsAppContact } from "@/lib/owner-whatsapp";
import styles from "./WhatsAppAdminButton.module.css";

export default function WhatsAppAdminButton({ businessName }: { businessName: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const continueLink = useRef<HTMLAnchorElement>(null);
  return <>
    <a className={styles.fab} href="https://wa.me/6285694488510" target="_blank" rel="noopener noreferrer"
      aria-label="Hubungi Admin OKESIH melalui WhatsApp" title="WhatsApp Admin OKESIH"
      onClick={event => {
        const contact = ownerWhatsAppContact(businessName);
        event.currentTarget.href = contact.url;
        if (!contact.isWorkingHours) {
          event.preventDefault();
          if (continueLink.current) continueLink.current.href = contact.url;
          dialog.current?.showModal();
        }
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.52 3.48A11.88 11.88 0 0 0 12.05 0C5.46 0 .1 5.36.1 11.95c0 2.1.55 4.15 1.59 5.96L0 24l6.25-1.64a11.94 11.94 0 0 0 5.8 1.48h.01c6.58 0 11.94-5.36 11.94-11.95a11.87 11.87 0 0 0-3.48-8.41ZM12.05 21.82a9.9 9.9 0 0 1-5.05-1.38l-.36-.21-3.71.97.99-3.62-.24-.37a9.89 9.89 0 0 1-1.52-5.26c0-5.49 4.46-9.95 9.95-9.95a9.87 9.87 0 0 1 7.04 2.92 9.88 9.88 0 0 1 2.91 7.04c0 5.48-4.47 9.86-10.01 9.86Zm5.46-7.42c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.77-1.65-2.07-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.21 5.09 4.5.71.3 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
        </svg>
    </a>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="owner-wa-hours"
      onClick={event => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.current?.close();
      }}>
      <p id="owner-wa-hours">Admin akan segera merespon di jam kerja 09.00 - 20.00 WITA</p>
      <div className={styles.actions}>
        <button type="button" onClick={() => dialog.current?.close()}>Batal</button>
        <a ref={continueLink} href="https://wa.me/6285694488510" target="_blank" rel="noopener noreferrer"
          onClick={event => {
            event.currentTarget.href = ownerWhatsAppContact(businessName).url;
            dialog.current?.close();
          }}>Lanjut ke WhatsApp</a>
      </div>
    </dialog>
  </>;
}
