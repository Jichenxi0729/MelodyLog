import React, { useState, useMemo } from 'react';
import { Song } from '../types';
import { Music2, Disc, Calendar, User, ChevronDown, ChevronUp } from 'lucide-react';

interface LyricsMatchResult {
  song: Song;
  matchingLines: { line: string; lineIndex: number }[];
}

interface LyricsSearchResultProps {
  songs: Song[];
  searchQuery: string;
  onSongClick?: (songId: string) => void;
  onArtistClick?: (artist: string) => void;
  onAlbumClick?: (album: string) => void;
}

// 高亮关键词组件
const HighlightText: React.FC<{ text: string; keyword: string }> = ({ text, keyword }) => {
  if (!keyword.trim()) return <>{text}</>;

  const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark key={index} className="bg-amber-200/80 text-amber-900 rounded-sm px-0.5 font-medium">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
};

// 歌词搜索结果卡片
const LyricsResultCard: React.FC<{
  result: LyricsMatchResult;
  keyword: string;
  onSongClick?: (songId: string) => void;
  onArtistClick?: (artist: string) => void;
  onAlbumClick?: (album: string) => void;
}> = ({ result, keyword, onSongClick, onArtistClick, onAlbumClick }) => {
  const [expanded, setExpanded] = useState(false);
  const { song, matchingLines } = result;

  // 获取完整歌词行
  const allLines = useMemo(() => {
    if (!song.lyrics) return [];
    return song.lyrics.split('\n').filter(l => l.trim());
  }, [song.lyrics]);

  // 计算匹配行附近的上下文行
  const contextLines = useMemo(() => {
    if (expanded) return allLines;
    // 未展开时显示匹配行及其上下各1行
    const contextRange = 1;
    const lineIndices = new Set<number>();
    matchingLines.forEach(m => {
      for (let i = Math.max(0, m.lineIndex - contextRange); i <= Math.min(allLines.length - 1, m.lineIndex + contextRange); i++) {
        lineIndices.add(i);
      }
    });
    return Array.from(lineIndices).sort((a, b) => a - b).map(i => allLines[i]);
  }, [expanded, allLines, matchingLines]);

  // 发行年份
  let releaseYear: number | null = null;
  if (song.releaseDate) {
    if (typeof song.releaseDate === 'string' && !isNaN(Number(song.releaseDate))) {
      const year = Number(song.releaseDate);
      if (year >= 1900 && year <= 2100) releaseYear = year;
    } else {
      const date = new Date(song.releaseDate);
      if (!isNaN(date.getTime())) releaseYear = date.getFullYear();
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
      {/* 歌曲信息头部 */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={() => onSongClick?.(song.id)}
      >
        {/* 封面 */}
        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 shadow-sm ring-1 ring-slate-100">
          <img
            src={song.coverUrl || `https://picsum.photos/seed/${song.id}/200`}
            alt={song.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>

        {/* 歌曲信息 */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800 truncate">{song.title}</h3>
          <div className="flex items-center gap-1 text-xs text-brand-light font-medium mt-0.5">
            <User size={10} />
            {song.artists.map((artist, i) => (
              <React.Fragment key={artist}>
                <span
                  onClick={(e) => { e.stopPropagation(); onArtistClick?.(artist); }}
                  className="cursor-pointer hover:underline"
                >
                  {artist}
                </span>
                {i < song.artists.length - 1 && <span className="text-slate-400">/</span>}
              </React.Fragment>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
            {song.album && (
              <span
                onClick={(e) => { e.stopPropagation(); onAlbumClick?.(song.album!); }}
                className="flex items-center gap-0.5 cursor-pointer hover:text-brand-light"
              >
                <Disc size={9} /> {song.album}
              </span>
            )}
            {releaseYear && (
              <span className="flex items-center gap-0.5">
                <Calendar size={9} /> {releaseYear}
              </span>
            )}
            <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">
              {matchingLines.length} 处匹配
            </span>
          </div>
        </div>
      </div>

      {/* 歌词预览/展开区域 */}
      <div
        className="px-3 pb-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="bg-gradient-to-br from-slate-50/80 to-amber-50/30 rounded-lg p-3 border border-slate-100/60">
          <div className="space-y-1">
            {contextLines.map((line, index) => (
              <p
                key={index}
                className={`text-sm leading-relaxed text-center ${
                  matchingLines.some(m => m.line === line)
                    ? 'text-slate-800 font-medium'
                    : 'text-slate-400'
                }`}
              >
                <HighlightText text={line} keyword={keyword} />
              </p>
            ))}
          </div>

          {/* 展开/收起按钮 */}
          {allLines.length > contextLines.length && (
            <div className="flex items-center justify-center mt-2 pt-2 border-t border-slate-200/50">
              <button className="flex items-center gap-1 text-xs text-slate-400 hover:text-brand-light transition-colors">
                {expanded ? (
                  <>
                    收起 <ChevronUp size={12} />
                  </>
                ) : (
                  <>
                    查看完整歌词 <ChevronDown size={12} />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const LyricsSearchResult: React.FC<LyricsSearchResultProps> = ({
  songs,
  searchQuery,
  onSongClick,
  onArtistClick,
  onAlbumClick,
}) => {
  // 歌词搜索结果
  const lyricsResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results: LyricsMatchResult[] = [];

    songs.forEach(song => {
      if (!song.lyrics || !song.lyrics.trim()) return;
      const lines = song.lyrics.split('\n').filter(l => l.trim());
      const matchingLines: { line: string; lineIndex: number }[] = [];

      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(q)) {
          matchingLines.push({ line, lineIndex: index });
        }
      });

      if (matchingLines.length > 0) {
        results.push({ song, matchingLines });
      }
    });

    // 按匹配数量排序
    results.sort((a, b) => b.matchingLines.length - a.matchingLines.length);
    return results;
  }, [songs, searchQuery]);

  if (lyricsResults.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <Music2 className="text-slate-300 mx-auto mb-3" size={36} />
        <p className="text-slate-500 text-sm">未找到包含该关键词的歌词</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {lyricsResults.map(result => (
        <LyricsResultCard
          key={result.song.id}
          result={result}
          keyword={searchQuery}
          onSongClick={onSongClick}
          onArtistClick={onArtistClick}
          onAlbumClick={onAlbumClick}
        />
      ))}
    </div>
  );
};
