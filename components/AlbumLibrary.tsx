import React, { useMemo, useState, useEffect } from 'react';
import { Song } from '../types';
import { Music, ChevronRight, LayoutGrid, List, Calendar, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

type AlbumViewMode = 'three-col' | 'two-col' | 'list';
type AlbumSortKey = 'year' | 'name';
type AlbumSortDirection = 'asc' | 'desc';

const STORAGE_KEY_ALBUM_LIBRARY_VIEW = 'melodylog_album_library_view_mode';
const STORAGE_KEY_ALBUM_SORT = 'melodylog_album_library_sort';

interface AlbumLibraryProps {
  songs: Song[];
  onSelectAlbum: (album: string) => void;
}

const AlbumLibraryComponent: React.FC<AlbumLibraryProps> = ({ songs, onSelectAlbum }) => {
  const [viewMode, setViewMode] = useState<AlbumViewMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ALBUM_LIBRARY_VIEW);
    return (saved as AlbumViewMode) || 'three-col';
  });

  const [albumSort, setAlbumSort] = useState<{ key: AlbumSortKey; direction: AlbumSortDirection }>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ALBUM_SORT);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return { key: 'year', direction: 'desc' };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ALBUM_LIBRARY_VIEW, viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ALBUM_SORT, JSON.stringify(albumSort));
  }, [albumSort]);
  
  const albumsData = useMemo(() => {
    const map = new Map<string, { count: number; year?: string; coverUrl?: string; artists: Set<string>; releaseDate?: string }>();
    
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
            albumInfo.releaseDate = song.releaseDate;
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
        releaseDate: info.releaseDate,
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
        const dir = albumSort.direction === 'asc' ? 1 : -1;
        if (albumSort.key === 'year') {
          // 按年份排序
          if (a.year && b.year) return dir * (parseInt(a.year) - parseInt(b.year));
          if (a.year) return -1;
          if (b.year) return 1;
          return dir * a.name.localeCompare(b.name, 'zh-CN');
        } else {
          // 按名称排序
          return dir * a.name.localeCompare(b.name, 'zh-CN');
        }
      });
  }, [songs, albumSort]);



  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Music className="text-brand-light" /> 专辑库 ({albumsData.length})
        </h2>
        
        <div className="flex items-center gap-2">
          {/* Sort Controls */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setAlbumSort(prev => ({ key: 'year', direction: prev.key === 'year' && prev.direction === 'desc' ? 'asc' : 'desc' }))}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${
                albumSort.key === 'year' ? 'bg-white text-brand-light shadow-sm font-medium' : 'text-slate-500 hover:text-slate-700'
              }`}
              title="按年份排序"
            >
              <Calendar size={12} />
              {albumSort.key === 'year' ? (albumSort.direction === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} />}
            </button>
            <button
              onClick={() => setAlbumSort(prev => ({ key: 'name', direction: prev.key === 'name' && prev.direction === 'desc' ? 'asc' : 'desc' }))}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors ${
                albumSort.key === 'name' ? 'bg-white text-brand-light shadow-sm font-medium' : 'text-slate-500 hover:text-slate-700'
              }`}
              title="按名称排序"
            >
              名
              {albumSort.key === 'name' ? (albumSort.direction === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} />}
            </button>
          </div>

          {/* View Mode Selector */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('three-col')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'three-col' 
                  ? 'bg-white text-brand-light shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="三列网格"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('two-col')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'two-col' 
                  ? 'bg-white text-brand-light shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title="两列网格"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
              </svg>
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
              <List size={16} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Three Column Grid */}
      {viewMode === 'three-col' && (
        <div className="grid grid-cols-3 gap-4 max-h-[calc(100vh-120px)] overflow-y-auto">
          {albumsData.map(({ name, count, year, coverUrl, artists }) => (
            <div key={name} className="group">
              {/* 专辑封面 */}
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
              
              {/* 专辑信息 */}
              <div className="min-w-0 mt-1.5">
                <div className="text-sm font-semibold text-slate-800 truncate group-hover:text-brand-light transition-colors line-clamp-1">
                  {name}
                </div>
                <div className="text-xs text-slate-500 truncate line-clamp-1">
                  {artists}{year ? ` · ${year}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Two Column Grid */}
      {viewMode === 'two-col' && (
        <div className="grid grid-cols-2 gap-4 max-h-[calc(100vh-120px)] overflow-y-auto">
          {albumsData.map(({ name, count, year, coverUrl, artists }) => (
            <div key={name} className="group">
              {/* 专辑封面 */}
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
                    <Music size={40} className="text-slate-400" />
                  </div>
                )}
              </button>
              
              {/* 专辑信息 */}
              <div className="min-w-0 mt-2">
                <div className="text-base font-semibold text-slate-800 truncate group-hover:text-brand-light transition-colors line-clamp-1">
                  {name}
                </div>
                <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                  <div className="truncate">{artists}</div>
                  <div className="flex items-center gap-2">
                    <span>{count} 首歌曲</span>
                    {year && (
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {year}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-1 max-h-[calc(100vh-120px)] overflow-y-auto">
          {albumsData.map(({ name, count, year, coverUrl, artists }) => (
            <button
              key={name}
              onClick={() => onSelectAlbum(name)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-all group text-left"
            >
              {/* 专辑封面 */}
              <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden shadow-sm">
                {coverUrl ? (
                  <img 
                    src={coverUrl} 
                    alt={`${name} 专辑封面`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                    <Music size={14} className="text-slate-400" />
                  </div>
                )}
              </div>

              {/* 专辑信息 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate group-hover:text-brand-light transition-colors">
                  {name}
                </p>
                <p className="text-xs text-slate-400 truncate">{artists}</p>
              </div>

              {/* 年份和歌曲数 */}
              <div className="flex-shrink-0 flex items-center gap-3 text-xs text-slate-400">
                {year && (
                  <span className="flex items-center gap-0.5">
                    <Calendar size={11} />
                    {year}
                  </span>
                )}
                <span>{count}首</span>
              </div>

              {/* 箭头 */}
              <ChevronRight size={16} className="flex-shrink-0 text-slate-300 group-hover:text-brand-light transition-colors" />
            </button>
          ))}
        </div>
      )}

      {albumsData.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          暂无专辑记录，快去添加音乐吧！
        </div>
      )}
    </div>
  );
};

export const AlbumLibrary = React.memo(AlbumLibraryComponent);
