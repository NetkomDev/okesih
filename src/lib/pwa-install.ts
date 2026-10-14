import type { InstallationKind } from "@/lib/pwa-routing";

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export async function requestPwaInstallation(expectedKind: InstallationKind) {
  const installPrompt = window.__okesihInstallPrompt;
  if (!installPrompt) return "unavailable" as const;
  if (window.__okesihInstallKind !== expectedKind) return "wrong-kind" as const;

  window.__okesihInstallPrompt = undefined;
  await installPrompt.prompt();
  const choice = await installPrompt.userChoice;
  return choice.outcome;
}

declare global {
  interface Window {
    __okesihInstallPrompt?: InstallPromptEvent;
    __okesihInstallKind?: InstallationKind;
  }
}
