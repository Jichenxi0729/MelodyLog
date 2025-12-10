// 缓存接口定义
interface LyricsCache {
  [key: string]: {
    data: any;
    timestamp: number;
  };
}

// 内存缓存
const memoryCache: LyricsCache = {};
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时缓存

// 从缓存获取歌词
const getLyricsFromCache = (key: string, type: 'lyrics' | 'lyricsWithTime'): any => {
  // 内存缓存检查
  if (memoryCache[key]) {
    const now = Date.now();
    if (now - memoryCache[key].timestamp < CACHE_DURATION) {
      console.log(`[缓存] 从内存获取 ${type}: ${key}`);
      return memoryCache[key].data;
    }
  }

  // localStorage缓存检查
  try {
    const localStorageKey = `lyricsCache_${type}_${key}`;
    const cached = localStorage.getItem(localStorageKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      if (now - timestamp < CACHE_DURATION) {
        console.log(`[缓存] 从localStorage获取 ${type}: ${key}`);
        // 更新内存缓存
        memoryCache[key] = { data, timestamp };
        return data;
      }
    }
  } catch (error) {
    console.error('Error accessing localStorage:', error);
  }

  return null;
};

// 保存歌词到缓存
const saveLyricsToCache = (key: string, type: 'lyrics' | 'lyricsWithTime', data: any): void => {
  const timestamp = Date.now();
  
  // 保存到内存缓存
  memoryCache[key] = { data, timestamp };
  
  // 保存到localStorage
  try {
    const localStorageKey = `lyricsCache_${type}_${key}`;
    localStorage.setItem(localStorageKey, JSON.stringify({ data, timestamp }));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

// 歌词API服务
export const fetchLyrics = async (songTitle: string, artist?: string): Promise<string[]> => {
  const cacheKey = `${songTitle.trim().toLowerCase()}_${artist || ''}`;
  
  // 检查缓存
  const cachedData = getLyricsFromCache(cacheKey, 'lyrics');
  if (cachedData) {
    return cachedData;
  }
  
  try {
    // 调用Lokua的歌词API
    console.log(`[API] 获取歌词: ${songTitle}${artist ? ` - ${artist}` : ''}`);
    
    // 使用网易云音乐接口，因为它是最常用的
    const response = await fetch(`https://lokuamusic.top/api/netease?input=${encodeURIComponent(songTitle + (artist ? ` ${artist}` : ''))}&filter=name&page=1`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch lyrics from Lokua API');
    }
    
    const data = await response.json();
    
    // 检查是否返回了歌曲列表
    if (data.code === 200 && data.data && data.data.length > 0) {
      console.log('Received song list from Lokua API');
      
      let selectedSong = data.data[0]; // 默认选择第一首
      
      // 如果有歌手信息，尝试匹配正确的歌曲
      if (artist) {
        const artistLower = artist.toLowerCase();
        const matchedSong = data.data.find((song: any) => 
          song.author.toLowerCase().includes(artistLower) ||
          song.title.toLowerCase().includes(artistLower)
        );
        if (matchedSong) {
          selectedSong = matchedSong;
          console.log(`Found matching song: ${selectedSong.title} - ${selectedSong.author}`);
        }
      }
      
      // 解析歌词数据
      if (selectedSong.lrc) {
        // 解析LRC格式歌词
        const lines = selectedSong.lrc.split('\n')
          .map((line: string) => {
            // 移除时间戳
            const textOnly = line.replace(/\[[\d:\.]+\]/g, '').trim();
            return textOnly;
          })
          .filter((line: string) => line.length > 0);
        
        const result = lines.length > 0 ? lines : ['暂无歌词'];
        saveLyricsToCache(cacheKey, 'lyrics', result);
        return result;
      } else {
        console.log('No lyrics found for this song');
        const result = ['暂无歌词'];
        saveLyricsToCache(cacheKey, 'lyrics', result);
        return result;
      }
    } else {
      console.log('No matching songs found');
      const result = ['暂无歌词'];
      saveLyricsToCache(cacheKey, 'lyrics', result);
      return result;
    }
  } catch (error) {
    console.error('Error fetching lyrics:', error);
    // 返回一些默认的歌词内容作为备用
    const result = [
      '歌词加载失败',
      '请稍后再试',
      '或者尝试其他歌曲'
    ];
    // 缓存错误结果
    saveLyricsToCache(cacheKey, 'lyrics', result);
    return result;
  }
};

// 获取带时间戳的歌词（如果需要）
export const fetchLyricsWithTime = async (songTitle: string, artist?: string): Promise<Array<{ time: string; text: string }>> => {
  const cacheKey = `${songTitle.trim().toLowerCase()}_${artist || ''}`;
  
  // 检查缓存
  const cachedData = getLyricsFromCache(cacheKey, 'lyricsWithTime');
  if (cachedData) {
    return cachedData;
  }
  
  try {
    console.log(`[API] 获取带时间戳歌词: ${songTitle}${artist ? ` - ${artist}` : ''}`);
    
    // 使用网易云音乐接口，因为它是最常用的
    const response = await fetch(`https://lokuamusic.top/api/netease?input=${encodeURIComponent(songTitle + (artist ? ` ${artist}` : ''))}&filter=name&page=1`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch lyrics with time from Lokua API');
    }
    
    const data = await response.json();
    
    // 检查是否返回了歌曲列表
    if (data.code === 200 && data.data && data.data.length > 0) {
      console.log('Received song list from Lokua API');
      
      let selectedSong = data.data[0]; // 默认选择第一首
      
      // 如果有歌手信息，尝试匹配正确的歌曲
      if (artist) {
        const artistLower = artist.toLowerCase();
        const matchedSong = data.data.find((song: any) => 
          song.author.toLowerCase().includes(artistLower) ||
          song.title.toLowerCase().includes(artistLower)
        );
        if (matchedSong) {
          selectedSong = matchedSong;
          console.log(`Found matching song: ${selectedSong.title} - ${selectedSong.author}`);
        }
      }
      
      // 解析带时间戳的歌词
      if (selectedSong.lrc) {
        // 解析LRC格式歌词
        const lines = selectedSong.lrc.split('\n')
          .map((line: string) => line.trim())
          .filter((line: string) => line.length > 0);
        
        // 解析时间戳和歌词内容
        const result = lines.map((line: string) => {
          const match = line.match(/\[(\d+:\d+\.\d+)\](.*)/);
          if (match) {
            return {
              time: match[1],
              text: match[2]
            };
          }
          // 如果没有时间戳，也返回歌词内容
          return {
            time: '',
            text: line
          };
        });
        
        // 缓存结果
        saveLyricsToCache(cacheKey, 'lyricsWithTime', result);
        return result;
      } else {
        console.log('No lyrics found for this song');
        const result: Array<{ time: string; text: string }> = [];
        saveLyricsToCache(cacheKey, 'lyricsWithTime', result);
        return result;
      }
    } else {
      console.log('No matching songs found');
      const result: Array<{ time: string; text: string }> = [];
      saveLyricsToCache(cacheKey, 'lyricsWithTime', result);
      return result;
    }
  } catch (error) {
    console.error('Error fetching lyrics with time:', error);
    const result: Array<{ time: string; text: string }> = [];
    // 缓存错误结果
    saveLyricsToCache(cacheKey, 'lyricsWithTime', result);
    return result;
  }
};

// 清除歌词缓存
export const clearLyricsCache = (): void => {
  // 清除内存缓存
  Object.keys(memoryCache).forEach(key => {
    delete memoryCache[key];
  });
  
  // 清除localStorage缓存
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('lyricsCache_')) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
  
  console.log('[缓存] 已清除所有歌词缓存');
};
