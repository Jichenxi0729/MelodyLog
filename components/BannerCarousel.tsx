import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Song } from '../types';
import { ChevronLeft, ChevronRight, Music2 } from 'lucide-react';

interface BannerCarouselProps {
  songs: Song[];
  onSongClick: (songId: string) => void;
}

// 基于日期生成固定的随机种子，确保同一天推荐相同的歌曲
const getDailySeed = (): number => {
  const today = new Date();
  return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
};

// 使用种子生成伪随机数
const seededRandom = (seed: number): (() => number) => {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

// 获取每日推荐的5首歌曲
const getDailyRecommendations = (songs: Song[], count: number = 5): Song[] => {
  if (songs.length === 0) return [];
  if (songs.length <= count) return [...songs];

  const seed = getDailySeed();
  const random = seededRandom(seed);
  const indices = new Set<number>();
  
  while (indices.size < Math.min(count, songs.length)) {
    indices.add(Math.floor(random() * songs.length));
  }
  
  return Array.from(indices).map(i => songs[i]);
};

// 从图片URL提取主色调（返回亮色和暗色两种用于渐变）
const extractDominantColor = (imageUrl: string): Promise<{ light: string; dark: string }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ light: '#6366f1', dark: '#4338ca' });
          return;
        }

        // 缩小尺寸以提高性能
        const size = 80;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const imageData = ctx.getImageData(0, 0, size, size).data;

        // 颜色直方图统计
        const colorMap = new Map<string, number>();
        for (let i = 0; i < imageData.length; i += 4) {
          const pr = imageData[i];
          const pg = imageData[i + 1];
          const pb = imageData[i + 2];
          const brightness = (pr + pg + pb) / 3;

          // 过滤过亮或过暗的像素
          if (brightness > 20 && brightness < 240) {
            // 量化颜色到32级减少种类
            const qr = Math.floor(pr / 8) * 8;
            const qg = Math.floor(pg / 8) * 8;
            const qb = Math.floor(pb / 8) * 8;
            const key = `${qr},${qg},${qb}`;
            colorMap.set(key, (colorMap.get(key) || 0) + 1);
          }
        }

        // 找出出现频率最高的颜色
        let maxCount = 0;
        let dominantR = 80, dominantG = 90, dominantB = 120; // 默认蓝灰色

        for (const [key, count] of colorMap.entries()) {
          if (count > maxCount) {
            maxCount = count;
            const [r, g, b] = key.split(',').map(Number);
            dominantR = r;
            dominantG = g;
            dominantB = b;
          }
        }

        // HSL辅助函数
        const rgbToHsl = (r: number, g: number, b: number) => {
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          let h = 0, s = 0, l = (max + min) / 2 / 255;
          if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (510 - max - min) : d / (max + min);
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            else if (max === g) h = ((b - r) / d + 2) / 6;
            else h = ((r - g) / d + 4) / 6;
          }
          return { h, s, l };
        };

        const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
          const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1; if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
          };
          let rf: number, gf: number, bf: number;
          if (s === 0) { rf = gf = bf = l; }
          else {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            rf = hue2rgb(p, q, h + 1/3); gf = hue2rgb(p, q, h); bf = hue2rgb(p, q, h - 1/3);
          }
          return [Math.round(rf * 255), Math.round(gf * 255), Math.round(bf * 255)];
        };

        const { h, s, l } = rgbToHsl(dominantR, dominantG, dominantB);

        // 生成两种颜色用于渐变：
        // light色：保持较高亮度(0.55~0.65)，饱和度适中(0.55~0.75)
        // dark色：较低亮度(0.25~0.35)，饱和度略高
        const baseLightness = Math.max(0.45, Math.min(l, 0.6));
        const lightL = baseLightness + 0.12;
        const darkL = Math.max(0.18, baseLightness - 0.18);
        const lightS = Math.min(s * 0.9 + 0.15, 0.75);
        const darkS = Math.min(s * 0.95 + 0.2, 0.85);

        const [lr, lg, lb] = hslToRgb(h, lightS, lightL);
        const [dr, dg, db] = hslToRgb(h, darkS, darkL);

        resolve({
          light: `rgb(${lr}, ${lg}, ${lb})`,
          dark: `rgb(${dr}, ${dg}, ${db})`,
        });
      } catch {
        resolve({ light: '#6366f1', dark: '#4338ca' });
      }
    };

    img.onerror = () => resolve({ light: '#6366f1', dark: '#4338ca' });
    img.src = imageUrl;
  });
};

