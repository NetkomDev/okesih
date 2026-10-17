import type { InstallationKind } from "@/lib/pwa-routing";

export const PWA_INSTALLED_STORAGE_KEY = "okesih_pwa_installed_v1";

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export async function requestPwaInstallation(expectedKind?: InstallationKind) {
  const installPrompt = window.__okesihInstallPrompt;
  if (!installPrompt) return "unavailable" as const;
  if (expectedKind && window.__okesihInstallKind && window.__okesihInstallKind !== expectedKind) {
    return "unavailable" as const;
  }

  try {
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    window.__okesihInstallPrompt = undefined;
    if (choice.outcome === "accepted") {
      try { localStorage.setItem(PWA_INSTALLED_STORAGE_KEY, "1"); } catch {}
    }
    return choice.outcome;
  } catch (err) {
    console.error("Install prompt error:", err);
    return "unavailable" as const;
  }
}


declare global {
  interface Window {
    __okesihInstallPrompt?: InstallPromptEvent;
    __okesihInstallKind?: InstallationKind;
  }
}
