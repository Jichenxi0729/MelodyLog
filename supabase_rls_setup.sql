-- Supabase RLS (Row Level Security) 配置脚本
-- 此脚本将为songs表启用RLS并配置访问策略

-- 1. 为songs表启用RLS
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;

-- 2. 配置RLS策略

-- 允许用户查看自己的歌曲
CREATE POLICY "Users can view their own songs" 
  ON songs 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- 允许用户添加自己的歌曲
CREATE POLICY "Users can add their own songs" 
  ON songs 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- 允许用户更新自己的歌曲
CREATE POLICY "Users can update their own songs" 
  ON songs 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- 允许用户删除自己的歌曲
CREATE POLICY "Users can delete their own songs" 
  ON songs 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- 3. 可选：为匿名用户提供有限的访问权限（如果需要）
-- 以下策略将允许匿名用户查看所有歌曲，但不能修改
-- CREATE POLICY "Allow anonymous users to view all songs" 
--   ON songs 
--   FOR SELECT 
--   TO anon 
--   USING (true);

-- 4. 可选：为管理员用户提供完全访问权限（如果需要）
-- 以下策略将允许管理员用户访问所有歌曲
-- CREATE POLICY "Allow admins to access all songs" 
--   ON songs 
--   USING (EXISTS (
--     SELECT 1 FROM auth.users u 
--     WHERE u.id = auth.uid() 
--     AND u.email = 'admin@example.com' -- 替换为你的管理员邮箱
--   ));
