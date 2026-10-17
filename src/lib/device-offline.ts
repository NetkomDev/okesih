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

export async function cacheDeviceSnapshot(type: "POS" | "KDS", value: unknown) {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_CACHE, "readwrite");
  const done = transactionDone(transaction);
  transaction.objectStore(STORE_CACHE).put({ value, cachedAt: new Date().toISOString() }, type);
  await done;
}

export async function readDeviceSnapshot<T>(type: "POS" | "KDS") {
  const db = await openDatabase();
  return requestValue<{ value: T; cachedAt: string } | undefined>(db.transaction(STORE_CACHE).objectStore(STORE_CACHE).get(type));
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

