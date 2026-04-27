import { readStorage, writeStorage, readSession, writeSession } from './storage.js';

const PLATFORM_PLAY_BASELINES = {
  'w9XLDme8HQ4': 182
};

const REPEAT_MODES = new Set(['off', 'all', 'one']);

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

function normalizePlayCounts(value = {}) {
  const next = { ...PLATFORM_PLAY_BASELINES };

  if (!value || typeof value !== 'object') {
    return next;
  }

  Object.entries(value).forEach(([videoId, count]) => {
    const safeVideoId = String(videoId || '').trim();
    const safeCount = Math.max(0, Number(count) || 0);
    if (!safeVideoId || !safeCount) return;
    next[safeVideoId] = safeCount;
  });

  return next;
}

function normalizeDailyPick(value = null) {
  if (!value || typeof value !== 'object') return null;

  const date = String(value.date || '').trim();
  const videoId = String(value.videoId || '').trim();
  if (!date || !videoId) return null;

  return { date, videoId };
}

function normalizeShuffle(value = false) {
  return Boolean(value);
}

function normalizeRepeatMode(value = 'off') {
  const safeValue = String(value || 'off').trim().toLowerCase();
  return REPEAT_MODES.has(safeValue) ? safeValue : 'off';
}

function getTodayStamp() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTopPlayedVideoId() {
  const entries = Object.entries(state.playCounts || {}).sort((a, b) => {
    const delta = (Number(b[1]) || 0) - (Number(a[1]) || 0);
    if (delta !== 0) return delta;
    return String(a[0]).localeCompare(String(b[0]));
  });

  return entries[0]?.[0] || '';
}

export const state = {
  liked: readStorage('vlv_liked', []),
  recent: readStorage('vlv_recent', []),
  playlists: readStorage('vlv_playlists', []).map(normalizePlaylist),
  favoriteStations: readStorage('vlv_favorite_stations', []),
  recentStations: readStorage('vlv_recent_stations', []),
  favoriteArtists: readStorage('vlv_favorite_artists', []),
  recentArtists: readStorage('vlv_recent_artists', []),
  playCounts: normalizePlayCounts(readStorage('vlv_play_counts', {})),
  dailyPick: normalizeDailyPick(readStorage('vlv_daily_pick', null)),
  queue: readSession('vlv_queue', []),
  queueIndex: readSession('vlv_queue_index', 0),
  currentTrack: readSession('vlv_current_track', null),
  volume: readSession('vlv_volume', 65),
  shuffle: normalizeShuffle(readSession('vlv_shuffle', false)),
  repeatMode: normalizeRepeatMode(readSession('vlv_repeat_mode', 'off')),
  isPlaying: false
};

export function refreshLibraryState(){
  state.liked = readStorage('vlv_liked', []);
  state.recent = readStorage('vlv_recent', []);
  state.playlists = readStorage('vlv_playlists', []).map(normalizePlaylist);
  state.favoriteStations = readStorage('vlv_favorite_stations', []);
  state.recentStations = readStorage('vlv_recent_stations', []);
  state.favoriteArtists = readStorage('vlv_favorite_artists', []);
  state.recentArtists = readStorage('vlv_recent_artists', []);
  state.playCounts = normalizePlayCounts(readStorage('vlv_play_counts', {}));
  state.dailyPick = normalizeDailyPick(readStorage('vlv_daily_pick', null));
}

export function syncLibrary(){
  state.playlists = state.playlists.map(normalizePlaylist);
  writeStorage('vlv_liked', state.liked);
  writeStorage('vlv_recent', state.recent);
  writeStorage('vlv_playlists', state.playlists);
  writeStorage('vlv_favorite_stations', state.favoriteStations);
  writeStorage('vlv_recent_stations', state.recentStations);
  writeStorage('vlv_favorite_artists', state.favoriteArtists);
  writeStorage('vlv_recent_artists', state.recentArtists);
  writeStorage('vlv_play_counts', state.playCounts);
  writeStorage('vlv_daily_pick', state.dailyPick);
}

export function syncPlayback(){
  writeSession('vlv_queue', state.queue);
  writeSession('vlv_queue_index', state.queueIndex);
  writeSession('vlv_current_track', state.currentTrack);
  writeSession('vlv_volume', state.volume);
  writeSession('vlv_shuffle', state.shuffle);
  writeSession('vlv_repeat_mode', state.repeatMode);
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

export function recordTrackPlay(track){
  if(!track?.videoId){ return 0; }

  const safeVideoId = String(track.videoId).trim();
  const nextCount = (Number(state.playCounts[safeVideoId]) || 0) + 1;
  state.playCounts = {
    ...state.playCounts,
    [safeVideoId]: nextCount
  };
  syncLibrary();
  return nextCount;
}

export function registerTrackPlayback(track){
  if(!track?.videoId){ return 0; }
  state.recent = [track, ...state.recent.filter(item => item.videoId !== track.videoId)].slice(0, 18);

  const safeVideoId = String(track.videoId).trim();
  const nextCount = (Number(state.playCounts[safeVideoId]) || 0) + 1;
  state.playCounts = {
    ...state.playCounts,
    [safeVideoId]: nextCount
  };

  syncLibrary();
  return nextCount;
}

export function getTrackPlayCount(videoId){
  const safeVideoId = String(videoId || '').trim();
  return safeVideoId ? (Number(state.playCounts[safeVideoId]) || 0) : 0;
}

export function getVelvetPickVideoId(fallbackVideoId = ''){
  const today = getTodayStamp();
  const currentPick = normalizeDailyPick(state.dailyPick);
  if (currentPick?.date === today && currentPick.videoId) {
    return currentPick.videoId;
  }

  const nextVideoId = getTopPlayedVideoId() || String(fallbackVideoId || '').trim();
  state.dailyPick = nextVideoId ? { date: today, videoId: nextVideoId } : null;
  syncLibrary();
  return nextVideoId;
}

export function toggleShufflePlayback(){
  state.shuffle = !state.shuffle;
  syncPlayback();
  return state.shuffle;
}

export function cycleRepeatMode(){
  state.repeatMode = state.repeatMode === 'off'
    ? 'all'
    : (state.repeatMode === 'all' ? 'one' : 'off');
  syncPlayback();
  return state.repeatMode;
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

export function isFavoriteArtist(slug){
  const safeSlug = String(slug || '').trim();
  return safeSlug ? state.favoriteArtists.includes(safeSlug) : false;
}

export function toggleFavoriteArtist(slug){
  const safeSlug = String(slug || '').trim();
  if(!safeSlug){ return false; }

  const exists = isFavoriteArtist(safeSlug);
  state.favoriteArtists = exists
    ? state.favoriteArtists.filter(item => item !== safeSlug)
    : [safeSlug, ...state.favoriteArtists.filter(item => item !== safeSlug)].slice(0, 18);
  syncLibrary();
  return !exists;
}

export function pushRecentArtist(slug){
  const safeSlug = String(slug || '').trim();
  if(!safeSlug){ return; }

  state.recentArtists = [safeSlug, ...state.recentArtists.filter(item => item !== safeSlug)].slice(0, 18);
  syncLibrary();
}
