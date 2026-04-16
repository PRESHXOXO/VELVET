import { hydrateTrack, normalizeSearch, searchCatalog } from './catalog.js';
import { fetchSongs } from './youtube.js';

const liveSearchCache = new Map();

function emptyMatches() {
  return { tracks: [], artists: [], stations: [] };
}

export function normalizeQuery(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function trackKey(track = {}) {
  const hydrated = hydrateTrack(track);
  if (hydrated.videoId) return `video:${hydrated.videoId}`;
  return `meta:${normalizeSearch(hydrated.title)}::${normalizeSearch(hydrated.artist)}`;
}

export function dedupeTracks(tracks = []) {
  const seen = new Set();

  return tracks
    .map(track => hydrateTrack(track))
    .filter(track => {
      if (!track.videoId && !track.title) return false;

      const key = trackKey(track);
      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
}

export function getLocalSearchSnapshot(query = '') {
  const normalized = normalizeQuery(query);
  const matches = normalized ? searchCatalog(normalized) : emptyMatches();

  return {
    query: normalized,
    matches,
    liveTracks: [],
    combinedTracks: dedupeTracks(matches.tracks)
  };
}

export async function fetchLiveTracks(query = '', max = 12) {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];

  const cacheKey = `${normalized.toLowerCase()}::${max}`;
  if (!liveSearchCache.has(cacheKey)) {
    liveSearchCache.set(
      cacheKey,
      fetchSongs(normalized, max)
        .then(items => dedupeTracks(items))
        .catch(() => [])
    );
  }

  return liveSearchCache.get(cacheKey);
}

export async function getSearchResults(query = '', { liveLimit = 12 } = {}) {
  const local = getLocalSearchSnapshot(query);
  if (!local.query) return local;

  const liveTracks = await fetchLiveTracks(local.query, liveLimit);
  return {
    ...local,
    liveTracks,
    combinedTracks: dedupeTracks([...local.matches.tracks, ...liveTracks])
  };
}

export function hasSearchMatches(results) {
  return Boolean(
    results?.matches?.tracks?.length ||
      results?.matches?.artists?.length ||
      results?.matches?.stations?.length ||
      results?.liveTracks?.length
  );
}

export function getSearchPreview(results, limits = {}) {
  const {
    trackLimit = 4,
    artistLimit = 3,
    stationLimit = 2,
    liveTrackLimit = 4
  } = limits;

  const localTracks = (results?.matches?.tracks || []).slice(0, trackLimit);
  const liveTracks = (results?.liveTracks || []).slice(0, liveTrackLimit);

  return {
    query: results?.query || '',
    tracks: localTracks,
    artists: (results?.matches?.artists || []).slice(0, artistLimit),
    stations: (results?.matches?.stations || []).slice(0, stationLimit),
    liveTracks,
    combinedTracks: dedupeTracks([...localTracks, ...liveTracks])
  };
}
