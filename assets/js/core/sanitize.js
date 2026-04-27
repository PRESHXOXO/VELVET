export function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeText(value = '', { fallback = '', maxLength = 160 } = {}) {
  const cleaned = String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/&(?=(#\d+|#x[a-fA-F0-9]+|[a-zA-Z]{2,8});?)/g, ' and ')
    .replace(/[<>"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, Math.max(0, Number(maxLength) || 0));

  return cleaned || fallback;
}

export function normalizeToken(value = '', { fallback = '', maxLength = 64 } = {}) {
  const cleaned = String(value ?? '')
    .replace(/[^a-zA-Z0-9 _.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, Math.max(0, Number(maxLength) || 0));

  return cleaned || fallback;
}

export function safeVideoId(value = '') {
  const safeValue = String(value ?? '').trim();
  return /^[A-Za-z0-9_-]{6,32}$/.test(safeValue) ? safeValue : '';
}

export function safeUrl(value = '', fallback = '') {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;

  if (/^(\.\/|\.\.\/|\/)/.test(raw)) {
    return raw;
  }

  try {
    const url = new URL(raw, 'https://velvet.local');
    if (['https:', 'http:', 'data:', 'blob:', 'file:'].includes(url.protocol)) {
      return raw.startsWith('http') || raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('file:')
        ? url.href
        : raw;
    }
  } catch (_err) {
    return fallback;
  }

  return fallback;
}

export function sanitizeTextList(values = [], { maxItems = 8, maxLength = 48 } = {}) {
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

export function sanitizeTrack(track = {}) {
  const safeVideo = safeVideoId(track.videoId || track?.id?.videoId || '');
  const thumbnail =
    track.thumb ||
    track.thumbnail ||
    track.image ||
    track.artwork ||
    track?.snippet?.thumbnails?.high?.url ||
    track?.snippet?.thumbnails?.medium?.url ||
    track?.snippet?.thumbnails?.default?.url ||
    '';

  return {
    ...track,
    title: normalizeText(track.title || track?.snippet?.title || '', { fallback: 'Unknown track', maxLength: 140 }),
    artist: normalizeText(track.artist || track.channelTitle || track?.snippet?.channelTitle || '', { fallback: 'Unknown artist', maxLength: 120 }),
    videoId: safeVideo,
    year: normalizeText(track.year || '', { maxLength: 12 }),
    thumb: safeUrl(thumbnail, ''),
    thumbnail: safeUrl(track.thumbnail || '', ''),
    image: safeUrl(track.image || '', ''),
    artwork: safeUrl(track.artwork || '', ''),
    moods: sanitizeTextList(track.moods || track.tags || [], { maxItems: 8, maxLength: 36 }),
    tags: sanitizeTextList(track.tags || track.moods || [], { maxItems: 8, maxLength: 36 })
  };
}

export function sanitizeTrackList(values = [], { maxItems = 80 } = {}) {
  if (!Array.isArray(values)) return [];

  const seen = new Set();
  return values
    .map(sanitizeTrack)
    .filter(track => track.videoId || track.title)
    .filter(track => {
      const key = track.videoId || `${track.title.toLowerCase()}::${track.artist.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxItems);
}

export function sanitizePlaylistName(value = '', fallback = 'Untitled Playlist') {
  return normalizeText(value, { fallback, maxLength: 80 });
}
