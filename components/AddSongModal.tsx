import React, { useState, useEffect } from 'react';
import { X, Music, User, Disc, Loader2, Search, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { musicApi, SongInfo } from '../services/musicApiAdapter';

interface AddSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (title: string, artist: string, album: string, coverUrl?: string, releaseDate?: string) => Promise<void>;
  songs: any[]; // 添加歌曲列表用于重复检测
}

export const AddSongModal: React.FC<AddSongModalProps> = ({ isOpen, onClose, onAdd, songs }) => {
  // 所有Hooks必须在条件返回之前调用
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  
  // 搜索相关状态
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<SongInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSong, setSelectedSong] = useState<SongInfo | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'manual'>('search'); // 默认切换到智能搜索
  const [searchError, setSearchError] = useState(''); // 搜索平台状态
  const [searchPlatform, setSearchPlatform] = useState<'itunes-domestic' | 'itunes-international' | 'netease' | 'qq'>('itunes-domestic'); // 搜索平台选择

  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setArtist('');
      setAlbum('');
      setSearchKeyword('');
      setSearchResults([]);
      setSelectedSong(null);
      setShowSearchResults(false);
      setActiveTab('search'); // 默认切换到智能搜索
      setSearchError(''); // 重置搜索错误
    }
  }, [isOpen]);

  // 条件返回必须在所有Hooks之后
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

  // 搜索歌曲
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchKeyword.trim()) return;

    // 使用选择的平台进行音乐搜索
    setIsSearching(true);
    setSearchResults([]);
    setSearchError('');
    setShowSearchResults(true); // 显示搜索结果区域

    try {
      console.log('开始搜索，平台:', searchPlatform, '关键词:', searchKeyword);
      // 使用新的API适配器，支持多种API类型
      const result = await musicApi.search({
        keyword: searchKeyword,
        apiType: searchPlatform,
        limit: 10
      });
      
      console.log('搜索结果:', result);
      setSearchResults(result);
      
      // 如果结果为空，检查是否是API类型的问题
      if (result.length === 0) {
        console.log('搜索结果为空，尝试直接测试API响应');
        
        // 直接测试Lokua_Music API响应
        if (searchPlatform === 'netease' || searchPlatform === 'qq') {
          try {
            const response = await fetch('https://lokuamusic.top/api/music', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                input: searchKeyword,
                filter: 'name',
                type: searchPlatform,
                page: 1
              })
            });
            
            if (response.ok) {
              const data = await response.json();
              console.log('直接API测试响应:', data);
            }
          } catch (apiError) {
            console.error('直接API测试失败:', apiError);
          }
        }
      }
    } catch (error) {
      console.error('搜索失败:', error);
      setSearchError('搜索失败，请重试或切换搜索平台');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 选择搜索结果
  const handleSelectSong = (song: SongInfo) => {
    setSelectedSong(song);
    setTitle(song.name);
    setArtist(song.artist);
    setAlbum(song.album);
    
    // 检查是否重复
    setIsDuplicate(checkDuplicate(song.name, song.artist));
  };

  // 确认添加
  const handleConfirmAdd = async () => {
    if (!title.trim() || !artist.trim()) return;

    // 提交前再次检查重复
    if (checkDuplicate(title, artist)) {
      setIsDuplicate(true);
      return;
    }

    setIsLoading(true);
    
    // 如果用户通过搜索选择了具体的歌曲，直接使用选择的歌曲信息
    let songTitle = title;
    let songArtist = artist;
    let coverUrl = '';
    let matchedAlbum = album;
    let releaseDate: string | undefined = undefined;
    
    if (selectedSong) {
      // 使用用户选择的歌曲信息，包括完整的标题、艺术家、专辑、封面和发行日期
      songTitle = selectedSong.name;
      songArtist = selectedSong.artist;
      coverUrl = selectedSong.coverUrl || '';
      matchedAlbum = selectedSong.album;
      releaseDate = selectedSong.releaseDate;
      console.log('使用用户选择的歌曲信息（' + 
                 (searchPlatform === 'netease' ? '网易云音乐' : 
                  searchPlatform === 'qq' ? 'QQ音乐' : 
                  searchPlatform === 'itunes-domestic' ? 'Apple Music国内版' : 'iTunes国际版') + '）');
      console.log('选择的歌曲完整信息:', {
        name: selectedSong.name,
        artist: selectedSong.artist,
        album: selectedSong.album,
        coverUrl: selectedSong.coverUrl,
        releaseDate: selectedSong.releaseDate,
        platform: selectedSong.platform
      });
    } else {
      // 只有手动输入时，才进行智能匹配
      try {
        // 先尝试国内版搜索
        const domesticResults = await musicApi.search({
          keyword: `${title} ${artist}`,
          apiType: 'itunes-domestic',
          limit: 5
        });
        
        // 严格匹配：歌名和歌手都需要匹配
        const matchedSong = domesticResults.find(song => {
          const songNameMatch = song.name.toLowerCase().includes(title.toLowerCase());
          const artistMatch = song.artist.toLowerCase().includes(artist.toLowerCase());
          return songNameMatch && artistMatch;
        });
        
        if (matchedSong) {
            // 使用国内版完全匹配到的歌曲信息
            coverUrl = matchedSong.coverUrl || '';
            // 只有当用户没有手动输入专辑时，才使用API获取的专辑信息
            if (!album.trim()) {
              matchedAlbum = matchedSong.album;
            }
            releaseDate = matchedSong.releaseDate;
            console.log('使用国内版完全匹配到的歌曲信息');
          } else {
            // 国内版没有完全匹配，使用国际版第一首歌的数据
            const internationalResults = await musicApi.search({
              keyword: `${title} ${artist}`,
              apiType: 'itunes-international',
              limit: 1
            });
            
            if (internationalResults.length > 0) {
              // 使用国际版第一首歌的信息
              const internationalSong = internationalResults[0];
              coverUrl = internationalSong.coverUrl || '';
              // 只有当用户没有手动输入专辑时，才使用API获取的专辑信息
              if (!album.trim()) {
                matchedAlbum = internationalSong.album;
              }
              releaseDate = internationalSong.releaseDate;
              console.log('使用国际版第一首歌的信息');
            } else {
              console.log('国际版也没有找到歌曲，使用用户输入的信息');
            }
          }
      } catch (error) {
        console.warn('歌曲信息匹配失败，使用用户输入的信息:', error);
      }
    }
    
    // 使用匹配到的信息或用户输入的信息
    await onAdd(songTitle, songArtist, matchedAlbum, coverUrl, releaseDate);
    setIsLoading(false);
    
    // 重置状态
    setTitle('');
    setArtist('');
    setAlbum('');
    setSearchKeyword('');
    setSearchResults([]);
    setSelectedSong(null);
    setShowSearchResults(false);
    onClose();
  };

  // 手动提交
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleConfirmAdd();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
        
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

        {/* 标签页切换 */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'search' 
                ? 'text-brand-light border-b-2 border-brand-light' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            智能搜索
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'manual' 
                ? 'text-brand-light border-b-2 border-brand-light' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            手动输入
          </button>
        </div>

        <div className="p-6 max-h-96 overflow-y-auto">
          {activeTab === 'search' ? (
            <>
              {/* 搜索区域 */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">搜索歌曲</label>
                  
                  {/* 平台选择 */}
                  <div className="space-y-2">
                    {/* 主要API平台选择 */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                    type="button"
                    onClick={() => setSearchPlatform('itunes-domestic')}
                    className={`py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                      searchPlatform === 'itunes-domestic' 
                        ? 'bg-brand-light text-white' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    苹果音乐
                    <div className="text-xs opacity-80 mt-1">国内版</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchPlatform('itunes-international')}
                    className={`py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                      searchPlatform === 'itunes-international' 
                        ? 'bg-brand-light text-white' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    苹果音乐
                    <div className="text-xs opacity-80 mt-1">国际版</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchPlatform('netease')}
                    className={`py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                      searchPlatform === 'netease' 
                        ? 'bg-brand-light text-white' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    网易云音乐
                    <div className="text-xs opacity-80 mt-1">官方API</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchPlatform('qq')}
                    className={`py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                      searchPlatform === 'qq' 
                        ? 'bg-brand-light text-white' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    QQ音乐
                    <div className="text-xs opacity-80 mt-1">官方API</div>
                  </button>
                    </div>
                    

                  </div>
                  
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch(e as any)}
                        placeholder="输入歌曲名、歌手名或关键词..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-light focus:border-brand-light outline-none transition-all"
                      />
                    </div>
                    <button
                      onClick={(e) => handleSearch(e)}
                      disabled={isSearching || !searchKeyword.trim()}
                      className="px-6 bg-brand-light hover:bg-blue-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSearching ? <Loader2 className="animate-spin" size={16} /> : '搜索'}
                    </button>
                  </div>
                </div>

                {/* 搜索结果 */}
                {showSearchResults && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">搜索结果</span>
                      <button 
                        onClick={() => setShowSearchResults(!showSearchResults)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        {showSearchResults ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                    
                    {isSearching ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="animate-spin text-brand-light" size={24} />
                      </div>
                    ) : searchResults.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {searchResults.map((song) => (
                          <div
                            key={song.id}
                            onClick={() => handleSelectSong(song)}
                            className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-brand-light hover:bg-blue-50 ${
                              selectedSong?.id === song.id ? 'border-brand-light bg-blue-50' : 'border-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {/* 封面图片 */}
                              {song.coverUrl ? (
                                <img
                                  src={song.coverUrl}
                                  alt={`${song.name} cover`}
                                  className="w-10 h-10 rounded object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded bg-slate-200 flex items-center justify-center flex-shrink-0">
                                    <Music className="text-slate-400" size={16} />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-medium text-slate-800 truncate">
                      {song.name} · <span className="text-blue-600">{song.artist}</span>
                    </div>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {searchPlatform === 'itunes-domestic' ? 'Apple Music' : 
                       searchPlatform === 'itunes-international' ? 'iTunes国际版' :
                       searchPlatform === 'netease' ? '网易云音乐' :
                       searchPlatform === 'qq' ? 'QQ音乐' : '未知平台'}
                    </span>
                  </div>
                  <div className={`text-xs truncate ${song.album.includes('未知专辑') || song.album.includes('单曲') ? 'text-gray-400 italic' : 'text-slate-500'}`}>
                    {song.album}
                  </div>
                </div>
                              {selectedSong && selectedSong.id === song.id && (
                                <Check className="text-brand-light flex-shrink-0" size={16} />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        未找到相关歌曲，请尝试其他关键词
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* 手动输入区域 */}
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">歌曲信息</label>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Music size={16} className="text-slate-400" />
                        <span className="text-sm text-slate-600">歌曲名</span>
                      </div>
                      <input
                        type="text"
                        value={title}
                        onChange={handleTitleChange}
                        placeholder="输入歌曲名称"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-light focus:border-brand-light outline-none transition-all"
                      />
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <User size={16} className="text-slate-400" />
                        <span className="text-sm text-slate-600">歌手</span>
                      </div>
                      <input
                        type="text"
                        value={artist}
                        onChange={handleArtistChange}
                        placeholder="输入歌手名称"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-light focus:border-brand-light outline-none transition-all"
                      />
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Disc size={16} className="text-slate-400" />
                        <span className="text-sm text-slate-600">专辑</span>
                      </div>
                      <input
                        type="text"
                        value={album}
                        onChange={(e) => setAlbum(e.target.value)}
                        placeholder="输入专辑名称（可选）"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-light focus:border-brand-light outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* 重复检测 */}
                  {isDuplicate && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-red-700">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm font-medium">检测到重复歌曲</span>
                      </div>
                      <p className="text-red-600 text-xs mt-1">歌曲列表中已存在相同歌曲，请确认是否要重复添加</p>
                    </div>
                  )}
                </div>
              </form>
            </>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 text-slate-600 hover:text-slate-800 font-medium rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirmAdd}
            disabled={isLoading || !title.trim() || !artist.trim() || isDuplicate}
            className="px-6 py-2 bg-brand-light hover:bg-blue-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="animate-spin" size={16} />
                添加中...
              </div>
            ) : (
              '添加歌曲'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};