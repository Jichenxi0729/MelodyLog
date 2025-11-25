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
    // 调用用户提供的歌词API
    console.log(`[API] 获取歌词: ${songTitle}${artist ? ` - ${artist}` : ''}`);
    
    // 首先尝试获取歌曲列表，根据歌手名字选择正确的歌曲序号
    const songListResponse = await fetch(`https://www.hhlqilongzhu.cn/api/dg_geci.php?msg=${encodeURIComponent(songTitle)}&type=1`);
    
    if (!songListResponse.ok) {
      throw new Error('Failed to fetch song list');
    }
    
    const songListData = await songListResponse.text();
    const songListLines = songListData.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('LRC'));
    
    // 检查是否返回了歌曲列表
    if (songListLines.length > 0 && /^\d+\./.test(songListLines[0])) {
      console.log('Received song list, searching for matching artist...');
      
      let selectedSongIndex = 1; // 默认选择第一首
      
      // 如果有歌手信息，尝试匹配正确的歌曲序号
      if (artist) {
        const artistLower = artist.toLowerCase();
        for (let i = 0; i < songListLines.length; i++) {
          const line = songListLines[i];
          // 检查行中是否包含歌手名字
          if (line.toLowerCase().includes(artistLower)) {
            // 提取序号
            const match = line.match(/^(\d+)\./);
            if (match) {
              selectedSongIndex = parseInt(match[1]);
              console.log(`Found matching artist, selected song index: ${selectedSongIndex}`);
              break;
            }
          }
        }
      }
      
      // 使用选定的歌曲序号获取歌词
      const lyricsResponse = await fetch(`https://www.hhlqilongzhu.cn/api/dg_geci.php?msg=${encodeURIComponent(songTitle)}&type=1&n=${selectedSongIndex}`);
      
      if (!lyricsResponse.ok) {
        throw new Error('Failed to fetch lyrics with selected index');
      }
      
      const lyricsData = await lyricsResponse.text();
      
      // 解析歌词数据
      const lines = lyricsData.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('LRC'));
      
      // 如果返回的仍然是歌曲列表，则返回模拟歌词
      if (lines.length > 0 && /^\d+\./.test(lines[0])) {
        console.log('Still received song list after index selection');
        const result = [
          '这里是模拟歌词',
          '因为歌词API返回了歌曲列表',
          '请尝试更具体的歌曲名称',
          '或者提供正确的歌曲序号'
        ];
        saveLyricsToCache(cacheKey, 'lyrics', result);
        return result;
      }
      
      const result = lines.length > 0 ? lines : ['暂无歌词'];
      saveLyricsToCache(cacheKey, 'lyrics', result);
      return result;
    } else {
      // 直接返回歌词数据
      const lines = songListData.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('LRC'));
      
      const result = lines.length > 0 ? lines : ['暂无歌词'];
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
export const fetchLyricsWithTime = async (songTitle: string): Promise<Array<{ time: string; text: string }>> => {
  const cacheKey = songTitle.trim().toLowerCase();
  
  // 检查缓存
  const cachedData = getLyricsFromCache(cacheKey, 'lyricsWithTime');
  if (cachedData) {
    return cachedData;
  }
  
  try {
    console.log(`[API] 获取带时间戳歌词: ${songTitle}`);
    const response = await fetch(`https://www.hhlqilongzhu.cn/api/dg_geci.php?msg=${encodeURIComponent(songTitle)}&type=2&n=1`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch lyrics with time');
    }
    
    const data = await response.text();
    
    // 解析带时间戳的歌词
    const lines = data.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // 这里需要根据API返回的具体格式来解析时间戳和歌词内容
    // 假设格式为 [00:00.00]歌词内容
    const result = lines.map(line => {
      const match = line.match(/\[(\d+:\d+\.\d+)\](.*)/);
      if (match) {
        return {
          time: match[1],
          text: match[2]
        };
      }
      return {
        time: '',
        text: line
      };
    });
    
    // 缓存结果
    saveLyricsToCache(cacheKey, 'lyricsWithTime', result);
    return result;
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
