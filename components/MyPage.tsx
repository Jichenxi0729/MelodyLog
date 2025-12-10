import React from 'react';
import { Download, UploadCloud, Music2, Users, Database, Info, User as UserIcon } from 'lucide-react';
import { Song } from '../types';
import { User as AuthUser } from '../services/authService';

interface MyPageProps {
  songs: Song[];
  onImport: () => void;
  onExport: () => void;
  user: AuthUser | null;
}

const MyPage: React.FC<MyPageProps> = ({ songs, onImport, onExport, user }) => {
  // Calculate statistics
  const totalSongs = songs.length;
  // 正确计算唯一歌手数量：从artists数组中提取所有歌手并去重
  const uniqueArtists = new Set(
    songs.flatMap(song => song.artists || [])
  ).size;
  const uniqueAlbums = new Set(
    songs.map(song => song.album).filter(album => album)
  ).size;
  
  // Calculate total play time (based on user request: 3 minutes per song)
  const totalMinutes = songs.length * 3;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="text-brand-light" size={24} />
            <h1 className="text-xl font-bold text-slate-800">我的音乐库</h1>
          </div>
        </div>
      </header>
      
      {/* User Profile */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand-light/10 flex items-center justify-center">
            {user?.user_metadata?.avatar_url ? (
              <img 
                src={user.user_metadata.avatar_url} 
                alt="用户头像" 
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <UserIcon className="text-brand-light" size={32} />
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              {user?.user_metadata?.username || user?.user_metadata?.name || user?.user_metadata?.full_name || '用户'}
            </h2>
            <p className="text-sm text-slate-500">{user?.email || ''}</p>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">歌曲总数</p>
                <h3 className="text-2xl font-bold text-slate-800">{totalSongs}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-brand-light/10 flex items-center justify-center">
                <Music2 className="text-brand-light" size={20} />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">歌手数量</p>
                <h3 className="text-2xl font-bold text-slate-800">{uniqueArtists}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="text-blue-500" size={20} />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">专辑数量</p>
                <h3 className="text-2xl font-bold text-slate-800">{uniqueAlbums}</h3>
              </div>
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Database className="text-purple-500" size={20} />
              </div>
            </div>
          </div>
        </div>
        
        {/* Total Playtime */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">总播放时长</p>
              <h3 className="text-2xl font-bold text-slate-800">
                {hours}小时{minutes}分钟
              </h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="text-green-500" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
        </div>
        
        {/* Import/Export Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">数据管理</h2>
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={onImport}
              className="flex items-center justify-between w-full p-4 bg-brand-light/5 hover:bg-brand-light/10 text-brand-light rounded-lg transition-colors border border-brand-light/20"
            >
              <div className="flex items-center gap-3">
                <UploadCloud size={20} />
                <span className="font-medium">导入音乐</span>
              </div>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
            
            <button
              onClick={onExport}
              className="flex items-center justify-between w-full p-4 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors border border-slate-200"
              disabled={songs.length === 0}
            >
              <div className="flex items-center gap-3">
                <Download size={20} />
                <span className="font-medium">导出音乐库</span>
              </div>
              <span className="text-sm text-slate-500">
                {songs.length} 首歌曲
              </span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MyPage;