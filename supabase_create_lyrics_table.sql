-- 创建lyrics表的SQL脚本
-- 在Supabase SQL编辑器中运行此脚本以创建歌词表结构

-- 先删除现有的表（如果存在），确保重新创建正确的结构
DROP TABLE IF EXISTS lyrics;

CREATE TABLE lyrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE NOT NULL,
  song_title TEXT NOT NULL,
  artist_name TEXT,
  plain_lyrics TEXT,
  synced_lyrics TEXT,
  source TEXT DEFAULT 'manual',
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- 创建唯一约束：每首歌每个用户只能有一条歌词记录
  CONSTRAINT unique_song_lyrics UNIQUE(song_id, user_id)
);

-- 创建必要的索引
CREATE INDEX IF NOT EXISTS idx_lyrics_song_id ON lyrics(song_id);
CREATE INDEX IF NOT EXISTS idx_lyrics_user_id ON lyrics(user_id);
CREATE INDEX IF NOT EXISTS idx_lyrics_song_title ON lyrics(song_title);
CREATE INDEX IF NOT EXISTS idx_lyrics_artist_name ON lyrics(artist_name);
CREATE INDEX IF NOT EXISTS idx_lyrics_created_at ON lyrics(created_at DESC);

-- 创建更新时间戳的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
DROP TRIGGER IF EXISTS update_lyrics_updated_at ON lyrics;
CREATE TRIGGER update_lyrics_updated_at
    BEFORE UPDATE ON lyrics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 添加注释
COMMENT ON TABLE lyrics IS '用户歌词库，存储手动添加或同步的歌词';
COMMENT ON COLUMN lyrics.song_id IS '关联的歌曲ID';
COMMENT ON COLUMN lyrics.plain_lyrics IS '纯文本歌词，每行用换行符分隔';
COMMENT ON COLUMN lyrics.synced_lyrics IS '同步歌词，JSON格式：[{"time":"00:00.00","text":"歌词内容"}]';
COMMENT ON COLUMN lyrics.source IS '歌词来源：manual(手动添加)、lrclib(api获取)、import(导入)';