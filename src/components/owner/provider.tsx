"use client";

import PwaRoleMismatchModal from "@/components/PwaRoleMismatchModal";
import { useAuthGuard } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/client";
import { createContext,useCallback,useContext,useEffect,useRef,useState } from "react";
import { ownerFetch } from "./helpers";
import type { DashboardData,DeviceInstallation,OwnerOnboarding,Profile } from "./types";

function useSession() {
  const auth = useAuthGuard(["OWNER"]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [onboarding, setOnboarding] = useState<OwnerOnboarding | null>(null);
  const [onboardingReady, setOnboardingReady] = useState(false);
  const [error, setError] = useState("");
  
  
  
  useEffect(() => {
    if (!auth.isAuthorized) return;
    const controller = new AbortController();
    void Promise.all([
      ownerFetch("/api/owner/profile", { signal: controller.signal, cache: "no-store" }),
      ownerFetch("/api/owner/onboarding", { signal: controller.signal, cache: "no-store" }),
    ]).then(([business, setup]) => {
      if (controller.signal.aborted) return;
      setProfile(business.data); setOnboarding(setup.onboarding); setOnboardingReady(true);
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [auth.isAuthorized]);
  
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const refreshProfile = useCallback(async () => {
    const payload = await ownerFetch("/api/owner/profile", { cache: "no-store" });
    setProfile(payload.data);
    return payload.data as Profile;
  }, []);
  const onboardingAction = async (body: Record<string, unknown>) => {
    setBusy(true); setError("");
    try {
      const payload = await ownerFetch("/api/owner/onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (payload.session) {
        const supabase = createClient();
        await supabase.auth.setSession({
          access_token: payload.session.access_token,
          refresh_token: payload.session.refresh_token,
        });
      }
      setOnboarding(payload.onboarding);
      if (body.action === "change_password") setNewPassword("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Onboarding gagal diperbarui."); }
    finally { setBusy(false); }
  };
  return { ...auth, profile, refreshProfile, onboarding, onboardingReady, onboardingAction, error, setError, busy, newPassword, setNewPassword };
}
const OwnerContext = createContext<ReturnType<typeof useSession> | null>(null);
export function OwnerProvider({ children }: { children: React.ReactNode }) {
  const session = useSession();
  if (!session.profile || session.loading || !session.isAuthorized) {
    return (
      <div className="owner-loading" role="status">
        <div className="owner-loading-glow" aria-hidden="true" />
        <div className="owner-loading-logo-box">
          <img src="/okesih-logo-animated.svg" alt="OKESIH Owner" />
        </div>
        <div className="owner-loading-copy">
          <strong>OKESIH <span style={{ color: "var(--brand-orange-light, #ff623a)" }}>Owner</span></strong>
          <p>{session.error || "Menyiapkan portal pemilik usaha..."}</p>
        </div>
        {!session.error && (
          <div className="owner-loading-bar" aria-hidden="true">
            <div className="owner-loading-bar-fill" />
          </div>
        )}
        {session.error && (
          <button type="button" className="owner-loading-retry-btn" onClick={() => window.location.reload()}>
            <span>🔄</span>
            <span>Muat Ulang Halaman</span>
          </button>
        )}
      </div>
    );
  }
  return <OwnerContext.Provider value={session}>{children}</OwnerContext.Provider>;
}
export function useOwnerSession() {
  const context = useContext(OwnerContext);
  if (!context?.profile) throw new Error("OwnerProvider diperlukan.");
  return { ...context, profile: context.profile };
}

type Resource = "overview" | "menu" | "staff" | "waiters" | "qris-tables" | "devices" | "pin";
const endpoints: Partial<Record<Resource, string>> = { overview: "dashboard", menu: "menus", staff: "staff", waiters: "waiters", "qris-tables": "tables", devices: "devices" };
const tables: Partial<Record<Resource, string[]>> = { overview: ["transactions", "shifts"], menu: ["menus"], staff: ["shifts", "warkop_members"], waiters: ["waiters"], "qris-tables": ["warkop_tables"] };

// Each mounted route owns its data and subscription; the layout only owns identity/onboarding.
export function useOwnerData(resource: Resource) {
  const { profile, refreshProfile } = useOwnerSession();
  const [data, setData] = useState<DashboardData>(() => ({ profile, menus: [], staff: [], waiters: [], tables: [], activeCashier: null, metrics: { receiptCount: 0, cash: 0, qris: 0, total: 0, billing: null } }));
  const [devices, setDevices] = useState<DeviceInstallation[]>([]);
  const [error, setError] = useState("");
  
  
  const [ready, setReady] = useState(!endpoints[resource]);
  const sequence = useRef(0);
  const loadDashboard = useCallback(async () => {
    const endpoint = endpoints[resource];
    if (!endpoint) return;
    const current = ++sequence.current;
    const result = await ownerFetch(`/api/owner/${endpoint}`, { cache: "no-store" });
    if (current !== sequence.current) return;
    setReady(true);
    if (resource === "devices") setDevices(result.devices || []);
    else setData(previous => ({ ...previous, ...result.data }));
  }, [resource]);
  useEffect(() => {
    const load = () => { void loadDashboard().catch(reason => setError(reason.message)); };
    const timer = setTimeout(load, 0);
    const supabase = createClient();
    const channel = supabase.channel(`owner-${resource}-${profile.id}`);
    for (const table of tables[resource] || []) channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `warkop_id=eq.${profile.id}` }, load);
    if (tables[resource]?.length) channel.subscribe();
    const invalidate = () => { sequence.current++; };
    return () => { clearTimeout(timer); invalidate(); void supabase.removeChannel(channel); };
  }, [resource, profile.id, loadDashboard]);
  
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const mutate = async (work: () => Promise<unknown>, successMessage?: string) => {
    setBusy(true); setError(""); setNotice("");
    try {
      await work(); await loadDashboard();
      if (resource === "qris-tables") await refreshProfile();
      if (successMessage) setNotice(successMessage);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Perubahan gagal disimpan."); }
    finally { setBusy(false); }
  };
  return { ready, data: { ...data, profile }, setData, devices, error, setError, notice, setNotice, busy, setBusy, loadDashboard, loadDeviceCenter: loadDashboard, mutate };
}
