import React, { useMemo } from 'react';
import { Song } from '../types';
import { User, ChevronRight } from 'lucide-react';

interface ArtistLibraryProps {
  songs: Song[];
  onSelectArtist: (artist: string) => void;
}

export const ArtistLibrary: React.FC<ArtistLibraryProps> = ({ songs, onSelectArtist }) => {
  const artistsData = useMemo(() => {
    const map = new Map<string, number>();
    songs.forEach(song => {
      const count = map.get(song.artist) || 0;
      map.set(song.artist, count + 1);
    });
    
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
  }, [songs]);

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