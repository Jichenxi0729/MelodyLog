import React, { useState } from 'react';
import { X, Music, User, Disc, Loader2 } from 'lucide-react';

interface AddSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (title: string, artist: string, album: string) => Promise<void>;
  songs: any[]; // 添加歌曲列表用于重复检测
}

export const AddSongModal: React.FC<AddSongModalProps> = ({ isOpen, onClose, onAdd, songs }) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);

  if (!isOpen) return null;

  // 检查歌曲是否重复
  const checkDuplicate = (songTitle: string, songArtist: string) => {
    const artists = songArtist.split(/[,，、\/]/).map(a => a.trim()).filter(a => a.length > 0);
    
    return songs.some(song => {
      const titleMatch = song.title.toLowerCase() === songTitle.toLowerCase();
      const artistMatch = song.artists.some(artist => 
        artists.some(a => artist.toLowerCase() === a.toLowerCase())
      );
      return titleMatch && artistMatch;
    });
  };

  // 处理输入变化，实时检测重复
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (newTitle.trim() && artist.trim()) {
      setIsDuplicate(checkDuplicate(newTitle, artist));
    } else {
      setIsDuplicate(false);
    }
  };

  const handleArtistChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newArtist = e.target.value;
    setArtist(newArtist);
    if (title.trim() && newArtist.trim()) {
      setIsDuplicate(checkDuplicate(title, newArtist));
    } else {
      setIsDuplicate(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !artist.trim()) return;

    // 提交前再次检查重复
    if (checkDuplicate(title, artist)) {
      setIsDuplicate(true);
      return;
    }

    setIsLoading(true);
    await onAdd(title, artist, album);
    setIsLoading(false);
    
    // Reset and close
    setTitle('');
    setArtist('');
    setAlbum('');
    setIsDuplicate(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-brand-dark px-6 py-4 flex justify-between items-center">
          <h2 className="text-white text-lg font-semibold">记录新音乐</h2>
          <button 
            onClick={onClose} 
            className="text-white/70 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">歌名 <span className="text-red-500">*</span></label>
            <div className="relative">
              <Music className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={title}
                onChange={handleTitleChange}
                placeholder="例如：七里香"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-light focus:border-brand-light outline-none transition-all"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">歌手 <span className="text-red-500">*</span></label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={artist}
                onChange={handleArtistChange}
                placeholder="例如：周杰伦（多个歌手用逗号分隔）"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-light focus:border-brand-light outline-none transition-all"
                required
              />
            </div>
            {isDuplicate && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center text-red-700">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">歌曲已存在！请勿重复添加相同的歌曲。</span>
                </div>
              </div>
            )}
          </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">专辑 <span className="text-slate-400 text-xs">(选填)</span></label>
          <div className="relative">
            <Disc className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={album}
              onChange={(e) => setAlbum(e.target.value)}
              placeholder="例如：七里香"
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-light focus:border-brand-light outline-none transition-all"
            />
          </div>
        </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-6 bg-brand-light hover:bg-blue-500 text-white font-semibold py-3 rounded-lg shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : '保存记录'}
          </button>

        </form>
      </div>
    </div>
  );
};