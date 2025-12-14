import React from 'react';
import { Song } from '../types';
import { Calendar, Disc, User, Trash2 } from 'lucide-react';

// 添加isNaN函数的声明（在TypeScript中，isNaN是全局函数，但明确声明可以避免潜在问题）
declare global {
  interface NumberConstructor {
    isNaN(number: number): boolean;
  }
}

interface SongCardProps {
  song: Song;
  onArtistClick?: (artist: string) => void;
  onAlbumClick?: (album: string) => void;
  onDelete?: () => void;
  onSongClick?: (songId: string) => void;
  onYearSearch?: (year: number) => void;
}

export const SongCard: React.FC<SongCardProps> = ({ song, onArtistClick, onAlbumClick, onDelete, onSongClick, onYearSearch }) => {
  // 更新添加时间格式，包含年份信息
  const formattedDate = new Date(song.addedAt).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });

  // 修复年份显示逻辑，兼容纯数字年份格式
  const releaseYear = song.releaseDate ? 
    (typeof song.releaseDate === 'string' && !isNaN(Number(song.releaseDate)) 
      ? Number(song.releaseDate) 
      : new Date(song.releaseDate).getFullYear()) : null;

  const handleArtistClick = (e: React.MouseEvent, artist: string) => {
    e.stopPropagation();
    onArtistClick?.(artist);
  };

  const handleAlbumClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (song.album) {
      onAlbumClick?.(song.album);
    }
  };

  const handleSongClick = () => {
    onSongClick?.(song.id);
  };

  return (
    <div onClick={handleSongClick} className="group relative bg-blue-50/20 rounded-lg shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-slate-200 h-[64px] flex items-center pr-2 md:pr-2 w-full cursor-pointer hover:bg-blue-100">
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
      <div className="flex-1 min-w-0 ml-2 flex flex-col justify-center h-full py-0.5 space-y-0.5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-bold text-slate-800 truncate pr-2 md:pr-2" title={song.title}>
            {song.title}
          </h3>
        </div>
        
        {/* Artists - Clickable */}
        <div className="flex items-center gap-1 text-xs text-brand-light font-medium truncate w-fit">
          <User size={10} />
          {song.artists.map((artist, index) => (
            <React.Fragment key={artist}>
              <span 
                onClick={(e) => handleArtistClick(e, artist)}
                className="cursor-pointer hover:underline hover:text-blue-600"
                title={`查看 ${artist} 的详情`}
              >
                {artist}
              </span>
              {index < song.artists.length - 1 && <span className="text-slate-400">/</span>}
            </React.Fragment>
          ))}
        </div>

        {/* Metadata Row */}
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          {song.album && (
            <span 
              onClick={handleAlbumClick}
              className="flex items-center gap-0.5 truncate cursor-pointer hover:text-brand-light hover:underline transition-colors"
              title={`查看专辑: ${song.album}`}
            >
              <Disc size={9} /> {song.album}
            </span>
          )}
          {releaseYear && (
            <span 
            onClick={(e) => {
              e.stopPropagation();
              onYearSearch?.(releaseYear as number);
            }}
            className="flex items-center gap-0.5 text-slate-400 cursor-pointer hover:text-brand-light hover:underline transition-colors"
            title={`搜索 ${releaseYear} 年的所有歌曲`}
          >
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