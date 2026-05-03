import { createClient } from '@supabase/supabase-js';
import { getLyrics as getLyricsFromLib, parseLyrics as parseLyricsFromLib } from 'lyrics-lib';
import * as OpenCC from 'opencc-js';
import API_CONFIG from './apiConfig';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

let converter: ReturnType<typeof OpenCC.Converter> | null = null;

// ============================================================
// 统一歌词获取策略：
//
// 1. 添加/导入歌曲时 → fetchLyricsAndSave() 
//    调用 lyrics-lib 获取歌词 + 保存到 Supabase（后台静默）
//
// 2. 进入详情页时 → fetchLyrics()
//    只从 Supabase/缓存读取，不自动搜索 API
//    （没歌词就显示空状态，用户手动点击"搜索歌曲"）
//
// 3. 手动搜索时 → searchLyricsByTitle()
//    搜索多个候选结果供用户选择
//
// 4. 编辑保存/自定义歌词后 → fetchLyrics() 或直接更新状态
// ============================================================

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
  source?: 'manual' | 'lrclib' | 'lyrics-lib' | 'import';
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface LyricsCache {
  [key: string]: {
    data: LyricsCacheData;
    timestamp: number;
  };
}

interface LyricsCacheData {
  plain?: string[];
  synced?: Array<{ time: string; text: string }>;
}

const memoryCache: LyricsCache = {};
const CACHE_DURATION = 24 * 60 * 60 * 1000;

