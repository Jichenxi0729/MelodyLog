import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Music2, UploadCloud, Home, Users, Download } from 'lucide-react';
import { Song, ViewState } from './types';
import { SongCard } from './components/SongCard';
import { AddSongModal } from './components/AddSongModal';
import { ImportModal } from './components/ImportModal';
import { ArtistLibrary } from './components/ArtistLibrary';
import { ArtistDetail } from './components/ArtistDetail';
import { AlbumDetail } from './components/AlbumDetail';
import { fetchSongMetadata } from './services/musicService';
import { exportSongsToCSV } from './utils/csvExporter';

// Constants
const STORAGE_KEY = 'melodylog_songs';

const App: React.FC = () => {
  // Data State
  const [songs, setSongs] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Navigation State
  const [view, setView] = useState<ViewState>({ type: 'HOME' });
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

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

  // Filtered Songs (Only for Home View Search)
  const filteredHomeSongs = useMemo(() => {
    let result = songs;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.title.toLowerCase().includes(q) || 
        s.artist.toLowerCase().includes(q) ||
        (s.album && s.album.toLowerCase().includes(q))
      );
    }

    // Default sort: Newest first
    return result.sort((a, b) => b.addedAt - a.addedAt);
  }, [songs, searchQuery]);

  // Handlers
  const handleDeleteSong = (songId: string) => {
    // 确认删除
    if (window.confirm('确定要删除这首歌曲吗？')) {
      setSongs(prevSongs => prevSongs.filter(song => song.id !== songId));
    }
  };

  const handleAddSong = async (title: string, artist: string, album: string) => {
    const metadata = await fetchSongMetadata(title, artist);
    
    const newSong: Song = {
      id: crypto.randomUUID(),
      title,
      artist,
      album: album || metadata.album,
      coverUrl: metadata.coverUrl,
      releaseDate: metadata.releaseDate,
      addedAt: Date.now()
    };

    setSongs(prev => [newSong, ...prev]);
  };

  const handleBulkImport = async (lines: string[]) => {
    const newSongs: Song[] = [];
    
    for (const line of lines) {
      const parts = line.split('-').map(s => s.trim());
      if (parts.length >= 2) {
        const title = parts[0];
        const artist = parts[1];
        const metadata = await fetchSongMetadata(title, artist);
        
        newSongs.push({
          id: crypto.randomUUID(),
          title,
          artist,
          coverUrl: metadata.coverUrl,
          releaseDate: metadata.releaseDate,
          album: metadata.album,
          addedAt: Date.now()
        });
      }
    }

    setSongs(prev => [...newSongs, ...prev]);
  };

  // Navigation Handlers
  const navigateToHome = () => {
    setView({ type: 'HOME' });
    setSearchQuery('');
  };

  const navigateToArtists = () => {
    setView({ type: 'ARTISTS' });
  };

  const navigateToArtistDetail = (artist: string) => {
    setView({ type: 'ARTIST_DETAIL', data: artist });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToAlbumDetail = (album: string) => {
    setView({ type: 'ALBUM_DETAIL', data: album });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-brand-bg pb-24 md:pb-10 font-sans">
      
      {/* Header - Dark Theme Color with Glassmorphism */}
      <header className="bg-brand-dark/95 backdrop-blur-md sticky top-0 z-40 border-b border-white/10 transition-all shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-2">
            <div className="flex items-center gap-4 h-12">
                
                {/* Search Bar or Page Title */}
                {view.type === 'HOME' ? (
                     <div className="flex-1 relative max-w-lg group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-blue-200 group-focus-within:text-white transition-colors" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-9 pr-3 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/5 text-white placeholder-blue-200/70 focus:bg-white/20 focus:ring-1 focus:ring-white/30 focus:outline-none transition-all text-sm"
                            placeholder="搜索音乐..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                ) : (
                    <div className="flex-1 flex items-center">
                         <span className="text-lg font-bold text-white tracking-wide">
                            {view.type === 'ARTISTS' ? '歌手库' : ''}
                            {view.type === 'ARTIST_DETAIL' ? '歌手详情' : ''}
                            {view.type === 'ALBUM_DETAIL' ? '专辑详情' : ''}
                         </span>
                    </div>
                )}

                {/* Desktop Actions */}
                <div className="hidden md:flex items-center gap-1 shrink-0">
                     <button 
                        onClick={navigateToHome}
                        className={`p-2 rounded-lg transition-colors ${view.type === 'HOME' ? 'bg-white/20 text-white' : 'text-blue-200 hover:bg-white/10 hover:text-white'}`}
                        title="首页"
                      >
                        <Home size={20} />
                      </button>
                      <button 
                        onClick={navigateToArtists}
                        className={`p-2 rounded-lg transition-colors ${view.type === 'ARTISTS' ? 'bg-white/20 text-white' : 'text-blue-200 hover:bg-white/10 hover:text-white'}`}
                        title="歌手库"
                      >
                        <Users size={20} />
                      </button>
                      
                      <div className="w-px h-6 bg-white/20 mx-2"></div>
                      
                      <button 
                        onClick={() => setIsImportModalOpen(true)}
                        className="p-2 text-blue-200 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
                        title="导入"
                      >
                        <UploadCloud size={20} />
                      </button>
                      <button 
                        onClick={() => exportSongsToCSV(songs)}
                        className="p-2 text-blue-200 hover:bg-white/10 hover:text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="导出CSV"
                        disabled={songs.length === 0}
                      >
                        <Download size={20} />
                      </button>
                      <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="ml-1 bg-brand-light hover:bg-blue-400 text-white px-3 py-1.5 rounded-full text-sm font-medium shadow-lg shadow-blue-900/20 transition-all flex items-center gap-1"
                      >
                        <Plus size={16} /> <span className="hidden lg:inline">添加</span>
                      </button>
                </div>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-4">
        
        {/* VIEW: HOME */}
        {view.type === 'HOME' && (
          <div className="space-y-3 animate-in fade-in duration-300">
             <div className="flex items-center justify-between px-1">
                <h2 className="text-base font-bold text-slate-800">最近添加</h2>
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <Music2 size={14} />
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
                />
              ))
            ) : (
              <div className="text-center py-20 px-6">
                <div className="bg-white inline-flex p-4 rounded-full shadow-sm mb-4">
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

        {/* VIEW: ARTIST DETAIL */}
        {view.type === 'ARTIST_DETAIL' && view.data && (
            <ArtistDetail 
                artist={view.data} 
                songs={songs} 
                onBack={navigateToHome}
                onAlbumClick={navigateToAlbumDetail}
                onDeleteSong={handleDeleteSong}
            />
        )}

        {/* VIEW: ALBUM DETAIL */}
        {view.type === 'ALBUM_DETAIL' && view.data && (
            <AlbumDetail 
                album={view.data} 
                songs={songs} 
                onBack={navigateToHome}
                onArtistClick={navigateToArtistDetail}
                onDeleteSong={handleDeleteSong}
            />
        )}

      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-50 flex justify-around py-2 pb-safe">
        <button 
            onClick={navigateToHome}
            className={`flex flex-col items-center gap-1 py-1 px-4 rounded-lg transition-colors ${view.type === 'HOME' ? 'text-brand-dark' : 'text-slate-400'}`}
        >
            <Home size={20} />
            <span className="text-[10px] font-medium">首页</span>
        </button>
        <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex flex-col items-center gap-1 text-slate-400"
        >
            <div className="bg-brand-dark text-white p-3 rounded-full -mt-8 shadow-lg shadow-blue-900/20 border-4 border-slate-50 active:scale-95 transition-transform">
                <Plus size={24} />
            </div>
            <span className="text-[10px] font-medium">添加</span>
        </button>
        <button 
            onClick={navigateToArtists}
            className={`flex flex-col items-center gap-1 py-1 px-4 rounded-lg transition-colors ${view.type === 'ARTISTS' ? 'text-brand-dark' : 'text-slate-400'}`}
        >
            <Users size={20} />
            <span className="text-[10px] font-medium">歌手</span>
        </button>
      </div>

      {/* Mobile Extra Buttons */}
      <div className="md:hidden flex fixed bottom-20 right-4 z-40 gap-2">
        <button
          onClick={() => setIsImportModalOpen(true)}
          className="bg-white text-brand-dark p-3 rounded-full shadow-lg border border-slate-100 active:scale-95 transition-transform"
          aria-label="导入"
        >
          <UploadCloud size={20} />
        </button>
        <button
          onClick={() => exportSongsToCSV(songs)}
          className="bg-white text-brand-dark p-3 rounded-full shadow-lg border border-slate-100 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="导出CSV"
          disabled={songs.length === 0}
        >
          <Download size={20} />
        </button>
      </div>

      {/* Modals */}
      <AddSongModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onAdd={handleAddSong} 
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