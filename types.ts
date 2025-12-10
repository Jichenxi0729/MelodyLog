export interface Song {
  id: string;
  title: string;
  artists: string[]; // 支持多位歌手
  album?: string;
  coverUrl?: string;
  releaseDate?: string; // ISO String or Year
  addedAt: number; // Timestamp
  duration?: number; // Duration in seconds
  // 以下是现有表中额外的字段
  lyrics?: string;
  comment?: string;
  tags?: string[];
  listenedDate?: string;
  rating?: number;
  spotifyUrl?: string;
  neteaseUrl?: string;
  youtubeUrl?: string;
}

export type SortOption = 'newest' | 'oldest' | 'artist';

export type ViewType = 'HOME' | 'ARTISTS' | 'ALBUMS' | 'MY_PAGE' | 'ARTIST_DETAIL' | 'ALBUM_DETAIL' | 'SONG_DETAIL';

export interface ViewState {
  type: ViewType;
  data?: string; // Used for Artist Name or Album Name
}

export interface ItunesResponse {
  resultCount: number;
  results: Array<{
    trackName: string;
    artistName: string;
    collectionName: string;
    artworkUrl100: string;
    releaseDate: string;
  }>;
}