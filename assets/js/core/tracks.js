export function formatCount(value, singular, plural = `${singular}s`) {
  const safe = Number(value) || 0;
  return `${safe} ${safe === 1 ? singular : plural}`;
}

export function dedupeByVideoId(tracks = []) {
  const seen = new Set();

  return tracks.filter(track => {
    if (!track?.videoId || seen.has(track.videoId)) return false;
    seen.add(track.videoId);
    return true;
  });
}

export function flattenPlaylistSongs(playlists = []) {
  return playlists.flatMap(playlist => Array.isArray(playlist?.songs) ? playlist.songs : []);
}

export function findTrackInCollections(videoId, collections = []) {
  const safeVideoId = String(videoId || '').trim();
  if (!safeVideoId) return null;

  for (const collection of collections) {
    if (!Array.isArray(collection)) continue;

    const match = collection.find(track => track?.videoId === safeVideoId);
    if (match) return match;
  }

  return null;
}
