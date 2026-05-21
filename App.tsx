import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Plus, Search, Music2, Home, Users, User, LogIn, LogOut, Disc, FileText, ChevronRight } from 'lucide-react';
import { Song } from './types';
import { SongCard } from './components/SongCard';
import { AddSongModal } from './components/AddSongModal';
import ImportModal from './components/ImportModal';
import { ArtistLibrary } from './components/ArtistLibrary';
import { AlbumLibrary } from './components/AlbumLibrary';
import { TagLibrary } from './components/TagLibrary';
import { ArtistDetail } from './components/ArtistDetail';
import { ArtistAlbums } from './components/ArtistAlbums';
import { AlbumDetail } from './components/AlbumDetail';
import { SongDetail } from './components/SongDetail';
import MyPage from './components/MyPage';
import AuthModal from './components/AuthModal';
import { ToastProvider, useToast, ConfirmDialog } from './components/Toast';
import { exportSongsToCSV, exportSongsToJSON } from './utils/csvExporter';
import { useAppData } from './hooks/useAppData';
import { useNavigation } from './hooks/useNavigation';
import { BannerCarousel } from './components/BannerCarousel';
import { StatsBar } from './components/StatsBar';
import { RecentAlbums } from './components/RecentAlbums';
import { LyricsSearchResult } from './components/LyricsSearchResult';

// Constants
const MENU_CLOSE_DELAY = 200;

