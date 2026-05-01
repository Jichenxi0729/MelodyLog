import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Search, Music2, UploadCloud, Home, Users, Download, User, LogIn, LogOut } from 'lucide-react';
import { Song, ViewState } from './types';
import { SongCard } from './components/SongCard';
import { AddSongModal } from './components/AddSongModal';
import ImportModal from './components/ImportModal';
import { ArtistLibrary } from './components/ArtistLibrary';
import { AlbumLibrary } from './components/AlbumLibrary';
import { ArtistDetail } from './components/ArtistDetail';
import { ArtistAlbums } from './components/ArtistAlbums';
import { AlbumDetail } from './components/AlbumDetail';
import { SongDetail } from './components/SongDetail';
import MyPage from './components/MyPage';
import AuthModal from './components/AuthModal';
import { musicApi } from './services/musicApiAdapter';
import { exportSongsToCSV } from './utils/csvExporter';
import { setCache, getCache, clearCache } from './utils/cacheUtils';
import { getAllSongs, addSong, addSongs, updateSong, deleteSong } from './services/supabaseService';
import { getCurrentUser, signOut, onAuthStateChange } from './services/authService';
import { User as AuthUser } from './services/authService';
import { fetchLyrics } from './services/lyricsService';

// Constants
// localStorage key for song data - used for migration only
const STORAGE_KEY = 'melodylog_songs';

