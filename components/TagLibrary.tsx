import React, { useMemo, useState } from 'react';
import { Song } from '../types';
import { Tag, Music, ChevronRight, Search } from 'lucide-react';

interface TagLibraryProps {
  songs: Song[];
  onTagClick: (tag: string) => void;
}

const TagLibraryComponent: React.FC<TagLibraryProps> = ({ songs, onTagClick }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const tagsData = useMemo(() => {
    const map = new Map<string, { count: number; coverUrl?: string }>();

    songs.forEach(song => {
      if (song.tags && song.tags.length > 0) {
        song.tags.forEach(tag => {
          const info = map.get(tag) || { count: 0 };
          info.count += 1;
          if (song.coverUrl && !info.coverUrl) {
            info.coverUrl = song.coverUrl;
          }
          map.set(tag, info);
        });
      }
    });

    return Array.from(map.entries())
      .map(([name, info]) => ({ name, count: info.count, coverUrl: info.coverUrl }))
      .sort((a, b) => b.count - a.count);
  }, [songs]);

  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tagsData;
    const q = searchQuery.toLowerCase();
    return tagsData.filter(tag => tag.name.toLowerCase().includes(q));
  }, [tagsData, searchQuery]);

  const totalTagCount = tagsData.length;

  // Color palette for tag badges
  const tagColors = [
    'bg-rose-50 text-rose-600 border-rose-200',
    'bg-blue-50 text-blue-600 border-blue-200',
    'bg-emerald-50 text-emerald-600 border-emerald-200',
    'bg-amber-50 text-amber-600 border-amber-200',
    'bg-purple-50 text-purple-600 border-purple-200',
    'bg-cyan-50 text-cyan-600 border-cyan-200',
    'bg-pink-50 text-pink-600 border-pink-200',
    'bg-indigo-50 text-indigo-600 border-indigo-200',
  ];

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Tag className="text-brand-light" /> 标签库 ({totalTagCount})
        </h2>
      </div>

      {/* Search */}
      {totalTagCount > 6 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="搜索标签..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-light focus:border-brand-light outline-none text-sm"
          />
        </div>
      )}

      {filteredTags.length > 0 ? (
        <div className="space-y-1 max-h-[calc(100vh-160px)] overflow-y-auto">
          {filteredTags.map((tag, index) => (
            <button
              key={tag.name}
              onClick={() => onTagClick(tag.name)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-slate-50 transition-all group text-left"
            >
              {/* Tag Color Badge */}
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${tagColors[index % tagColors.length]}`}>
                <Tag size={14} />
              </div>

              {/* Tag Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate group-hover:text-brand-light transition-colors">
                  {tag.name}
                </p>
                <p className="text-xs text-slate-400">{tag.count} 首歌曲</p>
              </div>

              {/* Cover Preview */}
              {tag.coverUrl && (
                <div className="w-8 h-8 rounded overflow-hidden shadow-sm flex-shrink-0">
                  <img src={tag.coverUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}

              {/* Arrow */}
              <ChevronRight size={16} className="flex-shrink-0 text-slate-300 group-hover:text-brand-light transition-colors" />
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-slate-400">
          {searchQuery.trim() ? (
            <>
              <Search className="mx-auto mb-3 text-slate-300" size={36} />
              <p className="text-sm">未找到匹配的标签</p>
            </>
          ) : (
            <>
              <Tag className="mx-auto mb-3 text-slate-300" size={36} />
              <p className="text-sm">暂无标签，给歌曲添加标签后这里会显示</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const TagLibrary = React.memo(TagLibraryComponent);
