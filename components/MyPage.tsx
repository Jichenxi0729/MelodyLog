import React from 'react';
import { Download, UploadCloud, Music2, Users, Database, User as UserIcon, FileJson, FileSpreadsheet, Tag, Clock, ChevronRight } from 'lucide-react';
import { Song } from '../types';
import { User as AuthUser } from '../services/authService';

interface MyPageProps {
  songs: Song[];
  onImport: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  user: AuthUser | null;
  onNavigateHome: () => void;
  onNavigateArtists: () => void;
  onNavigateAlbums: () => void;
  onNavigateTags: () => void;
}

const MyPage: React.FC<MyPageProps> = ({ songs, onImport, onExportCSV, onExportJSON, user, onNavigateHome, onNavigateArtists, onNavigateAlbums, onNavigateTags }) => {
  const totalSongs = songs.length;
  const uniqueArtists = new Set(songs.flatMap(song => song.artists || [])).size;
  const uniqueAlbums = new Set(songs.map(song => song.album).filter(Boolean)).size;
  const totalTags = new Set(songs.flatMap(song => song.tags || [])).size;
  const songsWithLyrics = songs.filter(song => song.lyrics && song.lyrics.trim()).length;
  const totalMinutes = songs.length * 3;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const stats = [
    { label: '歌曲', value: totalSongs, icon: <Music2 size={18} />, color: 'text-brand-light bg-brand-light/10', onClick: onNavigateHome },
    { label: '歌手', value: uniqueArtists, icon: <Users size={18} />, color: 'text-blue-500 bg-blue-50', onClick: onNavigateArtists },
    { label: '专辑', value: uniqueAlbums, icon: <Database size={18} />, color: 'text-purple-500 bg-purple-50', onClick: onNavigateAlbums },
    { label: '标签', value: totalTags, icon: <Tag size={18} />, color: 'text-pink-500 bg-pink-50', onClick: onNavigateTags },
  ];

  return (
    <div className="animate-in fade-in duration-300 space-y-5">
      {/* 用户信息 */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-brand-light/10 flex items-center justify-center flex-shrink-0">
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="头像" className="w-full h-full rounded-full object-cover" />
            ) : (
              <UserIcon className="text-brand-light" size={28} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-800 truncate">
              {user?.user_metadata?.username || user?.user_metadata?.name || user?.user_metadata?.full_name || '用户'}
            </h2>
            <p className="text-sm text-slate-400 truncate">{user?.email || ''}</p>
          </div>
        </div>
      </div>

      {/* 统计卡片 - 2x2 网格 */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map(stat => (
          <button
            key={stat.label}
            onClick={stat.onClick}
            className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 hover:shadow-md hover:border-slate-200 transition-all active:scale-[0.98] text-left w-full"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.color}`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-800">{stat.value}</p>
                  <p className="text-xs text-slate-400">{stat.label}</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-300" />
            </div>
          </button>
        ))}
      </div>

      {/* 额外统计 */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-green-500" />
            <div>
              <p className="text-sm font-semibold text-slate-800">{hours}h {minutes}m</p>
              <p className="text-[10px] text-slate-400">预估时长</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Music2 size={16} className="text-amber-500" />
            <div>
              <p className="text-sm font-semibold text-slate-800">{songsWithLyrics}/{totalSongs}</p>
              <p className="text-[10px] text-slate-400">有歌词</p>
            </div>
          </div>
        </div>
      </div>

      {/* 数据管理 */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">数据管理</h3>
        
        {/* 导入 */}
        <button
          onClick={onImport}
          className="w-full flex items-center gap-3 px-4 py-3 bg-brand-light/5 hover:bg-brand-light/10 rounded-lg transition-colors border border-brand-light/20 group"
        >
          <UploadCloud size={18} className="text-brand-light" />
          <div className="flex-1 text-left">
            <span className="text-sm font-medium text-brand-light">导入数据</span>
            <p className="text-[10px] text-slate-400">支持文本、CSV、JSON格式</p>
          </div>
        </button>

        {/* 导出 CSV */}
        <button
          onClick={onExportCSV}
          disabled={songs.length === 0}
          className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <FileSpreadsheet size={18} className="text-green-600" />
          <div className="flex-1 text-left">
            <span className="text-sm font-medium text-slate-700">导出 CSV</span>
            <p className="text-[10px] text-slate-400">基础信息，兼容表格软件</p>
          </div>
          <span className="text-xs text-slate-400">{songs.length}首</span>
        </button>

        {/* 导出 JSON */}
        <button
          onClick={onExportJSON}
          disabled={songs.length === 0}
          className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <FileJson size={18} className="text-amber-600" />
          <div className="flex-1 text-left">
            <span className="text-sm font-medium text-slate-700">导出 JSON</span>
            <p className="text-[10px] text-slate-400">完整数据，含歌词和标签</p>
          </div>
          <span className="text-xs text-slate-400">{songs.length}首</span>
        </button>
      </div>
    </div>
  );
};

export default MyPage;
