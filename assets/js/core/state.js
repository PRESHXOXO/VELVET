import { readStorage, writeStorage, readSession, writeSession } from './storage.js';

function normalizePlaylist(playlist = {}) {
  const stamp = Number(playlist?.updatedAt || playlist?.createdAt || playlist?.id) || Date.now();

  return {
    id: playlist.id || stamp,
    name: String(playlist.name || 'Untitled Playlist').trim() || 'Untitled Playlist',
    songs: Array.isArray(playlist.songs) ? playlist.songs : [],
    createdAt: Number(playlist.createdAt || stamp),
    updatedAt: Number(playlist.updatedAt || stamp)
  };
}

export const state = {
  liked: readStorage('vlv_liked', []),
  recent: readStorage('vlv_recent', []),
  playlists: readStorage('vlv_playlists', []).map(normalizePlaylist),
  favoriteStations: readStorage('vlv_favorite_stations', []),
  recentStations: readStorage('vlv_recent_stations', []),
  queue: readSession('vlv_queue', []),
  queueIndex: readSession('vlv_queue_index', 0),
  currentTrack: readSession('vlv_current_track', null),
  volume: readSession('vlv_volume', 65),
  isPlaying: false
};

export function refreshLibraryState(){
  state.liked = readStorage('vlv_liked', []);
  state.recent = readStorage('vlv_recent', []);
  state.playlists = readStorage('vlv_playlists', []).map(normalizePlaylist);
  state.favoriteStations = readStorage('vlv_favorite_stations', []);
  state.recentStations = readStorage('vlv_recent_stations', []);
}

export function syncLibrary(){
  state.playlists = state.playlists.map(normalizePlaylist);
  writeStorage('vlv_liked', state.liked);
  writeStorage('vlv_recent', state.recent);
  writeStorage('vlv_playlists', state.playlists);
  writeStorage('vlv_favorite_stations', state.favoriteStations);
  writeStorage('vlv_recent_stations', state.recentStations);
}

export function syncPlayback(){
  writeSession('vlv_queue', state.queue);
  writeSession('vlv_queue_index', state.queueIndex);
  writeSession('vlv_current_track', state.currentTrack);
  writeSession('vlv_volume', state.volume);
}

export function isLiked(videoId){
  return state.liked.some(track => track.videoId === videoId);
}

export function toggleLike(track){
  if(!track?.videoId){ return false; }
  const exists = isLiked(track.videoId);
  state.liked = exists
    ? state.liked.filter(item => item.videoId !== track.videoId)
    : [track, ...state.liked];
  syncLibrary();
  return !exists;
}

export function pushRecent(track){
  if(!track?.videoId){ return; }
  state.recent = [track, ...state.recent.filter(item => item.videoId !== track.videoId)].slice(0, 18);
  syncLibrary();
}

export function createPlaylist(name){
  const trimmed = String(name || '').trim();
  if(!trimmed){ return null; }
  const stamp = Date.now();
  const playlist = normalizePlaylist({ id: stamp, name: trimmed, songs: [], createdAt: stamp, updatedAt: stamp });
  state.playlists = [playlist, ...state.playlists];
  syncLibrary();
  return playlist;
}

export function createPlaylistFromTracks(name, tracks = []){
  const validTracks = tracks.filter(track => track?.videoId);
  if(!validTracks.length){ return null; }

  const playlist = createPlaylist(name);
  if(!playlist){ return null; }

  const seen = new Set();
  playlist.songs = validTracks.filter(track => {
    if(!track?.videoId || seen.has(track.videoId)){ return false; }
    seen.add(track.videoId);
    return true;
  });
  playlist.updatedAt = Date.now();
  syncLibrary();
  return playlist;
}

export function addTrackToPlaylist(track, playlistId){
  const playlist = state.playlists.find(item => item.id === playlistId);
  if(!playlist || !track?.videoId){ return false; }
  if(playlist.songs.some(song => song.videoId === track.videoId)){ return false; }
  playlist.songs.push(track);
  playlist.updatedAt = Date.now();
  syncLibrary();
  return true;
}

export function isFavoriteStation(index){
  const safeIndex = Number(index);
  return state.favoriteStations.includes(safeIndex);
}

export function toggleFavoriteStation(index){
  const safeIndex = Number(index);
  if(!Number.isInteger(safeIndex) || safeIndex < 0){ return false; }

  const exists = isFavoriteStation(safeIndex);
  state.favoriteStations = exists
    ? state.favoriteStations.filter(item => item !== safeIndex)
    : [safeIndex, ...state.favoriteStations.filter(item => item !== safeIndex)].slice(0, 12);
  syncLibrary();
  return !exists;
}

export function pushRecentStation(index){
  const safeIndex = Number(index);
  if(!Number.isInteger(safeIndex) || safeIndex < 0){ return; }

  state.recentStations = [safeIndex, ...state.recentStations.filter(item => item !== safeIndex)].slice(0, 12);
  syncLibrary();
}
