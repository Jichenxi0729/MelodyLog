import React, { useMemo } from 'react';
import { Song } from '../types';
import { SongCard } from './SongCard';
import { ArrowLeft, User, Mic2 } from 'lucide-react';

interface ArtistDetailProps {
  artist: string;
  songs: Song[];
  onBack: () => void;
  onAlbumClick: (album: string) => void;
}

export const ArtistDetail: React.FC<ArtistDetailProps> = ({ artist, songs, onBack, onAlbumClick }) => {
  const artistSongs = useMemo(() => {
    return songs
      .filter(s => s.artist === artist)
      .sort((a, b) => b.addedAt - a.addedAt);
  }, [songs, artist]);

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
          </p>
        </div>
      </div>

      {/* Songs List */}
      <div className="space-y-3">
        {artistSongs.map(song => (
          <SongCard 
            key={song.id} 
            song={song} 
            onAlbumClick={onAlbumClick}
            // No artist click handler needed here as we are already on the artist page
          />
        ))}
      </div>
    </div>
  );
};