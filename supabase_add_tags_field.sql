-- 为songs表添加tags字段
-- 在Supabase SQL编辑器中运行此脚本

-- 方法1: 直接添加字段（推荐，不会影响现有数据）
ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 方法2: 如果您需要重建整个表（包含所有字段，包括tags）
-- 注意：此方法会删除所有现有数据，请谨慎使用！
-- DROP TABLE IF EXISTS songs;
-- CREATE TABLE songs (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   title TEXT NOT NULL,
--   artists TEXT[] NOT NULL,
--   album TEXT,
--   "coverUrl" TEXT,
--   "releaseDate" TEXT,
--   "addedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--   duration INTEGER,
--   tags TEXT[] DEFAULT '{}',
--   user_id UUID REFERENCES auth.users(id) NOT NULL,
--   CONSTRAINT unique_song UNIQUE(title, artists)
-- );

-- 为tags字段创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_songs_tags ON songs USING GIN(tags);

-- 验证字段是否添加成功
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'songs' 
  AND column_name = 'tags';

-- 查看完整的表结构
\d+ songs