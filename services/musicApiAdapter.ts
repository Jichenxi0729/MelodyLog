// 音乐API适配器 - 为React Web应用提供音乐API功能
// 支持iTunes API

// 默认API类型
export const DEFAULT_API_TYPE = 'itunes' as const;

export const API_TYPES = {
  itunes: 'iTunes搜索API',
  'itunes-intl': 'iTunes国际版API'
} as const;

export interface SongInfo {
  id: string | number;
  name: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl: string;
  platform: string;
  platformName: string;
  releaseDate?: string; // 添加发行日期字段
}

export interface SearchResult {
  total: number;
  songs: SongInfo[];
}

class MusicApiAdapter {
  private apiType: keyof typeof API_TYPES = DEFAULT_API_TYPE; // 默认使用iTunes API

  // 搜索歌曲
  async search(params: { 
    keyword: string; 
    apiType?: keyof typeof API_TYPES;
    limit?: number; 
  }): Promise<SongInfo[]> {
    const apiType = params.apiType || DEFAULT_API_TYPE;
    
    try {
      switch (apiType) {
        case 'itunes':
          return await this.searchWithItunes(params, 'CN');
        case 'itunes-intl':
          return await this.searchWithItunes(params, 'US');
        default:
          throw new Error(`不支持的API类型: ${apiType}`);
      }
    } catch (error) {
      console.error(`搜索失败 (${apiType}):`, error);
      
      // 如果默认API失败，尝试回退到其他API
      if (apiType === DEFAULT_API_TYPE) {
        const fallbackApis: (keyof typeof API_TYPES)[] = ['itunes-intl'];
        
        for (const fallbackApi of fallbackApis) {
          if (fallbackApi !== apiType) {
            try {
              console.log(`尝试使用备用API: ${fallbackApi}`);
              return await this.search({ ...params, apiType: fallbackApi });
            } catch (fallbackError) {
              console.warn(`备用API ${fallbackApi} 也失败:`, fallbackError);
              continue;
            }
          }
        }
      }
      
      throw error;
    }
  }

  // 设置API类型
  setApiType(apiType: keyof typeof API_TYPES): void {
    this.apiType = apiType;
  }

  // 获取当前API类型
  getApiType(): keyof typeof API_TYPES {
    return this.apiType;
  }

  // iTunes API搜索
  private async searchWithItunes(params: { keyword: string; limit?: number }, country: string = 'CN'): Promise<SongInfo[]> {
    try {
      const response = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(params.keyword)}&entity=song&limit=${params.limit || 20}&country=${country}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        return data.results.map((song: any) => ({
          id: song.trackId,
          name: song.trackName,
          artist: song.artistName,
          album: song.collectionName || '未知专辑',
          duration: Math.floor(song.trackTimeMillis / 1000),
          coverUrl: song.artworkUrl100?.replace('100x100', '300x300'),
          releaseDate: song.releaseDate, // 添加发行日期
          platform: country === 'CN' ? 'itunes' : 'itunes-intl',
          platformName: country === 'CN' ? 'Apple Music' : 'iTunes国际版'
        }));
      } else {
        return [];
      }
    } catch (error) {
      console.warn('iTunes API请求失败:', error);
      throw error;
    }
  }

  // 智能生成专辑名称
  private generateAlbumName(songTitle: string, artist: string): string {
    // 清理歌曲标题中的常见专辑信息模式
    const cleanedTitle = songTitle.trim();
    
    // 常见专辑信息模式（按优先级排序）
    const albumPatterns = [
      // 中文模式：歌曲名 - 专辑名
      /^(.+?)\s*-\s*(.+)$/,
      // 中文模式：歌曲名（专辑名）
      /^(.+?)\s*\((.+?)\)$/,
      // 中文模式：歌曲名《专辑名》
      /^(.+?)\s*《(.+?)》$/,
      // 英文模式：Song Name - Album Name
      /^(.+?)\s*-\s*(.+)$/,
      // 英文模式：Song Name (Album Name)
      /^(.+?)\s*\((.+?)\)$/
    ];

    // 尝试提取专辑信息
    for (const pattern of albumPatterns) {
      const match = cleanedTitle.match(pattern);
      if (match && match[2]) {
        const albumName = match[2].trim();
        // 验证专辑名是否合理（不是太短或包含特殊字符）
        if (albumName.length >= 2 && albumName.length <= 50 && !/^[\d\s\-]+$/.test(albumName)) {
          return albumName;
        }
      }
    }

    // 如果无法提取专辑信息，根据歌曲特征生成合适的专辑名
    const titleWords = cleanedTitle.split(/[\s\-\|\/]+/).filter(word => word.length > 0);
    
    // 如果歌曲名较短，可能是单曲
    if (titleWords.length <= 3 || cleanedTitle.length <= 15) {
      return `${artist} - 单曲`;
    }
    
    // 如果歌曲名较长，可能是专辑主打歌
    if (titleWords.length >= 4) {
      return `${artist} - 专辑`;
    }

    // 默认返回未知专辑
    return '未知专辑';
  }

  // 清理歌曲标题（移除专辑信息）
  private cleanSongTitle(songTitle: string): string {
    const cleanedTitle = songTitle.trim();
    
    // 移除常见的专辑信息模式
    const patternsToRemove = [
      /\s*-\s*.+$/,           // 破折号后的内容
      /\s*\(.+?\)$/,         // 括号内的内容
      /\s*《.+?》$/,          // 书名号内的内容
      /\s*\[.+?\]$/,         // 方括号内的内容
      /\s*【.+?】$/,         // 中文方括号内的内容
      /\s*\|\s*.+$/,         // 竖线后的内容
      /\s*\/\s*.+$/          // 斜杠后的内容
    ];

    let result = cleanedTitle;
    for (const pattern of patternsToRemove) {
      result = result.replace(pattern, '').trim();
    }

    // 如果清理后为空，返回原始标题
    return result || cleanedTitle;
  }

  // 获取歌曲详情 - 暂不支持
  async getSongDetail(ids: number[]): Promise<SongInfo> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error('歌曲详情功能暂不可用'));
      }, 300);
    });
  }

  // 获取歌曲URL - 暂不支持
  async getSongUrl(id: number, br: number = 320000): Promise<string> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve('歌曲播放功能暂不可用');
      }, 200);
    });
  }

  // 获取歌词 - 暂不支持
  async getLyric(id: number): Promise<string> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve('歌词功能暂不可用');
      }, 200);
    });
  }

  // 获取平台名称
  private getPlatformName(platform: string): string {
    const platformMap: Record<string, string> = {
      'itunes': 'Apple Music',
      'itunes-intl': 'iTunes国际版'
    };
    
    return platformMap[platform] || platform;
  }
}

export const musicApi = new MusicApiAdapter();