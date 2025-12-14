import React, { useMemo } from 'react';
import { Song } from '../types';
import { Music, ChevronRight } from 'lucide-react';

interface AlbumLibraryProps {
  songs: Song[];
  onSelectAlbum: (album: string) => void;
}

export const AlbumLibrary: React.FC<AlbumLibraryProps> = ({ songs, onSelectAlbum }) => {
  
  const albumsData = useMemo(() => {
    const map = new Map<string, { count: number; year?: string; coverUrl?: string; artists: Set<string> }>();
    
    songs.forEach(song => {
      if (song.album) {
        const albumInfo = map.get(song.album) || { count: 0, artists: new Set<string>() };
        
        // 更新歌曲数量
        albumInfo.count += 1;
        
        // 获取年份信息（如果可用）
        if (song.releaseDate && !albumInfo.year) {
          const date = new Date(song.releaseDate);
          if (!isNaN(date.getTime())) {
            albumInfo.year = date.getFullYear().toString();
          }
        }
        
        // 获取封面图片（使用第一张有封面的歌曲的封面）
        if (song.coverUrl && !albumInfo.coverUrl) {
          albumInfo.coverUrl = song.coverUrl;
        }
        
        // 添加所有艺术家
        song.artists.forEach(artist => albumInfo.artists.add(artist));
        
        map.set(song.album, albumInfo);
      }
    });
    
    return Array.from(map.entries())
      .map(([name, info]) => ({
        name,
        count: info.count,
        year: info.year,
        coverUrl: info.coverUrl,
        artists: (() => {
          const artistArray = Array.from(info.artists);
          if (artistArray.length <= 2) {
            return artistArray.join('、');
          } else {
            return `${artistArray[0]}、${artistArray[1]}等`;
          }
        })()
      }))
      .sort((a, b) => {
        // 首先按年份排序（降序）
        if (a.year && b.year) {
          return parseInt(b.year) - parseInt(a.year);
        }
        if (a.year) return -1; // 有年份的排在前面
        if (b.year) return 1;  // 没有年份的排在后面
        // 然后按专辑名排序
        return a.name.localeCompare(b.name, 'zh-CN');
      });
  }, [songs]);



  return (
    <div className="animate-in fade-in duration-300">
      <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <Music className="text-brand-light" /> 专辑库 ({albumsData.length})
      </h2>
      
      <div className="grid grid-cols-3 gap-4 max-h-[calc(100vh-120px)] overflow-y-auto">
        {albumsData.map(({ name, count, year, coverUrl, artists }) => (
          <div key={name} className="group">
            {/* 专辑封面 - 适当放大尺寸，去除边框 */}
            <button
              onClick={() => onSelectAlbum(name)}
              className="relative block w-full aspect-square rounded-lg overflow-hidden transition-all group-hover:shadow-lg"
            >
              {coverUrl ? (
                <img 
                  src={coverUrl} 
                  alt={`${name} 专辑封面`} 
                  className="w-full h-full object-cover rounded-lg transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full bg-slate-100 rounded-lg flex items-center justify-center">
                  <Music size={32} className="text-slate-400" />
                </div>
              )}
            </button>
            
            {/* 专辑信息 - 适配新布局 */}
            <div className="min-w-0 mt-1.5">
              {/* 专辑名称 */}
              <div className="text-sm font-semibold text-slate-800 truncate group-hover:text-brand-light transition-colors line-clamp-1">
                {name}
              </div>
              
              {/* 艺术家和年份信息 - 用·隔开 */}
              <div className="text-xs text-slate-500 truncate line-clamp-1">
                {artists}{year ? ` · ${year}` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>

      {albumsData.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          暂无专辑记录，快去添加音乐吧！
        </div>
      )}
    </div>
  );
};