const AppContent: React.FC = () => {
  const { showToast } = useToast();
  const {
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
  } = useAppData();

  const {
    view,
    navigateBack,
    navigateToHome,
    navigateToArtists,
    navigateToAlbums,
    navigateToTags,
    navigateToMyPage,
    navigateToArtistDetail,
    navigateToAlbumDetail,
    navigateToArtistAlbums,
    navigateToSongDetail,
  } = useNavigation();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<'song' | 'album' | 'artist' | 'lyrics'>('song');
  const [displayLimit, setDisplayLimit] = useState(50);
  
  // 缺失歌词筛选状态（持久化到 localStorage）
  const [missingLyricsFilter, setMissingLyricsFilter] = useState<boolean>(() => {
    try {
      return localStorage.getItem('melodylog_missingLyricsFilter') === 'true';
    } catch {
      return false;
    }
  });

  // 当 missingLyricsFilter 变化时保存到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem('melodylog_missingLyricsFilter', String(missingLyricsFilter));
    } catch {
      // ignore localStorage errors
    }
  }, [missingLyricsFilter]);
  
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

  // 首页视图模式：'dashboard' = 新版首页, 'allSongs' = 全部歌曲列表
  const [homeViewMode, setHomeViewMode] = useState<'dashboard' | 'allSongs'>('dashboard');
  
  // Auth UI State
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Filtered and Sorted Songs
  const filteredHomeSongs = useMemo(() => {
    if (songs.length === 0) return songs;

    let result = songs;

    if (selectedTag) {
      result = result.filter(song => song.tags && song.tags.includes(selectedTag));
    }

    // 缺失歌词筛选
    if (missingLyricsFilter) {
      result = result.filter(song => !(song.lyrics && song.lyrics.trim()));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const isYearSearch = /^\d{4}$/.test(searchQuery);
      const searchYear = isYearSearch ? Number(searchQuery) : null;
      
      result = result.filter(s => {
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
        
        const titleLower = s.title.toLowerCase();
        if (titleLower.includes(q)) return true;
        
        for (const artist of s.artists) {
          if (artist.toLowerCase().includes(q)) return true;
        }
        
        if (s.album && s.album.toLowerCase().includes(q)) return true;
        
        return false;
      });
    }

    const sortDirection = sortConfig.direction === 'asc' ? 1 : -1;
    
    switch (sortConfig.key) {
      case 'title':
        return result.slice().sort((a, b) => sortDirection * a.title.localeCompare(b.title));
      case 'releaseDate':
        return result.slice().sort((a, b) => {
          if (!a.releaseDate && !b.releaseDate) return 0;
          if (!a.releaseDate) return 1;
          if (!b.releaseDate) return -1;
          
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
  }, [songs, searchQuery, sortConfig, selectedTag, missingLyricsFilter]);

  // Album search results
  const filteredAlbums = useMemo(() => {
    if (!searchQuery.trim() || searchType !== 'album') return [];
    const q = searchQuery.toLowerCase();
    const isYearSearch = /^\d{4}$/.test(searchQuery);
    const searchYear = isYearSearch ? Number(searchQuery) : null;
    
    const map = new Map<string, { count: number; year?: string; coverUrl?: string; artists: Set<string> }>();
    
    songs.forEach(song => {
      if (song.album) {
        let match = false;
        if (searchYear !== null && song.releaseDate) {
          let songYear: number | null = null;
          if (typeof song.releaseDate === 'string' && !isNaN(Number(song.releaseDate))) {
            const year = Number(song.releaseDate);
            if (year >= 1900 && year <= 2100) songYear = year;
          } else {
            const date = new Date(song.releaseDate);
            if (!isNaN(date.getTime())) songYear = date.getFullYear();
          }
          match = songYear === searchYear;
        } else if (searchYear === null) {
          match = song.album.toLowerCase().includes(q);
        }
        
        if (match) {
          const albumInfo = map.get(song.album) || { count: 0, artists: new Set<string>() };
          albumInfo.count += 1;
          if (song.releaseDate && !albumInfo.year) {
            const date = new Date(song.releaseDate);
            if (!isNaN(date.getTime())) albumInfo.year = date.getFullYear().toString();
          }
          if (song.coverUrl && !albumInfo.coverUrl) albumInfo.coverUrl = song.coverUrl;
          song.artists.forEach(a => albumInfo.artists.add(a));
          map.set(song.album, albumInfo);
        }
      }
    });
    
    return Array.from(map.entries()).map(([name, info]) => ({
      name,
      count: info.count,
      year: info.year,
      coverUrl: info.coverUrl,
      artists: Array.from(info.artists).slice(0, 2).join('、'),
    }));
  }, [songs, searchQuery, searchType]);

  // Artist search results
  const filteredArtists = useMemo(() => {
    if (!searchQuery.trim() || searchType !== 'artist') return [];
    const q = searchQuery.toLowerCase();
    const isYearSearch = /^\d{4}$/.test(searchQuery);
    if (isYearSearch) return [];
    
    const map = new Map<string, { songCount: number; coverUrl?: string }>();
    
    songs.forEach(song => {
      song.artists.forEach(artist => {
        if (artist.toLowerCase().includes(q)) {
          const info = map.get(artist) || { songCount: 0 };
          info.songCount += 1;
          if (song.coverUrl && !info.coverUrl) info.coverUrl = song.coverUrl;
          map.set(artist, info);
        }
      });
    });
    
    return Array.from(map.entries()).map(([name, info]) => ({
      name,
      songCount: info.songCount,
      coverUrl: info.coverUrl,
    }));
  }, [songs, searchQuery, searchType]);

  // Whether we're in search mode with results
  const isSearching = searchQuery.trim().length > 0;

  // Delete handler with confirm dialog
  const onDeleteSong = useCallback((songId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '删除确认',
      message: '确定要删除这首歌曲吗？此操作不可撤销。',
      onConfirm: () => handleDeleteSong(songId, () => setConfirmDialog(prev => ({ ...prev, isOpen: false }))),
    });
  }, [handleDeleteSong]);

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTag(tag);
    setDisplayLimit(50);
    navigateToHome();
  }, [navigateToHome]);

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
              
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md mx-4 flex items-center">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder={searchType === 'song' ? '搜索歌曲...' : searchType === 'album' ? '搜索专辑...' : searchType === 'artist' ? '搜索歌手...' : '搜索歌词...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-20 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-light focus:border-brand-light outline-none text-sm"
                  disabled={!user}
                />
                {/* Search Type Tabs */}
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-slate-200/60 rounded-md p-0.5">
                  <button
                    onClick={() => { setSearchType('song'); setSearchQuery(''); }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      searchType === 'song' ? 'bg-white text-brand-light shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    歌曲
                  </button>
                  <button
                    onClick={() => { setSearchType('album'); setSearchQuery(''); }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      searchType === 'album' ? 'bg-white text-brand-light shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    专辑
                  </button>
                  <button
                    onClick={() => { setSearchType('artist'); setSearchQuery(''); }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      searchType === 'artist' ? 'bg-white text-brand-light shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    歌手
                  </button>
                  <button
                    onClick={() => { setSearchType('lyrics'); setSearchQuery(''); }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      searchType === 'lyrics' ? 'bg-white text-brand-light shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    歌词
                  </button>
                </div>
              </div>
              
              {/* User Menu */}
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    onBlur={(e) => {
                      if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
                        setTimeout(() => setIsUserMenuOpen(false), MENU_CLOSE_DELAY);
                      }
                    }}
                    className="p-2 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                    aria-label="用户菜单"
                  >
                    <User size={20} />
                  </button>
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 z-50">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await handleSignOut();
                          setIsUserMenuOpen(false);
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
        {/* VIEW: HOME */}
        {view.type === 'HOME' && (
          <div className="animate-in fade-in duration-300">
            {/* 搜索时显示搜索结果 */}
            {isSearching ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-base font-bold text-slate-800">
                    {searchType === 'song' ? '歌曲结果' : searchType === 'album' ? '专辑结果' : searchType === 'artist' ? '歌手结果' : '歌词结果'}
                  </h2>
                  <span className="text-xs text-slate-400">
                    {searchType === 'song' ? `${filteredHomeSongs.length} 首歌曲`
                      : searchType === 'album' ? `${filteredAlbums.length} 张专辑`
                      : searchType === 'artist' ? `${filteredArtists.length} 位歌手`
                      : '关键词搜索'}
                  </span>
                </div>

                {/* Song Results */}
                {(!isSearching || searchType === 'song') && (
                  filteredHomeSongs.length > 0 ? (
                    <div>
                      {filteredHomeSongs.map(song => (
                        <SongCard 
                            key={song.id} 
                            song={song} 
                            onArtistClick={navigateToArtistDetail}
                            onAlbumClick={navigateToAlbumDetail}
                            onDelete={() => onDeleteSong(song.id)}
                            onSongClick={navigateToSongDetail}
                            onYearSearch={(year) => setSearchQuery(year.toString())}
                        />
                      ))}
                    </div>
                  ) : isSearching && searchType === 'song' ? (
                    <div className="text-center py-16 px-6">
                      <Music2 className="text-slate-300 mx-auto mb-3" size={36} />
                      <p className="text-slate-500 text-sm">未找到匹配的歌曲</p>
                    </div>
                  ) : null
                )}

                {/* Album Results */}
                {isSearching && searchType === 'album' && (
                  filteredAlbums.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {filteredAlbums.map(album => (
                        <button
                          key={album.name}
                          onClick={() => navigateToAlbumDetail(album.name)}
                          className="group text-left"
                        >
                          <div className="aspect-square rounded-lg overflow-hidden shadow-sm group-hover:shadow-md transition-shadow">
                            {album.coverUrl ? (
                              <img src={album.coverUrl} alt={album.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            ) : (
                              <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                                <Disc size={28} className="text-slate-300" />
                              </div>
                            )}
                          </div>
                          <p className="text-xs font-medium text-slate-800 mt-1 truncate group-hover:text-brand-light transition-colors">{album.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{album.artists}{album.year ? ` · ${album.year}` : ''}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 px-6">
                      <Disc className="text-slate-300 mx-auto mb-3" size={36} />
                      <p className="text-slate-500 text-sm">未找到匹配的专辑</p>
                    </div>
                  )
                )}

                {/* Artist Results */}
                {isSearching && searchType === 'artist' && (
                  filteredArtists.length > 0 ? (
                    <div className="space-y-1">
                      {filteredArtists.map(artist => (
                        <button
                          key={artist.name}
                          onClick={() => navigateToArtistDetail(artist.name)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-all group text-left"
                        >
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex-shrink-0 shadow-sm">
                            {artist.coverUrl ? (
                              <img src={artist.coverUrl} alt={artist.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <User size={16} className="text-slate-400" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate group-hover:text-brand-light transition-colors">{artist.name}</p>
                            <p className="text-xs text-slate-400">{artist.songCount} 首歌曲</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 px-6">
                      <Users className="text-slate-300 mx-auto mb-3" size={36} />
                      <p className="text-slate-500 text-sm">未找到匹配的歌手</p>
                    </div>
                  )
                )}

                {/* Lyrics Results */}
                {isSearching && searchType === 'lyrics' && (
                  <LyricsSearchResult
                    songs={songs}
                    searchQuery={searchQuery}
                    onSongClick={navigateToSongDetail}
                    onArtistClick={navigateToArtistDetail}
                    onAlbumClick={navigateToAlbumDetail}
                  />
                )}
              </div>
            ) : homeViewMode === 'allSongs' ? (
              /* 全部歌曲视图 */
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setHomeViewMode('dashboard')}
                      className="text-sm text-brand-light hover:text-blue-600 transition-colors"
                    >
                      &larr; 首页
                    </button>
                    <h2 className="text-base font-bold text-slate-800">全部歌曲</h2>
                    
                    {/* 缺失歌词筛选按钮 */}
                    <button
                      onClick={() => setMissingLyricsFilter(!missingLyricsFilter)}
                      className={`flex items-center gap-1 px-2 py-0.5 border rounded-full text-xs transition-colors ${
                        missingLyricsFilter 
                          ? 'bg-red-50 text-red-600 border-red-200' 
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <FileText size={12} />
                      <span>{missingLyricsFilter ? '缺失歌词' : '找歌词'}</span>
                      {missingLyricsFilter && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      )}
                    </button>

                    {/* Sort Button */}
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
                      
                      {isSortMenuOpen && (
                        <div className="absolute left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50">
                          <div className="px-2 py-1 text-xs font-semibold text-slate-500 border-b border-slate-100">标题</div>
                          <button
                            onClick={() => { setSortConfig({ key: 'title', direction: 'asc' }); setIsSortMenuOpen(false); }}
                            className={`block w-full text-left px-4 py-2 text-sm ${sortConfig.key === 'title' && sortConfig.direction === 'asc' ? 'bg-brand-light/10 text-brand-light font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                          >A-Z 升序</button>
                          <button
                            onClick={() => { setSortConfig({ key: 'title', direction: 'desc' }); setIsSortMenuOpen(false); }}
                            className={`block w-full text-left px-4 py-2 text-sm ${sortConfig.key === 'title' && sortConfig.direction === 'desc' ? 'bg-brand-light/10 text-brand-light font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                          >Z-A 降序</button>
                          
                          <div className="px-2 py-1 text-xs font-semibold text-slate-500 border-t border-b border-slate-100 mt-1">年份</div>
                          <button
                            onClick={() => { setSortConfig({ key: 'releaseDate', direction: 'asc' }); setIsSortMenuOpen(false); }}
                            className={`block w-full text-left px-4 py-2 text-sm ${sortConfig.key === 'releaseDate' && sortConfig.direction === 'asc' ? 'bg-brand-light/10 text-brand-light font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                          >年份升序</button>
                          <button
                            onClick={() => { setSortConfig({ key: 'releaseDate', direction: 'desc' }); setIsSortMenuOpen(false); }}
                            className={`block w-full text-left px-4 py-2 text-sm ${sortConfig.key === 'releaseDate' && sortConfig.direction === 'desc' ? 'bg-brand-light/10 text-brand-light font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                          >年份降序</button>
                          
                          <div className="px-2 py-1 text-xs font-semibold text-slate-500 border-t border-b border-slate-100 mt-1">添加时间</div>
                          <button
                            onClick={() => { setSortConfig({ key: 'addedAt', direction: 'asc' }); setIsSortMenuOpen(false); }}
                            className={`block w-full text-left px-4 py-2 text-sm ${sortConfig.key === 'addedAt' && sortConfig.direction === 'asc' ? 'bg-brand-light/10 text-brand-light font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                          >添加时间升序</button>
                          <button
                            onClick={() => { setSortConfig({ key: 'addedAt', direction: 'desc' }); setIsSortMenuOpen(false); }}
                            className={`block w-full text-left px-4 py-2 text-sm ${sortConfig.key === 'addedAt' && sortConfig.direction === 'desc' ? 'bg-brand-light/10 text-brand-light font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                          >添加时间降序</button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-slate-400 text-xs">
                    <button
                      onClick={handleRandomRoam}
                      className="text-slate-400 hover:text-brand-light transition-colors focus:outline-none p-1 rounded"
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

                {/* 歌曲列表 */}
                {filteredHomeSongs.length > 0 ? (
                  <div className="-mx-4 px-4">
                    {filteredHomeSongs.slice(0, displayLimit).map(song => (
                      <SongCard 
                          key={song.id} 
                          song={song} 
                          onArtistClick={navigateToArtistDetail}
                          onAlbumClick={navigateToAlbumDetail}
                          onDelete={() => onDeleteSong(song.id)}
                          onSongClick={navigateToSongDetail}
                          onYearSearch={(year) => setSearchQuery(year.toString())}
                      />
                    ))}
                    {filteredHomeSongs.length > displayLimit && (
                      <button
                        onClick={() => setDisplayLimit(prev => prev + 50)}
                        className="w-full py-3 text-sm text-brand-light hover:text-brand-dark font-medium transition-colors"
                      >
                        加载更多 ({filteredHomeSongs.length - displayLimit} 首未显示)
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-20 px-6">
                    <div className="bg-slate-50 inline-flex p-4 rounded-full shadow-sm mb-4">
                      <Music2 className="text-slate-300" size={40} />
                    </div>
                    <h3 className="text-slate-800 font-semibold text-lg mb-1">没有找到音乐</h3>
                    <p className="text-slate-500 max-w-xs mx-auto mb-6 text-sm">您的音乐库是空的，快去添加第一首歌吧！</p>
                    <button onClick={() => setIsAddModalOpen(true)} className="text-brand-light font-medium hover:underline text-sm">添加音乐</button>
                  </div>
                )}
              </div>
            ) : (
              /* 新版 Dashboard 首页 */
              <div className="space-y-5">
                {/* Banner 轮播 */}
                <BannerCarousel songs={songs} onSongClick={navigateToSongDetail} />

                {/* 统计数据 */}
                <StatsBar 
                  songs={songs}
                  onNavigateHome={() => setHomeViewMode('allSongs')}
                  onNavigateArtists={navigateToArtists}
                  onNavigateAlbums={navigateToAlbums}
                  onNavigateTags={navigateToTags}
                />

                {/* 最近添加歌曲 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                      <Music2 size={16} className="text-brand-light" />
                      最近添加
                    </h2>
                    <button
                      onClick={() => {
                        setHomeViewMode('allSongs');
                        setDisplayLimit(50);
                      }}
                      className="flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors"
                    >
                      查看全部
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  {songs.length > 0 ? (
                    <div className="-mx-4 px-4">
                      {filteredHomeSongs.slice(0, 5).map(song => (
                        <SongCard 
                          key={song.id} 
                          song={song} 
                          onArtistClick={navigateToArtistDetail}
                          onAlbumClick={navigateToAlbumDetail}
                          onDelete={() => onDeleteSong(song.id)}
                          onSongClick={navigateToSongDetail}
                          onYearSearch={(year) => setSearchQuery(year.toString())}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-slate-400 text-sm">暂无歌曲</p>
                    </div>
                  )}
                </div>

                {/* 最近专辑 */}
                <RecentAlbums 
                  songs={songs}
                  displayCount={5}
                  onAlbumClick={navigateToAlbumDetail}
                  onViewAll={navigateToAlbums}
                />

                {/* 空状态提示 */}
                {songs.length === 0 && (
                  <div className="text-center py-12 px-6">
                    <div className="bg-slate-50 inline-flex p-4 rounded-full shadow-sm mb-4">
                      <Music2 className="text-slate-300" size={40} />
                    </div>
                    <h3 className="text-slate-800 font-semibold text-base mb-1">没有找到音乐</h3>
                    <p className="text-slate-500 text-sm mb-4">您的音乐库是空的，快去添加第一首歌吧！</p>
                    <button 
                      onClick={() => setIsAddModalOpen(true)}
                      className="px-5 py-2.5 bg-brand-light text-white font-medium rounded-lg hover:bg-brand-dark transition-colors text-sm"
                    >
                      添加音乐
                    </button>
                  </div>
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

        {/* VIEW: TAG LIBRARY */}
        {view.type === 'TAGS' && (
            <TagLibrary 
                songs={songs} 
                onTagClick={handleTagClick}
            />
        )}

        {/* VIEW: MY PAGE */}
        {view.type === 'MY_PAGE' && (
            <MyPage 
                songs={songs} 
                onImport={() => setIsImportModalOpen(true)}
                onExportCSV={() => exportSongsToCSV(songs)}
                onExportJSON={() => exportSongsToJSON(songs)}
                user={user}
                onNavigateHome={navigateToHome}
                onNavigateArtists={navigateToArtists}
                onNavigateAlbums={navigateToAlbums}
                onNavigateTags={navigateToTags}
            />
        )}

        {/* VIEW: ARTIST DETAIL */}
        {view.type === 'ARTIST_DETAIL' && view.data && (
            <ArtistDetail 
                artist={view.data} 
                songs={songs} 
                onBack={navigateBack}
                onAlbumClick={navigateToAlbumDetail}
                onDeleteSong={onDeleteSong}
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
                onDeleteSong={onDeleteSong}
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

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-50 shadow-lg">
        <div className="max-w-3xl mx-auto px-4 py-1">
          <div className="flex justify-around items-center">
              <button
                onClick={() => { navigateToHome(); setDisplayLimit(50); setHomeViewMode('dashboard'); }}
                className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl mx-0.5 transition-all duration-200 ${
                  view.type === 'HOME' 
                    ? 'bg-brand-light/10 text-brand-light' 
                    : 'text-slate-500 hover:text-brand-light hover:bg-slate-50'
                }`}
              >
                <Home size={18} className="mb-0.5" />
                <span className="text-xs font-medium">首页</span>
              </button>

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

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center justify-center w-10 h-10 rounded-xl mx-0.5 transition-all duration-200 bg-blue-600 text-white hover:bg-blue-700"
                aria-label="添加音乐"
              >
                <Plus size={24} strokeWidth={3} />
              </button>

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
        onJSONImport={handleJSONImport}
      />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          console.log('Authentication successful');
        }}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
};

const App: React.FC = () => (
  <ToastProvider>
    <AppContent />
  </ToastProvider>
);

export default App;