const getLyricsFromCache = (key: string, type: 'plain' | 'synced'): string[] | Array<{ time: string; text: string }> | null => {
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

const saveLyricsToCache = (key: string, type: 'plain' | 'synced', data: string[] | Array<{ time: string; text: string }>): void => {
  const timestamp = Date.now();
  memoryCache[key] = { data, timestamp };

  try {
    const localStorageKey = `lyrics_${type}_${key}`;
    localStorage.setItem(localStorageKey, JSON.stringify({ data, timestamp }));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

export const convertToSimplified = (text: string): string => {
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

// ============================================================
// Supabase 数据库操作
// ============================================================

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
        song_title: '',
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
  _artistName: string | undefined,
  plainLyrics: string,
  source: 'manual' | 'lrclib' | 'lyrics-lib' | 'import' = 'manual'
): Promise<boolean> => {
  try {
    console.log(`[Supabase] 保存歌词到songs表: ${songTitle}, source: ${source}`);
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

// ============================================================
// 核心歌词获取函数（使用 lyrics-lib）
// ============================================================

/**
 * 使用 lyrics-lib 从 API 获取纯文本歌词
 * @returns 歌词文本或 null（如果未找到）
 */
const fetchFromAPI = async (
  title: string,
  artist?: string
): Promise<string | null> => {
  try {
    const simplifiedTitle = convertToSimplified(title);
    const simplifiedArtist = artist ? convertToSimplified(artist) : undefined;

    console.log(`[lyrics-lib] 获取歌词: ${simplifiedTitle}${simplifiedArtist ? ` - ${simplifiedArtist}` : ''}`);

    const lyrics = await getLyricsFromLib({
      title: simplifiedTitle,
      artist: simplifiedArtist
    });

    if (lyrics) {
      console.log(`[lyrics-lib] 成功获取歌词 (${lyrics.length} 字符)`);
      return lyrics;
    }

    console.log('[lyrics-lib] 未找到歌词');
    return null;
  } catch (error) {
    console.log(`[lyrics-lib] 获取失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
};

/**
 * 📥 添加/导入歌曲时调用：获取歌词并保存到 Supabase
 *
 * 使用场景：
 * - useAppData.handleAddSong() 添加单首歌曲后
 * - useAppData.handleBulkImport() 批量导入歌曲后
 *
 * 特点：
 * - 后台静默执行，失败不阻断主流程
 * - 自动将歌词保存到 Supabase 缓存
 */
export const fetchLyricsAndSave = async (
  songId: string,
  songTitle: string,
  artist?: string
): Promise<{ success: boolean; lyricsText?: string }> => {
  try {
    console.log(`[自动获取歌词] 开始: ${songTitle}${artist ? ` - ${artist}` : ''}`);

    // 调用 API 获取歌词（使用歌曲名模糊搜索，不指定艺术家以提高匹配率）
    const lyricsText = await fetchFromAPI(songTitle);

    if (lyricsText) {
      // 解析歌词文本
      const parsed = parseLyricsFromLib(lyricsText);
      const lines = (parsed.synced || parsed.unsynced).map(item =>
        convertToSimplified(item.text)
      ).filter(text => text.length > 0);

      if (lines.length > 0 && lines[0] !== '暂无歌词') {
        const joinedLyrics = lines.join('\n');
        // 保存到 Supabase
        const success = await saveLyricsToSupabase(
          songId,
          songTitle,
          artist,
          joinedLyrics,
          'lyrics-lib'
        );

        // 同时更新内存和本地缓存
        const cacheKey = `${songId}_${songTitle.trim().toLowerCase()}_${artist || ''}`;
        saveLyricsToCache(cacheKey, 'plain', lines);

        console.log(`[自动获取歌词] ✅ 成功保存到 Supabase (${lines.length} 行)`);
        return { success: true, lyricsText: joinedLyrics };
      }
    }

    console.log('[自动获取歌词] ⚠️ 未找到有效歌词');
    return { success: false };
  } catch (error) {
    console.error('[自动获取歌词] ❌ 失败:', error);
    return { success: false };
  }
};

/**
 * 📱 进入详情页时调用：只从 Supabase/缓存读取歌词
 *
 * 使用场景：
 * - SongDetail useEffect([songId]) 进入详情页时
 * - 编辑保存/自定义歌词保存后刷新显示
 *
 * 特点：
 * - 纯读取函数，不搜索外部 API
 * - 如果 Supabase 没有歌词，返回空数组（让 UI 显示"点击搜索"提示）
 */
export const fetchLyrics = async (
  songId: string,
  songTitle: string,
  artist?: string
): Promise<string[]> => {
  const cacheKey = `${songId}_${songTitle.trim().toLowerCase()}_${artist || ''}`;

  // 1. 优先从 Supabase 获取歌词（最新数据）
  const supabaseLyrics = await fetchLyricsFromSupabase(songId);
  if (supabaseLyrics && supabaseLyrics.plain_lyrics) {
    const lines = parsePlainText(supabaseLyrics.plain_lyrics);
    saveLyricsToCache(cacheKey, 'plain', lines);
    console.log(`[fetchLyrics] ✅ 从 Supabase 加载歌词 (${lines.length} 行)`);
    return lines;
  }

  // 2. 如果 Supabase 没有，检查本地缓存（可能是之前的会话数据）
  const cachedData = getLyricsFromCache(cacheKey, 'plain');
  if (cachedData) {
    console.log(`[fetchLyrics] ✅ 从本地缓存加载歌词 (${cachedData.length} 行)`);
    return cachedData;
  }

  // 3. 都没有，返回空数组（UI 会显示"点击搜索"提示）
  console.log('[fetchLyrics] ℹ️ 无可用歌词，等待用户手动搜索');
  return [];
};

// ============================================================
// 手动搜索功能
// ============================================================

interface LrclibSearchResult {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

/**
 * 🔍 用户手动点击"搜索歌曲"按钮时调用
 * 搜索多个候选歌词结果供选择
 */
export const searchLyricsByTitle = async (
  songTitle: string,
  artist?: string,
  directFuzzySearch = false
): Promise<LrclibSearchResult[]> => {
  try {
    const simplifiedTitle = convertToSimplified(songTitle);
    const simplifiedArtist = artist ? convertToSimplified(artist) : '';
    console.log(`[手动搜索] 歌词: ${simplifiedTitle}${simplifiedArtist ? ' - ' + simplifiedArtist : ''}`);

    const searchWithParams = async (trackName: string, artistName?: string): Promise<LrclibSearchResult[]> => {
      const params = new URLSearchParams({ track_name: trackName });
      if (artistName) {
        params.append('artist_name', artistName);
      }
      const url = `${API_CONFIG.LRCLIB_SEARCH_URL}?${params.toString()}`;

      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[手动搜索] 失败: HTTP ${response.status}`);
        return [];
      }
      const results = await response.json();
      return Array.isArray(results) ? results : [];
    };

    // 直接模糊搜索（只使用歌曲名）
    if (directFuzzySearch) {
      const results = await searchWithParams(simplifiedTitle);
      console.log(`[手动搜索] 结果数量: ${results.length}`);
      return results;
    }

    // 精确搜索（歌曲名 + 艺术家名）
    let results = await searchWithParams(simplifiedTitle, simplifiedArtist);

    // 降级为只使用歌曲名搜索
    if (results.length === 0 && simplifiedTitle) {
      console.log(`[手动搜索] 精确搜索无结果，尝试模糊搜索: ${simplifiedTitle}`);
      results = await searchWithParams(simplifiedTitle);
    }

    console.log(`[手动搜索] 最终结果数量: ${results.length}`);
    return results;
  } catch (error) {
    console.error(`[手动搜索] 失败:`, error);
    return [];
  }
};

// ============================================================
// 自定义歌词操作
// ============================================================

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

// 兼容旧接口：fetchLyricsById（已废弃，建议使用 fetchLyricsAndSave）
export const fetchLyricsById = fetchLyricsAndSave;

// 兼容旧接口：fetchLyricsWithTime（已废弃，当前未使用）
export const fetchLyricsWithTime = async (
  _songId: string,
  _songTitle: string,
  _artist?: string
): Promise<Array<{ time: string; text: string }>> => {
  console.warn('[已废弃] fetchLyricsWithTime 已废弃，请使用其他方法');
  return [];
};

export { parseLRC, parsePlainText };
