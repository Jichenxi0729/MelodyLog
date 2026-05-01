import { Song } from '../types';

/**
 * 将歌曲数据导出为CSV格式
 */
export const exportSongsToCSV = (songs: Song[]): void => {
  const headers = ['歌名', '歌手', '专辑', '年份', '封面图片URL', '标签', '添加时间'];
  
  const csvContent = [
    headers.join(','),
    ...songs.map(song => {
      const year = song.releaseDate
        ? typeof song.releaseDate === 'string' && song.releaseDate.length >= 4
          ? song.releaseDate.substring(0, 4)
          : ''
        : '';
      
      const addedTime = new Date(song.addedAt).toLocaleString('zh-CN');
      const tags = (song.tags || []).join(';');
      
      const values = [
        escapeCSV(song.title),
        escapeCSV(song.artists.join('/')),
        escapeCSV(song.album || ''),
        year,
        escapeCSV(song.coverUrl || ''),
        escapeCSV(tags),
        escapeCSV(addedTime)
      ];
      
      return values.join(',');
    })
  ].join('\n');
  
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `MelodyLog_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * 将歌曲数据导出为JSON格式（完整数据，包含歌词）
 */
export const exportSongsToJSON = (songs: Song[]): void => {
  const exportData = {
    appName: 'MelodyLog',
    version: '1.0',
    exportDate: new Date().toISOString(),
    totalSongs: songs.length,
    songs: songs.map(song => ({
      id: song.id,
      title: song.title,
      artists: song.artists,
      album: song.album || '',
      coverUrl: song.coverUrl || '',
      releaseDate: song.releaseDate || '',
      tags: song.tags || [],
      duration: song.duration,
      lyrics: song.lyrics || '',
      comment: song.comment || '',
      addedAt: song.addedAt,
    }))
  };
  
  const jsonContent = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `MelodyLog_${new Date().toISOString().split('T')[0]}.json`);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const escapeCSV = (text: string): string => {
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};
