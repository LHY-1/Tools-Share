// IndexedDB 存储工具，替代 localStorage 以支持更大的存储配额
// IndexedDB 配额通常在几百 MB 到几 GB，远大于 localStorage 的 5-10MB

const DB_NAME = 'tool-share-db';
const DB_VERSION = 1;
const STORE_NAME = 'tools';

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
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function saveTools(tools: unknown[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // 清除旧数据
    store.clear();

    // 添加所有工具（使用 put 支持更新已有记录）
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
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export async function clearTools(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 迁移 localStorage 到 IndexedDB
export async function migrateFromLocalStorage(): Promise<void> {
  const saved = localStorage.getItem('tools');
  if (saved) {
    const tools = JSON.parse(saved);
    await saveTools(tools);
    console.log(`已迁移 ${tools.length} 个工具到 IndexedDB`);
  }
}
