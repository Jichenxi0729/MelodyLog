import React from 'react';
import { Song } from '../types';
import { Calendar, Disc, User, Trash2 } from 'lucide-react';

interface SongCardProps {
  song: Song;
  onArtistClick?: (artist: string) => void;
  onAlbumClick?: (album: string) => void;
  onDelete?: () => void;
}

export const SongCard: React.FC<SongCardProps> = ({ song, onArtistClick, onAlbumClick, onDelete }) => {
  const formattedDate = new Date(song.addedAt).toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  });

  const releaseYear = song.releaseDate ? new Date(song.releaseDate).getFullYear() : null;

  const handleArtistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onArtistClick?.(song.artist);
  };

  const handleAlbumClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (song.album) {
      onAlbumClick?.(song.album);
    }
  };

  return (
    <div className="group relative bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-slate-100 h-[64px] flex items-center pr-3 md:pr-3 w-full">
      {/* Cover Art - Smaller */}
      <div className="flex-shrink-0 w-[64px] h-[64px] relative">
        <img
          src={song.coverUrl || `https://picsum.photos/seed/${song.id}/200`}
          alt={`${song.title} cover`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 ml-3 flex flex-col justify-center h-full py-1.5 space-y-0.5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-bold text-slate-800 truncate pr-2 md:pr-2" title={song.title}>
            {song.title}
          </h3>
        </div>
        
        {/* Artist - Clickable */}
        <div 
          onClick={handleArtistClick}
          className="flex items-center gap-1 text-xs text-brand-light font-medium truncate cursor-pointer hover:underline hover:text-blue-600 w-fit"
          title={`查看 ${song.artist} 的详情`}
        >
          <User size={10} />
          {song.artist}
        </div>

        {/* Metadata Row */}
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          {song.album && (
            <span 
              onClick={handleAlbumClick}
              className="flex items-center gap-0.5 truncate max-w-[120px] cursor-pointer hover:text-brand-light hover:underline transition-colors"
              title={`查看专辑: ${song.album}`}
            >
              <Disc size={9} /> {song.album}
            </span>
          )}
          {releaseYear && (
            <span className="flex items-center gap-0.5 text-slate-400">
              <Calendar size={9} /> {releaseYear}
            </span>
          )}
        </div>
      </div>
      
      {/* Metadata column with date and delete button */}
      <div className="absolute right-2 flex flex-col items-end gap-1 justify-center">
        <span className="text-[10px] text-slate-400 font-medium">{formattedDate}</span>
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 rounded-full bg-white/90 text-slate-400 hover:text-red-500 hover:bg-white transition-colors md:opacity-0 md:group-hover:opacity-100 shadow-sm"
            aria-label="删除歌曲"
            title="删除歌曲"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
};