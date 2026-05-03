import { useState, useEffect, useCallback } from 'react';
import { Song } from '../types';
import { indexedDBHelper } from '../utils/indexedDB';
import { getAllSongs, addSong, addSongs, updateSong, deleteSong } from '../services/supabaseService';
import { getCurrentUser, signOut, onAuthStateChange } from '../services/authService';
import { User as AuthUser } from '../services/authService';
import { fetchLyrics, fetchLyricsAndSave } from '../services/lyricsService';
import { musicApi } from '../services/musicApiAdapter';
import { useToast } from '../components/Toast';

// Constants
const SUPABASE_TIMEOUT = 6000;
const LYRICS_CONCURRENCY = 3;
const FORCE_FULL_SYNC_THRESHOLD = 7 * 24 * 60 * 60 * 1000; // 7 天以上全量同步

// 并发控制工具函数
const asyncPool = async <T,>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> => {
  const results: T[] = [];
  const executing: Promise<void>[] = [];
  
  for (let i = 0; i < tasks.length; i++) {
    const p = tasks[i]().then(result => {
      results[i] = result;
    });
    executing.push(p as Promise<void>);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(e => e === p), 1);
    }
  }
  
  await Promise.all(executing);
  return results;
};

// 从旧 localStorage 迁移数据到 IndexedDB
const migrateFromLocalStorage = async () => {
  try {
    const cachedUser = localStorage.getItem('sb-session');
    if (!cachedUser) return false;
    
    const sessionData = JSON.parse(cachedUser);
    if (!sessionData?.session?.user) return false;
    
    // 尝试从 cacheUtils 的缓存格式读取
    const oldCacheKey = 'user_songs';
    const cachedData = localStorage.getItem(oldCacheKey);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      if (parsed?.data && Array.isArray(parsed.data)) {
        await indexedDBHelper.saveAllSongs(parsed.data);
        await indexedDBHelper.saveMetadata({
          lastSyncTime: Date.now(),
          userId: sessionData.session.user.id
        });
        localStorage.removeItem(oldCacheKey);
        return true;
      }
    }
  } catch (error) {
    console.warn('Migration from localStorage failed:', error);
  }
  return false;
};

