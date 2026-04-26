import { createClient } from '@supabase/supabase-js';
import { Client } from 'lrclib-api';
import * as OpenCC from 'opencc-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const lrclibClient = new Client();
let converter: ReturnType<typeof OpenCC.Converter> | null = null;

const getConverter = () => {
  if (!converter) {
    converter = OpenCC.Converter({ from: 'tw', to: 'cn' });
  }
  return converter;
};

interface LyricsData {
  id?: string;
  song_id: string;
  song_title: string;
  artist_name?: string;
  plain_lyrics: string;
  synced_lyrics?: string;
  source?: 'manual' | 'lrclib' | 'import';
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface LyricsCache {
  [key: string]: {
    data: any;
    timestamp: number;
  };
}

const memoryCache: LyricsCache = {};
const CACHE_DURATION = 24 * 60 * 60 * 1000;

const getLyricsFromCache = (key: string, type: 'plain' | 'synced'): any => {
  if (memoryCache[key]) {
    const now = Date.now();
    if (now - memoryCache[key].timestamp < CACHE_DURATION) {
      console.log(`[本地缓存] 获取 ${type}: ${key}`);
      return memoryCache[key].data;
    }
  }

  try {
    const localStorageKey = `lyrics_${type}_${key}`;
    const cached = localStorage.getItem(localStorageKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      if (now - timestamp < CACHE_DURATION) {
        console.log(`[本地缓存] 从localStorage获取 ${type}: ${key}`);
        memoryCache[key] = { data, timestamp };
        return data;
      }
    }
  } catch (error) {
    console.error('Error accessing localStorage:', error);
  }

  return null;
};

const saveLyricsToCache = (key: string, type: 'plain' | 'synced', data: any): void => {
  const timestamp = Date.now();
  memoryCache[key] = { data, timestamp };

  try {
    const localStorageKey = `lyrics_${type}_${key}`;
    localStorage.setItem(localStorageKey, JSON.stringify({ data, timestamp }));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

const convertToSimplified = (text: string): string => {
  if (!text) return text;
  try {
    return getConverter()(text);
  } catch (error) {
    console.error('Error converting text:', error);
    return text;
  }
};

const parseLRC = (lrcText: string): { plain: string[]; synced: Array<{ time: string; text: string }> } => {
  const lines = lrcText.split('\n');
  const plain: string[] = [];
  const synced: Array<{ time: string; text: string }> = [];

  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    const match = trimmedLine.match(/\[(\d{2}:\d{2}\.\d{2,3})\](.*)/);
    if (match) {
      const time = match[1];
      const text = convertToSimplified(match[2].trim());
      synced.push({ time, text });
      if (text && !plain.includes(text)) {
        plain.push(text);
      }
    } else {
      const text = convertToSimplified(trimmedLine);
      if (text && !plain.includes(text)) {
        plain.push(text);
      }
    }
  });

  return { plain, synced };
};

const parsePlainText = (text: string): string[] => {
  return text.split('\n')
    .map(line => convertToSimplified(line.trim()))
    .filter(line => line.length > 0);
};

export const getUserId = async (): Promise<string | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

export const fetchLyricsFromSupabase = async (songId: string): Promise<LyricsData | null> => {
  try {
    console.log(`[Supabase] 从songs表获取歌词: ${songId}`);

    const { data, error } = await supabase
      .from('songs')
      .select('user_lyrics, lyrics_source')
      .eq('id', songId)
      .single();

    if (error) {
      console.error('Error fetching lyrics from Supabase:', error);
      return null;
    }

    if (data && data.user_lyrics) {
      console.log('[Supabase] 歌词获取成功');
      return {
        song_id: songId,
        song_title: '', // 从数据库获取时可能没有song_title，设置为空字符串
        plain_lyrics: data.user_lyrics,
        source: data.lyrics_source
      };
    }

    console.log('[Supabase] 该歌曲暂无歌词');
    return null;
  } catch (error) {
    console.error('Error fetching lyrics from Supabase:', error);
    return null;
  }
};

export const saveLyricsToSupabase = async (
  songId: string,
  songTitle: string,
  _artistName: string | undefined, // 未使用的参数，添加下划线前缀
  plainLyrics: string,
  source: 'manual' | 'lrclib' | 'import' = 'manual'
): Promise<boolean> => {
  try {
    console.log(`[Supabase] 保存歌词到songs表: ${songTitle}, songId: ${songId}, source: ${source}`);
    console.log(`[Supabase] 歌词内容长度: ${plainLyrics.length} 字符`);

    // 先检查歌曲是否存在
    const { data: song, error: checkError } = await supabase
      .from('songs')
      .select('id')
      .eq('id', songId)
      .single();

    if (checkError) {
      console.error('Error checking song existence:', checkError);
      return false;
    }

    if (!song) {
      console.error('Song not found:', songId);
      return false;
    }

    const { error } = await supabase
      .from('songs')
      .update({
        user_lyrics: plainLyrics,
        lyrics_source: source
      })
      .eq('id', songId);

    if (error) {
      console.error('Error saving lyrics to Supabase:', error);
      return false;
    }

    console.log('[Supabase] 歌词保存成功');
    return true;
  } catch (error) {
    console.error('Error saving lyrics to Supabase:', error);
    return false;
  }
};

export const deleteLyricsFromSupabase = async (songId: string): Promise<boolean> => {
  try {
    const userId = await getUserId();
    if (!userId) {
      return false;
    }

    const { error } = await supabase
      .from('lyrics')
      .delete()
      .eq('song_id', songId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting lyrics from Supabase:', error);
      return false;
    }

    console.log('[Supabase] 歌词删除成功');
    return true;
  } catch (error) {
    console.error('Error deleting lyrics from Supabase:', error);
    return false;
  }
};

export const getAllUserLyrics = async (): Promise<LyricsData[]> => {
  try {
    const userId = await getUserId();
    if (!userId) {
      return [];
    }

    const { data, error } = await supabase
      .from('lyrics')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching all lyrics:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching all lyrics:', error);
    return [];
  }
};

export const searchLyricsByTitle = async (songTitle: string, artist?: string, directFuzzySearch = false): Promise<any[]> => {
  try {
    // 转换为简体进行搜索
    const simplifiedTitle = convertToSimplified(songTitle);
    const simplifiedArtist = artist ? convertToSimplified(artist) : '';
    console.log(`[lrclib.net] 搜索歌词: ${simplifiedTitle}${simplifiedArtist ? ` - ${simplifiedArtist}` : ''}`);
    
    // 降级搜索策略
    const searchWithParams = async (trackName: string, artistName?: string): Promise<any[]> => {
      const params = new URLSearchParams({ track_name: trackName });
      if (artistName) {
        params.append('artist_name', artistName);
      }
      const url = `https://lrclib.net/api/search?${params.toString()}`;
      console.log(`[lrclib.net] 搜索URL: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[lrclib.net] 搜索失败: HTTP ${response.status}`);
        return [];
      }
      const results = await response.json();
      console.log(`[lrclib.net] 搜索结果数量: ${Array.isArray(results) ? results.length : 0}`);
      return Array.isArray(results) ? results : [];
    };
    
    // 直接模糊搜索（只使用歌曲名）
    if (directFuzzySearch) {
      console.log(`[lrclib.net] 直接进行模糊搜索: ${simplifiedTitle}`);
      const results = await searchWithParams(simplifiedTitle);
      console.log(`[lrclib.net] 最终搜索结果数量: ${results.length}`);
      return results;
    }
    
    // 第一轮：精确搜索（歌曲名 + 艺术家名）
    let results = await searchWithParams(simplifiedTitle, simplifiedArtist);
    
    // 第二轮：如果没有结果，降级为只使用歌曲名搜索
    if (results.length === 0 && simplifiedTitle) {
      console.log(`[lrclib.net] 精确搜索无结果，尝试模糊搜索: ${simplifiedTitle}`);
      results = await searchWithParams(simplifiedTitle);
    }
    
    console.log(`[lrclib.net] 最终搜索结果数量: ${results.length}`);
    return results;
  } catch (error) {
    console.error(`[lrclib.net] 搜索失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
};

export const fetchLyricsById = async (
  songId: string,
  trackId: string,
  songTitle: string,
  artist?: string
): Promise<string[]> => {
  const cacheKey = `${songId}_${songTitle.trim().toLowerCase()}_${artist || ''}_${trackId}`;

  const cachedData = getLyricsFromCache(cacheKey, 'plain');
  if (cachedData) {
    return cachedData;
  }

  try {
    // 转换为简体进行搜索
    const simplifiedTitle = convertToSimplified(songTitle);
    const simplifiedArtist = artist ? convertToSimplified(artist) : '';
    console.log(`[lrclib.net] 获取歌词: ${simplifiedTitle}${simplifiedArtist ? ` - ${simplifiedArtist}` : ''}`);
    
    // 直接使用简体的歌曲名和艺术家名获取歌词
    const query = {
      track_name: simplifiedTitle,
      artist_name: simplifiedArtist // 使用简体的艺术家名或空字符串
    };
    const metadata = await lrclibClient.findLyrics(query);

    if (metadata) {
      if (metadata.instrumental) {
        const result = ['纯音乐，无歌词'];
        saveLyricsToCache(cacheKey, 'plain', result);
        // 保存到Supabase
        await saveLyricsToSupabase(
          songId,
          songTitle,
          artist,
          result.join('\n'),
          'lrclib'
        );
        return result;
      }

      if (metadata.plainLyrics) {
        const lines = metadata.plainLyrics.split('\n')
          .map((line: string) => convertToSimplified(line.trim()))
          .filter((line: string) => line.length > 0);

        const result = lines.length > 0 ? lines : ['暂无歌词'];
        saveLyricsToCache(cacheKey, 'plain', result);

        // 保存到Supabase，只保存纯文本歌词
        await saveLyricsToSupabase(
          songId,
          songTitle,
          artist,
          result.join('\n'),
          'lrclib'
        );

        return result;
      }
    }

    const result = ['暂无歌词'];
    saveLyricsToCache(cacheKey, 'plain', result);
    return result;
  } catch (error) {
    console.error('Error fetching lyrics:', error);
    const result = ['暂无歌词'];
    saveLyricsToCache(cacheKey, 'plain', result);
    return result;
  }
};

export const fetchLyrics = async (
  songId: string,
  songTitle: string,
  artist?: string
): Promise<string[]> => {
  const cacheKey = `${songId}_${songTitle.trim().toLowerCase()}_${artist || ''}`;

  const cachedData = getLyricsFromCache(cacheKey, 'plain');
  if (cachedData) {
    return cachedData;
  }

  const supabaseLyrics = await fetchLyricsFromSupabase(songId);
  if (supabaseLyrics && supabaseLyrics.plain_lyrics) {
    const lines = parsePlainText(supabaseLyrics.plain_lyrics);
    saveLyricsToCache(cacheKey, 'plain', lines);
    return lines;
  }

  try {
    // 转换为简体进行搜索
    const simplifiedTitle = convertToSimplified(songTitle);
    const simplifiedArtist = artist ? convertToSimplified(artist) : '';
    console.log(`[lrclib.net] 获取歌词: ${simplifiedTitle}${simplifiedArtist ? ` - ${simplifiedArtist}` : ''}`);

    // 定义搜索函数（带错误处理）
    const searchLyrics = async (useArtist: boolean): Promise<any> => {
      try {
        const query = {
          track_name: simplifiedTitle,
          artist_name: useArtist ? (simplifiedArtist || '') : '' // 使用简体的歌手名或空字符串
        };
        return await lrclibClient.findLyrics(query);
      } catch (error) {
        console.log(`[lrclib.net] 搜索失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return null;
      }
    };

