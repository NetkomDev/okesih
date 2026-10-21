/** Persist one intent through uncertain responses; a changed cart has a new key. */
export async function orderIntentKey(storage: Pick<Storage, "getItem" | "setItem">, scope: string, input: unknown) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(input)));
  const payload = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  const key = `okesih-intent:${scope}`;
  try {
    const existing = JSON.parse(storage.getItem(key) || "null");
    if (existing?.payload === payload && typeof existing.id === "string") return existing.id as string;
  } catch { /* Replace corrupt local intent. */ }
  const id = crypto.randomUUID();
  storage.setItem(key, JSON.stringify({ payload, id }));
  return id;
}
export function completeOrderIntent(storage: Pick<Storage, "removeItem">, scope: string) {
  storage.removeItem(`okesih-intent:${scope}`);
}
