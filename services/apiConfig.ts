// API 配置 - 集中管理所有外部 API URL

const API_CONFIG = {
  /** TuneHub API 基础 URL */
  TUNEHUB_BASE_URL: 'https://music-dl.sayqz.com/api',
  /** iTunes 搜索 API 基础 URL */
  ITUNES_BASE_URL: 'https://itunes.apple.com/search',
  /** lrclib.net 歌词搜索 API 基础 URL */
  LRCLIB_SEARCH_URL: 'https://lrclib.net/api/search',
  /** 硅基流动大模型 API 配置 */
  SILICON_FLOW: {
    API_KEY: import.meta.env.VITE_SILICON_FLOW_API_KEY || '',
    BASE_URL: 'https://api.siliconflow.cn/v1',
    MODEL: 'Pro/deepseek-ai/DeepSeek-V3',
  },
} as const;

export default API_CONFIG;
