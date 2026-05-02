import React, { useMemo, useState, useEffect } from 'react';
import { Song } from '../types';
import { ArrowLeft, Disc, LayoutGrid, List, Calendar, Music, ChevronRight } from 'lucide-react';

type ViewMode = 'grid' | 'list';

const STORAGE_KEY_ARTIST_ALBUMS_VIEW = 'melodylog_artist_albums_view_mode';

interface ArtistAlbumsProps {
  artist: string;
  songs: Song[];
  onBack: () => void;
  onAlbumClick: (album: string) => void;
}

export const ArtistAlbums: React.FC<ArtistAlbumsProps> = ({ artist, songs, onBack, onAlbumClick }) => {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ARTIST_ALBUMS_VIEW);
    return (saved as ViewMode) || 'grid';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ARTIST_ALBUMS_VIEW, viewMode);
  }, [viewMode]);

  const artistAlbums = useMemo(() => {
    const albumMap = new Map<string, { 
      coverUrl?: string; 
      releaseDate?: string; 
      songCount: number;
      songs: Song[];
    }>();
    
    songs
      .filter(s => s.artists.includes(artist))
      .forEach(song => {
        if (song.album) {
          const existing = albumMap.get(song.album);
          if (existing) {
            existing.songCount += 1;
            existing.songs.push(song);
            if (!existing.coverUrl && song.coverUrl) {
              existing.coverUrl = song.coverUrl;
            }
            if (!existing.releaseDate && song.releaseDate) {
              existing.releaseDate = song.releaseDate;
            }
          } else {
            albumMap.set(song.album, {
              coverUrl: song.coverUrl,
              releaseDate: song.releaseDate,
              songCount: 1,
              songs: [song]
            });
          }
        }
      });

    return Array.from(albumMap.entries())
      .map(([name, info]) => ({
        name,
        ...info
      }))
      .sort((a, b) => {
        if (a.releaseDate && b.releaseDate) {
          return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
        }
        if (a.releaseDate) return -1;
        if (b.releaseDate) return 1;
        return a.name.localeCompare(b.name, 'zh-CN');
      });
  }, [songs, artist]);

  const getReleaseYear = (dateStr?: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date.getFullYear();
  };

  return (
    <div className="animate-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <button 
        onClick={onBack}
        className="flex items-center gap-1 text-slate-500 hover:text-brand-light mb-4 text-sm font-medium transition-colors"
      >
        <ArrowLeft size={16} /> 返回
      </button>

      {/* Title and View Toggle */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{artist} 的专辑</h1>
          <p className="text-sm text-slate-500 mt-1">共 {artistAlbums.length} 张专辑</p>
        </div>
        
        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'grid' 
                ? 'bg-white text-brand-light shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
            title="网格视图"
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'list' 
                ? 'bg-white text-brand-light shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
            title="列表视图"
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* Albums Grid/List */}
      {artistAlbums.length > 0 ? (
        viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-3 gap-4">
            {artistAlbums.map((album) => (
              <button
                key={album.name}
                onClick={() => onAlbumClick(album.name)}
                className="group text-left"
              >
                <div className="relative w-full aspect-square rounded-lg overflow-hidden shadow-md transition-all group-hover:shadow-xl group-hover:scale-105">
                  {album.coverUrl ? (
                    <img 
                      src={album.coverUrl} 
                      alt={`${album.name} 专辑封面`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                      <Disc size={40} className="text-slate-400" />
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-brand-light transition-colors">
                    {album.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <span>{album.songCount} 首歌曲</span>
                    {getReleaseYear(album.releaseDate) && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-0.5">
                          <Calendar size={10} />
                          {getReleaseYear(album.releaseDate)}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* List View - 与 AlbumLibrary 保持一致的紧凑样式 */
          <div className="space-y-1 max-h-[calc(100vh-120px)] overflow-y-auto">
            {artistAlbums.map((album) => (
              <button
                key={album.name}
                onClick={() => onAlbumClick(album.name)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-all group text-left"
              >
                {/* Album Cover */}
                <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden shadow-sm">
                  {album.coverUrl ? (
                    <img 
                      src={album.coverUrl} 
                      alt={`${album.name} 专辑封面`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                      <Disc size={14} className="text-slate-400" />
                    </div>
                  )}
                </div>

                {/* Album Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate group-hover:text-brand-light transition-colors">
                    {album.name}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {album.songCount} 首
                  </p>
                </div>

                {/* Year and Count */}
                <div className="flex-shrink-0 flex items-center gap-3 text-xs text-slate-400">
                  {getReleaseYear(album.releaseDate) && (
                    <span className="flex items-center gap-0.5">
                      <Calendar size={11} />
                      {getReleaseYear(album.releaseDate)}
                    </span>
                  )}
                </div>

                {/* Arrow */}
                <ChevronRight size={16} className="flex-shrink-0 text-slate-300 group-hover:text-brand-light transition-colors" />
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="text-center py-20 text-slate-400">
          <Disc size={48} className="mx-auto mb-4 text-slate-300" />
          <p>该歌手暂无专辑记录</p>
        </div>
      )}
    </div>
  );
};