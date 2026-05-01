import { useState, useCallback } from 'react';
import { ViewState } from '../types';

export const useNavigation = () => {
  const [view, setView] = useState<ViewState>({ type: 'HOME' });
  const [navigationHistory, setNavigationHistory] = useState<ViewState[]>([{ type: 'HOME' }]);

  const navigateTo = useCallback((newView: ViewState, scrollToTop = true) => {
    setNavigationHistory(prev => [...prev, newView]);
    setView(newView);
    if (scrollToTop) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const navigateBack = useCallback(() => {
    if (navigationHistory.length > 1) {
      const newHistory = navigationHistory.slice(0, -1);
      const previousView = newHistory[newHistory.length - 1];
      
      setNavigationHistory(newHistory);
      setView(previousView);
      
      return previousView;
    } else {
      const homeView = { type: 'HOME' as const };
      setView(homeView);
      return homeView;
    }
  }, [navigationHistory]);

  const navigateToHome = useCallback(() => {
    navigateTo({ type: 'HOME' });
  }, [navigateTo]);

  const navigateToArtists = useCallback(() => {
    navigateTo({ type: 'ARTISTS' });
  }, [navigateTo]);

  const navigateToAlbums = useCallback(() => {
    navigateTo({ type: 'ALBUMS' });
  }, [navigateTo]);

  const navigateToTags = useCallback(() => {
    navigateTo({ type: 'TAGS' });
  }, [navigateTo]);

  const navigateToMyPage = useCallback(() => {
    navigateTo({ type: 'MY_PAGE' });
  }, [navigateTo]);

  const navigateToArtistDetail = useCallback((artist: string) => {
    navigateTo({ type: 'ARTIST_DETAIL', data: artist });
  }, [navigateTo]);

  const navigateToAlbumDetail = useCallback((album: string) => {
    navigateTo({ type: 'ALBUM_DETAIL', data: album });
  }, [navigateTo]);

  const navigateToArtistAlbums = useCallback((artist: string) => {
    navigateTo({ type: 'ARTIST_ALBUMS', data: artist });
  }, [navigateTo]);

  const navigateToSongDetail = useCallback((songId: string) => {
    navigateTo({ type: 'SONG_DETAIL', data: songId });
  }, [navigateTo]);

  return {
    view,
    navigationHistory,
    navigateTo,
    navigateBack,
    navigateToHome,
    navigateToArtists,
    navigateToAlbums,
    navigateToTags,
    navigateToMyPage,
    navigateToArtistDetail,
    navigateToAlbumDetail,
    navigateToArtistAlbums,
    navigateToSongDetail,
  };
};
