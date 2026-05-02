import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';
import { useNavigate } from 'react-router-dom';
import { Song } from '../types';
import { fetchLyrics, addCustomLyrics, searchLyricsByTitle, fetchLyricsById, saveLyricsToSupabase, convertToSimplified } from '../services/lyricsService';
import { useToast } from './Toast';
import { ArrowLeft, Share2, Plus, Pencil, Search, Tag, Disc, Calendar } from 'lucide-react';
import { LyricsEditor } from './LyricsEditor';
import { getTagsFromSongs, addTagToHistory } from '../utils/tagUtils';

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
  const { showToast } = useToast();
  const posterRef = useRef<HTMLDivElement>(null);
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
              setShowSavedLyrics(true);
            } else if (Array.isArray(parsed) && parsed.length > 0) {
              setSavedLyrics(parsed);
              setShowSavedLyrics(true);
            }
          }
        } catch (error) {
          console.error('解析保存的歌词失败:', error);
          localStorage.removeItem(`savedLyrics_${songId}`);
        }
      } else {
        setLoading(false);
      }
    }
  }, [songId]);
  
  // 当songs变化时，仅更新当前歌曲信息，不重新获取歌词
  useEffect(() => {
    if (songId) {
      const foundSong = songs.find(s => s.id === songId);
      if (foundSong) {
        setSong(foundSong);
        // 如果不在编辑模式，也要更新编辑状态，确保编辑时有最新数据
        if (!isEditing) {
          setEditedTitle(foundSong.title);
          setEditedArtists([...foundSong.artists]);
          setEditedAlbum(foundSong.album || '');
          setEditedCoverUrl(foundSong.coverUrl || '');
          setEditedReleaseDate(foundSong.releaseDate || '');
          setEditedTags(foundSong.tags || []);
        }
      }
    }
  }, [songId, songs, isEditing]);
  
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
    { bg: 'bg-blue-50', text: 'text-blue-600' },
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
    setShowTagsHistory(false);
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
    if (!posterRef.current) {
      console.error('未找到海报元素');
      showToast('无法找到海报元素，请稍后再试。', 'error');
      return;
    }

    showToast('正在生成海报...', 'info');

    const element = posterRef.current;
    // 先克隆节点，避免影响原页面
    const clone = element.cloneNode(true) as HTMLElement;

    // 处理克隆中的图片，确保 crossOrigin 设置正确
    const imgs = clone.querySelectorAll('img');
    imgs.forEach(img => {
      img.crossOrigin = 'anonymous';
    });

    // 将克隆的元素临时放入 body 以便渲染
    clone.style.position = 'fixed';
    clone.style.left = '-9999px';
    clone.style.top = '0';
    document.body.appendChild(clone);

    // 使用html2canvas将海报元素转换为图片
    html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: element.offsetWidth,
      height: element.offsetHeight,
    }).then(canvas => {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = dataUrl;
        downloadLink.download = `${song?.title || 'song'}_poster.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        showToast('海报已下载', 'success');
        setShowShareModal(false);
      } catch (error) {
        console.error('下载海报失败:', error);
        showToast('下载海报时发生错误，请稍后再试。', 'error');
      }
    }).catch(error => {
      console.error('生成海报图片失败:', error);
      // 尝试不使用 CORS 的降级方案
      html2canvas(clone, {
        scale: 2,
        useCORS: false,
        allowTaint: false,
        backgroundColor: '#ffffff',
        width: element.offsetWidth,
        height: element.offsetHeight,
      }).then(canvas => {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.href = dataUrl;
          downloadLink.download = `${song?.title || 'song'}_poster.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          showToast('海报已下载（封面图片可能为空白）', 'success');
          setShowShareModal(false);
        } catch (err2) {
          console.error('降级下载也失败:', err2);
          showToast('下载海报时发生错误，请稍后再试。', 'error');
        }
      }).catch(() => {
        showToast('生成海报图片时发生错误，请稍后再试。', 'error');
      });
    }).finally(() => {
      // 清理临时克隆节点
      if (clone.parentNode === document.body) {
        document.body.removeChild(clone);
      }
    });
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
    if (loading) {
      return (
        <div className="flex items-center justify-center h-screen bg-brand-bg">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      );
    }
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

      <main className="pt-0.1 pb-5 px-0.5 max-w-2xl mx-auto">
        {/* 返回按钮和分享按钮 */}
        <div className="flex justify-between items-center mb-3">
          <button 
            onClick={onBack}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft size={16} /> 返回
          </button>
          <button 
            onClick={handleShare}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-100"
          >
            <Share2 size={16} /> 分享
          </button>
        </div>

        {/* 歌曲信息卡片 */}
        <section className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 mb-4">
          <div className="flex flex-row items-start gap-3.5">
            {/* 封面图片 */}
            <div className="relative group shrink-0">
              <div className="w-31 h-31 sm:w-40 sm:h-40 rounded-xl overflow-hidden shadow-lg ring-1 ring-slate-200 transition-transform group-hover:scale-[1.02]">
                <img 
                  src={song.coverUrl || 'https://via.placeholder.com/200'} 
                  alt={`${song.title} by ${song.artists.join('/')}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              {/* 封面装饰光效 */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            
            {/* 歌曲信息 */}
            <div className="text-left flex-1 min-w-0">
              {isEditing ? (
                // 编辑模式
                <div className="space-y-3 w-full">
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="text-xl font-bold text-slate-900 tracking-tight w-full border-b-2 border-slate-200 focus:border-blue-500 focus:outline-none pb-2 bg-transparent"
                  />
                  
                  <div className="space-y-2">
                    {editedArtists.map((artist, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={artist}
                          onChange={(e) => handleArtistChange(index, e.target.value)}
                          className="text-base text-blue-600 font-medium w-full border-b border-slate-200 focus:border-blue-500 focus:outline-none pb-1 bg-transparent"
                        />
                        {editedArtists.length > 1 && (
                          <button
                            onClick={() => handleRemoveArtist(index)}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={handleAddArtist}
                      className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                    >
                      + 添加艺术家
                    </button>
                  </div>
                  
                  <input
                    type="text"
                    value={editedAlbum}
                    onChange={(e) => setEditedAlbum(e.target.value)}
                    placeholder="专辑名称"
                    className="text-sm text-slate-500 w-full border-b border-slate-200 focus:border-blue-500 focus:outline-none pb-1 bg-transparent"
                  />

                  <input
                    type="text"
                    value={editedCoverUrl}
                    onChange={(e) => setEditedCoverUrl(e.target.value)}
                    placeholder="封面图片URL"
                    className="text-sm text-slate-500 w-full border-b border-slate-200 focus:border-blue-500 focus:outline-none pb-1 bg-transparent"
                  />

                  <input
                    type="text"
                    value={editedReleaseDate}
                    onChange={(e) => setEditedReleaseDate(e.target.value)}
                    placeholder="发行日期 (YYYY-MM-DD)"
                    className="text-sm text-slate-500 w-full border-b border-slate-200 focus:border-blue-500 focus:outline-none pb-1 bg-transparent"
                  />
                  
                  {/* 标签编辑 */}
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex gap-2 flex-wrap mb-2">
                      {editedTags.map((tag, index) => {
                        const colors = getTagColor(index);
                        const borderColor = colors.text.replace('text-', 'border-');
                        return (
                          <span key={index} className={`inline-flex items-center gap-1 px-2.5 py-1 ${colors.bg} ${colors.text} ${borderColor} border rounded-full text-xs font-medium`}>
                            {tag}
                            <button
                              onClick={() => handleRemoveTag(tag)}
                              className={`${colors.text} opacity-60 hover:opacity-100 ml-0.5`}
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
                          className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                        />
                        {/* 智能匹配标签下拉列表 */}
                        {showTagsHistory && getTagsFromSongs(songs).length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto">
                            <div className="sticky top-0 bg-slate-50 px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 rounded-t-xl">
                              <Tag className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-xs text-slate-500 font-medium">已有标签</span>
                            </div>
                            <div className="py-1">
                              {getTagsFromSongs(songs)
                                .filter(tagName => !editedTags.includes(tagName))
                                .filter(tagName => newTag === '' || tagName.toLowerCase().includes(newTag.toLowerCase()))
                                .slice(0, 10)
                                .map((tagName, idx) => {
                                  const tagColorOptions = [
                                    { bg: 'bg-pink-50', text: 'text-pink-700' },
                                    { bg: 'bg-amber-50', text: 'text-amber-700' },
                                    { bg: 'bg-lime-50', text: 'text-lime-700' },
                                    { bg: 'bg-sky-50', text: 'text-sky-700' },
                                    { bg: 'bg-blue-50', text: 'text-blue-700' },
                                    { bg: 'bg-orange-50', text: 'text-orange-700' }
                                  ];
                                  const color = tagColorOptions[idx % tagColorOptions.length];
                                  return (
                                    <button
                                      key={tagName}
                                      type="button"
                                      onClick={() => handleSelectFromMatchedTags(tagName)}
                                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 ${color.text} transition-colors first:rounded-b-xl`}
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
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
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
                  
                  <div className="flex gap-2.5 mt-4 pt-3 border-t border-slate-100">
                    <button
                      onClick={handleSave}
                      className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      保存
                    </button>
                    <button
                      onClick={handleCancel}
                      className="px-5 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                // 查看模式
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">{song.title}</h1>
                    <button
                      onClick={handleEdit}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="编辑歌曲信息"
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                  
                  <div className="text-sm sm:text-base text-blue-600 font-medium pl-0.5">
                    {song.artists.map((artist, index) => (
                      <React.Fragment key={artist}>
                        <span 
                          onClick={() => onArtistClick?.(artist)}
                          className="cursor-pointer hover:underline hover:text-blue-700 transition-colors"
                          title={`查看 ${artist} 的详情`}
                        >
                          {artist}
                        </span>
                        {index < song.artists.length - 1 && <span className="text-blue-300 mx-1">/</span>}
                      </React.Fragment>
                    ))}
                  </div>
                  
                  {/* 元信息 */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-slate-500 pt-1">
                    {song.album && (
                      <p className="flex items-center gap-1.5">
                        <Disc size={14} className="text-slate-400" />
                        <span 
                          onClick={() => onAlbumClick?.(song.album!)}
                          className="cursor-pointer hover:text-slate-800 hover:underline transition-colors"
                          title={`查看专辑: ${song.album}`}
                        >
                          {song.album}
                        </span>
                      </p>
                    )}
                    
                    {song.releaseDate && (() => {
                      let releaseYear: number | null = null;
                      if (typeof song.releaseDate === 'string' && !isNaN(Number(song.releaseDate))) {
                        const year = Number(song.releaseDate);
                        if (year >= 1900 && year <= 2100) {
                          releaseYear = year;
                        }
                      } else {
                        const date = new Date(song.releaseDate);
                        if (!isNaN(date.getTime())) {
                          releaseYear = date.getFullYear();
                        }
                      }
                      return releaseYear !== null ? (
                        <p className="flex items-center gap-1.5">
                          <Calendar size={14} className="text-slate-400" />
                          <span>{releaseYear}</span>
                        </p>
                      ) : null;
                    })()}
                  </div>
                  
                  {/* 标签显示 */}
                  {song.tags && song.tags.length > 0 && (
                    <div className="flex gap-1.5 sm:gap-2 flex-wrap pt-1.5">
                      {song.tags.map((tag, index) => {
                        const colors = getTagColor(index);
                        const borderColor = colors.text.replace('text-', 'border-');
                        return (
                          <button
                            key={index}
                            onClick={() => onTagClick && onTagClick(tag)}
                            className={`inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 ${colors.bg} ${colors.text} ${borderColor} border rounded-full text-[11px] sm:text-xs font-medium cursor-pointer hover:shadow-sm hover:opacity-80 transition-all`}
                          >
                            <Tag size={12} className="mr-1.5 opacity-70" />
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

        {/* 推荐歌词 / 收藏的歌词 */}
        <section className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 mb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-100 to-rose-50 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              {lyricsViewMode === 'saved' ? '我喜欢的歌词' : '推荐歌词'}
            </h2>
            <div className="flex items-center gap-3">
              {lyricsViewMode === 'saved' && (
                <span className="text-xs text-slate-400 font-medium px-2 py-1 bg-slate-50 rounded-full">{savedLyrics.length} 组</span>
              )}
              <div className="flex bg-slate-100 rounded-lg p-1">
                <button 
                  onClick={() => setLyricsViewMode('saved')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${lyricsViewMode === 'saved' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  我的
                </button>
                <button 
                  onClick={() => setLyricsViewMode('recommended')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${lyricsViewMode === 'recommended' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  推荐
                </button>
              </div>
            </div>
          </div>
          
          {/* 我喜欢的歌词 */}
          {lyricsViewMode === 'saved' && (
            savedLyrics.length > 0 ? (
              <div className="space-y-3">
                {savedLyrics.map((lyricGroup, groupIndex) => (
                  <div key={groupIndex} className="relative group">
                    <p className="text-slate-700 bg-gradient-to-r from-slate-50 to-transparent p-4 rounded-xl transition-all duration-300 hover:shadow-md hover:bg-slate-50 text-center text-sm leading-relaxed border border-slate-100">
                      「{lyricGroup.join('，')}。」
                    </p>
                    <button 
                      onClick={() => handleDeleteSavedLyricGroup(groupIndex)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 backdrop-blur-sm text-slate-400 opacity-0 group-hover:opacity-100 transition-all hover:text-red-500 hover:bg-red-50 shadow-sm"
                      title="删除这个歌词组"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
                {savedLyrics.length > 1 && (
                  <button 
                    onClick={handleDeleteAllLyrics}
                    className="w-full mt-4 py-2.5 text-red-600 hover:text-red-700 text-center text-sm font-medium rounded-xl bg-red-50/80 hover:bg-red-100/80 transition-all"
                  >
                    删除所有歌词组
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center text-slate-400 py-8 gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-500">还没有保存喜欢的歌词</h3>
                  <p className="text-xs mt-1 text-slate-400">选择歌词后点击"收藏"，将喜欢的句子收藏起来</p>
                </div>
              </div>
            )
          )}
          
          {/* 推荐歌词 */}
          {lyricsViewMode === 'recommended' && (
            <>
              {recommendedLyrics.length > 0 ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {recommendedLyrics.map((lyricGroup, groupIndex) => (
                      <div key={groupIndex}>
                        <p className="text-slate-700 bg-gradient-to-r from-blue-50/50 to-transparent p-4 rounded-xl transition-all duration-300 hover:shadow-md hover:from-blue-50 text-center text-sm leading-relaxed border border-blue-100/50">
                          「{lyricGroup.join('，')}。」
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="text-center pt-2">
                    <button 
                      onClick={() => {
                        const newRecommended = generateRecommendedLyrics(lyrics);
                        setRecommendedLyrics(newRecommended);
                      }}
                      className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md inline-flex items-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      换一批推荐
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center text-slate-400 py-8 gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-500">暂无推荐歌词</h3>
                    <p className="text-xs mt-1 text-slate-400">当前歌曲歌词较少，无法生成推荐</p>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* 歌词展示区域 */}
        <section className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 mb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-50 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2M9 19c0-1.105 1.343-2 3-2s3 .895 3 2M9 19v-3m0 3V5m0 14c0 1.105-1.343 2-3 2s-3-.895-3-2m3 0c0-1.105 1.343-2 3-2s3 .895 3 2m0 0v-3m0 3" />
                </svg>
              </div>
              歌词
            </h2>
            <div className="flex items-center gap-2">
              {selectedLyrics.length > 0 && (
                <>
                  <button
                    onClick={handleClearSelection}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all font-medium text-xs flex items-center"
                  >
                    清除
                  </button>
                  <button
                    onClick={handleSaveLyrics}
                    className="px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-all shadow-sm hover:shadow-md font-medium text-xs"
                  >
                    收藏
                  </button>
                </>
              )}
              <button
                onClick={() => setShowLyricsEditor(true)}
                className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors"
                title="编辑歌词"
              >
                <Pencil size={15} />
              </button>
              <button 
                onClick={handleSearchLyrics}
                disabled={buttonLoading}
                className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors disabled:opacity-50"
                title="搜索歌词"
              >
                <Search size={15} />
              </button>
            </div>
          </div>
          
          {loading ? (
            <div className="flex flex-col justify-center items-center h-40 gap-4">
              <div className="relative">
                <div className="w-10 h-10 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
              </div>
              <p className="text-slate-400 text-sm">正在获取歌词...</p>
            </div>
          ) : lyrics.length > 0 ? (
            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar-track]:bg-transparent [&::-ms-overflow-style]:none [scrollbar-width:none]">
              {lyrics.map((line, index) => (
                  <p 
                    key={index} 
                    className={`py-2.5 px-4 text-sm cursor-pointer transition-all duration-200 rounded-lg text-center leading-relaxed ${
                      selectedLyrics.includes(line)
                        ? 'bg-pink-50 text-pink-700 font-medium scale-[1.01]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
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
            <div className="flex flex-col items-center justify-center text-center text-slate-400 py-14 gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2M9 19c0-1.105 1.343-2 3-2s3 .895 3 2M9 19v-3m0 3V5m0 14c0 1.105-1.343 2-3 2s-3-.895-3-2m3 0c0-1.105 1.343-2 3-2s3 .895 3 2m0 0v-3m0 3" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-medium text-slate-500">暂无歌词</h3>
                <p className="text-sm mt-1 text-slate-400">点击右上角按钮搜索或编辑歌词</p>
              </div>
            </div>
          )}
        </section>


      </main>

        {/* 搜索歌词模态框 */}
        {showSearchModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-auto animate-slide-up shadow-2xl border border-slate-100">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-50 flex items-center justify-center">
                    <Search size={16} className="text-blue-500" />
                  </div>
                  搜索歌词
                </h3>
                <button 
                  onClick={() => setShowSearchModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-lg hover:bg-slate-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="mb-5 p-3 bg-slate-50 rounded-xl">
                <p className="text-sm text-slate-600">
                  正在搜索: <span className="font-semibold text-slate-900">{song?.title}</span>
                </p>
              </div>
              
              {searchLoading ? (
                <div className="flex flex-col justify-center items-center py-14 gap-4">
                  <div className="relative w-10 h-10">
                    <div className="absolute inset-0 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
                  </div>
                  <p className="text-slate-400 text-sm font-medium">正在搜索歌词...</p>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-2.5 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
                  {searchResults.map((result, index) => (
                    <div 
                      key={index} 
                      className="p-4 bg-slate-50/80 rounded-xl hover:bg-blue-50 transition-all cursor-pointer border border-transparent hover:border-blue-200 group"
                      onClick={() => handleSelectLyrics(result)}
                    >
                      <div className="font-semibold text-slate-900 mb-1 group-hover:text-blue-700 transition-colors">{result.name || result.title}</div>
                      <div className="text-sm text-slate-600 mb-0.5">{result.artistName || result.artist}</div>
                      {result.albumName && (
                        <div className="text-xs text-slate-400 flex items-center gap-1">
                          <Disc size={11} />
                          {result.albumName}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center text-slate-400 py-14 gap-4">
                  <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center">
                    <Search size={22} className="text-slate-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-500">未找到歌词</h3>
                    <p className="text-xs mt-1 text-slate-400">尝试手动添加歌词或稍后再试</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 分享海报模态框 */}
        {showShareModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
            <div className="bg-white rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-auto animate-slide-up shadow-2xl border border-slate-100">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-50 flex items-center justify-center">
                    <Share2 size={16} className="text-blue-500" />
                  </div>
                  分享海报
                </h3>
                <button 
                  onClick={() => setShowShareModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-lg hover:bg-slate-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                {/* 海报预览区域 - 3:4比例 */}
                <div ref={posterRef} className="aspect-[3/4] w-full md:w-[220px] bg-gradient-to-br from-blue-50 via-white to-sky-50 rounded-2xl overflow-hidden relative shadow-lg border border-slate-200 shrink-0">
                  {/* 顶部装饰 */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-cyan-400 to-sky-400"></div>
                  
                  {/* 歌词卡片内容 */}
                  <div className="absolute inset-0 p-5 flex flex-col">
                    {/* 卡片容器 */}
                    <div className="flex-1 flex flex-col justify-between">
                      {/* 歌曲封面 - 确保完整显示 */}
                      {song?.coverUrl ? (
                        <div className="w-28 h-28 rounded-xl overflow-hidden shadow-md self-center border-2 border-white bg-white ring-1 ring-slate-200">
                          <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" crossOrigin="anonymous" />
                        </div>
                      ) : (
                        <div className="w-28 h-28 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shadow-md self-center border-2 border-white ring-1 ring-slate-200">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.414a5 5 0 000-7.072m-2.828 9.9a9 9 0 010-12.728" />
                          </svg>
                        </div>
                      )}
                        
                      {/* 歌曲信息 */}
                      <div className="text-slate-900 text-base font-semibold mt-3 text-center truncate px-1">{song?.title}</div>
                      <div className="text-slate-500 text-xs mt-0.5 text-center truncate">{song?.artists?.join('/')}</div>
                      {song?.album && <div className="text-slate-400 text-xs mt-0.5 text-center truncate">{song?.album}</div>}
                      
                      {/* 歌词卡片 */}
                      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 mt-2">
                        {/* 选中的歌词 */}
                        {selectedLyrics.length > 0 ? (
                          <div className="leading-relaxed">
                            {selectedLyrics.length <= 3 ? (
                              <div className="text-xs text-slate-600 italic text-center font-medium">
                                「{selectedLyrics.join('，')}。」
                              </div>
                            ) : (
                              selectedLyrics.map((line, index) => (
                                <div key={index} className="mb-0.5 text-xs text-slate-600 text-center last:mb-0">{line}</div>
                              ))
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center py-1">
                            <div className="text-slate-400 text-xs text-center">
                              分享这首好听的歌曲
                            </div>
                            <div className="text-sm text-slate-500 truncate max-w-full mt-1 font-medium">
                              {song?.title} - {song?.artists?.join('/')}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* 底部装饰 */}
                    <div className="mt-3 pt-2 border-t border-slate-100 text-center">
                      <div className="text-slate-300 text-[10px] tracking-widest uppercase">MelodyLog</div>
                    </div>
                  </div>
                </div>
                
                {/* 海报操作区域 */}
                <div className="flex-1 space-y-5 w-full">
                  <div className="space-y-2">
                    <h4 className="text-base font-semibold text-slate-800">分享选项</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">将这首歌分享给好友，或下载精美海报保存</p>
                  </div>
                  
                  <div className="space-y-2.5">
                    <button 
                      onClick={() => {
                        try {
                          if (navigator.share) {
                            navigator.share({
                              title: `分享歌曲: ${song?.title || '未知歌曲'}`,
                              text: selectedLyrics.length > 0 
                                ? `${song?.title || '未知歌曲'} - ${song?.artists?.join('/') || '未知歌手'}\n\n${selectedLyrics.join('\n')}`
                                : `${song?.title || '未知歌曲'} - ${song?.artists?.join('/') || '未知歌手'}`,
                              url: window.location.href
                            }).catch(err => {
                              console.error('Web Share API分享失败:', err);
                              showToast('分享失败，请尝试下载海报或复制链接。', 'warning');
                            });
                          } else {
                            showToast('您的浏览器不支持直接分享功能，请尝试下载海报。', 'info');
                          }
                        } catch (err) {
                          console.error('分享功能执行错误:', err);
                          showToast('分享时发生错误，请稍后再试。', 'error');
                        }
                      }}
                      className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-medium transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Share2 size={18} />
                      直接分享
                    </button>
                    
                    <button 
                      onClick={handleDownloadPoster}
                      className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      下载海报
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => setShowShareModal(false)}
                    className="w-full py-2.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
                  >
                    取消
                  </button>
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