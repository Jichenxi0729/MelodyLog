import React, { useMemo, useRef } from 'react';
import { Song } from '../types';
import { Disc, ChevronRight, Music } from 'lucide-react';

interface RecentAlbumsProps {
  songs: Song[];
  displayCount?: number;
  onAlbumClick: (album: string) => void;
  onViewAll: () => void;
}

export const RecentAlbums: React.FC<RecentAlbumsProps> = ({ 
  songs, 
  displayCount = 5,
  onAlbumClick,
  onViewAll 
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 获取最近添加的专辑（基于最新添加的歌曲）
  const recentAlbums = useMemo(() => {
    const albumMap = new Map<string, { 
      name: string; 
      coverUrl?: string; 
      artists: Set<string>; 
      year?: string;
      latestAddedAt: number;
      count: number;
    }>();

    songs.forEach(song => {
      if (song.album) {
        const existing = albumMap.get(song.album);
        if (existing) {
          existing.count += 1;
          if (song.addedAt > existing.latestAddedAt) {
            existing.latestAddedAt = song.addedAt;
          }
          if (!existing.coverUrl && song.coverUrl) {
            existing.coverUrl = song.coverUrl;
          }
          song.artists.forEach(a => existing.artists.add(a));
        } else {
          const year = (() => {
            if (!song.releaseDate) return undefined;
            const date = new Date(song.releaseDate);
            return !isNaN(date.getTime()) ? date.getFullYear().toString() : undefined;
          })();

          albumMap.set(song.album, {
            name: song.album,
            coverUrl: song.coverUrl,
            artists: new Set(song.artists),
            year,
            latestAddedAt: song.addedAt,
            count: 1,
          });
        }
      }
    });

    // 按最近添加时间排序，取前N个
    return Array.from(albumMap.values())
      .sort((a, b) => b.latestAddedAt - a.latestAddedAt)
      .slice(0, displayCount)
      .map(album => ({
        ...album,
        artists: Array.from(album.artists).slice(0, 2).join('、'),
      }));
  }, [songs, displayCount]);

  // 滚动到左边
  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  // 滚动到右边
  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  if (recentAlbums.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
          <Disc size={16} className="text-brand-light" />
          最近专辑
        </h2>
        <button
          onClick={onViewAll}
          className="flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors"
        >
          查看全部
          <ChevronRight size={14} />
        </button>
      </div>

      {/* 横向滚动区域 */}
      <div className="relative group">
        {/* 左边渐变遮罩 */}
        <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {/* 右边渐变遮罩 */}
        <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {recentAlbums.map((album) => (
            <button
              key={album.name}
              onClick={() => onAlbumClick(album.name)}
              className="flex-shrink-0 w-[140px] snap-start group/item"
            >
              {/* 封面 */}
              <div className="aspect-square rounded-xl overflow-hidden shadow-sm mb-2 bg-slate-100">
                {album.coverUrl ? (
                  <img
                    src={album.coverUrl}
                    alt={`${album.name} 封面`}
                    className="w-full h-full object-cover group-hover/item:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music size={32} className="text-slate-300" />
                  </div>
                )}
              </div>

              {/* 信息 */}
              <div className="px-0.5">
                <p className="text-sm font-medium text-slate-800 truncate group-hover/item:text-brand-light transition-colors">
                  {album.name}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {album.artists}{album.year ? ` · ${album.year}` : ''}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* 滚动按钮 */}
        {recentAlbums.length > 3 && (
          <>
            <button
              onClick={scrollLeft}
              className="absolute left-0 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-slate-50 transition-all z-20"
              aria-label="向左滑动"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button
              onClick={scrollRight}
              className="absolute right-0 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-slate-50 transition-all z-20"
              aria-label="向右滑动"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </>
        )}
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};