const App: React.FC = () => {
  // Data State
  const [songs, setSongs] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  
  // Navigation State
  const [view, setView] = useState<ViewState>({ type: 'HOME' });
  const [navigationHistory, setNavigationHistory] = useState<ViewState[]>([{ type: 'HOME' }]);
  
  // Navigation functions
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  
  // Sorting
  const [sortConfig, setSortConfig] = useState<{
    key: 'addedAt' | 'title' | 'releaseDate';
    direction: 'asc' | 'desc';
  }>({ key: 'addedAt', direction: 'desc' });
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  
  // Auth State
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Load current user and listen for auth state changes
  useEffect(() => {
    // 优先尝试从缓存加载用户数据，提升首次加载速度
    const cachedUser = localStorage.getItem('sb-session');
    if (cachedUser) {
      try {
        const sessionData = JSON.parse(cachedUser);
        if (sessionData?.session?.user) {
          setUser(sessionData.session.user);
          // 同时尝试从本地缓存加载歌曲
          const cachedSongs = getCache<Song[]>('user_songs');
          if (cachedSongs) {
            setSongs(cachedSongs);
            console.log('Quick load: User and songs from cache');
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
      } catch (error: any) {
        console.error('Failed to load user:', error);
        // 捕获到的任何错误都应该设置用户为null
        setUser(null);
      } finally {
        setIsLoadingUser(false);
      }
    };

    loadUser();

    // Listen for auth state changes
    const subscription = onAuthStateChange((authUser) => {
      setUser(authUser);
      if (authUser) {
        // User logged in, load their songs
        // 使用缓存优先策略
        const fetchSongs = async () => {
          // 首先尝试从本地缓存获取歌曲 - 这一步是同步的，几乎立即完成
          const cachedSongs = getCache<Song[]>('user_songs');
          if (cachedSongs) {
            // 如果缓存存在，立即使用缓存数据，提升用户体验
            setSongs(cachedSongs);
            console.log('Loaded songs from cache');
          }
          
          // 然后异步从Supabase获取最新数据，但使用超时控制
          try {
            const timeoutPromise = new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Supabase request timeout')), 6000) // 6秒超时
            );
            const songsPromise = getAllSongs();
            const songsFromSupabase = await Promise.race([songsPromise, timeoutPromise]) as Song[];
            setSongs(songsFromSupabase);
            // 更新缓存，设置过期时间为24小时
            setCache('user_songs', songsFromSupabase);
            console.log('Loaded songs from Supabase and updated cache');
          } catch (error) {
            console.log('Failed to load songs from Supabase, sticking with cache:', error);
            // 如果Supabase加载失败，保持缓存数据即可，不做任何处理
          }
        };
        fetchSongs();
      } else {
        // User logged out, clear songs but keep cache for quick login later
        setSongs([]);
      }
    });

    return () => subscription.data.subscription.unsubscribe();
  }, []);

  // Load songs from Supabase on initial render and when user changes
  const loadSongs = async () => {
    if (!user) return;
    
    try {
      // 首先尝试从本地缓存获取歌曲
      const cachedSongs = getCache<Song[]>('user_songs');
      if (cachedSongs) {
        // 如果缓存存在，先使用缓存数据
        setSongs(cachedSongs);
        console.log('Loaded songs from cache in loadSongs');
      }
      
      // 从Supabase加载最新数据
      const songsFromSupabase = await getAllSongs();
      
      // Check if there are songs in localStorage that need to be migrated
      const savedSongs = localStorage.getItem(STORAGE_KEY);
      if (savedSongs) {
        try {
          const parsedSongs = JSON.parse(savedSongs) as Song[];
          if (parsedSongs.length > 0) {
            // If Supabase is empty, migrate all songs
            if (songsFromSupabase.length === 0) {
              console.log('Migrating songs from localStorage to Supabase...');
              for (const song of parsedSongs) {
                await addSong(song);
              }
              // Update the songs state with the migrated songs
              setSongs(parsedSongs);
              // 更新缓存
              setCache('user_songs', parsedSongs);
              console.log('Migration completed successfully!');
            } else {
              // If Supabase already has songs, check for new songs to migrate
              const supabaseIds = new Set(songsFromSupabase.map(song => song.id));
              const songsToMigrate = parsedSongs.filter(song => !supabaseIds.has(song.id));
              
              if (songsToMigrate.length > 0) {
                console.log(`Migrating ${songsToMigrate.length} new songs from localStorage to Supabase...`);
                for (const song of songsToMigrate) {
                  await addSong(song);
                }
                // Update the songs state with the combined list
                const updatedSongs = [...songsFromSupabase, ...songsToMigrate];
                setSongs(updatedSongs);
                // 更新缓存
                setCache('user_songs', updatedSongs);
                console.log('Migration completed successfully!');
              } else {
                // 如果没有需要迁移的歌曲，使用Supabase数据并更新缓存
                setSongs(songsFromSupabase);
                setCache('user_songs', songsFromSupabase);
              }
            }
            
            // Clear localStorage after migration
            localStorage.removeItem(STORAGE_KEY);
            console.log('LocalStorage cleared after migration.');
          }
        } catch (error) {
          console.error('Failed to parse saved songs:', error);
        }
      }
    } catch (error) {
      console.error('Failed to load songs from Supabase:', error);
      // 首先尝试使用缓存
      const cachedSongs = getCache<Song[]>('user_songs');
      if (cachedSongs) {
        setSongs(cachedSongs);
        console.log('Fallback to cached songs due to Supabase error in loadSongs');
      } else {
        // 如果缓存不存在，尝试使用localStorage作为最后手段
        const savedSongs = localStorage.getItem(STORAGE_KEY);
        if (savedSongs) {
          try {
            const parsedSongs = JSON.parse(savedSongs) as Song[];
            setSongs(parsedSongs);
            // 将localStorage的数据设置到缓存中
            setCache('user_songs', parsedSongs);
          } catch (parseError) {
            console.error('Failed to parse saved songs:', parseError);
            setSongs([]);
          }
        } else {
          setSongs([]);
        }
      }
    }
  };

  // Filtered and Sorted Songs (Only for Home View) - 优化性能
  const filteredHomeSongs = useMemo(() => {
    // 如果没有歌曲，直接返回空数组
    if (songs.length === 0) return songs;

    let result = songs;

    // 如果有选中的标签，先进行标签过滤
    if (selectedTag) {
      result = result.filter(song => song.tags && song.tags.includes(selectedTag));
    }

    // 如果有搜索条件，进行过滤
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      // 检查是否是年份搜索（4位数字）
      const isYearSearch = /^\d{4}$/.test(searchQuery);
      const searchYear = isYearSearch ? Number(searchQuery) : null;
      
      result = result.filter(s => {
        // 年份搜索逻辑
        if (searchYear !== null) {
          if (s.releaseDate) {
            let songYear: number | null = null;
            if (typeof s.releaseDate === 'string' && !isNaN(Number(s.releaseDate))) {
              const year = Number(s.releaseDate);
              if (year >= 1900 && year <= 2100) {
                songYear = year;
              }
            } else {
              const date = new Date(s.releaseDate);
              if (!isNaN(date.getTime())) {
                songYear = date.getFullYear();
              }
            }
            return songYear === searchYear;
          }
          return false;
        }
        
        // 常规搜索逻辑 - 减少不必要的toLowerCase调用
        const titleLower = s.title.toLowerCase();
        if (titleLower.includes(q)) return true;
        
        for (const artist of s.artists) {
          if (artist.toLowerCase().includes(q)) return true;
        }
        
        if (s.album && s.album.toLowerCase().includes(q)) return true;
        
        return false;
      });
    }

    // Sort based on selected configuration - 优化排序逻辑
    const sortDirection = sortConfig.direction === 'asc' ? 1 : -1;
    
    switch (sortConfig.key) {
      case 'title':
        return result.slice().sort((a, b) => sortDirection * a.title.localeCompare(b.title));
      case 'releaseDate':
        // Sort by release date, with songs without date at the end
        return result.slice().sort((a, b) => {
          if (!a.releaseDate && !b.releaseDate) return 0;
          if (!a.releaseDate) return 1;
          if (!b.releaseDate) return -1;
          
          // Helper function to safely get timestamp
          const getSafeTimestamp = (dateStr: string) => {
            if (typeof dateStr === 'string' && !isNaN(Number(dateStr))) {
              const year = Number(dateStr);
              if (year >= 1900 && year <= 2100) {
                return new Date(year, 0, 1).getTime();
              }
            }
            const date = new Date(dateStr);
            return !isNaN(date.getTime()) ? date.getTime() : null;
          };
          
          const timeA = getSafeTimestamp(a.releaseDate);
          const timeB = getSafeTimestamp(b.releaseDate);
          
          if (timeA === null && timeB === null) return 0;
          if (timeA === null) return 1;
          if (timeB === null) return -1;
          
          return sortDirection * (timeA - timeB);
        });
      case 'addedAt':
      default:
        return result.slice().sort((a, b) => sortDirection * (a.addedAt - b.addedAt));
    }
  }, [songs, searchQuery, sortConfig, selectedTag]);

  // Handlers - 使用useCallback优化，使用函数式更新避免依赖songs
  const handleDeleteSong = useCallback(async (songId: string) => {
    // 确认删除
    if (window.confirm('确定要删除这首歌曲吗？')) {
      try {
        await deleteSong(songId);
        // 使用函数式更新，避免依赖songs数组
        setSongs(prevSongs => {
          const updatedSongs = prevSongs.filter(song => song.id !== songId);
          setCache('user_songs', updatedSongs);
          return updatedSongs;
        });
      } catch (error) {
        console.error('Failed to delete song:', error);
      }
    }
  }, []);

  const handleAddSong = useCallback(async (title: string, artist: string, album: string, coverUrl?: string, releaseDate?: string, tags?: string[]) => {
    // 将歌手字符串分割为数组，支持逗号、顿号、斜杠、& 符号分隔
    const artists = artist.split(/[,，、\/&]/).map(a => a.trim()).filter(a => a.length > 0);
    
    // 使用传入的歌曲信息，保留用户选择的平台数据
    let matchedCoverUrl = coverUrl || '';
    let matchedAlbum = album;
    let matchedReleaseDate = releaseDate;
    
    // 只有在没有提供完整信息（手动输入模式）时，才尝试智能匹配
    // 注意：coverUrl和releaseDate都必须是undefined才进行智能匹配，空字符串不算
    if (coverUrl === undefined || releaseDate === undefined) {
      try {
        // 先尝试国内版搜索
        const domesticResults = await musicApi.search({
          keyword: `${title} ${artists.join(' ')}`,
          apiType: 'itunes-domestic',
          limit: 5
        });
        
        // 严格匹配：歌名和歌手都需要匹配
        const matchedSong = domesticResults.find(song => {
          const songNameMatch = song.name.toLowerCase().includes(title.toLowerCase());
          const artistMatch = song.artist.toLowerCase().includes(artists.join(' ').toLowerCase());
          return songNameMatch && artistMatch;
        });
        
        if (matchedSong) {
          // 使用国内版完全匹配到的歌曲信息
          matchedCoverUrl = matchedSong.coverUrl || '';
          // 只有当用户没有手动输入专辑时，才使用API获取的专辑信息
          if (!album.trim()) {
            matchedAlbum = matchedSong.album;
          }
          matchedReleaseDate = matchedSong.releaseDate; // 使用匹配到的发行日期
          console.log('使用国内版完全匹配到的歌曲信息');
        } else {
          // 国内版没有完全匹配，使用国际版第一首歌的数据
          const internationalResults = await musicApi.search({
            keyword: `${title} ${artists.join(' ')}`,
            apiType: 'itunes-international',
            limit: 1
          });
          
          if (internationalResults.length > 0) {
            // 使用国际版第一首歌的信息
            const internationalSong = internationalResults[0];
            matchedCoverUrl = internationalSong.coverUrl || '';
            // 只有当用户没有手动输入专辑时，才使用API获取的专辑信息
            if (!album.trim()) {
              matchedAlbum = internationalSong.album;
            }
            matchedReleaseDate = internationalSong.releaseDate; // 使用国际版的发行日期
            console.log('使用国际版第一首歌的信息');
          } else {
            console.log('国际版也没有找到歌曲，使用用户输入的信息');
          }
        }
      } catch (error) {
        console.warn('歌曲信息匹配失败，使用用户输入的信息:', error);
      }
    } else {
      console.log('使用用户选择平台的原始歌曲信息');
    }
    
    const newSong: Song = {
      id: crypto.randomUUID(),
      title,
      artists,
      album: matchedAlbum,
      coverUrl: matchedCoverUrl,
      releaseDate: matchedReleaseDate,
      tags: tags && tags.length > 0 ? tags : [], // 始终设置为数组
      addedAt: Date.now()
    };

    try {
      // Add to Supabase（现在会抛出错误而不是返回null）
      const addedSong = await addSong(newSong);
      
      // 自动获取并保存歌词
      try {
        const artist = addedSong.artists[0];
        await fetchLyrics(addedSong.id, addedSong.title, artist);
        console.log('歌词自动获取成功:', addedSong.title);
      } catch (error) {
        console.warn('歌词自动获取失败:', error);
        // 即使失败也不影响歌曲添加
      }
      
      // 使用函数式更新，避免依赖songs数组
      setSongs(prevSongs => {
        const updatedSongs = [addedSong, ...prevSongs];
        setCache('user_songs', updatedSongs);
        return updatedSongs;
      });
    } catch (error) {
      console.error('添加歌曲失败:', error);
      throw error;
    }
  }, []);

  const handleUpdateSong = useCallback(async (updatedSong: Song) => {
    try {
      // Update in Supabase
      await updateSong(updatedSong.id, updatedSong);
      // 使用函数式更新，避免依赖songs数组
      setSongs(prevSongs => {
        const updatedSongs = prevSongs.map(song => 
          song.id === updatedSong.id ? updatedSong : song
        );
        setCache('user_songs', updatedSongs);
        return updatedSongs;
      });
    } catch (error) {
      console.error('Failed to update song:', error);
    }
  }, []);

  const handleUpdateAlbum = useCallback(async (oldAlbumName: string, newAlbumName: string) => {
    try {
      // 使用函数式更新获取当前歌曲列表
      setSongs(prevSongs => {
        // 获取所有属于该专辑的歌曲
        const albumSongs = prevSongs.filter(song => song.album === oldAlbumName);
        
        // 批量更新数据库
        albumSongs.forEach(async (song) => {
          const updatedSong = { ...song, album: newAlbumName };
          await updateSong(song.id, updatedSong);
        });
        
        // 更新本地状态和缓存
        const updatedSongs = prevSongs.map(song => 
          song.album === oldAlbumName ? { ...song, album: newAlbumName } : song
        );
        setCache('user_songs', updatedSongs);
        
        // 显示成功消息（在setSongs之外显示，避免在回调中调用alert）
        setTimeout(() => {
          alert(`成功将专辑 "${oldAlbumName}" 修改为 "${newAlbumName}"，共更新了 ${albumSongs.length} 首歌曲`);
        }, 0);
        
        return updatedSongs;
      });
    } catch (error) {
      console.error('Failed to update album:', error);
      alert('更新专辑名称失败，请稍后重试');
    }
  }, []);

  const handleBulkImport = useCallback(async (lines: string[]) => {
    const newSongs: Song[] = [];
    const importErrors: string[] = [];
    
    // 延迟函数
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // 去重检查
    const existingSongs = new Set();
    if (songs.length > 0) {
      songs.forEach(song => {
        existingSongs.add(`${song.title.toLowerCase()}|||${song.artists.join(',').toLowerCase()}`);
      });
    }
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      try {
        // 检查是否是JSON格式（用于新的CSV导入）
        if (line.startsWith('{') && line.endsWith('}')) {
          // 新的CSV导入格式：JSON字符串
          try {
            const songInfo = JSON.parse(line);
            
            if (songInfo.title && songInfo.artist) {
              // 将歌手字符串分割为数组，支持逗号、顿号、斜杠分隔
              const artists = songInfo.artist.split(/[,，、\/]/).map((a: string) => a.trim()).filter((a: string) => a.length > 0);
              
              // 去重检查
              const songKey = `${songInfo.title.toLowerCase()}|||${artists.join(',').toLowerCase()}`;
              if (existingSongs.has(songKey)) {
                console.warn(`[${i+1}/${lines.length}] 歌曲已存在，跳过导入: ${songInfo.title} - ${artists.join(', ')}`);
                importErrors.push(`第${i+1}行：歌曲已存在 - ${songInfo.title}`);
                continue;
              }
              
              // 创建歌曲对象，支持使用CSV中提供的添加时间
              const newSong: Song = {
                id: crypto.randomUUID(),
                title: songInfo.title,
                artists,
                album: songInfo.album || undefined,
                coverUrl: songInfo.coverUrl || undefined,
                releaseDate: songInfo.releaseDate || undefined,
                tags: songInfo.tags || [], // 添加tags字段
                addedAt: songInfo.addedAt ? 
                  (typeof songInfo.addedAt === 'string' ? new Date(songInfo.addedAt).getTime() : songInfo.addedAt) : 
                  Date.now()
              };
              

              
              newSongs.push(newSong);
              existingSongs.add(songKey); // 更新已存在歌曲集合
              console.log(`[${i+1}/${lines.length}] 成功导入歌曲: ${songInfo.title} - ${artists.join(', ')}`);
            }
          } catch (jsonError) {
            console.error(`[${i+1}/${lines.length}] JSON解析失败:`, jsonError);
            importErrors.push(`第${i+1}行：数据格式错误`);
            // 继续处理其他行
          }
        } else {
          // 传统格式：歌名 - 歌手 (专辑)
          const parts = line.split('-').map(s => s.trim());
          if (parts.length >= 2) {
            let title = parts[0];
            let artist = parts[1];
            let matchedAlbum = '';
            
            // 从歌手部分提取专辑信息（如果有）
            const albumMatch = artist.match(/\((.+?)\)$/);
            if (albumMatch) {
              matchedAlbum = albumMatch[1];
              artist = artist.replace(/\((.+?)\)$/, '').trim();
            }
            
            // 将歌手字符串分割为数组，支持逗号、顿号、斜杠、& 符号分隔
            const artists = artist.split(/[,，、\/&]/).map(a => a.trim()).filter(a => a.length > 0);
            
            // 去重检查
            const songKey = `${title.toLowerCase()}|||${artists.join(',').toLowerCase()}`;
            if (existingSongs.has(songKey)) {
              console.warn(`[${i+1}/${lines.length}] 歌曲已存在，跳过导入: ${title} - ${artists.join(', ')}`);
              importErrors.push(`第${i+1}行：歌曲已存在 - ${title}`);
              continue;
            }
            
            let coverUrl = '';
            let releaseDate: string | undefined = undefined;
            
            // 不使用智能匹配，直接使用用户输入的信息
            console.log(`[${i+1}/${lines.length}] 使用用户输入的信息`);
            
            // 传统格式导入不支持添加时间字段，使用当前时间
            newSongs.push({
              id: crypto.randomUUID(),
              title,
              artists,
              coverUrl: coverUrl || undefined,
              releaseDate: releaseDate || undefined,
              album: matchedAlbum || undefined,
              tags: [], // 添加tags字段
              addedAt: Date.now()
            });
            
            existingSongs.add(songKey); // 更新已存在歌曲集合
          }
        }
      } catch (error) {
        console.error(`[${i+1}/${lines.length}] 处理失败:`, error);
        importErrors.push(`第${i+1}行：处理失败`);
        // 继续处理其他行
      }
    }

    // 更新歌曲列表
    if (newSongs.length > 0) {
      try {
        // 使用批量添加功能添加所有新歌曲到Supabase
        const addedSongs = await addSongs(newSongs);
        
        // 批量自动获取并保存歌词
        const fetchAllLyrics = async () => {
          for (const song of addedSongs) {
            try {
              const artist = song.artists[0];
              await fetchLyrics(song.id, song.title, artist);
              console.log('歌词自动获取成功:', song.title);
            } catch (error) {
              console.warn('歌词自动获取失败:', song.title, error);
            }
            // 添加短暂延迟，避免请求过快
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        };
        
        // 不阻塞UI，异步获取歌词
        fetchAllLyrics().catch(error => {
          console.error('批量获取歌词失败:', error);
        });
        
        // Update local state and cache
        const updatedSongs = [...addedSongs, ...songs];
        setSongs(updatedSongs);
        // 同步更新缓存
        setCache('user_songs', updatedSongs);
        
        // 显示导入结果
        const successMessage = `成功导入 ${addedSongs.length} 首歌曲`;
        if (importErrors.length > 0) {
          alert(`${successMessage}\n\n导入失败的歌曲：\n${importErrors.slice(0, 10).join('\n')}${importErrors.length > 10 ? `\n...等${importErrors.length - 10}首歌曲` : ''}`);
        } else {
          console.log(successMessage);
        }
      } catch (error) {
        console.error('Failed to import songs:', error);
        alert('歌曲导入失败，请重试');
      }
    } else {
      alert('没有成功导入任何歌曲，可能是因为所有歌曲都已存在或格式错误');
    }
  }, [songs]);

  // Navigation Handlers - 使用useCallback优化
  const navigateTo = useCallback((newView: ViewState, scrollToTop = true) => {
    setNavigationHistory(prev => [...prev, newView]);
    setView(newView);
    if (scrollToTop) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const navigateBack = useCallback(() => {
    if (navigationHistory.length > 1) {
      // 移除当前页面，回到上一页
      const newHistory = navigationHistory.slice(0, -1);
      const previousView = newHistory[newHistory.length - 1];
      
      setNavigationHistory(newHistory);
      setView(previousView);
      
      // 如果是回到首页，清空搜索
      if (previousView.type === 'HOME') {
        setSearchQuery('');
      }
    } else {
      // 如果历史栈只有首页，则保持在当前页面
      setView({ type: 'HOME' });
      setSearchQuery('');
    }
  }, [navigationHistory]);

  const navigateToHome = useCallback(() => {
    navigateTo({ type: 'HOME' });
    setSearchQuery('');
  }, [navigateTo]);

  const navigateToArtists = useCallback(() => {
    navigateTo({ type: 'ARTISTS' });
  }, [navigateTo]);

  const navigateToAlbums = useCallback(() => {
    navigateTo({ type: 'ALBUMS' });
  }, [navigateTo]);

  const navigateToMyPage = useCallback(() => {
    navigateTo({ type: 'MY_PAGE' });
  }, [navigateTo]);

  const navigateToArtistDetail = useCallback((artist: string) => {
    navigateTo({ type: 'ARTIST_DETAIL', data: artist });
  }, [navigateTo]);

  const navigateToAlbumDetail = useCallback((album: string) => {
    navigateTo({ type: 'ALBUM_DETAIL', data: album });
  }, [navigateTo]);

  const navigateToArtistAlbums = useCallback((artist: string) => {
    navigateTo({ type: 'ARTIST_ALBUMS', data: artist });
  }, [navigateTo]);

  const navigateToSongDetail = useCallback((songId: string) => {
    navigateTo({ type: 'SONG_DETAIL', data: songId });
  }, [navigateTo]);

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTag(tag);
    navigateToHome();
  }, [navigateToHome]);

  // Random Roam Function
  const handleRandomRoam = () => {
    if (songs.length > 0) {
      const randomIndex = Math.floor(Math.random() * songs.length);
      const randomSong = songs[randomIndex];
      navigateToSongDetail(randomSong.id);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* Header - Only show on HOME page */}
      {view.type === 'HOME' && (
        <header className="sticky top-0 z-50 bg-white border-b border-slate-100 shadow-sm">
          <div className="max-w-3xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Music2 className="text-brand-light" size={24} />
                <h1 className="text-xl font-bold text-slate-800">音想</h1>
              </div>
              
              {/* Search Bar with Import/Export Buttons */}
              <div className="relative flex-1 max-w-md mx-4 flex items-center">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="搜索歌曲、歌手或专辑..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-light focus:border-brand-light outline-none text-sm"
                  disabled={!user}
                />
                {/* Clear search button */}
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label="清除搜索"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                )}
              </div>
              
              {/* User Menu */}
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    onBlur={(e) => {
                      // 检查是否点击的是菜单项本身
                      if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
                        // 延迟关闭菜单，以便用户可以点击菜单项
                        setTimeout(() => setIsUserMenuOpen(false), 200);
                      }
                    }}
                    className="p-2 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                    aria-label="用户菜单"
                  >
                    <User size={20} />
                  </button>
                  {/* Dropdown Menu */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 z-50">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation(); // 防止触发父元素的事件
                          try {
                            console.log('Attempting to sign out...');
                            const result = await signOut();
                            console.log('Sign out result:', result);
                            setIsUserMenuOpen(false);
                          } catch (error) {
                            console.error('Failed to sign out:', error);
                          }
                        }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <LogOut size={16} />
                        登出
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="p-2 rounded-full bg-brand-light text-white hover:bg-brand-dark transition-colors"
                  aria-label="登录/注册"
                >
                  <LogIn size={20} />
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 pb-24 pt-4">
        {/* Login Prompt */}
        {isLoadingUser ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-brand-light border-t-transparent rounded-full animate-spin mr-3"></div>
            <p className="text-slate-600">加载中...</p>
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <User size={64} className="text-brand-light mb-4" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">欢迎使用音想</h2>
            <p className="text-slate-600 mb-6 max-w-md">
              登录或注册账号，开始管理您的音乐收藏
            </p>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-6 py-3 bg-brand-light text-white font-semibold rounded-lg hover:bg-brand-dark transition-colors"
            >
              登录/注册
            </button>
          </div>
        ) : (
        <div>
        {/* Breadcrumb - Removed back button from ARTISTS page as requested */}
        
        {/* VIEW: HOME */}
        {view.type === 'HOME' && (
          <div className="space-y-3 animate-in fade-in duration-300">
             <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-800">最近添加</h2>
                    {/* 显示当前筛选的标签 */}
                    {selectedTag && (
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs">
                        <span>标签: {selectedTag}</span>
                        <button
                          onClick={() => setSelectedTag(null)}
                          className="ml-1 text-amber-500 hover:text-amber-700"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>
                    )}
                    
                    {/* Sort Button with Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                        className="flex items-center justify-center w-7 h-7 text-slate-600 hover:text-brand-light transition-colors rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-light/20"
                        title="排序选项"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8 6h12M8 12h12M8 18h12M1 6h3M1 12h3M1 18h3" />
                        </svg>
                      </button>
                      
                      {/* Sort Dropdown Menu with explicit options */}
                      {isSortMenuOpen && (
                        <div className="absolute left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50">
                          {/* Title Sorting Options */}
                          <div className="px-2 py-1 text-xs font-semibold text-slate-500 border-b border-slate-100">标题</div>
                          <button
                            onClick={() => {
                              setSortConfig({ key: 'title', direction: 'asc' });
                              setIsSortMenuOpen(false);
                            }}
                            className={`block w-full text-left px-4 py-2 text-sm ${sortConfig.key === 'title' && sortConfig.direction === 'asc' ? 'bg-brand-light/10 text-brand-light font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                          >
                            A-Z 升序
                          </button>
                          <button
                            onClick={() => {
                              setSortConfig({ key: 'title', direction: 'desc' });
                              setIsSortMenuOpen(false);
                            }}
                            className={`block w-full text-left px-4 py-2 text-sm ${sortConfig.key === 'title' && sortConfig.direction === 'desc' ? 'bg-brand-light/10 text-brand-light font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                          >
                            Z-A 降序
                          </button>
                          
                          {/* Year Sorting Options */}
                          <div className="px-2 py-1 text-xs font-semibold text-slate-500 border-t border-b border-slate-100 mt-1">年份</div>
                          <button
                            onClick={() => {
                              setSortConfig({ key: 'releaseDate', direction: 'asc' });
                              setIsSortMenuOpen(false);
                            }}
                            className={`block w-full text-left px-4 py-2 text-sm ${sortConfig.key === 'releaseDate' && sortConfig.direction === 'asc' ? 'bg-brand-light/10 text-brand-light font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                          >
                            年份升序
                          </button>
                          <button
                            onClick={() => {
                              setSortConfig({ key: 'releaseDate', direction: 'desc' });
                              setIsSortMenuOpen(false);
                            }}
                            className={`block w-full text-left px-4 py-2 text-sm ${sortConfig.key === 'releaseDate' && sortConfig.direction === 'desc' ? 'bg-brand-light/10 text-brand-light font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                          >
                            年份降序
                          </button>
                          
                          {/* Added Date Sorting Options */}
                          <div className="px-2 py-1 text-xs font-semibold text-slate-500 border-t border-b border-slate-100 mt-1">添加时间</div>
                          <button
                            onClick={() => {
                              setSortConfig({ key: 'addedAt', direction: 'asc' });
                              setIsSortMenuOpen(false);
                            }}
                            className={`block w-full text-left px-4 py-2 text-sm ${sortConfig.key === 'addedAt' && sortConfig.direction === 'asc' ? 'bg-brand-light/10 text-brand-light font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                          >
                            添加时间升序
                          </button>
                          <button
                            onClick={() => {
                              setSortConfig({ key: 'addedAt', direction: 'desc' });
                              setIsSortMenuOpen(false);
                            }}
                            className={`block w-full text-left px-4 py-2 text-sm ${sortConfig.key === 'addedAt' && sortConfig.direction === 'desc' ? 'bg-brand-light/10 text-brand-light font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                          >
                            添加时间降序
                          </button>
                        </div>
                      )}
                    </div>
                </div>
                
                {/* Song Count with Random Roam */}
                <div className="flex items-center gap-1 text-slate-400 text-xs">
                    <button
                      onClick={handleRandomRoam}
                      className="text-slate-400 hover:text-brand-light transition-colors focus:outline-none focus:ring-2 focus:ring-brand-light/20 p-1 rounded"
                      title="随机漫游"
                      disabled={songs.length === 0}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v6m0 12v2M2 12h6m12 0h2M2 12l3.5-3.5m11.5 3.5-3.5-3.5M2 12l3.5 3.5m11.5-3.5-3.5 3.5" />
                      </svg>
                    </button>
                    <span>{filteredHomeSongs.length} 条记录</span>
                </div>
            </div>

            {filteredHomeSongs.length > 0 ? (
              filteredHomeSongs.map(song => (
                <SongCard 
                    key={song.id} 
                    song={song} 
                    onArtistClick={navigateToArtistDetail}
                    onAlbumClick={navigateToAlbumDetail}
                    onDelete={() => handleDeleteSong(song.id)}
                    onSongClick={navigateToSongDetail}
                    onYearSearch={(year) => setSearchQuery(year.toString())}
                />
              ))
            ) : (
              <div className="text-center py-20 px-6">
                <div className="bg-slate-50 inline-flex p-4 rounded-full shadow-sm mb-4">
                  <Music2 className="text-slate-300" size={40} />
                </div>
                <h3 className="text-slate-800 font-semibold text-lg mb-1">没有找到音乐</h3>
                <p className="text-slate-500 max-w-xs mx-auto mb-6 text-sm">
                  {searchQuery 
                    ? "未能找到匹配的歌曲。" 
                    : "您的音乐库是空的，快去添加第一首歌吧！"}
                </p>
                {!searchQuery && (
                  <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="text-brand-light font-medium hover:underline text-sm"
                  >
                    添加音乐
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW: ARTIST LIBRARY */}
        {view.type === 'ARTISTS' && (
            <ArtistLibrary 
                songs={songs} 
                onSelectArtist={navigateToArtistDetail} 
            />
        )}

        {/* VIEW: ALBUM LIBRARY */}
        {view.type === 'ALBUMS' && (
            <AlbumLibrary 
                songs={songs} 
                onSelectAlbum={navigateToAlbumDetail} 
            />
        )}

        {/* VIEW: MY PAGE */}
        {view.type === 'MY_PAGE' && (
            <MyPage 
                songs={songs} 
                onImport={() => setIsImportModalOpen(true)}
                onExport={() => exportSongsToCSV(songs)}
                user={user}
            />
        )}

        {/* VIEW: ARTIST DETAIL */}
        {view.type === 'ARTIST_DETAIL' && view.data && (
            <ArtistDetail 
                artist={view.data} 
                songs={songs} 
                onBack={navigateBack}
                onAlbumClick={navigateToAlbumDetail}
                onDeleteSong={handleDeleteSong}
                onSongClick={navigateToSongDetail}
                onViewAllAlbums={navigateToArtistAlbums}
            />
        )}

        {/* VIEW: ARTIST ALBUMS */}
        {view.type === 'ARTIST_ALBUMS' && view.data && (
            <ArtistAlbums 
                artist={view.data} 
                songs={songs} 
                onBack={navigateBack}
                onAlbumClick={navigateToAlbumDetail}
            />
        )}

        {/* VIEW: ALBUM DETAIL */}
        {view.type === 'ALBUM_DETAIL' && view.data && (
            <AlbumDetail 
                album={view.data} 
                songs={songs} 
                onBack={navigateBack}
                onArtistClick={navigateToArtistDetail}
                onDeleteSong={handleDeleteSong}
                onSongClick={navigateToSongDetail}
                onUpdateAlbum={handleUpdateAlbum}
            />
        )}

        {/* VIEW: SONG DETAIL */}
        {view.type === 'SONG_DETAIL' && view.data && (
            <SongDetail 
                songs={songs}
                songId={view.data}
                onBack={navigateBack}
                onArtistClick={navigateToArtistDetail}
                onAlbumClick={navigateToAlbumDetail}
                onUpdateSong={handleUpdateSong}
                onTagClick={handleTagClick}
            />
        )}
      </div>
      )}
    </main>

      {/* Bottom Navigation Bar - Smaller size */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-50 shadow-lg">
        <div className="max-w-3xl mx-auto px-4 py-1">
          <div className="flex justify-around items-center">
              {/* Home Button */}
              <button
                onClick={navigateToHome}
                className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl mx-0.5 transition-all duration-200 ${
                  view.type === 'HOME' 
                    ? 'bg-brand-light/10 text-brand-light' 
                    : 'text-slate-500 hover:text-brand-light hover:bg-slate-50'
                }`}
              >
                <Home size={18} className="mb-0.5" />
                <span className="text-xs font-medium">首页</span>
              </button>

              {/* Artists Button */}
              <button
                onClick={navigateToArtists}
                className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl mx-0.5 transition-all duration-200 ${
                  view.type === 'ARTISTS' 
                    ? 'bg-brand-light/10 text-brand-light' 
                    : 'text-slate-500 hover:text-brand-light hover:bg-slate-50'
                }`}
              >
                <Users size={18} className="mb-0.5" />
                <span className="text-xs font-medium">歌手库</span>
              </button>

              {/* Add Button - Center position, no text, dark blue background, smaller button, larger plus icon */}
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center justify-center w-10 h-10 rounded-xl mx-0.5 transition-all duration-200 bg-blue-600 text-white hover:bg-blue-700"
                aria-label="添加音乐"
              >
                <Plus size={24} strokeWidth={3} />
              </button>

              {/* Albums Button */}
              <button
                onClick={navigateToAlbums}
                className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl mx-0.5 transition-all duration-200 ${
                  view.type === 'ALBUMS' 
                    ? 'bg-brand-light/10 text-brand-light' 
                    : 'text-slate-500 hover:text-brand-light hover:bg-slate-50'
                }`}
              >
                <Music2 size={18} className="mb-0.5" />
                <span className="text-xs font-medium">专辑库</span>
              </button>

              {/* My Page Button */}
              <button
                onClick={navigateToMyPage}
                className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl mx-0.5 transition-all duration-200 ${
                  view.type === 'MY_PAGE' 
                    ? 'bg-brand-light/10 text-brand-light' 
                    : 'text-slate-500 hover:text-brand-light hover:bg-slate-50'
                }`}
              >
                <User size={18} className="mb-0.5" />
                <span className="text-xs font-medium">我的</span>
              </button>
            </div>
        </div>
      </div>

      {/* Floating Action Button - Removed, now integrated into navigation bar */}

      {/* Modals */}
      <AddSongModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onAdd={handleAddSong}
        songs={songs}
      />
      <ImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onImport={handleBulkImport} 
      />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          // Auth successful
          console.log('Authentication successful');
        }}
      />

    </div>
  );
};

export default App;