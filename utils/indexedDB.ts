import { Song } from '../types';

const DB_NAME = 'MelodyLogDB';
const DB_VERSION = 1;
const STORE_NAME = 'songs';
const META_STORE_NAME = 'meta';

interface DBMetadata {
  lastSyncTime: number;
  userId?: string;
}

class IndexedDBHelper {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initDB();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 创建歌曲存储
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const songsStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          songsStore.createIndex('addedAt', 'addedAt', { unique: false });
          songsStore.createIndex('title', 'title', { unique: false });
        }

        // 创建元数据存储
        if (!db.objectStoreNames.contains(META_STORE_NAME)) {
          db.createObjectStore(META_STORE_NAME, { keyPath: 'key' });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    await this.initPromise;
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  // 获取所有歌曲
  async getAllSongs(): Promise<Song[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as Song[]);
      request.onerror = () => reject(request.error);
    });
  }

  // 保存所有歌曲
  async saveAllSongs(songs: Song[]): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // 清空现有数据
      store.clear();
      
      // 逐个添加新数据
      songs.forEach(song => store.put(song));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // 添加单个歌曲
  async addSong(song: Song): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(song);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 更新单个歌曲
  async updateSong(song: Song): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(song);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 删除单个歌曲
  async deleteSong(songId: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(songId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 获取元数据
  async getMetadata(): Promise<DBMetadata | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(META_STORE_NAME, 'readonly');
      const store = transaction.objectStore(META_STORE_NAME);
      const request = store.get('metadata');

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // 保存元数据
  async saveMetadata(metadata: DBMetadata): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(META_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(META_STORE_NAME);
      const request = store.put({ key: 'metadata', value: metadata });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 清除所有数据（登出时使用）
  async clearAll(): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, META_STORE_NAME], 'readwrite');
      transaction.objectStore(STORE_NAME).clear();
      transaction.objectStore(META_STORE_NAME).clear();
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

export const indexedDBHelper = new IndexedDBHelper();
