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
}

export function syncLibrary(){
  state.playlists = state.playlists.map(normalizePlaylist);
  writeStorage('vlv_liked', state.liked);
  writeStorage('vlv_recent', state.recent);
  writeStorage('vlv_playlists', state.playlists);
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

export function addTrackToPlaylist(track, playlistId){
  const playlist = state.playlists.find(item => item.id === playlistId);
  if(!playlist || !track?.videoId){ return false; }
  if(playlist.songs.some(song => song.videoId === track.videoId)){ return false; }
  playlist.songs.push(track);
  playlist.updatedAt = Date.now();
  syncLibrary();
  return true;
}
