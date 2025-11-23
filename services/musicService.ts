import { ItunesResponse } from '../types';

// We use iTunes Search API as a robust, key-free alternative to Last.fm/Spotify for this demo.
// It provides cover art and release dates reliably without requiring the user to configure an API key.
const ITUNES_API_URL = 'https://itunes.apple.com/search';

export const fetchSongMetadata = async (title: string, artist: string): Promise<{ coverUrl?: string; releaseDate?: string; album?: string }> => {
  try {
    const query = `${title} ${artist}`;
    const url = `${ITUNES_API_URL}?term=${encodeURIComponent(query)}&entity=song&limit=1`;
    
    // Note: iTunes API typically allows CORS from simple fetch requests.
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data: ItunesResponse = await response.json();

    if (data.resultCount > 0) {
      const track = data.results[0];
      return {
        coverUrl: track.artworkUrl100.replace('100x100', '300x300'), // Get higher res
        releaseDate: track.releaseDate,
        album: track.collectionName
      };
    }
  } catch (error) {
    console.warn('Failed to fetch metadata:', error);
  }

  return {};
};