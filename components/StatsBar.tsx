import React from 'react';
import { Song } from '../types';
import { Music2, Users, Disc, Tags } from 'lucide-react';

interface StatsBarProps {
  songs: Song[];
  onNavigateHome?: () => void;
  onNavigateArtists?: () => void;
  onNavigateAlbums?: () => void;
  onNavigateTags?: () => void;
}

export const StatsBar: React.FC<StatsBarProps> = ({ 
  songs, 
  onNavigateHome, 
  onNavigateArtists, 
  onNavigateAlbums, 
  onNavigateTags 
}) => {
  const totalSongs = songs.length;
  const uniqueArtists = new Set(songs.flatMap(song => song.artists || [])).size;
  const uniqueAlbums = new Set(songs.map(song => song.album).filter(Boolean)).size;
  const totalTags = new Set(songs.flatMap(song => song.tags || [])).size;

  const stats = [
    { 
      label: '歌曲', 
      value: totalSongs, 
      icon: <Music2 size={14} />, 
      onClick: onNavigateHome 
    },
    { 
      label: '歌手', 
      value: uniqueArtists, 
      icon: <Users size={14} />, 
      onClick: onNavigateArtists 
    },
    { 
      label: '专辑', 
      value: uniqueAlbums, 
      icon: <Disc size={14} />, 
      onClick: onNavigateAlbums 
    },
    { 
      label: '标签', 
      value: totalTags, 
      icon: <Tags size={14} />, 
      onClick: onNavigateTags 
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {stats.map((stat) => (
        <button
          key={stat.label}
          onClick={stat.onClick}
          className="flex items-center gap-2 py-2.5 px-3 rounded-xl bg-blue-50/80 hover:bg-blue-100/80 active:scale-[0.97] transition-all duration-200 group"
        >
          <div className="w-7 h-7 rounded-lg bg-blue-500 flex-shrink-0 flex items-center justify-center text-white group-hover:bg-blue-600 group-hover:shadow-sm transition-all">
            {stat.icon}
          </div>
          <div className="flex flex-col items-start min-w-0">
            <span className="text-base font-bold text-slate-800 leading-tight">{stat.value}</span>
            <span className="text-[10px] text-slate-500 font-medium leading-tight">{stat.label}</span>
          </div>
        </button>
      ))}
    </div>
  );
};
