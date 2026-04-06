// IndexedDB 存储工具，替代 localStorage 以支持更大的存储配额
// IndexedDB 配额通常在几百 MB 到几 GB，远大于 localStorage 的 5-10MB

const DB_NAME = 'tool-share-db';
const DB_VERSION = 3; // 升级版本以添加 blob-url-map store
const TOOLS_STORE = 'tools';
const IMAGES_STORE = 'images';
const BLOB_URL_MAP_STORE = 'blob-url-map';

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(TOOLS_STORE)) {
        db.createObjectStore(TOOLS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        // key: imageId (string), value: { id, blob, mimeType, filename }
        db.createObjectStore(IMAGES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(BLOB_URL_MAP_STORE)) {
        // key: contentHash (string), value: { hash, blobUrl, edgeColor, uploadedAt }
        db.createObjectStore(BLOB_URL_MAP_STORE, { keyPath: 'hash' });
      }
    };
  });
}

// ─── Tools ───────────────────────────────────────────────────────────────────

export async function saveTools(tools: unknown[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TOOLS_STORE, 'readwrite');
    const store = transaction.objectStore(TOOLS_STORE);
    store.clear();
    for (const tool of tools) {
      store.put(tool);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function loadTools<T>(): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TOOLS_STORE, 'readonly');
    const store = transaction.objectStore(TOOLS_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export async function clearTools(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TOOLS_STORE, 'readwrite');
    const store = transaction.objectStore(TOOLS_STORE);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ─── Categories（存在 tools store，key='__categories__'）─────────────────────

const CATEGORIES_KEY = '__categories__';

export async function saveCategories(categories: string[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TOOLS_STORE, 'readwrite');
    const store = tx.objectStore(TOOLS_STORE);
    store.put({ id: CATEGORIES_KEY, categories });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadCategories(): Promise<string[] | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TOOLS_STORE, 'readonly');
    const store = tx.objectStore(TOOLS_STORE);
    const req = store.get(CATEGORIES_KEY);
    req.onsuccess = () => resolve(req.result?.categories ?? null);
    req.onerror = () => reject(req.error);
  });
}

// ─── Images ──────────────────────────────────────────────────────────────────

export interface StoredImage {
  id: string;       // 唯一 ID，工具数据里用这个 ID 引用
  blob: Blob;
  mimeType: string;
  filename: string;
  edgeColor?: string; // 边缘采样颜色 rgb(r, g, b)
}

/** 保存一张图片，返回 imageId */
export async function saveImage(image: StoredImage): Promise<string> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(IMAGES_STORE, 'readwrite');
    const store = transaction.objectStore(IMAGES_STORE);
    store.put(image);
    transaction.oncomplete = () => resolve(image.id);
    transaction.onerror = () => reject(transaction.error);
  });
}

/** 读取一张图片 */
export async function loadImage(id: string): Promise<StoredImage | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(IMAGES_STORE, 'readonly');
    const store = transaction.objectStore(IMAGES_STORE);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

/** 读取所有图片 */
export async function loadAllImages(): Promise<StoredImage[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(IMAGES_STORE, 'readonly');
    const store = transaction.objectStore(IMAGES_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as StoredImage[]);
    request.onerror = () => reject(request.error);
  });
}

/** 删除一张图片 */
export async function deleteImage(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(IMAGES_STORE, 'readwrite');
    const store = transaction.objectStore(IMAGES_STORE);
    store.delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/** 清空所有图片 */
export async function clearImages(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(IMAGES_STORE, 'readwrite');
    const store = transaction.objectStore(IMAGES_STORE);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/** 将 imageId 转换为可用于 <img src> 的 object URL（仅当前会话有效） */
export async function imageIdToObjectUrl(id: string): Promise<string | null> {
  const img = await loadImage(id);
  if (!img) return null;
  return URL.createObjectURL(img.blob);
}

// ─── Blob URL 全局去重映射 ──────────────────────────────────────────────────

export interface BlobUrlRecord {
  hash: string;       // 内容哈希（md5/data-hash）
  blobUrl: string;    // 已上传的 Vercel Blob URL
  uploadedAt: string; // ISO 时间
}

/**
 * 查全局映射表：内容哈希 → 已存在的 Blob URL。
 * 用于同步时判断图片是否已上传过，避免重复上传。
 */
export async function getBlobUrlByHash(hash: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_URL_MAP_STORE, 'readonly');
    const req = tx.objectStore(BLOB_URL_MAP_STORE).get(hash);
    req.onsuccess = () => resolve(req.result?.blobUrl ?? null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 读取映射：内容哈希 → 边缘颜色。
 */
export async function getBlobColorByHash(hash: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_URL_MAP_STORE, 'readonly');
    const req = tx.objectStore(BLOB_URL_MAP_STORE).get(hash);
    req.onsuccess = () => resolve(req.result?.edgeColor ?? null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 写入映射：内容哈希 → Blob URL（含边缘颜色）。
 * 幂等：已存在则覆盖。
 */
export async function setBlobUrlByHash(hash: string, blobUrl: string, edgeColor?: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_URL_MAP_STORE, 'readwrite');
    tx.objectStore(BLOB_URL_MAP_STORE).put({ hash, blobUrl, edgeColor, uploadedAt: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Migration ───────────────────────────────────────────────────────────────

export async function migrateFromLocalStorage(): Promise<void> {
  const saved = localStorage.getItem('tools');
  if (saved) {
    const tools = JSON.parse(saved);
    await saveTools(tools);
    console.log(`已迁移 ${tools.length} 个工具到 IndexedDB`);
  }
}
