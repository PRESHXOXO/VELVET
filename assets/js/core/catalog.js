import { stations, seedSongs, artistProfiles } from '../data/catalog.js';
import { normalizeText, safeUrl, safeVideoId, sanitizeTextList, sanitizeTrack } from './sanitize.js';

export function normalizeSearch(value = '') {
  return String(value ?? '').toLowerCase().trim();
}

export function slugify(value = '') {
  return normalizeSearch(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function ytThumb(videoId = '') {
  const safeId = safeVideoId(videoId);
  return safeId ? `https://i.ytimg.com/vi/${safeId}/hqdefault.jpg` : '';
}

export function hydrateTrack(track = {}) {
  const hydrated = sanitizeTrack(track);
  const moods = Array.isArray(hydrated.moods) && hydrated.moods.length
    ? hydrated.moods
    : sanitizeTextList(track.tags || [], { maxItems: 8, maxLength: 36 });

  return {
    ...hydrated,
    title: hydrated.title || 'Unknown track',
    artist: hydrated.artist || 'Unknown artist',
    thumb: hydrated.thumb || hydrated.thumbnail || hydrated.image || hydrated.artwork || ytThumb(hydrated.videoId),
    videoId: hydrated.videoId || '',
    year: hydrated.year || '',
    moods
  };
}

export const catalogTracks = seedSongs.map(hydrateTrack);

export function getArtistSlug(track) {
  return slugify(track.artist);
}

export function getArtistTracks(slug) {
  return catalogTracks.filter(track => getArtistSlug(track) === slug);
}

export function getArtistProfile(slug) {
  const tracks = getArtistTracks(slug);
  const leadTrack = tracks[0] || null;
  const leadImage = safeUrl(leadTrack?.thumb || '', '');

  if (artistProfiles[slug]) {
    const profile = artistProfiles[slug];
    const portraitImage = safeUrl(profile.portraitImage || profile.image || leadImage || '', '');
    const featureImage = safeUrl(profile.featureImage || profile.heroImage || profile.image || portraitImage || leadImage || '', '');

    return {
      slug,
      ...profile,
      name: normalizeText(profile.name || slug, { fallback: slug, maxLength: 80 }),
      description: normalizeText(profile.description || profile.bio || profile.tagline || 'Velvet artist profile.', { fallback: 'Velvet artist profile.', maxLength: 260 }),
      tagline: normalizeText(profile.tagline || '', { maxLength: 140 }),
      bio: normalizeText(profile.bio || '', { maxLength: 260 }),
      tags: sanitizeTextList(profile.tags || [], { maxItems: 6, maxLength: 32 }),
      image: safeUrl(profile.image || portraitImage || featureImage || leadImage || '', ''),
      portraitImage,
      featureImage,
      heroImage: safeUrl(profile.heroImage || featureImage || portraitImage || leadImage || '', '')
    };
  }

  if (!tracks.length) {
    return {
      slug,
      name: normalizeText(slug, { fallback: slug, maxLength: 80 }),
      description: 'No profile yet.',
      gradient: 'linear-gradient(135deg,#17121a,#43253c)',
      image: '',
      portraitImage: '',
      featureImage: '',
      heroImage: '',
      tags: []
    };
  }

  return {
    slug,
    name: normalizeText(tracks[0].artist, { fallback: slug, maxLength: 80 }),
    description: `A Velvet profile built from ${tracks.length} seed tracks.`,
    gradient: 'linear-gradient(135deg,#17121a,#43253c)',
    tags: ['Velvet profile'],
    image: leadImage,
    portraitImage: leadImage,
    featureImage: leadImage,
    heroImage: leadImage
  };
}

export function getArtistName(slug) {
  const profile = getArtistProfile(slug);
  return profile?.name || getArtistTracks(slug)[0]?.artist || slug;
}

export function getArtistSlugs() {
  const set = new Set([
    ...Object.keys(artistProfiles),
    ...catalogTracks.map(getArtistSlug)
  ]);

  return Array.from(set).sort((a, b) =>
    getArtistName(a).localeCompare(getArtistName(b))
  );
}

export function getStationTracks(index) {
  const station = stations[index];
  if (!station) return [];

  const indexes = Array.isArray(station.seedIndexes) ? station.seedIndexes : [];
  return indexes
    .map(i => catalogTracks[i])
    .filter(Boolean);
}

export function getStationVisual(index) {
  const station = stations[index];
  if (!station) return '';

  if (station.heroImage || station.cardImage || station.image) {
    return safeUrl(station.heroImage || station.cardImage || station.image || '', '');
  }

  const leadTrack = getStationTracks(index)[0];
  return safeUrl(leadTrack?.thumb || '', '');
}

export function searchCatalog(query) {
  const q = normalizeSearch(query);

  const tracks = catalogTracks.filter(track =>
    normalizeSearch(track.title).includes(q) ||
    normalizeSearch(track.artist).includes(q) ||
    normalizeSearch((track.moods || []).join(' ')).includes(q)
  );

  const artists = getArtistSlugs()
    .map(slug => getArtistProfile(slug))
    .filter(profile =>
      normalizeSearch(profile.name).includes(q) ||
      normalizeSearch(profile.description || '').includes(q)
    );

  const stationMatches = stations
    .map((station, index) => ({
      station: {
        ...station,
        name: normalizeText(station.name || '', { fallback: 'Station', maxLength: 80 }),
        signal: normalizeText(station.signal || '', { maxLength: 80 }),
        query: normalizeText(station.query || '', { maxLength: 180 }),
        description: normalizeText(station.description || '', { maxLength: 220 }),
        tags: sanitizeTextList(station.tags || [], { maxItems: 6, maxLength: 32 }),
        heroImage: safeUrl(station.heroImage || '', ''),
        cardImage: safeUrl(station.cardImage || '', ''),
        image: safeUrl(station.image || '', '')
      },
      index
    }))
    .filter(entry =>
      normalizeSearch(entry.station.name).includes(q) ||
      normalizeSearch(entry.station.query).includes(q)
    );

  return {
    tracks,
    artists,
    stations: stationMatches
  };
}

export function findTrackByVideoId(videoId) {
  const safeId = safeVideoId(videoId);
  if (!safeId) return null;
  return catalogTracks.find(track => track.videoId === safeId) || null;
}

export { stations };
