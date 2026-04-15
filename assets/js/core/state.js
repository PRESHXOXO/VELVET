import { readStorage, writeStorage, readSession, writeSession } from './storage.js';

export const state = {
  liked: readStorage('vlv_liked', []),
  recent: readStorage('vlv_recent', []),
  playlists: readStorage('vlv_playlists', []),
  queue: readSession('vlv_queue', []),
  queueIndex: readSession('vlv_queue_index', 0),
  currentTrack: readSession('vlv_current_track', null),
  volume: readSession('vlv_volume', 65),
  isPlaying: false
};

export function syncLibrary(){
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
  const playlist = { id: Date.now(), name: trimmed, songs: [] };
  state.playlists = [playlist, ...state.playlists];
  syncLibrary();
  return playlist;
}

export function addTrackToPlaylist(track, playlistId){
  const playlist = state.playlists.find(item => item.id === playlistId);
  if(!playlist || !track?.videoId){ return false; }
  if(playlist.songs.some(song => song.videoId === track.videoId)){ return false; }
  playlist.songs.push(track);
  syncLibrary();
  return true;
}
