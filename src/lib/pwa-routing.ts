export function installationKind(path: string): "POS" | "KDS" | "DASHBOARD" {
  if (/^\/pos(\/|$)/.test(path)) return "POS";
  if (/^\/kds(\/|$)/.test(path)) return "KDS";
  return "DASHBOARD";
}

export function isDashboardLaunch(path: string) {
  return path === "/" || /^\/(owner|superadmin|marketing|admin)(\/|$)/.test(path);
}