    // 1. 先尝试使用歌手名和歌曲名搜索
    let metadata = await searchLyrics(true);
    
    // 2. 如果失败，尝试只使用歌曲名搜索
    if (!metadata) {
      console.log(`[lrclib.net] 尝试只使用歌曲名搜索: ${songTitle}`);
      metadata = await searchLyrics(false);
    }

    if (metadata) {
      if (metadata.instrumental) {
        const result = ['纯音乐，无歌词'];
        saveLyricsToCache(cacheKey, 'plain', result);
        // 保存到Supabase
        await saveLyricsToSupabase(
          songId,
          songTitle,
          artist,
          result.join('\n'),
          'lrclib'
        );
        return result;
      }

      if (metadata.plainLyrics) {
        const lines = metadata.plainLyrics.split('\n')
          .map((line: string) => convertToSimplified(line.trim()))
          .filter((line: string) => line.length > 0);

        const result = lines.length > 0 ? lines : ['暂无歌词'];
        saveLyricsToCache(cacheKey, 'plain', result);

        // 保存到Supabase，只保存纯文本歌词
        await saveLyricsToSupabase(
          songId,
          songTitle,
          artist,
          result.join('\n'),
          'lrclib'
        );

        return result;
      }
    }

    const result = ['暂无歌词'];
    saveLyricsToCache(cacheKey, 'plain', result);
    return result;
  } catch (error) {
    console.error('Error fetching lyrics:', error);
    const result = ['暂无歌词'];
    saveLyricsToCache(cacheKey, 'plain', result);
    return result;
  }
};

