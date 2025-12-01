import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Music2, UploadCloud, Home, Users, Download, User } from 'lucide-react';
import { Song, ViewState } from './types';
import { SongCard } from './components/SongCard';
import { AddSongModal } from './components/AddSongModal';
import ImportModal from './components/ImportModal';
import { ArtistLibrary } from './components/ArtistLibrary';
import { AlbumLibrary } from './components/AlbumLibrary';
import { ArtistDetail } from './components/ArtistDetail';
import { AlbumDetail } from './components/AlbumDetail';
import { SongDetail } from './components/SongDetail';
import MyPage from './components/MyPage';
import { musicApi } from './services/musicApiAdapter';
import { exportSongsToCSV } from './utils/csvExporter';

// Constants
const STORAGE_KEY = 'melodylog_songs';

const App: React.FC = () => {
  // Data State
  const [songs, setSongs] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Navigation State
  const [view, setView] = useState<ViewState>({ type: 'HOME' });
  const [navigationHistory, setNavigationHistory] = useState<ViewState[]>([{ type: 'HOME' }]);
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // Sorting
  const [sortConfig, setSortConfig] = useState<{
    key: 'addedAt' | 'title' | 'releaseDate';
    direction: 'asc' | 'desc';
  }>({ key: 'addedAt', direction: 'desc' });
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  // Initialize from LocalStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSongs(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse songs", e);
      }
    }
  }, []);

  // Save to LocalStorage whenever songs change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  }, [songs]);

  // Filtered and Sorted Songs (Only for Home View)
  const filteredHomeSongs = useMemo(() => {
    let result = songs;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.title.toLowerCase().includes(q) || 
        s.artists.some(artist => artist.toLowerCase().includes(q)) ||
        (s.album && s.album.toLowerCase().includes(q))
      );
    }

    // Sort based on selected configuration
    switch (sortConfig.key) {
      case 'title':
        return result.sort((a, b) => {
          const comparison = a.title.localeCompare(b.title);
          return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
      case 'releaseDate':
        // Sort by release date, with songs without date at the end
        return result.sort((a, b) => {
          if (!a.releaseDate && !b.releaseDate) return 0;
          if (!a.releaseDate) return sortConfig.direction === 'asc' ? 1 : -1;
          if (!b.releaseDate) return sortConfig.direction === 'asc' ? -1 : 1;
          
          const dateA = new Date(a.releaseDate).getTime();
          const dateB = new Date(b.releaseDate).getTime();
          return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
        });
      case 'addedAt':
      default:
        // Sort by added date with direction
        return result.sort((a, b) => {
          return sortConfig.direction === 'asc' ? a.addedAt - b.addedAt : b.addedAt - a.addedAt;
        });
    }
  }, [songs, searchQuery, sortConfig]);

  // Handlers
  const handleDeleteSong = (songId: string) => {
    // 确认删除
    if (window.confirm('确定要删除这首歌曲吗？')) {
      setSongs(prevSongs => prevSongs.filter(song => song.id !== songId));
    }
  };

  const handleAddSong = async (title: string, artist: string, album: string, coverUrl?: string, releaseDate?: string) => {
    // 将歌手字符串分割为数组，支持逗号、顿号、斜杠分隔
    const artists = artist.split(/[,，、\/]/).map(a => a.trim()).filter(a => a.length > 0);
    
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
          matchedAlbum = matchedSong.album;
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
            matchedAlbum = internationalSong.album;
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
      addedAt: Date.now()
    };

    setSongs(prev => [newSong, ...prev]);
  };

  const handleUpdateSong = (updatedSong: Song) => {
    setSongs(prevSongs => {
      const updatedSongs = prevSongs.map(song => 
        song.id === updatedSong.id ? updatedSong : song
      );
      // 保存到localStorage
      localStorage.setItem('songs', JSON.stringify(updatedSongs));
      return updatedSongs;
    });
  };

  const handleBulkImport = async (lines: string[], enableSmartMatch: boolean = true) => {
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
                addedAt: songInfo.addedAt ? 
                  (typeof songInfo.addedAt === 'string' ? new Date(songInfo.addedAt).getTime() : songInfo.addedAt) : 
                  Date.now()
              };
              
              // 如果启用了智能匹配且没有提供图片URL，尝试获取更多信息
              if (enableSmartMatch && !songInfo.coverUrl) {
                try {
                  // 添加API调用延迟，避免频繁请求
                  await delay(300);
                  
                  // 先尝试国内版搜索
                  const domesticResults = await musicApi.search({
                    keyword: `${songInfo.title} ${artists.join(' ')}`,
                    apiType: 'itunes-domestic',
                    limit: 5
                  });
                  
                  // 严格匹配：歌名和歌手都需要匹配
                  const matchedSong = domesticResults.find(song => {
                    const songNameMatch = song.name.toLowerCase().includes(songInfo.title.toLowerCase());
                    const artistMatch = song.artist.toLowerCase().includes(artists.join(' ').toLowerCase());
                    return songNameMatch && artistMatch;
                  });
                  
                  if (matchedSong) {
                    // 使用国内版完全匹配到的歌曲信息
                    if (!newSong.coverUrl) newSong.coverUrl = matchedSong.coverUrl || undefined;
                    if (!newSong.album) newSong.album = matchedSong.album;
                    if (!newSong.releaseDate) newSong.releaseDate = matchedSong.releaseDate;
                    console.log(`[${i+1}/${lines.length}] 使用国内版完全匹配到的歌曲信息`);
                  } else {
                    // 国内版没有完全匹配，使用国际版第一首歌的数据
                    const internationalResults = await musicApi.search({
                      keyword: `${songInfo.title} ${artists.join(' ')}`,
                      apiType: 'itunes-international',
                      limit: 1
                    });
                    
                    if (internationalResults.length > 0) {
                      // 使用国际版第一首歌的信息
                      const internationalSong = internationalResults[0];
                      if (!newSong.coverUrl) newSong.coverUrl = internationalSong.coverUrl || undefined;
                      if (!newSong.album) newSong.album = internationalSong.album;
                      if (!newSong.releaseDate) newSong.releaseDate = internationalSong.releaseDate;
                      console.log(`[${i+1}/${lines.length}] 使用国际版第一首歌的信息`);
                    } else {
                      console.log(`[${i+1}/${lines.length}] 国际版也没有找到歌曲，使用用户输入的信息`);
                    }
                  }
                } catch (error) {
                  console.warn(`[${i+1}/${lines.length}] 歌曲信息匹配失败，使用用户输入的信息:`, error);
                }
              }
              
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
            
            // 将歌手字符串分割为数组，支持逗号、顿号、斜杠分隔
            const artists = artist.split(/[,，、\/]/).map(a => a.trim()).filter(a => a.length > 0);
            
            // 去重检查
            const songKey = `${title.toLowerCase()}|||${artists.join(',').toLowerCase()}`;
            if (existingSongs.has(songKey)) {
              console.warn(`[${i+1}/${lines.length}] 歌曲已存在，跳过导入: ${title} - ${artists.join(', ')}`);
              importErrors.push(`第${i+1}行：歌曲已存在 - ${title}`);
              continue;
            }
            
            let coverUrl = '';
            let releaseDate: string | undefined = undefined;
            
            if (enableSmartMatch) {
              // 智能匹配歌曲信息：先尝试国内版，如果没有完全匹配就使用国际版第一首歌
              try {
                // 添加API调用延迟，避免频繁请求
                await delay(300);
                
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
                  coverUrl = matchedSong.coverUrl || '';
                  matchedAlbum = matchedSong.album;
                  releaseDate = matchedSong.releaseDate;
                  console.log(`[${i+1}/${lines.length}] 使用国内版完全匹配到的歌曲信息`);
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
                    coverUrl = internationalSong.coverUrl || '';
                    matchedAlbum = internationalSong.album;
                    releaseDate = internationalSong.releaseDate;
                    console.log(`[${i+1}/${lines.length}] 使用国际版第一首歌的信息`);
                  } else {
                    console.log(`[${i+1}/${lines.length}] 国际版也没有找到歌曲，使用用户输入的信息`);
                  }
                }
              } catch (error) {
                console.warn(`[${i+1}/${lines.length}] 歌曲信息匹配失败，使用用户输入的信息:`, error);
              }
            } else {
              // 不启用智能匹配，使用用户输入的基本信息
              console.log(`[${i+1}/${lines.length}] 跳过智能匹配，使用用户输入的信息`);
            }
            
            // 传统格式导入不支持添加时间字段，使用当前时间
            newSongs.push({
              id: crypto.randomUUID(),
              title,
              artists,
              coverUrl: coverUrl || undefined,
              releaseDate: releaseDate || undefined,
              album: matchedAlbum || undefined,
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
      setSongs(prev => [...newSongs, ...prev]);
      
      // 显示导入结果
      const successMessage = `成功导入 ${newSongs.length} 首歌曲`;
      if (importErrors.length > 0) {
        alert(`${successMessage}\n\n导入失败的歌曲：\n${importErrors.slice(0, 10).join('\n')}${importErrors.length > 10 ? `\n...等${importErrors.length - 10}首歌曲` : ''}`);
      } else {
        console.log(successMessage);
      }
    } else {
      alert('没有成功导入任何歌曲，可能是因为所有歌曲都已存在或格式错误');
    }
  };

  // Navigation Handlers
  const navigateTo = (newView: ViewState) => {
    setNavigationHistory(prev => [...prev, newView]);
    setView(newView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateBack = () => {
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
  };

  const navigateToHome = () => {
    navigateTo({ type: 'HOME' });
    setSearchQuery('');
  };

  const navigateToArtists = () => {
    navigateTo({ type: 'ARTISTS' });
  };

  const navigateToAlbums = () => {
    navigateTo({ type: 'ALBUMS' });
  };

  const navigateToMyPage = () => {
    navigateTo({ type: 'MY_PAGE' });
  };

  const navigateToArtistDetail = (artist: string) => {
    navigateTo({ type: 'ARTIST_DETAIL', data: artist });
  };

  const navigateToAlbumDetail = (album: string) => {
    navigateTo({ type: 'ALBUM_DETAIL', data: album });
  };

  const navigateToSongDetail = (songId: string) => {
    navigateTo({ type: 'SONG_DETAIL', data: songId });
  };

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
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-light focus:border-brand-light outline-none text-sm"
                />
              </div>
              
              {/* No import/export buttons here - moved to My Page */}
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 pb-24 pt-4">
        {/* Breadcrumb - Removed back button from ARTISTS page as requested */}
        
        {/* VIEW: HOME */}
        {view.type === 'HOME' && (
          <div className="space-y-3 animate-in fade-in duration-300">
             <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1">
                    <h2 className="text-base font-bold text-slate-800">最近添加</h2>
                    
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
            />
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

    </div>
  );
};

export default App;