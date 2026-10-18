import { createClient } from "@/lib/supabase/client";
export function formatTableDisplay(label: string) {
  return (label || "").trim();
}
export function renderMultilineBizName(name: string): string[] {
  const trimmed = (name || "").trim();
  if (!trimmed) return [];
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [trimmed];
  return words;
}
export async function ownerFetch(path: string, init?: RequestInit) {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sesi login owner berakhir. Silakan login kembali.");
  const response = await fetch(path, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
  const responseText = await response.text();
  let payload;
  try { payload = responseText ? JSON.parse(responseText) : {}; }
  catch { if (!response.ok) throw new Error(`Server gagal memproses permintaan (${response.status}).`); }
  if (!response.ok) throw new Error(payload.error || "Permintaan gagal diproses.");
  return payload;
}
export function validateImage(file: File, maxSize: number, label: string) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error(`${label} harus berupa PNG, JPG, atau WebP.`);
  if (file.size > maxSize) throw new Error(`${label} maksimal ${Math.round(maxSize / 1024 / 1024)} MB.`);
}
export function money(value: number) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}
export function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char);
}