export const fetchLyricsWithTime = async (
  songId: string,
  songTitle: string,
  artist?: string
): Promise<Array<{ time: string; text: string }>> => {
  const cacheKey = `${songId}_${songTitle.trim().toLowerCase()}_${artist || ''}`;

  const cachedData = getLyricsFromCache(cacheKey, 'synced');
  if (cachedData) {
    return cachedData;
  }

  const supabaseLyrics = await fetchLyricsFromSupabase(songId);
  if (supabaseLyrics && supabaseLyrics.synced_lyrics) {
    try {
      const syncedData = JSON.parse(supabaseLyrics.synced_lyrics);
      saveLyricsToCache(cacheKey, 'synced', syncedData);
      return syncedData;
    } catch (error) {
      console.error('Error parsing synced lyrics from Supabase:', error);
    }
  }

  try {
    // 转换为简体进行搜索
    const simplifiedTitle = convertToSimplified(songTitle);
    const simplifiedArtist = artist ? convertToSimplified(artist) : '';
    console.log(`[lrclib.net] 获取同步歌词: ${simplifiedTitle}${simplifiedArtist ? ` - ${simplifiedArtist}` : ''}`);

    const query = {
      track_name: simplifiedTitle,
      artist_name: simplifiedArtist
    };

    const syncedLyrics = await lrclibClient.getSynced(query);

    if (syncedLyrics && syncedLyrics.length > 0) {
      const result = syncedLyrics.map((item: any) => ({
        time: formatTime(item.startTime),
        text: convertToSimplified(item.text)
      }));

      saveLyricsToCache(cacheKey, 'synced', result);

      const plainData = result.map(item => item.text).join('\n');
      await saveLyricsToSupabase(
        songId,
        songTitle,
        artist,
        plainData,
        'lrclib'
      );

      return result;
    }

    return [];
  } catch (error) {
    console.error('Error fetching synced lyrics:', error);
    return [];
  }
};