export const useAppData = () => {
  const { showToast } = useToast();
  const [songs, setSongs] = useState<Song[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // 从 IndexedDB 加载缓存数据
  const loadFromCache = useCallback(async (userId: string) => {
    try {
      const metadata = await indexedDBHelper.getMetadata();
      
      // 检查是否是当前用户的数据
      if (metadata && metadata.userId === userId) {
        const cachedSongs = await indexedDBHelper.getAllSongs();
        if (cachedSongs.length > 0) {
          setSongs(cachedSongs);
          return { metadata, hasCache: true };
        }
      }
    } catch (error) {
      console.error('Failed to load from cache:', error);
    }
    
    return { metadata: null, hasCache: false };
  }, []);

  // 从 Supabase 同步数据
  const syncFromSupabase = useCallback(async (userId: string) => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Supabase request timeout')), SUPABASE_TIMEOUT)
      );
      const songsPromise = getAllSongs();
      const songsFromSupabase = await Promise.race([songsPromise, timeoutPromise]) as Song[];
      
      // 更新本地缓存
      await indexedDBHelper.saveAllSongs(songsFromSupabase);
      await indexedDBHelper.saveMetadata({
        lastSyncTime: Date.now(),
        userId
      });
      
      setSongs(songsFromSupabase);
      return songsFromSupabase;
    } catch (error) {
      console.log('Failed to sync from Supabase, sticking with cache:', error);
      throw error;
    }
  }, []);

  // Load current user and listen for auth state changes
  useEffect(() => {
    const cachedUser = localStorage.getItem('sb-session');
    if (cachedUser) {
      try {
        const sessionData = JSON.parse(cachedUser);
        if (sessionData?.session?.user) {
          setUser(sessionData.session.user);
          
          // 尝试加载缓存数据
          (async () => {
            await migrateFromLocalStorage();
            await loadFromCache(sessionData.session.user.id);
          })();
        }
      } catch (e) {
        console.error('Failed to parse cached session');
      }
    }

    const loadUser = async () => {
      try {
        const { user } = await getCurrentUser();
        setUser(user);
      } catch (error) {
        console.error('Failed to load user:', error);
        setUser(null);
      } finally {
        setIsLoadingUser(false);
      }
    };

    loadUser();

    const subscription = onAuthStateChange((authUser) => {
      setUser(authUser);
      if (authUser) {
        const fetchSongs = async () => {
          // 优先从 IndexedDB 加载缓存
          await loadFromCache(authUser.id);
          
          try {
            await syncFromSupabase(authUser.id);
          } catch (error) {
            console.log('Failed to sync from Supabase, sticking with cache:', error);
          }
        };
        fetchSongs();
      } else {
        setSongs([]);
        (async () => {
          await indexedDBHelper.clearAll();
        })();
      }
    });
    return () => subscription.data.subscription.unsubscribe();
  }, [loadFromCache, syncFromSupabase]);

  const handleDeleteSong = useCallback(async (songId: string, onConfirm: () => void) => {
    try {
      await deleteSong(songId);
      setSongs(prevSongs => {
        const updatedSongs = prevSongs.filter(song => song.id !== songId);
        indexedDBHelper.saveAllSongs(updatedSongs).catch(console.error);
        return updatedSongs;
      });
      showToast('歌曲已删除', 'success');
    } catch (error) {
      console.error('Failed to delete song:', error);
      showToast('删除歌曲失败', 'error');
    }
    onConfirm();
  }, [showToast]);

  const handleAddSong = useCallback(async (title: string, artist: string, album: string, coverUrl?: string, releaseDate?: string, tags?: string[]) => {
    const artists = artist.split(/[,，、\/&]/).map(a => a.trim()).filter(a => a.length > 0);
    
    let matchedCoverUrl = coverUrl || '';
    let matchedAlbum = album;
    let matchedReleaseDate = releaseDate;
    
    if (coverUrl === undefined || releaseDate === undefined) {
      try {
        const domesticResults = await musicApi.search({
          keyword: `${title} ${artists.join(' ')}`,
          apiType: 'itunes-domestic',
          limit: 5
        });
        
        const matchedSong = domesticResults.find(song => {
          const songNameMatch = song.name.toLowerCase().includes(title.toLowerCase());
          const artistMatch = song.artist.toLowerCase().includes(artists.join(' ').toLowerCase());
          return songNameMatch && artistMatch;
        });
        
        if (matchedSong) {
          matchedCoverUrl = matchedSong.coverUrl || '';
          if (!album.trim()) {
            matchedAlbum = matchedSong.album;
          }
          matchedReleaseDate = matchedSong.releaseDate;
        } else {
          const internationalResults = await musicApi.search({
            keyword: `${title} ${artists.join(' ')}`,
            apiType: 'itunes-international',
            limit: 1
          });
          
          if (internationalResults.length > 0) {
            const internationalSong = internationalResults[0];
            matchedCoverUrl = internationalSong.coverUrl || '';
            if (!album.trim()) {
              matchedAlbum = internationalSong.album;
            }
            matchedReleaseDate = internationalSong.releaseDate;
          }
        }
      } catch (error) {
        console.warn('歌曲信息匹配失败，使用用户输入的信息:', error);
      }
    }
    
    const newSong: Song = {
      id: crypto.randomUUID(),
      title,
      artists,
      album: matchedAlbum,
      coverUrl: matchedCoverUrl,
      releaseDate: matchedReleaseDate,
      tags: tags && tags.length > 0 ? tags : [],
      addedAt: Date.now()
    };

    try {
      const addedSong = await addSong(newSong);
      
      // 后台自动获取歌词（不阻塞用户操作，成功后更新本地 state）
      fetchLyricsAndSave(addedSong.id, addedSong.title, addedSong.artists[0])
        .then(result => {
          if (result.success && result.lyricsText) {
            // 歌词获取成功，更新本地 songs state 以同步歌词数据
            setSongs(prevSongs => {
              const updatedSongs = prevSongs.map(s =>
                s.id === addedSong.id ? { ...s, lyrics: result.lyricsText } : s
              );
              indexedDBHelper.saveAllSongs(updatedSongs).catch(console.error);
              return updatedSongs;
            });
          }
        })
        .catch(error => {
          console.warn('歌词自动获取失败:', error);
        });
      
      setSongs(prevSongs => {
        const updatedSongs = [addedSong, ...prevSongs];
        indexedDBHelper.saveAllSongs(updatedSongs).catch(console.error);
        return updatedSongs;
      });
      showToast('歌曲添加成功', 'success');
    } catch (error) {
      console.error('添加歌曲失败:', error);
      showToast('添加歌曲失败，请重试', 'error');
      throw error;
    }
  }, [showToast]);

  const handleUpdateSong = useCallback(async (updatedSong: Song) => {
    try {
      await updateSong(updatedSong.id, updatedSong);
      setSongs(prevSongs => {
        const songs = prevSongs.map(song => 
          song.id === updatedSong.id ? updatedSong : song
        );
        indexedDBHelper.saveAllSongs(songs).catch(console.error);
        return songs;
      });
      showToast('歌曲更新成功', 'success');
    } catch (error) {
      console.error('Failed to update song:', error);
      showToast('更新歌曲失败', 'error');
    }
  }, [showToast]);

  const handleUpdateAlbum = useCallback(async (oldAlbumName: string, newAlbumName: string) => {
    try {
      const albumSongs = songs.filter(song => song.album === oldAlbumName);
      
      await Promise.all(
        albumSongs.map(song => {
          const updatedSong = { ...song, album: newAlbumName };
          return updateSong(song.id, updatedSong);
        })
      );
      
      setSongs(prevSongs => {
        const updatedSongs = prevSongs.map(song => 
          song.album === oldAlbumName ? { ...song, album: newAlbumName } : song
        );
        indexedDBHelper.saveAllSongs(updatedSongs).catch(console.error);
        return updatedSongs;
      });
      showToast(`专辑已更新为 "${newAlbumName}"，共 ${albumSongs.length} 首歌曲`, 'success');
    } catch (error) {
      console.error('Failed to update album:', error);
      showToast('更新专辑名称失败，请稍后重试', 'error');
      throw error;
    }
  }, [songs, showToast]);

  const handleBulkImport = useCallback(async (lines: string[]) => {
    const newSongs: Song[] = [];
    const importErrors: string[] = [];
    
    const existingSongs = new Set<string>();
    if (songs.length > 0) {
      songs.forEach(song => {
        existingSongs.add(`${song.title.toLowerCase()}|||${song.artists.join(',').toLowerCase()}`);
      });
    }
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      try {
        if (line.startsWith('{') && line.endsWith('}')) {
          try {
            const songInfo = JSON.parse(line);
            
            if (songInfo.title && songInfo.artist) {
              const artists = songInfo.artist.split(/[,，、\/]/).map((a: string) => a.trim()).filter((a: string) => a.length > 0);
              
              const songKey = `${songInfo.title.toLowerCase()}|||${artists.join(',').toLowerCase()}`;
              if (existingSongs.has(songKey)) {
                importErrors.push(`第${i+1}行：歌曲已存在 - ${songInfo.title}`);
                continue;
              }
              
              const newSong: Song = {
                id: crypto.randomUUID(),
                title: songInfo.title,
                artists,
                album: songInfo.album || undefined,
                coverUrl: songInfo.coverUrl || undefined,
                releaseDate: songInfo.releaseDate || undefined,
                tags: songInfo.tags || [],
                addedAt: songInfo.addedAt ? 
                  (typeof songInfo.addedAt === 'string' ? new Date(songInfo.addedAt).getTime() : songInfo.addedAt) : 
                  Date.now()
              };
              
              newSongs.push(newSong);
              existingSongs.add(songKey);
            }
          } catch (jsonError) {
            importErrors.push(`第${i+1}行：数据格式错误`);
          }
        } else {
          const parts = line.split('-').map(s => s.trim());
          if (parts.length >= 2) {
            let title = parts[0];
            let artist = parts[1];
            let matchedAlbum = '';
            
            const albumMatch = artist.match(/\((.+?)\)$/);
            if (albumMatch) {
              matchedAlbum = albumMatch[1];
              artist = artist.replace(/\((.+?)\)$/, '').trim();
            }
            
            const artists = artist.split(/[,，、\/&]/).map(a => a.trim()).filter(a => a.length > 0);
            
            const songKey = `${title.toLowerCase()}|||${artists.join(',').toLowerCase()}`;
            if (existingSongs.has(songKey)) {
              importErrors.push(`第${i+1}行：歌曲已存在 - ${title}`);
              continue;
            }
            
            newSongs.push({
              id: crypto.randomUUID(),
              title,
              artists,
              coverUrl: undefined,
              releaseDate: undefined,
              album: matchedAlbum || undefined,
              tags: [],
              addedAt: Date.now()
            });
            
            existingSongs.add(songKey);
          }
        }
      } catch (error) {
        importErrors.push(`第${i+1}行：处理失败`);
      }
    }

    if (newSongs.length > 0) {
      try {
        const addedSongs = await addSongs(newSongs);
        
        const fetchAllLyrics = async () => {
          const tasks = addedSongs.map(song => async () => {
            try {
              const artist = song.artists[0];
              // 批量导入时自动获取歌词并保存到 Supabase
              const result = await fetchLyricsAndSave(song.id, song.title, artist);
              if (result.success && result.lyricsText) {
                // 更新本地 state 以同步歌词数据
                setSongs(prevSongs => {
                  const updatedSongs = prevSongs.map(s =>
                    s.id === song.id ? { ...s, lyrics: result.lyricsText } : s
                  );
                  indexedDBHelper.saveAllSongs(updatedSongs).catch(console.error);
                  return updatedSongs;
                });
              }
            } catch (error) {
              console.warn('歌词自动获取失败:', song.title, error);
            }
          });
          await asyncPool(tasks, LYRICS_CONCURRENCY);
        };
        
        fetchAllLyrics().catch(error => {
          console.error('批量获取歌词失败:', error);
        });
        
        const updatedSongs = [...addedSongs, ...songs];
        setSongs(updatedSongs);
        indexedDBHelper.saveAllSongs(updatedSongs).catch(console.error);
        
        const successMessage = `成功导入 ${addedSongs.length} 首歌曲`;
        if (importErrors.length > 0) {
          showToast(`${successMessage}，${importErrors.length} 首导入失败`, 'warning', 5000);
        } else {
          showToast(successMessage, 'success');
        }
      } catch (error) {
        console.error('Failed to import songs:', error);
        showToast('歌曲导入失败，请重试', 'error');
      }
    } else {
      showToast('没有成功导入任何歌曲，可能是因为所有歌曲都已存在或格式错误', 'warning');
    }
  }, [songs, showToast]);

  const handleJSONImport = useCallback(async (importedSongs: Song[]) => {
    const newSongs: Song[] = [];
    const existingKeys = new Set<string>();
    songs.forEach(song => {
      existingKeys.add(`${song.title.toLowerCase()}|||${song.artists.join(',').toLowerCase()}`);
    });
    
    for (const song of importedSongs) {
      const artists = typeof song.artists === 'string' 
        ? (song.artists as unknown as string).split(/[,，、\/]/).map((a: string) => a.trim()).filter((a: string) => a.length > 0)
        : song.artists;
      
      const songKey = `${song.title.toLowerCase()}|||${artists.join(',').toLowerCase()}`;
      if (existingKeys.has(songKey)) continue;
      
      newSongs.push({
        id: song.id || crypto.randomUUID(),
        title: song.title,
        artists,
        album: song.album || undefined,
        coverUrl: song.coverUrl || undefined,
        releaseDate: song.releaseDate || undefined,
        tags: song.tags || [],
        lyrics: song.lyrics || undefined,
        comment: song.comment || undefined,
        duration: song.duration || undefined,
        addedAt: song.addedAt || Date.now(),
      });
      existingKeys.add(songKey);
    }
    
    if (newSongs.length > 0) {
      try {
        const addedSongs = await addSongs(newSongs);
        const updatedSongs = [...addedSongs, ...songs];
        setSongs(updatedSongs);
        indexedDBHelper.saveAllSongs(updatedSongs).catch(console.error);
        
        const skipped = importedSongs.length - newSongs.length;
        const msg = `成功导入 ${addedSongs.length} 首歌曲`;
        showToast(skipped > 0 ? `${msg}，${skipped} 首已跳过（重复）` : msg, skipped > 0 ? 'warning' : 'success');
      } catch (error) {
        console.error('JSON import failed:', error);
        showToast('导入失败，请重试', 'error');
      }
    } else {
      showToast('所有歌曲已存在，没有新歌曲导入', 'warning');
    }
  }, [songs, showToast]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Failed to sign out:', error);
      showToast('登出失败，请重试', 'error');
    }
  }, [showToast]);

  return {
    songs,
    user,
    isLoadingUser,
    handleDeleteSong,
    handleAddSong,
    handleUpdateSong,
    handleUpdateAlbum,
    handleBulkImport,
    handleJSONImport,
    handleSignOut,
  };
};
