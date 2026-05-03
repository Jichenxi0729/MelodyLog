import React, { memo } from 'react';
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

// 使用memo优化，防止不必要的重新渲染
const SongCardComponent: React.FC<SongCardProps> = ({ song, onArtistClick, onAlbumClick, onDelete, onSongClick, onYearSearch }) => {
  // 更新添加时间格式，包含年份信息
  const formattedDate = new Date(song.addedAt).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });

  // 修复年份显示逻辑，兼容纯数字年份格式，并防止无效日期错误
  let releaseYear: number | null = null;
  if (song.releaseDate) {
    if (typeof song.releaseDate === 'string' && !isNaN(Number(song.releaseDate))) {
      const year = Number(song.releaseDate);
      if (year >= 1900 && year <= 2100) {
        releaseYear = year;
      }
    } else {
      const date = new Date(song.releaseDate);
      if (!isNaN(date.getTime())) {
        releaseYear = date.getFullYear();
      }
    }
  }

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
    <div onClick={handleSongClick} className="group relative hover:bg-slate-50/60 transition-colors duration-200 cursor-pointer active:bg-slate-100">
      {/* 主内容区域：封面 + 信息 + 删除按钮 */}
      <div className="flex items-center py-2">
        {/* Cover Art */}
        <div className="flex-shrink-0 w-[56px] h-[56px] relative">
          <img
            src={song.coverUrl || `https://picsum.photos/seed/${song.id}/200`}
            alt={`${song.title} cover`}
            className="w-full h-full object-cover rounded-lg"
            loading="lazy"
          />
        </div>

        {/* Info + Delete */}
        <div className="flex-1 min-w-0 ml-3 flex items-center justify-between">
          <div className="flex-1 min-w-0 flex flex-col justify-center space-y-0.5">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-slate-800 truncate pr-2 max-w-[13rem]" title={song.title}>
                {song.title}
              </h3>
              <span className="text-[10px] text-slate-400 font-medium flex-shrink-0">{formattedDate}</span>
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
                  className="flex items-center gap-0.5 cursor-pointer hover:text-brand-light hover:underline transition-colors max-w-[16rem] truncate"
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

          {/* Delete button */}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="flex-shrink-0 ml-2 p-1.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
              aria-label="删除歌曲"
              title="删除歌曲"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      {/* 分割线：左端与歌曲信息对齐，与内容保持间距 */}
      <div className="absolute bottom-1 left-[68px] right-0 h-px bg-slate-100" />
    </div>
  );
};

// 使用memo包装组件，防止不必要的重新渲染
export const SongCard = memo(SongCardComponent, (prevProps, nextProps) => {
  // 自定义比较函数：只有当song对象的关键属性变化时才重新渲染
  return (
    prevProps.song.id === nextProps.song.id &&
    prevProps.song.title === nextProps.song.title &&
    prevProps.song.artists.join(',') === nextProps.song.artists.join(',') &&
    prevProps.song.album === nextProps.song.album &&
    prevProps.song.releaseDate === nextProps.song.releaseDate &&
    prevProps.song.addedAt === nextProps.song.addedAt &&
    prevProps.song.coverUrl === nextProps.song.coverUrl
  );
});