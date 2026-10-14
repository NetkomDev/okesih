/** Local screen lock only. Server authorization remains the tenant's device pairing. */
export type DevicePinRecord = { salt: string; hash: string; failures: number; retryAt: number };

export function devicePinKey(deviceId: string) { return `okesih-pos-pin-v1:${deviceId}`; }

export async function hashDevicePin(pin: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 600_000, hash: "SHA-256" }, key, 256);
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function readDevicePin(deviceId: string): DevicePinRecord | null {
  const raw = localStorage.getItem(devicePinKey(deviceId));
  if (raw === null) return null;
  const record = JSON.parse(raw) as DevicePinRecord;
  if (!/^[a-f0-9]{64}$/.test(record.hash) || !/^[a-f0-9]{32}$/.test(record.salt) ||
      !Number.isSafeInteger(record.failures) || record.failures < 0 || !Number.isFinite(record.retryAt)) {
    throw new Error("Data PIN perangkat tidak valid. Hubungi Owner untuk pairing ulang.");
  }
  return record;
}

export async function createDevicePin(pin: string): Promise<DevicePinRecord> {
  if (!/^\d{6}$/.test(pin)) throw new Error("PIN harus terdiri dari 6 angka.");
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { salt, hash: await hashDevicePin(pin, salt), failures: 0, retryAt: 0 };
}
