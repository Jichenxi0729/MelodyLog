import React from 'react';
import { Song } from '../types';
import { User, ChevronRight } from 'lucide-react';

interface ArtistLibraryProps {
  songs: Song[];
  onSelectArtist: (artist: string) => void;
}

export const ArtistLibrary: React.FC<ArtistLibraryProps> = ({ songs, onSelectArtist }) => {
  // 不使用useMemo，直接计算歌手数据，确保每次都重新计算
  const calculateArtistsData = () => {
    // 创建一个Map来存储歌手名称和对应的歌曲数量
    const artistMap = new Map<string, number>();
    
    // 确保songs是数组
    if (!Array.isArray(songs)) {
      console.error('Songs is not an array:', songs);
      return [];
    }
    
    // 遍历所有歌曲
    for (const song of songs) {
      // 确保歌曲有artists属性且是数组
      if (song && Array.isArray(song.artists)) {
        // 遍历歌曲的所有歌手
        for (const artist of song.artists) {
          // 确保歌手名称有效
          if (artist && typeof artist === 'string' && artist.trim()) {
            const trimmedArtist = artist.trim();
            // 更新歌手的歌曲数量
            const currentCount = artistMap.get(trimmedArtist) || 0;
            artistMap.set(trimmedArtist, currentCount + 1);
          }
        }
      }
    }
    
    // 将Map转换为数组，并按歌曲数量排序
    const result = Array.from(artistMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
    
    return result;
  };
  
  // 直接调用计算函数
  const artistsData = calculateArtistsData();
  
  // 调试信息
  console.log('ArtistLibrary - Songs count:', songs.length);
  console.log('ArtistLibrary - Artists count:', artistsData.length);
  console.log('ArtistLibrary - Artists data:', artistsData);

  return (
    <div className="animate-in fade-in duration-300">
      <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <User className="text-brand-light" /> 歌手库 ({artistsData.length})
      </h2>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {artistsData.map(({ name, count }) => (
          <button
            key={name}
            onClick={() => onSelectArtist(name)}
            className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md hover:border-brand-light/30 hover:bg-blue-50/30 transition-all text-left group"
          >
            <div className="min-w-0">
              <div className="font-semibold text-slate-800 truncate group-hover:text-brand-light transition-colors">
                {name}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {count} 首歌曲
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-300 group-hover:text-brand-light transition-colors" />
          </button>
        ))}
      </div>

      {artistsData.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          暂无歌手记录，快去添加音乐吧！
        </div>
      )}
    </div>
  );
};