import React, { useState, useEffect, useMemo, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { useNavigate } from 'react-router-dom';
import { Song } from '../types';
import { fetchLyrics, addCustomLyrics, searchLyricsByTitle, fetchLyricsById, saveLyricsToSupabase, convertToSimplified } from '../services/lyricsService';
import { ArrowLeft, Share2, Plus, Pencil, Search, Tag } from 'lucide-react';
import { LyricsEditor } from './LyricsEditor';
import { getTagsNameList, addTagToHistory } from '../utils/tagUtils';

// 添加全局动画样式
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes slide-up {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  @keyframes slide-in {
    from {
      transform: translateX(20px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slide-out {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(20px);
      opacity: 0;
    }
  }
  
  .animate-slide-up {
    animation: slide-up 0.3s ease-out;
  }
  
  .animate-fade-in {
    animation: fade-in 0.3s ease-out;
  }
  
  .animate-slide-in {
    animation: slide-in 0.3s ease-out;
  }
  
  .animate-slide-out {
    animation: slide-out 0.3s ease-out;
  }
  
  .animate-pulse {
    animation: pulse 0.5s ease-in-out;
  }
  
  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }
`;
document.head.appendChild(styleSheet);

interface SongDetailProps {
  songs: Song[];
  songId: string;
  onBack: () => void;
  onArtistClick?: (artist: string) => void;
  onAlbumClick?: (album: string) => void;
  onUpdateSong?: (updatedSong: Song) => void;
  onTagClick?: (tag: string) => void;
}

export const SongDetail: React.FC<SongDetailProps> = ({ songs, songId, onBack, onArtistClick, onAlbumClick, onUpdateSong, onTagClick }) => {
  // 使用props传入的songId而不是从URL参数获取
  const navigate = useNavigate();
  // 状态管理
  const [song, setSong] = useState<Song | null>(null);
  const [lyrics, setLyrics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true); // 初始加载状态
  const [buttonLoading, setButtonLoading] = useState(false); // 按钮点击加载状态
  const [selectedLyrics, setSelectedLyrics] = useState<string[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSavedLyrics, setShowSavedLyrics] = useState(false);
  const [savedLyrics, setSavedLyrics] = useState<string[][]>([]); // 改为二维数组，每个子数组代表一组歌词
  const [lyricsViewMode, setLyricsViewMode] = useState<'saved' | 'recommended'>('recommended'); // 歌词视图模式
  const [recommendedLyrics, setRecommendedLyrics] = useState<string[][]>([]); // 推荐的歌词组
  const [isLongPressing, setIsLongPressing] = useState<Record<string, boolean>>({});
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // 编辑状态
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedArtists, setEditedArtists] = useState<string[]>([]);
  const [editedAlbum, setEditedAlbum] = useState('');
  const [editedCoverUrl, setEditedCoverUrl] = useState('');
  const [editedReleaseDate, setEditedReleaseDate] = useState('');
  const [editedTags, setEditedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [showTagsHistory, setShowTagsHistory] = useState(false);
  
  // 歌词编辑器状态
  const [showLyricsEditor, setShowLyricsEditor] = useState(false);
  
  // 歌词搜索状态
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // 响应式处理
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 仅在songId变化时运行，用于获取歌曲详情和初始歌词
  useEffect(() => {
    if (songId) {
      const foundSong = songs.find(s => s.id === songId);
      if (foundSong) {
        setSong(foundSong);
        // 初始化编辑状态
        setEditedTitle(foundSong.title);
        setEditedArtists([...foundSong.artists]);
        setEditedAlbum(foundSong.album || '');
        setEditedCoverUrl(foundSong.coverUrl || '');
        setEditedReleaseDate(foundSong.releaseDate || '');
        setEditedTags(foundSong.tags || []);
        
        // 加载歌词
        const loadLyrics = async () => {
          try {
            setLoading(true);
            // 使用第一位歌手信息来匹配正确的歌词
            const artist = foundSong.artists[0];
            const lyricsData = await fetchLyrics(foundSong.id, foundSong.title, artist);
            setLyrics(lyricsData);
            // 生成推荐歌词
            const recommended = generateRecommendedLyrics(lyricsData);
            setRecommendedLyrics(recommended);
          } catch (error) {
            console.error('Failed to load lyrics:', error);
          } finally {
            setLoading(false);
          }
        };
        loadLyrics();
        
        // 加载保存的歌词
        try {
          const saved = localStorage.getItem(`savedLyrics_${songId}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            // 兼容旧格式：如果是一维数组，转换为二维数组
            if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
              setSavedLyrics([parsed]);
              setShowSavedLyrics(true); // 有收藏歌词时自动显示
            } else if (Array.isArray(parsed) && parsed.length > 0) {
              setSavedLyrics(parsed);
              setShowSavedLyrics(true); // 有收藏歌词时自动显示
            }
          }
        } catch (error) {
          console.error('解析保存的歌词失败:', error);
          localStorage.removeItem(`savedLyrics_${songId}`);
        }
      }
    }
  }, [songId]);
  
  // 当songs变化时，仅更新当前歌曲信息，不重新获取歌词
  useEffect(() => {
    if (songId) {
      const foundSong = songs.find(s => s.id === songId);
      if (foundSong) {
        setSong(foundSong);
      }
    }
  }, [songId, songs]);
  
  // 使用props传入的onBack函数，不再使用navigate(-1)

  // 编辑功能函数 - 使用useCallback优化
  const handleEdit = useCallback(() => {
    if (song) {
      setIsEditing(true);
      setEditedTitle(song.title);
      setEditedArtists([...song.artists]);
      setEditedAlbum(song.album || '');
      setEditedCoverUrl(song.coverUrl || '');
      setEditedReleaseDate(song.releaseDate || '');
      setEditedTags(song.tags || []);
    }
  }, [song]);

  const handleSave = useCallback(async () => {
    if (song && onUpdateSong) {
      const updatedSong = {
        ...song,
        title: editedTitle,
        artists: editedArtists,
        album: editedAlbum,
        coverUrl: editedCoverUrl,
        releaseDate: editedReleaseDate,
        tags: editedTags
      };
      setSong(updatedSong);
      onUpdateSong(updatedSong);
      setIsEditing(false);
      
      // 重新获取歌词，因为歌曲信息可能变化了
      try {
        setLoading(true);
        const artist = updatedSong.artists[0];
        const lyricsData = await fetchLyrics(updatedSong.id, updatedSong.title, artist);
        setLyrics(lyricsData);
        // 重新生成推荐歌词
        const recommended = generateRecommendedLyrics(lyricsData);
        setRecommendedLyrics(recommended);
      } catch (error) {
        console.error('Failed to load lyrics after update:', error);
      } finally {
        setLoading(false);
      }
    }
  }, [song, editedTitle, editedArtists, editedAlbum, editedCoverUrl, editedReleaseDate, editedTags, onUpdateSong]);

  const handleCancel = () => {
    setIsEditing(false);
    if (song) {
      setEditedTitle(song.title);
      setEditedArtists([...song.artists]);
      setEditedAlbum(song.album || '');
      setEditedCoverUrl(song.coverUrl || '');
      setEditedReleaseDate(song.releaseDate || '');
      setEditedTags(song.tags || []);
    }
  };
  
  // 标签颜色数组 - 温暖柔和的纯色背景和文字颜色
  interface TagColor {
    bg: string;
    text: string;
  }
  
  const tagColors: TagColor[] = [
    { bg: 'bg-pink-50', text: 'text-pink-600' },
    { bg: 'bg-amber-50', text: 'text-amber-600' },
    { bg: 'bg-lime-50', text: 'text-lime-600' },
    { bg: 'bg-sky-50', text: 'text-sky-600' },
    { bg: 'bg-violet-50', text: 'text-violet-600' },
    { bg: 'bg-orange-50', text: 'text-orange-600' },
  ];
  
  // 获取标签颜色
  const getTagColor = (index: number) => {
    return tagColors[index % tagColors.length];
  };
  
  // 标签功能
  const handleAddTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (newTag.trim() && !editedTags.includes(newTag.trim())) {
      const colorIndex = editedTags.length % 6;
      addTagToHistory(newTag.trim(), colorIndex);
      setEditedTags([...editedTags, newTag.trim()]);
      setNewTag('');
      setShowTagsHistory(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditedTags(editedTags.filter(tag => tag !== tagToRemove));
  };

  // 从匹配的标签中选择
  const handleSelectFromMatchedTags = (tagName: string) => {
    if (!editedTags.includes(tagName)) {
      const colorIndex = editedTags.length % 6;
      addTagToHistory(tagName, colorIndex);
      setEditedTags([...editedTags, tagName]);
    }
    setNewTag('');
  };

  // 处理艺术家变化
  const handleArtistChange = (index: number, value: string) => {
    const newArtists = [...editedArtists];
    newArtists[index] = value;
    setEditedArtists(newArtists);
  };

  // 添加新的艺术家
  const handleAddArtist = () => {
    setEditedArtists([...editedArtists, '']);
  };

  // 删除艺术家
  const handleRemoveArtist = (index: number) => {
    if (editedArtists.length > 1) {
      const newArtists = editedArtists.filter((_, i) => i !== index);
      setEditedArtists(newArtists);
    }
  };

  const handleShare = () => {
    setShowShareModal(true);
  };
  
  // 实现海报下载功能
  const handleDownloadPoster = () => {
    // 找到海报预览元素
    const posterElement = document.querySelector('.aspect-\[3\/4\].w-full') as HTMLElement;
    
    if (posterElement) {
      // 使用html2canvas将海报元素转换为图片
      html2canvas(posterElement, {
        scale: 2, // 提高图片质量
        useCORS: true, // 允许跨域图片
        allowTaint: true,
        backgroundColor: null
      }).then(canvas => {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.href = dataUrl;
          downloadLink.download = `${song?.title || 'song'}_poster.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        } catch (error) {
          console.error('下载海报失败:', error);
          alert('下载海报时发生错误，请稍后再试。');
        }
      }).catch(error => {
        console.error('生成海报图片失败:', error);
        alert('生成海报图片时发生错误，请稍后再试。');
      });
    } else {
      console.error('未找到海报元素');
      alert('无法找到海报元素，请稍后再试。');
    }
    
    // 关闭模态框
    setShowShareModal(false);
  };

  const handleSaveLyrics = () => {
    if (selectedLyrics.length > 0 && songId) {
      // 检查当前选中的歌词组是否已经完全保存过
      const isAlreadySaved = savedLyrics.some(savedGroup => 
        savedGroup.length === selectedLyrics.length &&
        selectedLyrics.every(line => savedGroup.includes(line))
      );

      if (isAlreadySaved) {
        // 显示已保存过的提示
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-yellow-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-slide-in';
        notification.textContent = '这个歌词组合已经保存过了';
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.classList.add('animate-slide-out');
          setTimeout(() => notification.remove(), 300);
        }, 2000);
      } else {
        // 将当前选中的歌词组添加到已保存列表中
        const updatedSavedLyrics = [...savedLyrics, [...selectedLyrics]];
        setSavedLyrics(updatedSavedLyrics);
        
        // 保存到本地存储
        localStorage.setItem(`savedLyrics_${songId}`, JSON.stringify(updatedSavedLyrics));
        
        // 显示成功提示
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-slide-in';
        notification.textContent = `已保存 1 组歌词`;
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.classList.add('animate-slide-out');
          setTimeout(() => notification.remove(), 300);
        }, 2000);
      }
      
      setSelectedLyrics([]);
    }
  };
  
  // 处理删除整个歌词组
  const handleDeleteSavedLyricGroup = (indexToDelete: number) => {
    const updatedSavedLyrics = savedLyrics.filter((_, index) => index !== indexToDelete);
    setSavedLyrics(updatedSavedLyrics);
    
    // 更新本地存储
    localStorage.setItem(`savedLyrics_${songId}`, JSON.stringify(updatedSavedLyrics));
    
    // 显示删除成功提示
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-slide-in';
    notification.textContent = '歌词组已删除';
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('animate-slide-out');
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  };

  // 处理删除所有歌词
  const handleDeleteAllLyrics = () => {
    setSavedLyrics([]);
    
    // 更新本地存储
    localStorage.setItem(`savedLyrics_${songId}`, JSON.stringify([]));
    
    // 显示删除成功提示
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-slide-in';
    notification.textContent = '所有歌词已删除';
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('animate-slide-out');
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  };

  // 生成推荐歌词
  const generateRecommendedLyrics = (fullLyrics: string[]) => {
    // 过滤掉太短的歌词和纯标点符号
    const validLyrics = fullLyrics.filter(lyric => {
      const trimmed = lyric.trim();
      return trimmed.length > 5 && !/^[\s\p{P}]+$/u.test(trimmed);
    });

    if (validLyrics.length === 0) {
      return [];
    }

    const recommended: string[][] = [];
    const maxGroups = 2; // 最多生成2组
    const usedRanges = new Set<string>(); // 记录已使用的歌词范围，避免重复

    for (let i = 0; i < maxGroups && recommended.length < maxGroups; i++) {
      // 随机选择2-3句连续的歌词
      const groupSize = Math.floor(Math.random() * 2) + 2; // 2-3句
      
      // 确保起始位置不会导致越界
      const maxStartIndex = validLyrics.length - groupSize;
      if (maxStartIndex < 0) break;

      let startIndex;
      let rangeKey;
      let isRangeUsed;

      // 尝试找到一个未使用的范围
      do {
        startIndex = Math.floor(Math.random() * (maxStartIndex + 1));
        rangeKey = `${startIndex}-${startIndex + groupSize - 1}`;
        isRangeUsed = usedRanges.has(rangeKey);
      } while (isRangeUsed && usedRanges.size < validLyrics.length - groupSize + 1);

      // 如果所有范围都被使用了，就退出循环
      if (isRangeUsed) break;

      // 标记这个范围为已使用
      usedRanges.add(rangeKey);

      // 提取连续的歌词组
      const group = validLyrics.slice(startIndex, startIndex + groupSize).map(lyric => lyric.trim());

      if (group.length >= 2) {
        recommended.push(group);
      }
    }

    return recommended;
  };

  // 处理保存自定义歌词
  const handleSaveCustomLyrics = async (lyricsText: string, isLRC: boolean) => {
    if (!song) return;
    
    try {
      const artistName = song.artists[0];
      const result = await addCustomLyrics(song.id, song.title, artistName, lyricsText, isLRC);
      
      if (result.success) {
        // 重新获取歌词以更新显示
        const newLyrics = await fetchLyrics(song.id, song.title, artistName);
        setLyrics(newLyrics);
        
        // 显示成功提示
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-slide-in';
        notification.textContent = result.message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.classList.add('animate-slide-out');
          setTimeout(() => notification.remove(), 300);
        }, 2000);
      } else {
        // 显示错误提示
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-slide-in';
        notification.textContent = result.message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.classList.add('animate-slide-out');
          setTimeout(() => notification.remove(), 300);
        }, 2000);
      }
    } catch (error) {
      console.error('保存歌词失败:', error);
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-slide-in';
      notification.textContent = '保存歌词失败，请重试';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.classList.add('animate-slide-out');
        setTimeout(() => notification.remove(), 300);
      }, 2000);
    }
  };
  
  // 处理搜索歌词 - 使用useCallback优化
  const handleSearchLyrics = useCallback(async () => {
    if (!song) return;
    
    try {
      setSearchLoading(true);
      setSearchResults([]);
      setShowSearchModal(true);
      
      const artistName = song.artists[0]; // 使用真实的歌手名
      const results = await searchLyricsByTitle(song.title, artistName, true); // 直接进行模糊搜索
      setSearchResults(results);
    } catch (error) {
      console.error('搜索歌词失败:', error);
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-slide-in';
      notification.textContent = '搜索歌词失败，请重试';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.classList.add('animate-slide-out');
        setTimeout(() => notification.remove(), 300);
      }, 2000);
    } finally {
      setSearchLoading(false);
    }
  }, [song]);
  
  // 处理选择歌词 - 使用useCallback优化
  const handleSelectLyrics = useCallback(async (result: any) => {
    if (!song) return;
    
    try {
      setButtonLoading(true);
      
      // 直接使用搜索结果中的歌词数据
      if (result && result.plainLyrics) {
        // 将纯文本歌词按行分割
        const lines = result.plainLyrics.split('\n')
          .map((line: string) => convertToSimplified(line.trim()))
          .filter((line: string) => line.length > 0);
        
        setLyrics(lines);
        setShowSearchModal(false);
        
        // 保存到Supabase
        const artistName = song.artists[0];
        await saveLyricsToSupabase(song.id, song.title, artistName, lines.join('\n'), 'lrclib');
        
        // 显示成功提示
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-slide-in';
        notification.textContent = '歌词获取成功';
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.classList.add('animate-slide-out');
          setTimeout(() => notification.remove(), 300);
        }, 2000);
      } else {
        throw new Error('歌词数据格式错误');
      }
    } catch (error) {
      console.error('获取歌词失败:', error);
      const notification = document.createElement('div');
      notification.className = 'fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-slide-in';
      notification.textContent = '获取歌词失败，请重试';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.classList.add('animate-slide-out');
        setTimeout(() => notification.remove(), 300);
      }, 2000);
    } finally {
      setButtonLoading(false);
    }
  }, [song]);

  // 取消选中歌词
  const handleClearSelection = useCallback(() => {
    setSelectedLyrics([]);
  }, []);

  if (!song) {
    return (
      <div className="flex items-center justify-center h-screen bg-brand-bg text-gray-800">
        <div className="text-center">
          <p className="text-xl mb-4">歌曲未找到</p>
          <button 
            onClick={onBack} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-800">

      <main className="pt-2 pb-10 px-0.5 max-w-3xl mx-auto">
        {/* 返回按钮和分享按钮 */}
        <div className="flex justify-between items-center mb-4">
          <button 
            onClick={onBack}
            className="flex items-center gap-1 text-slate-500 hover:text-brand-light text-sm font-medium transition-colors"
          >
            <ArrowLeft size={16} /> 返回
          </button>
          <button 
            onClick={handleShare}
            className="flex items-center gap-1 text-slate-500 hover:text-brand-light text-sm font-medium transition-colors"
          >
            <Share2 size={16} /> 分享
          </button>
        </div>

        {/* 歌曲信息卡片 */}
        <section className="mb-4 bg-blue-50/20 rounded-xl p-3 shadow-md transform hover:shadow-lg transition-shadow duration-300">
          <div className="flex flex-row items-center gap-3">
            <div className="relative">
              <div className="w-28 h-28 md:w-36 md:h-36 rounded-lg overflow-hidden shadow-md">
                <img 
                  src={song.coverUrl || 'https://via.placeholder.com/200'} 
                  alt={`${song.title} by ${song.artists.join('/')}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
            <div className="text-left flex-1">
              {isEditing ? (
                // 编辑模式
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="text-lg md:text-xl font-bold mb-1 text-gray-900 tracking-tight w-full border-b border-gray-300 focus:border-blue-500 focus:outline-none pb-1"
                  />
                  
                  <div className="space-y-2">
                    {editedArtists.map((artist, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={artist}
                          onChange={(e) => handleArtistChange(index, e.target.value)}
                          className="text-base text-blue-600 mb-2 font-medium w-full border-b border-gray-300 focus:border-blue-500 focus:outline-none pb-1"
                        />
                        {editedArtists.length > 1 && (
                          <button
                            onClick={() => handleRemoveArtist(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={handleAddArtist}
                      className="text-blue-500 hover:text-blue-700 text-sm"
                    >
                      + 添加艺术家
                    </button>
                  </div>
                  
                  <input
                    type="text"
                    value={editedAlbum}
                    onChange={(e) => setEditedAlbum(e.target.value)}
                    placeholder="专辑名称"
                    className="text-xs text-gray-500 mb-1 w-full border-b border-gray-300 focus:border-blue-500 focus:outline-none pb-1"
                  />

                  <input
                    type="text"
                    value={editedCoverUrl}
                    onChange={(e) => setEditedCoverUrl(e.target.value)}
                    placeholder="封面图片URL"
                    className="text-xs text-gray-500 mb-1 w-full border-b border-gray-300 focus:border-blue-500 focus:outline-none pb-1"
                  />

                  <input
                    type="text"
                    value={editedReleaseDate}
                    onChange={(e) => setEditedReleaseDate(e.target.value)}
                    placeholder="发行日期 (YYYY-MM-DD)"
                    className="text-xs text-gray-500 mb-1 w-full border-b border-gray-300 focus:border-blue-500 focus:outline-none pb-1"
                  />
                  
                  {/* 标签编辑 */}
                  <div className="mt-2">
                    <div className="flex gap-2 flex-wrap mb-2">
                      {editedTags.map((tag, index) => {
                        const colors = getTagColor(index);
                        const borderColor = colors.text.replace('text-', 'border-');
                        return (
                          <span key={index} className={`inline-flex items-center gap-1 px-2 py-1 ${colors.bg} ${colors.text} ${borderColor} border rounded-full text-xs`}>
                            {tag}
                            <button
                              onClick={() => handleRemoveTag(tag)}
                              className={`${colors.text} opacity-60 hover:opacity-100`}
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                    <form onSubmit={handleAddTag} className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onFocus={() => setShowTagsHistory(true)}
                          placeholder="添加记忆标签..."
                          className="w-full text-xs px-2 py-1 bg-gray-100 border border-gray-200 rounded-full focus:border-amber-300 focus:outline-none"
                        />
                        {/* 智能匹配标签下拉列表 */}
                        {showTagsHistory && getTagsNameList().length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
                            <div className="sticky top-0 bg-gray-50 px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                              <Tag className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-500">已有标签</span>
                            </div>
                            <div className="py-1">
                              {getTagsNameList()
                                .filter(tagName => !editedTags.includes(tagName))
                                .filter(tagName => newTag === '' || tagName.includes(newTag))
                                .slice(0, 10)
                                .map((tagName, idx) => {
                                  const tagColorOptions = [
                                    { bg: 'bg-pink-50', text: 'text-pink-700' },
                                    { bg: 'bg-amber-50', text: 'text-amber-700' },
                                    { bg: 'bg-lime-50', text: 'text-lime-700' },
                                    { bg: 'bg-sky-50', text: 'text-sky-700' },
                                    { bg: 'bg-purple-50', text: 'text-purple-700' },
                                    { bg: 'bg-orange-50', text: 'text-orange-700' }
                                  ];
                                  const color = tagColorOptions[idx % tagColorOptions.length];
                                  return (
                                    <button
                                      key={tagName}
                                      type="button"
                                      onClick={() => handleSelectFromMatchedTags(tagName)}
                                      className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${color.text}`}
                                    >
                                      {tagName}
                                    </button>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        type="submit"
                        disabled={!newTag.trim()}
                        className="px-3 py-1 bg-pink-500 text-white rounded-full text-xs hover:bg-pink-600 disabled:opacity-50"
                      >
                        添加
                      </button>
                    </form>
                    {/* 点击其他地方关闭历史标签列表 */}
                    {showTagsHistory && (
                      <div 
                        className="fixed inset-0 z-0" 
                        onClick={() => setShowTagsHistory(false)}
                      />
                    )}
                  </div>
                  
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleSave}
                      className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs"
                    >
                      保存
                    </button>
                    <button
                      onClick={handleCancel}
                      className="px-3 py-1 bg-gray-300 text-gray-700 rounded-full text-xs"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                // 查看模式
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg md:text-xl font-bold mb-1 text-gray-900 tracking-tight">{song.title}</h1>
                    <button
                      onClick={handleEdit}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="text-base text-blue-600 mb-2 font-medium">
                    {song.artists.map((artist, index) => (
                      <React.Fragment key={artist}>
                        <span 
                          onClick={() => onArtistClick?.(artist)}
                          className="cursor-pointer hover:underline hover:text-blue-700"
                          title={`查看 ${artist} 的详情`}
                        >
                          {artist}
                        </span>
                        {index < song.artists.length - 1 && <span className="text-blue-600">/</span>}
                      </React.Fragment>
                    ))}
                  </div>
                  
                  {song.album && (
                    <p className="text-xs text-gray-500 mb-1">
                      专辑: 
                      <span 
                        onClick={() => onAlbumClick?.(song.album!)}
                        className="text-gray-700 cursor-pointer hover:underline hover:text-gray-900"
                        title={`查看专辑: ${song.album}`}
                      >
                        {song.album}
                      </span>
                    </p>
                  )}
                  
                  {song.releaseDate && (() => {
                    let releaseYear;
                    if (typeof song.releaseDate === 'string' && !isNaN(Number(song.releaseDate))) {
                      releaseYear = Number(song.releaseDate);
                    } else {
                      releaseYear = new Date(song.releaseDate).getFullYear();
                    }
                    return !isNaN(releaseYear) && (
                      <p className="text-xs text-gray-500 mb-1">
                        发行日期: <span className="text-gray-700">{releaseYear}</span>
                      </p>
                    );
                  })()}
                  
                  {/* 标签显示 */}
                  {song.tags && song.tags.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-2">
                      {song.tags.map((tag, index) => {
                        const colors = getTagColor(index);
                        const borderColor = colors.text.replace('text-', 'border-');
                        return (
                          <button
                            key={index}
                            onClick={() => onTagClick && onTagClick(tag)}
                            className={`inline-flex items-center px-3 py-1 ${colors.bg} ${colors.text} ${borderColor} border rounded-full text-xs cursor-pointer hover:opacity-80 transition-opacity`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 mr-1 ${colors.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        </section>

        {/* 歌词区域 */}
        <section className="bg-blue-50/20 rounded-xl p-3 shadow-md mb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {lyricsViewMode === 'saved' ? '我喜欢的歌词' : '推荐歌词'}
            </h2>
            <div className="flex items-center gap-4">
              {lyricsViewMode === 'saved' && (
                <span className="text-xs text-gray-500">{savedLyrics.length} 组</span>
              )}
              <div className="flex gap-2">
                <button 
                  onClick={() => setLyricsViewMode('saved')}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${lyricsViewMode === 'saved' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                  我的
                </button>
                <button 
                  onClick={() => setLyricsViewMode('recommended')}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${lyricsViewMode === 'recommended' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                  推荐
                </button>
              </div>
            </div>
          </div>
          
          {/* 我喜欢的歌词 */}
          {lyricsViewMode === 'saved' && (
            savedLyrics.length > 0 ? (
              <div className="space-y-4">
                {/* 显示所有保存的歌词组 */}
                <div className="space-y-4">
                  {savedLyrics.map((lyricGroup, groupIndex) => (
                    <div key={groupIndex} className="relative group">
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-xl transition-all duration-300 hover:shadow-md text-center text-sm">
                        「{lyricGroup.join('，')}。」
                      </p>
                      <button 
                        onClick={() => handleDeleteSavedLyricGroup(groupIndex)}
                        className="absolute top-2 right-2 p-2 rounded-full bg-gray-100 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                        title="删除这个歌词组"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {savedLyrics.length > 1 && (
                    <button 
                      onClick={handleDeleteAllLyrics}
                      className="w-full mt-2 text-red-600 hover:text-red-700 text-center py-2 rounded-lg bg-red-50 hover:bg-red-100 transition-colors text-xs"
                    >
                      删除所有歌词组
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center text-gray-500 py-10 gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-gray-600">还没有保存喜欢的歌词</h3>
                <p className="text-xs">选择歌词后点击"收藏"按钮，将喜欢的歌词收藏起来</p>
              </div>
            )
          )}
          
          {/* 推荐歌词 */}
          {lyricsViewMode === 'recommended' && (
            <>
              {recommendedLyrics.length > 0 ? (
                <div className="space-y-4">
                  <div className="space-y-4">
                    {recommendedLyrics.map((lyricGroup, groupIndex) => (
                      <div key={groupIndex} className="relative group">
                        <p className="text-gray-700 bg-gray-50 p-3 rounded-xl transition-all duration-300 hover:shadow-md text-center text-sm">
                          「{lyricGroup.join('，')}。」
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="text-center">
                    <button 
                      onClick={() => {
                        const newRecommended = generateRecommendedLyrics(lyrics);
                        setRecommendedLyrics(newRecommended);
                      }}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-full text-xs transition-colors"
                    >
                      重新推荐
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center text-gray-500 py-10 gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-gray-600">暂无推荐歌词</h3>
                  <p className="text-xs">歌曲歌词太少，无法生成推荐</p>
                </div>
              )}
            </>
          )}
        </section>

        {/* 歌词展示区域 */}
        <section className="bg-blue-50/20 rounded-xl p-3 shadow-md transform hover:shadow-lg transition-shadow duration-300 min-h-[300px] mb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2M9 19c0-1.105 1.343-2 3-2s3 .895 3 2M9 19v-3m0 3V5m0 14c0 1.105-1.343 2-3 2s-3-.895-3-2m3 0c0-1.105 1.343-2 3-2s3 .895 3 2m0 0v-3m0 3" />
              </svg>
              歌词
            </h2>
            <div className="flex items-center gap-2">
              {selectedLyrics.length > 0 && (
                <>
                  <button
                    onClick={handleClearSelection}
                    className="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white rounded-full transition-colors font-medium text-xs flex items-center"
                  >
                    清除
                  </button>
                  <button
                    onClick={handleSaveLyrics}
                    className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-full transition-colors font-medium text-xs flex items-center"
                  >
                    收藏
                  </button>
                </>
              )}
              <button
                onClick={() => setShowLyricsEditor(true)}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-full transition-colors font-medium text-xs flex items-center"
              >
                <Pencil size={14} />
              </button>
              <button 
                onClick={handleSearchLyrics}
                disabled={buttonLoading}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-full transition-colors font-medium text-xs flex items-center"
              >
                <Search size={14} />
              </button>
            </div>
          </div>
          
          {loading ? (
            <div className="flex flex-col justify-center items-center h-32 gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              <p className="text-gray-500 text-sm">正在获取歌词...</p>
            </div>
          ) : lyrics.length > 0 ? (
            <div className="space-y-4">
              {lyrics.map((line, index) => (
                  <p 
                    key={index} 
                    className={`text-center py-2 px-4 text-sm cursor-pointer transition-all rounded-lg ${selectedLyrics.includes(line) ? 'bg-pink-100 text-pink-800' : 'text-gray-700 hover:bg-blue-50'}`}
                    onClick={() => {
                      setSelectedLyrics(prev => {
                        if (prev.includes(line)) {
                          return prev.filter(l => l !== line);
                        } else {
                          return [...prev, line];
                        }
                      });
                    }}
                  >
                    {line}
                  </p>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center text-gray-500 py-10 gap-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2M9 19c0-1.105 1.343-2 3-2s3 .895 3 2M9 19v-3m0 3V5m0 14c0 1.105-1.343 2-3 2s-3-.895-3-2m3 0c0-1.105 1.343-2 3-2s3 .895 3 2m0 0v-3m0 3" />
                </svg>
              </div>
              <h3 className="text-base font-medium text-gray-600">暂无歌词</h3>
              <p className="text-sm">点击右上角的获取歌词按钮获取歌词</p>
            </div>
          )}
        </section>


      </main>

        {/* 搜索歌词模态框 */}
        {showSearchModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-auto animate-slide-up shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Search size={20} className="text-purple-500" />
                  搜索歌词
                </h3>
                <button 
                  onClick={() => setShowSearchModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-full hover:bg-gray-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  搜索歌曲: <span className="font-medium">{song?.title}</span>
                </p>
              </div>
              
              {searchLoading ? (
                <div className="flex flex-col justify-center items-center py-10 gap-4">
                  <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-opacity-20 border-t-purple-500 rounded-full"></div>
                  <p className="text-gray-500 text-sm">正在搜索歌词...</p>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-3">
                  {searchResults.map((result, index) => (
                    <div 
                      key={index} 
                      className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer border border-gray-200"
                      onClick={() => handleSelectLyrics(result)}
                    >
                      <div className="font-medium text-gray-900 mb-1">{result.name || result.title}</div>
                      <div className="text-sm text-gray-600 mb-2">{result.artistName || result.artist}</div>
                      {result.albumName && (
                        <div className="text-xs text-gray-500">{result.albumName}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center text-gray-500 py-10 gap-4">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                    <Search size={24} className="text-gray-400" />
                  </div>
                  <h3 className="text-base font-medium text-gray-600">未找到歌词</h3>
                  <p className="text-sm">尝试使用不同的歌曲标题或手动添加歌词</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 分享海报模态框 */}
        {showShareModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto animate-slide-up shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  分享海报
                </h3>
                <button 
                  onClick={() => setShowShareModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-full hover:bg-gray-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="flex flex-col md:flex-row gap-6 items-center">
                {/* 海报预览区域 - 3:4比例 */}
                <div className="aspect-[3/4] w-full md:w-[240px] bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl overflow-hidden relative shadow-xl border border-gray-200">
                  {/* 顶部装饰 */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400"></div>
                  
                  {/* 歌词卡片内容 */}
                  <div className="absolute inset-0 p-6 flex flex-col">
                    {/* 卡片容器 */}
                    <div className="flex-1 flex flex-col justify-between">
                      {/* 歌曲封面 - 确保完整显示 */}
                      {song?.coverUrl ? (
                        <div className="w-32 h-32 rounded-lg overflow-hidden mb-3 shadow-md self-center border-2 border-gray-200 bg-white">
                          <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-32 h-32 rounded-lg bg-gray-200 flex items-center justify-center mb-3 shadow-md self-center border-2 border-gray-200">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.414a5 5 0 000-7.072m-2.828 9.9a9 9 0 010-12.728" />
                          </svg>
                        </div>
                      )}
                       
                      {/* 歌曲信息 - 调整字体大小 */}
                      <div className="text-gray-900 text-base font-medium mb-0.5 text-center truncate">{song?.title}</div>
                      <div className="text-gray-600 text-xs mb-0.5 text-center truncate">{song?.artists?.join('/')}</div>
                      {song?.album && <div className="text-gray-500 text-xs mb-2 text-center truncate">{song?.album}</div>}
                      
                      {/* 歌词卡片 */}
                      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                        {/* 选中的歌词 */}
                        {selectedLyrics.length > 0 ? (
                          <div className="leading-relaxed">
                            {selectedLyrics.length <= 3 ? (
                              // 合并2-3句歌词为一句话并添加引号
                              <div className="text-xs text-gray-700 italic text-center">
                                「{selectedLyrics.join('，')}。」
                              </div>
                            ) : (
                              // 超过3句仍分开显示
                              selectedLyrics.map((line, index) => (
                                <div key={index} className="mb-0.5 text-xs text-gray-700 text-center last:mb-0">{line}</div>
                              ))
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <div className="text-gray-500 text-xs text-center py-2">
                              分享这首好听的歌曲
                            </div>
                            <div className="text-sm text-gray-500 truncate max-w-full">
                              {song?.title} - {song?.artists?.join('/')}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* 底部装饰 */}
                    <div className="mt-4 text-center">
                      <div className="text-gray-400 text-xs">MelodyLog</div>
                    </div>
                  </div>
                </div>
                
                {/* 海报操作区域 */}
                <div className="flex-1 space-y-6">
                  <div className="space-y-3">
                    <h4 className="text-lg font-medium text-gray-800">分享选项</h4>
                    <p className="text-gray-500 text-sm">您可以下载海报或复制链接分享给朋友</p>
                  </div>
                  
                  <div className="space-y-3">
                    <button 
                      onClick={() => {
                        try {
                          console.log('直接分享按钮点击，song数据:', song);
                          // 使用Web Share API实现直接分享功能
                          if (navigator.share) {
                            navigator.share({
                              title: `分享歌曲: ${song?.title || '未知歌曲'}`,
                              text: selectedLyrics.length > 0 
                                ? `${song?.title || '未知歌曲'} - ${song?.artists?.join('/') || '未知歌手'}\n\n${selectedLyrics.join('\n')}`
                                : `${song?.title || '未知歌曲'} - ${song?.artists?.join('/') || '未知歌手'}`,
                              url: window.location.href
                            }).catch(err => {
                              console.error('Web Share API分享失败:', err);
                              // 不自动回退到下载，让用户自己选择
                              alert('分享失败，请尝试下载海报或复制链接。');
                            });
                          } else {
                            console.log('浏览器不支持Web Share API');
                            // 如果浏览器不支持分享API，提示用户
                            alert('您的浏览器不支持直接分享功能，请尝试下载海报或复制链接。');
                          }
                        } catch (err) {
                          console.error('分享功能执行错误:', err);
                          alert('分享时发生错误，请稍后再试。');
                        }
                      }}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      直接分享
                    </button>
                    
                    <button 
                      onClick={handleDownloadPoster}
                      className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      下载海报
                    </button>
                  </div>
                  
                  <div className="flex gap-3 mt-4">
                    <button 
                      onClick={() => setShowShareModal(false)}
                      className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 歌词编辑器 */}
        {song && (
          <LyricsEditor
            isOpen={showLyricsEditor}
            onClose={() => setShowLyricsEditor(false)}
            songTitle={song.title}
            artistName={song.artists[0]}
            onSave={handleSaveCustomLyrics}
            existingLyrics={lyrics.join('\n')}
          />
        )}
    </div>
  );
};