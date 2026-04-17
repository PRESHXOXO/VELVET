function normalizeLabel(value = '') {
  return String(value || '').toLowerCase().trim();
}

function toTitleCase(value = '') {
  return value.replace(/\b\w/g, char => char.toUpperCase());
}

export function humanizePlaylistTag(value = '') {
  const normalized = normalizeLabel(value)
    .replace(/&amp;/g, '&')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return '';

  return toTitleCase(
    normalized
      .replace(/\br b\b/g, 'R&B')
      .replace(/\br&b\b/g, 'R&B')
      .replace(/\bhip hop\b/g, 'Hip Hop')
      .replace(/\balt\b/g, 'Alt')
      .replace(/\bdj\b/g, 'DJ')
  );
}

const PLAYLIST_PALETTES = [
  { keywords: ['slow jams', 'midnight', 'after hours', 'late night', 'romance'], gradient: 'linear-gradient(135deg,#190811,#4f1832)' },
  { keywords: ['club', 'party', 'dance', 'hype', 'workout'], gradient: 'linear-gradient(135deg,#1d0903,#5c1a0c)' },
  { keywords: ['neo soul', 'soul', 'warm', 'sunday morning'], gradient: 'linear-gradient(135deg,#1a1308,#5a3b1e)' },
  { keywords: ['current', 'alt r&b', 'moody', 'introspective'], gradient: 'linear-gradient(135deg,#0d1621,#213f62)' },
  { keywords: ['women of r&b', 'girl power', 'icons', 'power ballads'], gradient: 'linear-gradient(135deg,#220f24,#5a2a5f)' },
  { keywords: ['hip hop', 'trap', 'classics', 'throwback'], gradient: 'linear-gradient(135deg,#12131d,#2c3450)' }
];

export function getPlaylistSongs(playlist) {
  return Array.isArray(playlist?.songs) ? playlist.songs : [];
}

