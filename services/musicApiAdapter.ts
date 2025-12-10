// 音乐API适配器 - 为React Web应用提供音乐API功能
// 支持iTunes API

// 默认API类型
export const DEFAULT_API_TYPE = 'itunes-domestic' as const;

export const API_TYPES = {
  'itunes-domestic': 'iTunes搜索API',
  'itunes-international': 'iTunes国际版API',
  'netease': '网易云音乐',
  'qq': 'QQ音乐'
} as const;

export interface SongInfo {
  id: string | number;
  name: string;
  artist: string;
  album: string;
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
        case 'itunes-domestic':
          return await this.searchWithItunes(params, 'CN');
        case 'itunes-international':
          return await this.searchWithItunes(params, 'US');
        case 'netease':
          return await this.searchWithLokuaMusic(params, 'netease');
        case 'qq':
          return await this.searchWithLokuaMusic(params, 'qq');
        default:
          throw new Error(`不支持的API类型: ${apiType}`);
      }
    } catch (error) {
      console.error(`搜索失败 (${apiType}):`, error);
      
      // 如果默认API失败，尝试回退到其他API
      if (apiType === DEFAULT_API_TYPE) {
        const fallbackApis: (keyof typeof API_TYPES)[] = ['itunes-international', 'netease', 'qq'];
        
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
  
          coverUrl: song.artworkUrl100?.replace('100x100', '300x300'),
          releaseDate: song.releaseDate, // 添加发行日期
          platform: country === 'CN' ? 'itunes-domestic' : 'itunes-international',
          platformName: country === 'CN' ? API_TYPES['itunes-domestic'] : API_TYPES['itunes-international']
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

  // 使用Lokua_Music API搜索
  private async searchWithLokuaMusic(params: { keyword: string; limit?: number }, type: 'netease' | 'qq'): Promise<SongInfo[]> {
    try {
      console.log(`Lokua_Music API搜索开始，类型: ${type}，关键词: ${params.keyword}`);
      
      // 使用Lokua_Music API的统一入口
      const response = await fetch('https://lokuamusic.top/api/music', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: params.keyword,
          filter: 'name',
          type: type,
          page: 1
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Lokua_Music API原始响应数据:`, data);
      
      // 检查响应数据的各种可能结构
      let songs = [];
      if (data.data && data.data.song) {
        console.log(`找到歌曲列表在 data.data.song，数量: ${data.data.song.length}`);
        songs = data.data.song;
      } else if (data.data && Array.isArray(data.data)) {
        console.log(`找到歌曲列表在 data.data (数组)，数量: ${data.data.length}`);
        songs = data.data;
      } else if (Array.isArray(data)) {
        console.log(`找到歌曲列表在 data (数组)，数量: ${data.length}`);
        songs = data;
      } else {
        console.log(`未找到歌曲列表，响应结构:`, Object.keys(data));
        // 检查是否有其他可能的歌曲列表路径
        if (data.result && data.result.songs) {
          console.log(`找到歌曲列表在 data.result.songs，数量: ${data.result.songs.length}`);
          songs = data.result.songs;
        } else if (data.song) {
          console.log(`找到歌曲列表在 data.song，数量: ${Array.isArray(data.song) ? data.song.length : 0}`);
          songs = Array.isArray(data.song) ? data.song : [data.song];
        }
      }
      
      if (songs.length > 0) {
        return songs.map((song: any) => {
          // 处理发行日期
          let releaseDate = '';
          if (song.album && song.album.publishTime) {
            // 格式化为YYYY-MM-DD
            const date = new Date(song.album.publishTime);
            if (!isNaN(date.getTime())) {
              releaseDate = date.toISOString().split('T')[0];
            }
          } else if (song.publishTime) {
            const date = new Date(song.publishTime);
            if (!isNaN(date.getTime())) {
              releaseDate = date.toISOString().split('T')[0];
            }
          }
          
          // 处理封面图片，尝试从多个可能的字段中获取
          let coverUrl = '';
          // 尝试从歌曲对象中获取封面
          if (song.picUrl) coverUrl = song.picUrl;
          else if (song.cover) coverUrl = song.cover;
          else if (song.album && song.album.picUrl) coverUrl = song.album.picUrl;
          else if (song.album && song.album.cover) coverUrl = song.album.cover;
          else if (song.album && song.album.coverImgUrl) coverUrl = song.album.coverImgUrl;
          else if (song.album && song.album.blurPicUrl) coverUrl = song.album.blurPicUrl;
          else if (song.pic) coverUrl = song.pic;
          else if (song.albumpic) coverUrl = song.albumpic;
          else if (song.imageUrl) coverUrl = song.imageUrl;
          else if (song.albumId) {
            // 如果有专辑ID但没有封面，可以使用默认的封面URL格式
            if (type === 'netease') {
              coverUrl = `https://p2.music.126.net/${song.albumId}/1099511677777.jpg?param=300y300`;
            } else if (type === 'qq') {
              coverUrl = `https://y.gtimg.cn/music/photo_new/T002R300x300M000${song.albumId}.jpg`;
            }
          }
          
          // 确保封面URL是有效的
          if (coverUrl && typeof coverUrl === 'string') {
            // 修复可能的URL问题
            if (coverUrl.startsWith('//')) {
              coverUrl = `https:${coverUrl}`;
            }
            // 对于网易云音乐，确保使用高质量的封面
            if (type === 'netease' && coverUrl.includes('param=')) {
              coverUrl = coverUrl.replace(/param=\d+x\d+/, 'param=300y300');
            }
          } else {
            coverUrl = '';
          }
          
          // 处理歌曲名称，增加更多可能的字段映射
          let songName = '未知歌曲';
          if (song.name) songName = song.name;
          else if (song.title) songName = song.title;
          else if (song.songname) songName = song.songname;
          else if (song.songName) songName = song.songName;
          
          // 处理歌手名称，增加更多可能的字段映射
          let artistName = '未知歌手';
          if (song.singer) {
            artistName = Array.isArray(song.singer) ? song.singer.map((s: any) => s.name || s).join(', ') : song.singer;
          } else if (song.artists) {
            artistName = Array.isArray(song.artists) ? song.artists.map((a: any) => a.name || a).join(', ') : song.artists;
          } else if (song.artist) {
            artistName = Array.isArray(song.artist) ? song.artist.map((a: any) => a.name || a).join(', ') : song.artist;
          } else if (song.author) {
            artistName = Array.isArray(song.author) ? song.author.map((a: any) => a.name || a).join(', ') : song.author;
          } else if (song.songer) {
            artistName = song.songer;
          }
          
          // 处理专辑名称，增加更多可能的字段映射
          let albumName = '未知专辑';
          if (song.album?.name) albumName = song.album.name;
          else if (song.albumName) albumName = song.albumName;
          else if (song.album) albumName = typeof song.album === 'string' ? song.album : '未知专辑';
          else if (song.special) albumName = song.special;
          // 当所有专辑字段都没有值时，使用歌曲名称作为专辑名
          if (albumName === '未知专辑' || !albumName.trim()) {
            albumName = songName;
          }
          

          
          return {
            id: song.id || song.songid || Math.random().toString(36).substr(2, 9),
            name: songName,
            artist: artistName,
            album: albumName,
            coverUrl: coverUrl,
            releaseDate: releaseDate,
            platform: type,
            platformName: API_TYPES[type]
          };
        });
      } else {
        return [];
      }
    } catch (error) {
      console.warn(`${type === 'netease' ? '网易云音乐' : 'QQ音乐'} API请求失败:`, error);
      throw error;
    }
  }

  // 获取平台名称
  private getPlatformName(platform: string): string {
    const platformMap: Record<string, string> = {
      'itunes-domestic': 'Apple Music',
      'itunes-international': 'iTunes国际版',
      'netease': '网易云音乐',
      'qq': 'QQ音乐'
    };
    
    return platformMap[platform] || platform;
  }
}

export const musicApi = new MusicApiAdapter();