export const BannerCarousel: React.FC<BannerCarouselProps> = ({ songs, onSongClick }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dominantColor, setDominantColor] = useState<{ light: string; dark: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const isDragging = useRef(false);

  const recommendations = getDailyRecommendations(songs, 5);

  const currentSong = recommendations[currentIndex];

  // 当切换歌曲时提取新颜色
  useEffect(() => {
    if (currentSong?.coverUrl) {
      extractDominantColor(currentSong.coverUrl).then(setDominantColor);
    } else if (currentSong) {
      // 默认使用渐变色
      setDominantColor({ light: '#6366f1', dark: '#4338ca' });
    }
  }, [currentSong?.id]);

  const goToPrev = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + recommendations.length) % recommendations.length);
  }, [recommendations.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % recommendations.length);
  }, [recommendations.length]);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  // 触摸/滑动支持
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    isDragging.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    // 可以在这里添加滑动预览效果
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    
    // 滑动超过50px触发切换
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
  }, [goToPrev, goToNext]);

  if (recommendations.length === 0) {
    return null;
  }

  // 构建背景样式 - 使用取色的渐变背景
  const backgroundStyle: React.CSSProperties = dominantColor
    ? { backgroundImage: `linear-gradient(135deg, ${dominantColor.dark}, ${dominantColor.light})` }
    : { backgroundImage: 'linear-gradient(135deg, #4338ca, #6366f1)' };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl shadow-xl" ref={containerRef}>
      {/* Banner 内容 - 比例约 1:2.35 */}
      <div 
        className="relative cursor-grab active:cursor-grabbing select-none"
        style={{ aspectRatio: '2.35 / 1', ...backgroundStyle }}
        onClick={() => onSongClick(currentSong.id)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 背景模糊封面 */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={currentSong.coverUrl || `https://picsum.photos/seed/${currentSong.id}/400`}
            alt=""
            className="w-full h-full object-cover opacity-30 blur-2xl scale-110"
          />
        </div>

        {/* 渐变遮罩 - 轻微加深确保文字可读性 */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-black/10 to-transparent" />

        {/* 内容区域 */}
        <div className="relative h-full flex items-center px-5 py-4 gap-4">
          {/* 左侧：歌曲信息 */}
          <div className="flex-1 min-w-0 z-10">
            <div className="flex items-center gap-1.5 mb-2">
              <Music2 size={14} className="text-white/90" />
              <span className="text-[10px] font-medium text-white/80 uppercase tracking-wider">
                每日推荐
              </span>
              <span className="text-[10px] text-white/40">·</span>
              <span className="text-[10px] text-white/50">
                {currentIndex + 1} / {recommendations.length}
              </span>
              <span className="text-[10px] text-white/30 ml-1">左右滑动</span>
            </div>
            
            <h2 
              className="text-lg font-bold text-white mb-1.5 line-clamp-2 leading-tight drop-shadow-sm"
              title={currentSong.title}
            >
              {currentSong.title}
            </h2>
            
            <p className="text-sm text-white/85 mb-2 truncate drop-shadow-sm">
              {currentSong.artists.join(' / ')}
            </p>
            
            {currentSong.album && (
              <p className="text-xs text-white/55 truncate drop-shadow-sm">
                专辑: {currentSong.album}
              </p>
            )}

            {/* 轮播指示器 */}
            <div className="flex items-center gap-1.5 mt-3">
              {recommendations.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToSlide(index);
                  }}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    index === currentIndex 
                      ? 'w-5 bg-white' 
                      : 'w-1.5 bg-white/40 hover:bg-white/60'
                  }`}
                  aria-label={`跳转到第${index + 1}张`}
                />
              ))}
            </div>
          </div>

          {/* 右侧：封面图 */}
          <div className="flex-shrink-0 z-10">
            <div className="w-28 h-28 rounded-xl overflow-hidden shadow-2xl ring-2 ring-white/20">
              <img
                src={currentSong.coverUrl || `https://picsum.photos/seed/${currentSong.id}/200`}
                alt={`${currentSong.title} 封面`}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
            </div>
          </div>
        </div>

        {/* 左右切换按钮 */}
        {recommendations.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToPrev();
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/25 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/40 transition-all hidden md:block"
              aria-label="上一首"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/25 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/40 transition-all hidden md:block"
              aria-label="下一首"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      <style>{`
        .cursor-grab:active {
          cursor: grabbing;
        }
      `}</style>
    </div>
  );
};
