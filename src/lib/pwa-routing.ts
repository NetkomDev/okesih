export type InstallationKind = "POS" | "KDS" | "OWNER" | "MARKETING" | "SUPERADMIN" | "DASHBOARD";

export function installationKind(path: string): InstallationKind {
  if (/^\/pos(\/|$)/.test(path)) return "POS";
  if (/^\/kds(\/|$)/.test(path)) return "KDS";
  if (/^\/owner(\/|$)/.test(path)) return "OWNER";
  if (/^\/marketing\/dashboard(\/|$)/.test(path)) return "MARKETING";
  if (/^\/superadmin(\/|$)/.test(path)) return "SUPERADMIN";
  return "DASHBOARD";
}

export function isDashboardLaunch(path: string) {
  return path === "/" || /^\/(owner|superadmin|marketing|admin)(\/|$)/.test(path);
}
