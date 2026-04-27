import { readStorage, writeStorage, readSession, writeSession } from './storage.js';
import { normalizeText, sanitizePlaylistName, sanitizeTrack, sanitizeTrackList, safeVideoId } from './sanitize.js';

const PLATFORM_PLAY_BASELINES = {
  'w9XLDme8HQ4': 182
};

const REPEAT_MODES = new Set(['off', 'all', 'one']);
const MAX_LIBRARY_TRACKS = 120;
const MAX_PLAYLISTS = 40;
const MAX_PLAYLIST_TRACKS = 250;
const MAX_FAVORITE_STATIONS = 12;
const MAX_RECENT_STATIONS = 12;
const MAX_FAVORITE_ARTISTS = 18;
const MAX_RECENT_ARTISTS = 18;
const MAX_PLAY_COUNT_KEYS = 500;

function normalizeStringList(values = [], maxItems = 18, maxLength = 80) {
  if (!Array.isArray(values)) return [];

  const seen = new Set();
  return values
    .map(item => normalizeText(item, { maxLength }))
    .filter(Boolean)
    .filter(item => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxItems);
}

function normalizeIndexList(values = [], maxItems = 12) {
  if (!Array.isArray(values)) return [];

  const seen = new Set();
  return values
    .map(item => Number(item))
    .filter(item => Number.isInteger(item) && item >= 0)
    .filter(item => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    })
    .slice(0, maxItems);
}

function normalizePlaylist(playlist = {}) {
  const stamp = Number(playlist?.updatedAt || playlist?.createdAt || playlist?.id) || Date.now();

  return {
    id: playlist.id || stamp,
    name: sanitizePlaylistName(playlist.name || 'Untitled Playlist'),
    songs: sanitizeTrackList(Array.isArray(playlist.songs) ? playlist.songs : [], { maxItems: MAX_PLAYLIST_TRACKS }),
    createdAt: Number(playlist.createdAt || stamp),
    updatedAt: Number(playlist.updatedAt || stamp)
  };
}

function normalizePlayCounts(value = {}) {
  const next = { ...PLATFORM_PLAY_BASELINES };

  if (!value || typeof value !== 'object') {
    return next;
  }

  Object.entries(value)
    .slice(0, MAX_PLAY_COUNT_KEYS)
    .forEach(([videoId, count]) => {
      const safeVideo = safeVideoId(videoId);
      const safeCount = Math.max(0, Math.min(1000000, Number(count) || 0));
      if (!safeVideo || !safeCount) return;
      next[safeVideo] = safeCount;
    });

  return next;
}

