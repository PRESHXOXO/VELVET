import { stations, seedSongs, artistProfiles } from '../data/catalog.js';

export function normalizeSearch(value = '') {
  return value.toLowerCase().trim();
}

export function slugify(value = '') {
  return normalizeSearch(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function ytThumb(videoId = '') {
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';
}

export function hydrateTrack(track = {}) {
  const moods = Array.isArray(track.moods) && track.moods.length
    ? track.moods
    : (Array.isArray(track.tags) ? track.tags : []);

  return {
    title: track.title || 'Unknown track',
    artist: track.artist || 'Unknown artist',
    thumb:
      track.thumb ||
      track.thumbnail ||
      track.image ||
      track.artwork ||
      track?.snippet?.thumbnails?.high?.url ||
      track?.snippet?.thumbnails?.medium?.url ||
      track?.snippet?.thumbnails?.default?.url ||
      ytThumb(track.videoId),
    videoId: track.videoId || '',
    year: track.year || '',
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
  const leadImage = leadTrack?.thumb || '';

  if (artistProfiles[slug]) {
    const profile = artistProfiles[slug];
    const portraitImage = profile.portraitImage || profile.image || leadImage;
    const featureImage = profile.featureImage || profile.heroImage || profile.image || portraitImage || leadImage;

    return {
      slug,
      ...profile,
      description: profile.description || profile.bio || profile.tagline || 'Velvet artist profile.',
      tags: profile.tags || [],
      image: profile.image || portraitImage || featureImage || leadImage,
      portraitImage,
      featureImage,
      heroImage: profile.heroImage || featureImage || portraitImage || leadImage
    };
  }

  if (!tracks.length) {
    return {
      slug,
      name: slug,
      description: 'No profile yet.',
      gradient: 'linear-gradient(135deg,#17121a,#43253c)',
      image: '',
      portraitImage: '',
      featureImage: '',
      heroImage: ''
    };
  }

  return {
    slug,
    name: tracks[0].artist,
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
    return station.heroImage || station.cardImage || station.image || '';
  }

  const leadTrack = getStationTracks(index)[0];
  return leadTrack?.thumb || '';
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
    .map((station, index) => ({ station, index }))
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
  if (!videoId) return null;
  return catalogTracks.find(track => track.videoId === videoId) || null;
}

export { stations };
