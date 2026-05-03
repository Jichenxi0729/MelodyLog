import React, { useMemo } from 'react';
import { Song } from '../types';
import { SongCard } from './SongCard';
import { ArrowLeft, User, Mic2, Disc, ChevronRight, LayoutGrid, List } from 'lucide-react';

interface ArtistDetailProps {
  artist: string;
  songs: Song[];
  onBack: () => void;
  onAlbumClick: (album: string) => void;
  onDeleteSong: (songId: string) => void;
  onSongClick?: (songId: string) => void;
  onViewAllAlbums?: (artist: string) => void;
}

export const ArtistDetail: React.FC<ArtistDetailProps> = ({ artist, songs, onBack, onAlbumClick, onDeleteSong, onSongClick, onViewAllAlbums }) => {
  const artistSongs = useMemo(() => {
    return songs
      .filter(s => s.artists.includes(artist))
      .sort((a, b) => b.addedAt - a.addedAt);
  }, [songs, artist]);

  const artistAlbums = useMemo(() => {
    const albumMap = new Map<string, { coverUrl?: string; releaseDate?: string; songCount: number }>();
    
    artistSongs.forEach(song => {
      if (song.album) {
        const existing = albumMap.get(song.album);
        if (existing) {
          existing.songCount += 1;
          if (!existing.coverUrl && song.coverUrl) {
            existing.coverUrl = song.coverUrl;
          }
        } else {
          albumMap.set(song.album, {
            coverUrl: song.coverUrl,
            releaseDate: song.releaseDate,
            songCount: 1
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
  }, [artistSongs]);

  return (
    <div className="animate-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <button 
        onClick={onBack}
        className="flex items-center gap-1 text-slate-500 hover:text-brand-light mb-4 text-sm font-medium transition-colors"
      >
        <ArrowLeft size={16} /> 返回
      </button>

      <div className="bg-gradient-to-r from-brand-dark to-brand-light rounded-2xl p-6 md:p-8 mb-8 text-white shadow-lg relative overflow-hidden">
        <Mic2 className="absolute -bottom-4 -right-4 text-white/10 w-40 h-40 rotate-12" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <User className="text-white" size={24} />
            </div>
            <span className="text-white/80 text-sm font-medium uppercase tracking-wider">歌手</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">{artist}</h1>
          <p className="mt-2 text-white/80 flex items-center gap-2">
            <span>{artistSongs.length} 首歌曲</span>
            <span>·</span>
            <span>{artistAlbums.length} 张专辑</span>
          </p>
        </div>
      </div>

      {/* Albums Section - Horizontal Scroll */}
      {artistAlbums.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Disc className="text-brand-light" size={20} />
              专辑 ({artistAlbums.length})
            </h2>
            {onViewAllAlbums && (
              <button
                onClick={() => onViewAllAlbums(artist)}
                className="flex items-center gap-1 text-sm text-brand-light hover:text-brand-dark font-medium transition-colors"
              >
                查看全部
                <ChevronRight size={16} />
              </button>
            )}
          </div>
          
          <div>
            <div className="flex gap-3 overflow-x-auto pb-4 scroll-smooth">
              {artistAlbums.slice(0, 10).map((album) => (
                <button
                  key={album.name}
                  onClick={() => onAlbumClick(album.name)}
                  className="flex-shrink-0 w-32 group"
                >
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden shadow-md transition-all group-hover:shadow-xl group-hover:scale-105">
                    {album.coverUrl ? (
                      <img 
                        src={album.coverUrl} 
                        alt={`${album.name} 专辑封面`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                        <Disc size={32} className="text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="mt-2 text-left">
                    <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-brand-light transition-colors">
                      {album.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {album.songCount} 首
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Songs List */}
      <div>
        {artistSongs.map(song => (
          <SongCard 
            key={song.id} 
            song={song} 
            onAlbumClick={onAlbumClick}
            onDelete={() => onDeleteSong(song.id)}
            onSongClick={onSongClick}
          />
        ))}
      </div>
    </div>
  );
};