const formatTime = (ms: number): string => {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor((totalSeconds % 1) * 100);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
};

export const addCustomLyrics = async (
  songId: string,
  songTitle: string,
  artistName: string | undefined,
  lyricsText: string,
  isLRC: boolean = false
): Promise<{ success: boolean; message: string }> => {
  try {
    let plainLyrics: string;

    if (isLRC) {
      const parsed = parseLRC(lyricsText);
      plainLyrics = parsed.plain.join('\n');
    } else {
      plainLyrics = parsePlainText(lyricsText).join('\n');
    }

    const success = await saveLyricsToSupabase(
      songId,
      songTitle,
      artistName,
      plainLyrics,
      'manual'
    );

    if (success) {
      const cacheKey = `${songId}_${songTitle.trim().toLowerCase()}_${artistName || ''}`;
      if (isLRC) {
        const parsed = parseLRC(lyricsText);
        saveLyricsToCache(cacheKey, 'synced', parsed.synced);
        saveLyricsToCache(cacheKey, 'plain', parsed.plain);
      } else {
        const lines = parsePlainText(lyricsText);
        saveLyricsToCache(cacheKey, 'plain', lines);
      }

      return { success: true, message: '歌词保存成功' };
    } else {
      return { success: false, message: '歌词保存失败，请重试' };
    }
  } catch (error) {
    console.error('Error adding custom lyrics:', error);
    return { success: false, message: '歌词保存失败' };
  }
};

export const clearLyricsCache = (): void => {
  Object.keys(memoryCache).forEach(key => {
    delete memoryCache[key];
  });

  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('lyrics_')) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }

  console.log('[缓存] 已清除所有歌词缓存');
};

export { parseLRC, parsePlainText, convertToSimplified };