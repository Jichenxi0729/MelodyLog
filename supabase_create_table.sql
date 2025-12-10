-- 创建songs表的SQL脚本
-- 在Supabase SQL编辑器中运行此脚本以创建正确的表结构

-- 先删除现有的表（如果存在），确保重新创建正确的结构
DROP TABLE IF EXISTS songs;

CREATE TABLE songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artists TEXT[] NOT NULL,
  album TEXT,
  "coverUrl" TEXT,
  "releaseDate" TEXT,
  "addedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration INTEGER,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  -- 创建索引以提高查询性能
  CONSTRAINT unique_song UNIQUE(title, artists)
);

-- 创建必要的索引
CREATE INDEX IF NOT EXISTS idx_songs_addedAt ON songs("addedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_songs_artists ON songs USING GIN(artists);
CREATE INDEX IF NOT EXISTS idx_songs_user_id ON songs(user_id);
CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
CREATE INDEX IF NOT EXISTS idx_songs_album ON songs(album);
CREATE INDEX IF NOT EXISTS idx_songs_coverUrl ON songs("coverUrl");
CREATE INDEX IF NOT EXISTS idx_songs_releaseDate ON songs("releaseDate");