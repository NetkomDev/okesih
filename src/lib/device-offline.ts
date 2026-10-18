"use client";

const DB_NAME = "okesih-device-v1";
const STORE_CACHE = "snapshots";
const STORE_QUEUE = "operations";

export type QueuedOperation = {
  id: string;
  deviceType: "POS" | "KDS";
  path: string;
  body: Record<string, unknown>;
  createdAt: string;
};

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_CACHE)) db.createObjectStore(STORE_CACHE);
      if (!db.objectStoreNames.contains(STORE_QUEUE)) db.createObjectStore(STORE_QUEUE, { keyPath: "id" });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); databasePromise = null; };
      db.onclose = () => { databasePromise = null; };
      resolve(db);
    };
    request.onerror = () => { databasePromise = null; reject(request.error); };
  });
  return databasePromise;
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error("Penyimpanan offline dibatalkan."));
    transaction.onerror = () => reject(transaction.error);
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export type StoredSnapshot<T> = {
  value: T;
  cachedAt: string;
  dataVersion?: string;
};

// Tracking versi snapshot in-memory per tipe perangkat untuk deduplikasi I/O
const lastSnapshotMeta = new Map<string, { dataVersion: string; cachedAtTime: number }>();

export async function cacheDeviceSnapshot(
  type: "POS" | "KDS",
  value: unknown,
  options?: { dataVersion?: string; force?: boolean }
) {
  const now = new Date();
  const nowTime = now.getTime();
  const currentVersion = options?.dataVersion;
  const lastState = lastSnapshotMeta.get(type);

  // Jika versi data tidak berubah dan waktu tulis terakhir kurang dari 30 detik:
  // Lewati serialisasi dan penulisan ulang seluruh struktur objek ke IndexedDB untuk menghemat disk I/O,
  // sambil tetap menjamin batas izin offline diperbarui secara berkala (< 30 detik) atau saat force=true.
  if (
    !options?.force &&
    currentVersion &&
    lastState &&
    lastState.dataVersion === currentVersion &&
    nowTime - lastState.cachedAtTime < 30_000
  ) {
    return;
  }

  const db = await openDatabase();
  const transaction = db.transaction(STORE_CACHE, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(STORE_CACHE).put(
    {
      value,
      cachedAt: now.toISOString(),
      dataVersion: currentVersion,
    },
    type
  );
  await done;

  if (currentVersion) {
    lastSnapshotMeta.set(type, { dataVersion: currentVersion, cachedAtTime: nowTime });
  }
}

export async function touchDeviceSnapshotTime(type: "POS" | "KDS") {
  const cached = await readDeviceSnapshot<unknown>(type);
  if (!cached || !cached.value) return;
  const now = new Date();
  const db = await openDatabase();
  const transaction = db.transaction(STORE_CACHE, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(STORE_CACHE).put(
    {
      value: cached.value,
      cachedAt: now.toISOString(),
      dataVersion: cached.dataVersion,
    },
    type
  );
  await done;
  if (cached.dataVersion) {
    lastSnapshotMeta.set(type, { dataVersion: cached.dataVersion, cachedAtTime: now.getTime() });
  }
}

export async function readDeviceSnapshot<T>(type: "POS" | "KDS") {
  const db = await openDatabase();
  const record = await requestValue<StoredSnapshot<T> | undefined>(
    db.transaction(STORE_CACHE).objectStore(STORE_CACHE).get(type)
  );
  if (record?.dataVersion) {
    lastSnapshotMeta.set(type, {
      dataVersion: record.dataVersion,
      cachedAtTime: new Date(record.cachedAt).getTime(),
    });
  }
  return record;
}

export async function enqueueDeviceOperation(operation: QueuedOperation) {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_QUEUE, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(STORE_QUEUE).put(operation);
  await done;
}

export async function listDeviceOperations(type: "POS" | "KDS") {
  const db = await openDatabase();
  const all = await requestValue<QueuedOperation[]>(db.transaction(STORE_QUEUE).objectStore(STORE_QUEUE).getAll());
  return all.filter((operation) => operation.deviceType === type).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeDeviceOperation(id: string) {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_QUEUE, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(STORE_QUEUE).delete(id);
  await done;
}

export async function clearDeviceData(type: "POS" | "KDS") {
  const db = await openDatabase();
  const cacheTx = db.transaction(STORE_CACHE, "readwrite");
  const cacheDone = transactionDone(cacheTx);
  cacheTx.objectStore(STORE_CACHE).delete(type);
  await cacheDone;
  const operations = await listDeviceOperations(type);
  const queueTx = db.transaction(STORE_QUEUE, "readwrite");
  const queueDone = transactionDone(queueTx);
  for (const operation of operations) queueTx.objectStore(STORE_QUEUE).delete(operation.id);
  await queueDone;
}

