/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  // 其他环境变量可以在这里添加
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}