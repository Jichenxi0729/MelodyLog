import { useState, useEffect, useCallback } from 'react';
import { Song } from '../types';
import { setCache, getCache } from '../utils/cacheUtils';
import { getAllSongs, addSong, addSongs, updateSong, deleteSong } from '../services/supabaseService';
import { getCurrentUser, signOut, onAuthStateChange } from '../services/authService';
import { User as AuthUser } from '../services/authService';
import { fetchLyrics } from '../services/lyricsService';
import { musicApi } from '../services/musicApiAdapter';
import { useToast } from '../components/Toast';

// Constants
const STORAGE_KEY = 'melodylog_songs';
const SUPABASE_TIMEOUT = 6000;
const LYRICS_CONCURRENCY = 3;

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

export const useAppData = () => {
  const { showToast } = useToast();
  const [songs, setSongs] = useState<Song[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // Load current user and listen for auth state changes
  useEffect(() => {
    const cachedUser = localStorage.getItem('sb-session');
    if (cachedUser) {
      try {
        const sessionData = JSON.parse(cachedUser);
        if (sessionData?.session?.user) {
          setUser(sessionData.session.user);
          const cachedSongs = getCache<Song[]>('user_songs');
          if (cachedSongs) {
            setSongs(cachedSongs);
          }
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
          const cachedSongs = getCache<Song[]>('user_songs');
          if (cachedSongs) {
            setSongs(cachedSongs);
          }
          
          try {
            const timeoutPromise = new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Supabase request timeout')), SUPABASE_TIMEOUT)
            );
            const songsPromise = getAllSongs();
            const songsFromSupabase = await Promise.race([songsPromise, timeoutPromise]) as Song[];
            setSongs(songsFromSupabase);
            setCache('user_songs', songsFromSupabase);
          } catch (error) {
            console.log('Failed to load songs from Supabase, sticking with cache:', error);
          }
        };
        fetchSongs();
      } else {
        setSongs([]);
      }
    });

    return () => subscription.data.subscription.unsubscribe();
  }, []);

  const handleDeleteSong = useCallback(async (songId: string, onConfirm: () => void) => {
    try {
      await deleteSong(songId);
      setSongs(prevSongs => {
        const updatedSongs = prevSongs.filter(song => song.id !== songId);
        setCache('user_songs', updatedSongs);
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
      
      try {
        const artist = addedSong.artists[0];
        await fetchLyrics(addedSong.id, addedSong.title, artist);
      } catch (error) {
        console.warn('歌词自动获取失败:', error);
      }
      
      setSongs(prevSongs => {
        const updatedSongs = [addedSong, ...prevSongs];
        setCache('user_songs', updatedSongs);
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
        const updatedSongs = prevSongs.map(song => 
          song.id === updatedSong.id ? updatedSong : song
        );
        setCache('user_songs', updatedSongs);
        return updatedSongs;
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
        setCache('user_songs', updatedSongs);
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
              await fetchLyrics(song.id, song.title, artist);
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
        setCache('user_songs', updatedSongs);
        
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
    handleSignOut,
  };
};
