import React, { useMemo, useState } from 'react';
import { Song } from '../types';
import { SongCard } from './SongCard';
import { ArrowLeft, Disc, Calendar, User } from 'lucide-react';

interface AlbumDetailProps {
  album: string;
  songs: Song[];
  onBack: () => void;
  onArtistClick: (artist: string) => void;
  onDeleteSong: (songId: string) => void;
  onSongClick?: (songId: string) => void;
  onUpdateAlbum: (oldAlbumName: string, newAlbumName: string) => Promise<void>;
}

export const AlbumDetail: React.FC<AlbumDetailProps> = ({ album, songs, onBack, onArtistClick, onDeleteSong, onSongClick, onUpdateAlbum }) => {
  const [isEditingAlbum, setIsEditingAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState(album);

  const handleSaveAlbumName = async () => {
    if (newAlbumName.trim() && newAlbumName !== album) {
      await onUpdateAlbum(album, newAlbumName.trim());
      setIsEditingAlbum(false);
    }
  };
  const albumSongs = useMemo(() => {
    return songs
      .filter(s => s.album === album)
      .sort((a, b) => b.addedAt - a.addedAt);
  }, [songs, album]);

  // Use metadata from the first found song of this album
  const metadata = albumSongs[0] || { artists: [], releaseDate: null, coverUrl: '', id: '' };
  const releaseYear = metadata.releaseDate ? new Date(metadata.releaseDate).getFullYear() : null;

  return (
    <div className="animate-in slide-in-from-right-4 duration-300">
      <button 
        onClick={onBack}
        className="flex items-center gap-1 text-slate-500 hover:text-brand-light mb-4 text-sm font-medium transition-colors"
      >
        <ArrowLeft size={16} /> 返回
      </button>

      <div className="flex flex-col md:flex-row gap-6 mb-8 items-start">
        {/* Large Album Art */}
        <div className="w-40 h-40 md:w-52 md:h-52 rounded-xl shadow-xl overflow-hidden flex-shrink-0 bg-slate-200 border-4 border-white">
             <img
              src={metadata.coverUrl || `https://picsum.photos/seed/${metadata.id}/400`}
              alt={album}
              className="w-full h-full object-cover"
            />
        </div>

        {/* Album Info */}
        <div className="flex-1 pt-2">
            <span className="text-brand-light font-semibold text-xs uppercase tracking-wider bg-blue-50 px-2 py-1 rounded-md">专辑</span>
            {isEditingAlbum ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  value={newAlbumName}
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  className="text-2xl md:text-4xl font-bold text-slate-900 border-b-2 border-brand-light pb-1 focus:outline-none"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveAlbumName();
                    if (e.key === 'Escape') {
                      setNewAlbumName(album);
                      setIsEditingAlbum(false);
                    }
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveAlbumName}
                    className="px-3 py-1 bg-brand-light text-white rounded-md hover:bg-brand-medium transition-colors"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => {
                      setNewAlbumName(album);
                      setIsEditingAlbum(false);
                    }}
                    className="px-3 py-1 bg-slate-200 text-slate-700 rounded-md hover:bg-slate-300 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <h1 
                className="text-2xl md:text-4xl font-bold text-slate-900 mt-2 mb-2 leading-tight cursor-pointer hover:text-brand-light transition-colors"
                onClick={() => setIsEditingAlbum(true)}
                title="点击修改专辑名称"
              >
                {album}
              </h1>
            )}
            
            <div className="space-y-2">
                <div className="text-lg text-slate-600 font-medium flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        <User size={14} /> 
                    </span>
                    <div className="flex flex-wrap gap-1">
                        {metadata.artists.map((artist, index) => (
                            <span
                                key={index}
                                onClick={() => onArtistClick(artist)}
                                className="hover:text-brand-light cursor-pointer transition-colors"
                            >
                                {artist}{index < metadata.artists.length - 1 ? '/' : ''}
                            </span>
                        ))}
                    </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-slate-500 mt-4">
                    {releaseYear && (
                        <span className="flex items-center gap-1">
                            <Calendar size={14} /> {releaseYear}
                        </span>
                    )}
                    <span className="flex items-center gap-1">
                        <Disc size={14} /> {albumSongs.length} 首歌曲
                    </span>
                </div>
            </div>
        </div>
      </div>

      {/* Songs List */}
      <h3 className="text-lg font-bold text-slate-800 mb-4 px-1 border-b border-slate-100 pb-2">包含曲目</h3>
      <div className="space-y-3">
        {albumSongs.map(song => (
          <SongCard 
            key={song.id} 
            song={song} 
            onArtistClick={onArtistClick}
            onDelete={() => onDeleteSong(song.id)}
            onSongClick={onSongClick}
            // No album click needed
          />
        ))}
      </div>
    </div>
  );
};