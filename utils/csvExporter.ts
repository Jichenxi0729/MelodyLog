import { Song } from '../types';

/**
 * 将歌曲数据导出为CSV格式
 * @param songs 歌曲数组
 */
export const exportSongsToCSV = (songs: Song[]): void => {
  // CSV表头
  const headers = ['序号', '歌名', '歌手', '专辑', '年份'];
  
  // 准备CSV数据
  const csvContent = [
    headers.join(','), // 表头行
    ...songs.map((song, index) => {
      // 从releaseDate中提取年份，如果没有则为空
      const year = song.releaseDate
        ? typeof song.releaseDate === 'string' && song.releaseDate.length >= 4
          ? song.releaseDate.substring(0, 4)
          : ''
        : '';
      
      // 构建CSV行，处理特殊字符
      const values = [
        (index + 1).toString(), // 序号
        escapeCSV(song.title), // 歌名
        escapeCSV(song.artists.join('/')), // 歌手
        escapeCSV(song.album || ''), // 专辑
        year // 年份
      ];
      
      return values.join(',');
    })
  ].join('\n');
  
  // 创建Blob对象
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  
  // 创建下载链接
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  // 设置链接属性
  link.setAttribute('href', url);
  link.setAttribute('download', `MelodyLog_Export_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.display = 'none';
  
  // 添加到文档并触发点击
  document.body.appendChild(link);
  link.click();
  
  // 清理
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * 转义CSV中的特殊字符
 * @param text 需要转义的文本
 * @returns 转义后的文本
 */
const escapeCSV = (text: string): string => {
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    // 用双引号包裹并转义内部的双引号
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};