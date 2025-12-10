import { createClient } from '@supabase/supabase-js';
import { Song } from '../types';

// 从环境变量获取Supabase配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// 创建Supabase客户端实例
export const supabase = createClient(supabaseUrl, supabaseKey);

// 获取所有歌曲
export async function getAllSongs(): Promise<Song[]> {
  try {
    // 获取当前登录用户的ID
    const { data: authData, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authData?.user) {
      throw new Error('User not authenticated');
    }
    
    const user = authData.user;
  
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('user_id', user.id)
      .order('"addedAt"', { ascending: false });
    
    if (error) {
      console.error('Error fetching songs:', error);
      throw error;
    }
    
    return (data || []).map(song => ({
      ...song,
      // 确保时间戳类型匹配
      addedAt: typeof song.addedAt === 'number' ? song.addedAt : new Date(song.addedAt).getTime(),
      // 确保返回的对象包含所有需要的字段
      coverUrl: song.coverUrl || '',
      releaseDate: song.releaseDate || '',
      album: song.album || '',
      duration: song.duration || 0
    }));
  } catch (error) {
    // 处理AuthSessionMissingError或其他错误
    console.error('Error fetching songs:', error);
    throw error;
  }
}

// 添加新歌曲
export async function addSong(song: Song): Promise<Song> {
  try {
    // 获取当前登录用户的ID
    const { data: authData, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authData?.user) {
      throw new Error('User not authenticated');
    }
    
    const user = authData.user;
  
    const { data, error } = await supabase
      .from('songs')
      .insert([{
        id: song.id,
        title: song.title,
        artists: song.artists,
        album: song.album,
        "coverUrl": song.coverUrl || '',
        "releaseDate": song.releaseDate || '',
        "addedAt": new Date(song.addedAt),
        duration: song.duration || 0,
        user_id: user.id // 添加用户ID关联
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Error adding song:', error);
      throw error;
    }
    
    if (!data) {
      throw new Error('Failed to add song: No data returned');
    }
    
    return {
      ...data,
      addedAt: new Date(data.addedAt).getTime(),
      coverUrl: data.coverUrl || '',
      releaseDate: data.releaseDate || '',
      album: data.album || '',
      duration: data.duration || 0
    };
  } catch (error) {
    // 处理AuthSessionMissingError或其他错误
    console.error('Error adding song:', error);
    throw error;
  }
}

// 批量添加歌曲
export async function addSongs(songs: Song[]): Promise<Song[]> {
  if (songs.length === 0) {
    return [];
  }
  
  try {
    // 获取当前登录用户的ID
    const { data: authData, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authData?.user) {
      throw new Error('User not authenticated');
    }
    
    const user = authData.user;
  
    // 准备批量插入的数据
    const songsToInsert = songs.map(song => ({
      id: song.id,
      title: song.title,
      artists: song.artists,
      album: song.album,
      "coverUrl": song.coverUrl || '',
      "releaseDate": song.releaseDate || '',
      "addedAt": new Date(song.addedAt),
      duration: song.duration || 0,
      user_id: user.id // 添加用户ID关联
    }));
    
    // 批量插入到Supabase
    const { data, error } = await supabase
      .from('songs')
      .insert(songsToInsert)
      .select();
    
    if (error) {
      console.error('Error adding songs in bulk:', error);
      throw error;
    }
    
    if (!data) {
      throw new Error('Failed to add songs: No data returned');
    }
    
    // 转换返回的数据格式
    return data.map(song => ({
      ...song,
      addedAt: new Date(song.addedAt).getTime(),
      coverUrl: song.coverUrl || '',
      releaseDate: song.releaseDate || '',
      album: song.album || '',
      duration: song.duration || 0
    }));
  } catch (error) {
    // 处理AuthSessionMissingError或其他错误
    console.error('Error adding songs in bulk:', error);
    throw error;
  }
}

// 更新歌曲信息
export async function updateSong(songId: string, updatedFields: Partial<Song>): Promise<Song> {
  try {
    // 获取当前登录用户的ID
    const { data: authData, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authData?.user) {
      throw new Error('User not authenticated');
    }
    
    const user = authData.user;
  
    // 构建更新对象，确保驼峰命名的列名使用双引号
    const updateData: any = {};
    
    // 只在提供了这些字段时才更新
    if (updatedFields.title !== undefined) {
      updateData.title = updatedFields.title;
    }
    if (updatedFields.artists !== undefined) {
      updateData.artists = updatedFields.artists;
    }
    if (updatedFields.album !== undefined) {
      updateData.album = updatedFields.album;
    }
    if (updatedFields.duration !== undefined) {
      updateData.duration = updatedFields.duration;
    }
    if (updatedFields.coverUrl !== undefined) {
      updateData["coverUrl"] = updatedFields.coverUrl;
    }
    if (updatedFields.releaseDate !== undefined) {
      updateData["releaseDate"] = updatedFields.releaseDate;
    }
    if (updatedFields.addedAt !== undefined) {
      updateData["addedAt"] = new Date(updatedFields.addedAt);
    }
    
    const { data, error } = await supabase
      .from('songs')
      .update(updateData)
      .eq('id', songId)
      .eq('user_id', user.id) // 只允许更新当前用户的歌曲
      .select()
      .single();
    
    if (error) {
      console.error('Error updating song:', error);
      throw error;
    }
    
    if (!data) {
      throw new Error('Failed to update song: No data returned');
    }
    
    return {
      ...data,
      addedAt: new Date(data.addedAt).getTime(),
      coverUrl: data.coverUrl || '',
      releaseDate: data.releaseDate || '',
      album: data.album || '',
      duration: data.duration || 0
    };
  } catch (error) {
    // 处理AuthSessionMissingError或其他错误
    console.error('Error updating song:', error);
    throw error;
  }
}

// 删除歌曲
export async function deleteSong(songId: string): Promise<void> {
  try {
    // 获取当前登录用户的ID
    const { data: authData, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authData?.user) {
      throw new Error('User not authenticated');
    }
    
    const user = authData.user;
  
    const { error: deleteError } = await supabase
      .from('songs')
      .delete()
      .eq('id', songId)
      .eq('user_id', user.id); // 只允许删除当前用户的歌曲
    
    if (deleteError) {
      console.error('Error deleting song:', deleteError);
      throw deleteError;
    }
  } catch (error) {
    // 处理AuthSessionMissingError或其他错误
    console.error('Error deleting song:', error);
    throw error;
  }
}