function normalizeDailyPick(value = null) {
  if (!value || typeof value !== 'object') return null;

  const date = String(value.date || '').trim();
  const videoId = safeVideoId(value.videoId || '');
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

function sanitizeTrackForStorage(track) {
  return sanitizeTrack(track || {});
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

function readLibraryState() {
  return {
    liked: sanitizeTrackList(readStorage('vlv_liked', []), { maxItems: MAX_LIBRARY_TRACKS }),
    recent: sanitizeTrackList(readStorage('vlv_recent', []), { maxItems: MAX_LIBRARY_TRACKS }),
    playlists: (Array.isArray(readStorage('vlv_playlists', [])) ? readStorage('vlv_playlists', []) : [])
      .map(normalizePlaylist)
      .slice(0, MAX_PLAYLISTS),
    favoriteStations: normalizeIndexList(readStorage('vlv_favorite_stations', []), MAX_FAVORITE_STATIONS),
    recentStations: normalizeIndexList(readStorage('vlv_recent_stations', []), MAX_RECENT_STATIONS),
    favoriteArtists: normalizeStringList(readStorage('vlv_favorite_artists', []), MAX_FAVORITE_ARTISTS, 80),
    recentArtists: normalizeStringList(readStorage('vlv_recent_artists', []), MAX_RECENT_ARTISTS, 80),
    playCounts: normalizePlayCounts(readStorage('vlv_play_counts', {})),
    dailyPick: normalizeDailyPick(readStorage('vlv_daily_pick', null))
  };
}

function readPlaybackState() {
  return {
    queue: sanitizeTrackList(readSession('vlv_queue', []), { maxItems: MAX_LIBRARY_TRACKS }),
    queueIndex: Math.max(0, Number(readSession('vlv_queue_index', 0)) || 0),
    currentTrack: readSession('vlv_current_track', null) ? sanitizeTrackForStorage(readSession('vlv_current_track', null)) : null,
    volume: Math.max(0, Math.min(100, Number(readSession('vlv_volume', 65)) || 65)),
    shuffle: normalizeShuffle(readSession('vlv_shuffle', false)),
    repeatMode: normalizeRepeatMode(readSession('vlv_repeat_mode', 'off'))
  };
}

const initialLibraryState = readLibraryState();
const initialPlaybackState = readPlaybackState();

export const state = {
  liked: initialLibraryState.liked,
  recent: initialLibraryState.recent,
  playlists: initialLibraryState.playlists,
  favoriteStations: initialLibraryState.favoriteStations,
  recentStations: initialLibraryState.recentStations,
  favoriteArtists: initialLibraryState.favoriteArtists,
  recentArtists: initialLibraryState.recentArtists,
  playCounts: initialLibraryState.playCounts,
  dailyPick: initialLibraryState.dailyPick,
  queue: initialPlaybackState.queue,
  queueIndex: initialPlaybackState.queueIndex,
  currentTrack: initialPlaybackState.currentTrack,
  volume: initialPlaybackState.volume,
  shuffle: initialPlaybackState.shuffle,
  repeatMode: initialPlaybackState.repeatMode,
  isPlaying: false
};

export function refreshLibraryState(){
  const next = readLibraryState();
  state.liked = next.liked;
  state.recent = next.recent;
  state.playlists = next.playlists;
  state.favoriteStations = next.favoriteStations;
  state.recentStations = next.recentStations;
  state.favoriteArtists = next.favoriteArtists;
  state.recentArtists = next.recentArtists;
  state.playCounts = next.playCounts;
  state.dailyPick = next.dailyPick;
}

export function syncLibrary(){
  state.playlists = state.playlists.map(normalizePlaylist).slice(0, MAX_PLAYLISTS);
  state.liked = sanitizeTrackList(state.liked, { maxItems: MAX_LIBRARY_TRACKS });
  state.recent = sanitizeTrackList(state.recent, { maxItems: MAX_LIBRARY_TRACKS });
  state.favoriteStations = normalizeIndexList(state.favoriteStations, MAX_FAVORITE_STATIONS);
  state.recentStations = normalizeIndexList(state.recentStations, MAX_RECENT_STATIONS);
  state.favoriteArtists = normalizeStringList(state.favoriteArtists, MAX_FAVORITE_ARTISTS, 80);
  state.recentArtists = normalizeStringList(state.recentArtists, MAX_RECENT_ARTISTS, 80);
  state.playCounts = normalizePlayCounts(state.playCounts);
  state.dailyPick = normalizeDailyPick(state.dailyPick);

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
  state.queue = sanitizeTrackList(state.queue, { maxItems: MAX_LIBRARY_TRACKS });
  state.currentTrack = state.currentTrack ? sanitizeTrackForStorage(state.currentTrack) : null;
  state.queueIndex = Math.max(0, Number(state.queueIndex) || 0);
  state.volume = Math.max(0, Math.min(100, Number(state.volume) || 0));
  state.shuffle = normalizeShuffle(state.shuffle);
  state.repeatMode = normalizeRepeatMode(state.repeatMode);

  writeSession('vlv_queue', state.queue);
  writeSession('vlv_queue_index', state.queueIndex);
  writeSession('vlv_current_track', state.currentTrack);
  writeSession('vlv_volume', state.volume);
  writeSession('vlv_shuffle', state.shuffle);
  writeSession('vlv_repeat_mode', state.repeatMode);
}

export function isLiked(videoId){
  const safeId = safeVideoId(videoId);
  return safeId ? state.liked.some(track => track.videoId === safeId) : false;
}

export function toggleLike(track){
  const safeTrack = sanitizeTrackForStorage(track);
  if(!safeTrack?.videoId){ return false; }
  const exists = isLiked(safeTrack.videoId);
  state.liked = exists
    ? state.liked.filter(item => item.videoId !== safeTrack.videoId)
    : [safeTrack, ...state.liked];
  syncLibrary();
  return !exists;
}

export function pushRecent(track){
  const safeTrack = sanitizeTrackForStorage(track);
  if(!safeTrack?.videoId){ return; }
  state.recent = [safeTrack, ...state.recent.filter(item => item.videoId !== safeTrack.videoId)].slice(0, 18);
  syncLibrary();
}

export function recordTrackPlay(track){
  const safeTrack = sanitizeTrackForStorage(track);
  if(!safeTrack?.videoId){ return 0; }

  const nextCount = (Number(state.playCounts[safeTrack.videoId]) || 0) + 1;
  state.playCounts = {
    ...state.playCounts,
    [safeTrack.videoId]: nextCount
  };
  syncLibrary();
  return nextCount;
}

export function registerTrackPlayback(track){
  const safeTrack = sanitizeTrackForStorage(track);
  if(!safeTrack?.videoId){ return 0; }
  state.recent = [safeTrack, ...state.recent.filter(item => item.videoId !== safeTrack.videoId)].slice(0, 18);

  const nextCount = (Number(state.playCounts[safeTrack.videoId]) || 0) + 1;
  state.playCounts = {
    ...state.playCounts,
    [safeTrack.videoId]: nextCount
  };

  syncLibrary();
  return nextCount;
}

export function getTrackPlayCount(videoId){
  const safeVideo = safeVideoId(videoId);
  return safeVideo ? (Number(state.playCounts[safeVideo]) || 0) : 0;
}

export function getVelvetPickVideoId(fallbackVideoId = ''){
  const today = getTodayStamp();
  const currentPick = normalizeDailyPick(state.dailyPick);
  if (currentPick?.date === today && currentPick.videoId) {
    return currentPick.videoId;
  }

  const nextVideoId = getTopPlayedVideoId() || safeVideoId(fallbackVideoId);
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
  const trimmed = sanitizePlaylistName(name, '');
  if(!trimmed){ return null; }
  const stamp = Date.now();
  const playlist = normalizePlaylist({ id: stamp, name: trimmed, songs: [], createdAt: stamp, updatedAt: stamp });
  state.playlists = [playlist, ...state.playlists].slice(0, MAX_PLAYLISTS);
  syncLibrary();
  return playlist;
}

export function createPlaylistFromTracks(name, tracks = []){
  const validTracks = sanitizeTrackList(tracks, { maxItems: MAX_PLAYLIST_TRACKS }).filter(track => track?.videoId);
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
  const safeTrack = sanitizeTrackForStorage(track);
  if(!playlist || !safeTrack?.videoId){ return false; }
  if(playlist.songs.some(song => song.videoId === safeTrack.videoId)){ return false; }
  playlist.songs.push(safeTrack);
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
    : [safeIndex, ...state.favoriteStations.filter(item => item !== safeIndex)].slice(0, MAX_FAVORITE_STATIONS);
  syncLibrary();
  return !exists;
}

export function pushRecentStation(index){
  const safeIndex = Number(index);
  if(!Number.isInteger(safeIndex) || safeIndex < 0){ return; }

  state.recentStations = [safeIndex, ...state.recentStations.filter(item => item !== safeIndex)].slice(0, MAX_RECENT_STATIONS);
  syncLibrary();
}

export function isFavoriteArtist(slug){
  const safeSlug = normalizeText(slug, { maxLength: 80 });
  return safeSlug ? state.favoriteArtists.includes(safeSlug) : false;
}

export function toggleFavoriteArtist(slug){
  const safeSlug = normalizeText(slug, { maxLength: 80 });
  if(!safeSlug){ return false; }

  const exists = isFavoriteArtist(safeSlug);
  state.favoriteArtists = exists
    ? state.favoriteArtists.filter(item => item !== safeSlug)
    : [safeSlug, ...state.favoriteArtists.filter(item => item !== safeSlug)].slice(0, MAX_FAVORITE_ARTISTS);
  syncLibrary();
  return !exists;
}

export function pushRecentArtist(slug){
  const safeSlug = normalizeText(slug, { maxLength: 80 });
  if(!safeSlug){ return; }

  state.recentArtists = [safeSlug, ...state.recentArtists.filter(item => item !== safeSlug)].slice(0, MAX_RECENT_ARTISTS);
  syncLibrary();
}