function countValues(values = [], options = {}) {
  const { display = value => value } = options;
  const map = new Map();

  values.forEach(value => {
    const key = normalizeLabel(value);
    if (!key) return;

    if (!map.has(key)) {
      map.set(key, { key, label: display(value), count: 0 });
    }

    map.get(key).count += 1;
  });

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function resolvePlaylistGradient(tokens = []) {
  const normalized = tokens.map(normalizeLabel);

  const match = PLAYLIST_PALETTES.find(palette =>
    palette.keywords.some(keyword => normalized.some(token => token.includes(keyword)))
  );

  if (match) return match.gradient;
  return 'linear-gradient(135deg,#151018,#3a233f)';
}

function comparePlaylistsByPriority(a, b) {
  const lengthDelta = (b?.songs?.length || 0) - (a?.songs?.length || 0);
  if (lengthDelta) return lengthDelta;

  const updatedDelta = (Number(b?.updatedAt) || 0) - (Number(a?.updatedAt) || 0);
  if (updatedDelta) return updatedDelta;

  return (Number(b?.createdAt || b?.id) || 0) - (Number(a?.createdAt || a?.id) || 0);
}

export function getPrimaryPlaylist(playlists = []) {
  return [...playlists].sort(comparePlaylistsByPriority)[0] || null;
}

export function getPlaylistPreviewEntries(playlist, limit = 4) {
  return getPlaylistSongs(playlist)
    .map((track, queueIndex) => ({ track, queueIndex }))
    .slice(-limit)
    .reverse();
}

export function getPlaylistSignature(playlist) {
  const songs = getPlaylistSongs(playlist);
  const previewEntries = getPlaylistPreviewEntries(playlist, 4);
  const featuredTrack = previewEntries[0]?.track || songs[songs.length - 1] || null;
  const artistCounts = countValues(songs.map(track => track.artist));
  const moodCounts = countValues(
    songs.flatMap(track => Array.isArray(track?.moods) ? track.moods : []),
    { display: value => humanizePlaylistTag(value) }
  );
  const uniqueArtists = artistCounts.length;
  const dominantArtist = artistCounts[0]?.label || (featuredTrack?.artist || 'Velvet');
  const topMood = moodCounts[0]?.label || '';
  const secondMood = moodCounts[1]?.label || '';
  const gradient = resolvePlaylistGradient([
    playlist?.name,
    dominantArtist,
    topMood,
    secondMood,
    featuredTrack?.artist,
    ...(featuredTrack?.moods || [])
  ]);

  if (!songs.length) {
    return {
      previewEntries: [],
      featuredTrack: null,
      dominantArtist: '',
      topMood: '',
      tags: ['Open Stack'],
      summary: 'Still empty. Add songs and Velvet will shape the stack around what actually belongs together.',
      caption: 'Open canvas',
      gradient,
      artistCount: 0,
      trackCount: 0
    };
  }

  const tags = [topMood, secondMood, uniqueArtists > 1 ? `${uniqueArtists} artists` : dominantArtist]
    .filter(Boolean)
    .slice(0, 3);

  let summary = `${songs.length} tracks waiting in the room.`;
  if (topMood && uniqueArtists > 1) {
    summary = `${topMood} leaning across ${uniqueArtists} artists, anchored by ${dominantArtist}.`;
  } else if (topMood && uniqueArtists === 1) {
    summary = `${topMood} in focus with ${dominantArtist} carrying the whole stack.`;
  } else if (uniqueArtists === 1) {
    summary = `${dominantArtist} in focus across ${songs.length} tracks.`;
  } else if (uniqueArtists > 1) {
    summary = `${dominantArtist} plus ${uniqueArtists - 1} more artists in rotation.`;
  }

  return {
    previewEntries,
    featuredTrack,
    dominantArtist,
    topMood,
    tags,
    summary,
    caption: `${songs.length} tracks${uniqueArtists ? ` â€¢ ${uniqueArtists} artists` : ''}`,
    gradient,
    artistCount: uniqueArtists,
    trackCount: songs.length
  };
}

export function scoreTrackAgainstPlaylist(track, playlist) {
  if (!track?.videoId) return 0;

  const songs = getPlaylistSongs(playlist);
  if (!songs.length) return 1;

  const trackArtist = normalizeLabel(track.artist);
  const playlistArtists = new Set(songs.map(song => normalizeLabel(song.artist)));
  const trackMoods = new Set((track.moods || []).map(normalizeLabel).filter(Boolean));
  const playlistMoods = new Set(
    songs
      .flatMap(song => Array.isArray(song?.moods) ? song.moods : [])
      .map(normalizeLabel)
      .filter(Boolean)
  );

  let score = 0;

  if (trackArtist && playlistArtists.has(trackArtist)) {
    score += 5;
  }

  trackMoods.forEach(mood => {
    if (playlistMoods.has(mood)) {
      score += 3;
    }
  });

  if (normalizeLabel(playlist?.name).includes(trackArtist) && trackArtist) {
    score += 2;
  }

  if ((track.moods || []).some(mood => normalizeLabel(playlist?.name).includes(normalizeLabel(mood)))) {
    score += 2;
  }

  return score;
}

export function getPlaylistMatch(track, playlist) {
  const exists = getPlaylistSongs(playlist).some(song => song.videoId === track?.videoId);
  if (exists) {
    return { score: 999, label: 'Already inside', tone: 'existing', disabled: true };
  }

  const score = scoreTrackAgainstPlaylist(track, playlist);
  if (score >= 8) return { score, label: 'Strong match', tone: 'strong', disabled: false };
  if (score >= 4) return { score, label: 'Good fit', tone: 'good', disabled: false };
  if (score >= 1) return { score, label: 'Could work', tone: 'soft', disabled: false };
  return { score, label: 'Open stack', tone: 'open', disabled: false };
}

export function sortPlaylistsForTrack(playlists = [], track) {
  return [...playlists].sort((a, b) => {
    const aMatch = getPlaylistMatch(track, a);
    const bMatch = getPlaylistMatch(track, b);

    if (bMatch.score !== aMatch.score) return bMatch.score - aMatch.score;

    return comparePlaylistsByPriority(a, b);
  });
}
