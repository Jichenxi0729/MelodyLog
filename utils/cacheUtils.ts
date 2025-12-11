// 缓存管理工具函数

// 缓存数据结构
interface CacheData<T> {
  data: T;
  timestamp: number;
  expireAt: number;
}

// 默认缓存过期时间（1小时，单位：毫秒）
const DEFAULT_CACHE_EXPIRY = 60 * 60 * 1000;

// 设置缓存
export const setCache = <T>(key: string, data: T, expireAt: number = Date.now() + DEFAULT_CACHE_EXPIRY): void => {
  try {
    const cacheData: CacheData<T> = {
      data,
      timestamp: Date.now(),
      expireAt
    };
    localStorage.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Failed to set cache:', error);
  }
};

// 获取缓存
export const getCache = <T>(key: string): T | null => {
  try {
    const cacheItem = localStorage.getItem(key);
    if (!cacheItem) return null;

    const cacheData: CacheData<T> = JSON.parse(cacheItem);
    const now = Date.now();

    // 检查缓存是否过期
    if (now > cacheData.expireAt) {
      // 缓存过期，删除它
      localStorage.removeItem(key);
      return null;
    }

    return cacheData.data;
  } catch (error) {
    console.error('Failed to get cache:', error);
    return null;
  }
};

// 清除缓存
export const clearCache = (key?: string): void => {
  try {
    if (key) {
      localStorage.removeItem(key);
    } else {
      localStorage.clear();
    }
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
};

// 获取缓存状态
export const getCacheStatus = <T>(key: string): { isValid: boolean; data: T | null; timestamp?: number; expireAt?: number } => {
  const cacheData = localStorage.getItem(key);
  if (!cacheData) {
    return { isValid: false, data: null };
  }

  try {
    const parsedData: CacheData<T> = JSON.parse(cacheData);
    const now = Date.now();
    const isValid = now <= parsedData.expireAt;

    return {
      isValid,
      data: isValid ? parsedData.data : null,
      timestamp: parsedData.timestamp,
      expireAt: parsedData.expireAt
    };
  } catch (error) {
    console.error('Failed to get cache status:', error);
    return { isValid: false, data: null };
  }
};
