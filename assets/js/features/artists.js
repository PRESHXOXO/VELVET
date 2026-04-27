import { getArtistSlugs, getArtistProfile, getArtistTracks } from '../core/catalog.js';
import { playFromQueue } from '../core/player.js';
import {
  createPlaylistFromTracks,
  isFavoriteArtist,
  pushRecentArtist,
  state,
  toggleFavoriteArtist
} from '../core/state.js';
import { pageHead, emptyState, getTrackArtwork, icon } from '../ui/templates.js';
import { bindSongRowActions, toast } from '../core/ui.js';
import { readStorage, writeStorage } from '../core/storage.js';
import { artistProfiles as seededArtistProfiles } from '../data/catalog.js';

const ARTIST_ALPHA_KEY = 'vlv_artist_alpha';

function normalizeLetter(value = '') {
  const letter = String(value || '').trim().charAt(0).toUpperCase();
  return letter || 'All';
}

function readArtistAlphaFilter(letters = []) {
  const stored = String(readStorage(ARTIST_ALPHA_KEY, 'All') || 'All');
  const normalized = stored.toLowerCase() === 'all' ? 'All' : normalizeLetter(stored);
  return normalized === 'All' || letters.includes(normalized) ? normalized : 'All';
}

function writeArtistAlphaFilter(letter = 'All') {
  const normalized = String(letter || 'All');
  writeStorage(ARTIST_ALPHA_KEY, normalized === 'All' ? 'All' : normalizeLetter(normalized));
}

function isArtistsRoute() {
  const fileName = window.location.pathname.split('/').pop() || 'index.html';
  return fileName === 'artists.html';
}

function getArtistInitials(value = '') {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('') || 'V';
}

function shortLine(value = '', fallback = 'Velvet voice.') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;

  const trimmed = raw.split(/[.!?]/)[0]?.trim() || raw;
  return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
}

function getArtistLeadLine(profile, tracks = []) {
  if (profile?.tagline) {
    return shortLine(profile.tagline, 'Velvet voice.');
  }

  if (profile?.description) {
    return shortLine(profile.description, 'Velvet voice.');
  }

  if (tracks.length) {
    return `${tracks.length} tracks are currently revolving around this voice.`;
  }

  return 'Velvet voice.';
}

function getTrackCountLabel(trackCount = 0) {
  return `${trackCount} ${trackCount === 1 ? 'track' : 'tracks'}`;
}

function getExplicitArtistImage(profile) {
  const seededProfile = seededArtistProfiles?.[profile?.slug] || null;
  return seededProfile?.featureImage || seededProfile?.portraitImage || seededProfile?.image || '';
}

function getArtistEraLabel(tracks = []) {
  const years = tracks
    .map(track => Number(track?.year))
    .filter(year => Number.isFinite(year) && year > 0);

  if (!years.length) return 'Velvet era';

  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? `${min}` : `${min} - ${max}`;
}

function getArtistAtmosphere(profile, tracks = []) {
  const tags = (profile?.tags || []).slice(0, 2);
  if (tags.length) return tags.join(' / ');

  const leadTrack = tracks[0];
  if (leadTrack?.title) return leadTrack.title;

  return 'Featured voice';
}

function artistRailFeature(profile, tracks = [], { isPinned = false, isRecent = false } = {}) {
  const image = getExplicitArtistImage(profile);
  const descriptor = getArtistLeadLine(profile, tracks);

  return `
    <button class="artist-rail-feature" type="button" data-action="open-artist" data-slug="${profile.slug}">
      <div class="artist-rail-feature-thumb ${image ? '' : 'is-fallback'}">
        <span>${getArtistInitials(profile.name)}</span>
        ${image
          ? `<img src="${image}" alt="${profile.name || 'Artist'} portrait">`
          : ''}
      </div>
      <div class="artist-rail-feature-copy">
        <span class="panel-kicker">${isPinned ? 'Pinned voice' : (isRecent ? 'Recent voice' : 'Featured voice')}</span>
        <strong>${profile.name}</strong>
        <small>${descriptor}</small>
      </div>
    </button>
  `;
}

function artistRailItem(profile, { trackCount = 0, isPinned = false, isRecent = false } = {}) {
  return `
    <button class="artist-rail-item" type="button" data-action="open-artist" data-slug="${profile.slug}">
      <span>${profile.name}</span>
      <small>${isPinned ? 'Pinned' : (isRecent ? 'Recent' : getTrackCountLabel(trackCount))}</small>
    </button>
  `;
}

function getRelatedArtists(activeProfile, profiles = [], limit = 5) {
  const activeTags = new Set((activeProfile?.tags || []).map(tag => String(tag).toLowerCase()));

  return profiles
    .filter(profile => profile.slug !== activeProfile?.slug)
    .map(profile => {
      const sharedTags = (profile.tags || []).filter(tag => activeTags.has(String(tag).toLowerCase()));
      const exactInitial = profile.name?.charAt(0)?.toUpperCase() === activeProfile?.name?.charAt(0)?.toUpperCase();
      const trackCount = getArtistTracks(profile.slug).length;
      const score = (sharedTags.length * 4) + (exactInitial ? 1 : 0) + Math.min(trackCount, 3);

      return { profile, sharedTags, score, trackCount };
    })
    .sort((a, b) => b.score - a.score || a.profile.name.localeCompare(b.profile.name))
    .slice(0, limit);
}

function relatedArtistChip(entry) {
  const label = entry.sharedTags.length
    ? entry.sharedTags.slice(0, 2).join(' / ')
    : getTrackCountLabel(entry.trackCount);

  return `
    <button class="artist-stage-nearby-chip" type="button" data-action="open-artist" data-slug="${entry.profile.slug}">
      <span>${entry.profile.name}</span>
      <small>${label}</small>
    </button>
  `;
}

function rotationTrackCard(track, index, isCurrent = false) {
  const artwork = getTrackArtwork(track);
  const emphasisClass = index === 0 ? 'is-featured' : (index === 2 ? 'is-tall' : '');

  return `
    <button class="artist-rotation-card ${emphasisClass} ${isCurrent ? 'is-current' : ''}" type="button" data-action="play-artist-track" data-index="${index}" data-video="${track.videoId}">
      <div class="artist-rotation-art">
        ${artwork
          ? `<img src="${artwork}" alt="${track.title || 'Track artwork'}">`
          : `<div class="artist-rotation-fallback">${getArtistInitials(track.artist || track.title)}</div>`}
        <span class="artist-rotation-order">${String(index + 1).padStart(2, '0')}</span>
        <span class="artist-rotation-play">${icon('play')}</span>
      </div>
      <div class="artist-rotation-copy">
        <strong>${track.title || 'Unknown track'}</strong>
        <small>${track.artist || 'Unknown artist'}</small>
      </div>
    </button>
  `;
}

function artistStageVisualChip(track, index) {
  return `
    <button class="artist-stage-vignette ${index === 0 ? 'is-primary' : ''}" type="button" data-action="play-artist-track" data-index="${index}" data-video="${track.videoId}">
      <div class="artist-stage-vignette-art is-fallback">
        <span>${getArtistInitials(track.artist || track.title)}</span>
        <em>${String(index + 1).padStart(2, '0')}</em>
      </div>
      <div class="artist-stage-vignette-copy">
        <strong>${track.title || 'Velvet cut'}</strong>
        <small>${track.artist || 'Velvet'}</small>
      </div>
    </button>
  `;
}

function renderArtistStageVisual(profile, tracks = [], activeTrack = null, image = '') {
  const stageTracks = tracks.slice(0, 3);
  const signalTrack = activeTrack || stageTracks[0] || null;

  return `
    <div class="artist-stage-visual-frame ${image ? '' : 'is-image-missing'}">
      <div class="artist-stage-fallback">${getArtistInitials(profile?.name)}</div>
      ${image
        ? `<img class="artist-stage-image" src="${image}" alt="${profile?.name || 'Artist'} portrait">`
        : ''}
      <div class="artist-stage-visual-glass"></div>
      <div class="artist-stage-orbit artist-stage-orbit--halo"></div>
      <div class="artist-stage-orbit artist-stage-orbit--side"></div>
      <div class="artist-stage-cover-stack">
        ${stageTracks.length
          ? stageTracks.map((track, index) => artistStageVisualChip(track, index)).join('')
          : `
            <div class="artist-stage-vignette is-empty">
              <div class="artist-stage-vignette-art is-fallback"><span>${getArtistInitials(profile?.name)}</span></div>
              <div class="artist-stage-vignette-copy">
                <strong>${profile?.name || 'Velvet voice'}</strong>
                <small>Tracks will settle here as the room fills.</small>
              </div>
            </div>
          `}
      </div>
      ${signalTrack
        ? `
          <div class="artist-stage-signal-card">
            <div class="artist-stage-signal-thumb is-fallback">
              <span>${getArtistInitials(signalTrack.artist || signalTrack.title)}</span>
            </div>
            <div class="artist-stage-signal-copy">
              <span class="panel-kicker">Lead Cut</span>
              <strong>${signalTrack.title || 'Quiet room'}</strong>
              <small>${signalTrack.artist || 'Velvet'}</small>
            </div>
          </div>
        `
        : ''}
    </div>
  `;
}

let hashListenerBound = false;

export function renderArtistsPage(container) {
  if (!container) return;

  const slugs = getArtistSlugs();
  const profiles = slugs.map(slug => getArtistProfile(slug)).filter(Boolean);
  const fallbackSlug = profiles[0]?.slug || slugs[0];
  const letters = [...new Set(profiles.map(profile => profile.name.charAt(0).toUpperCase()).filter(Boolean))].sort();
  const activeLetter = readArtistAlphaFilter(letters);
  const filteredProfiles = activeLetter === 'All'
    ? profiles
    : profiles.filter(profile => profile.name.charAt(0).toUpperCase() === activeLetter);

  const hashMatch = window.location.hash.match(/artist-(.+)$/);
  const requestedSlug = hashMatch ? hashMatch[1] : fallbackSlug;
  const requestedProfile = getArtistProfile(requestedSlug) || getArtistProfile(fallbackSlug);
  const activeProfile = filteredProfiles.some(profile => profile.slug === requestedProfile?.slug)
    ? requestedProfile
    : (filteredProfiles[0] || requestedProfile || getArtistProfile(fallbackSlug));
  const activeSlug = activeProfile?.slug || fallbackSlug;
  const tracks = getArtistTracks(activeSlug);
  const activeImage = getExplicitArtistImage(activeProfile);

  pushRecentArtist(activeSlug);

  const leadLine = getArtistLeadLine(activeProfile, tracks);
  const focusTags = (activeProfile?.tags || []).slice(0, 4);
  const relatedArtists = getRelatedArtists(activeProfile, profiles, 4);
  const isPinnedArtist = isFavoriteArtist(activeSlug);
  const visibleProfiles = filteredProfiles.filter(profile => profile.slug !== activeSlug);
  const currentRotation = tracks.slice(0, 5);
  const activeTrack = tracks.find(track => track.videoId === state.currentTrack?.videoId) || tracks[0] || null;
  const laneSummary = activeLetter === 'All' ? 'All voices' : `${activeLetter} lane`;
  const activeEra = getArtistEraLabel(tracks);
  const rotationSummary = activeTrack
    ? `${activeTrack.title || 'Lead track'} is setting the tone.`
    : 'Tap a cover to start this voice in the shared player.';

  container.innerHTML = `
    <section class="artists-page artists-gallery-page">
      ${pageHead({
        kicker: 'Velvet Gallery',
        title: 'Artist Salon',
        copy: 'Move through one voice at a time: quiet rail, lifted portrait stage, and a recessed listening shelf.',
        linkText: 'Back Home',
        linkHref: 'index.html'
      })}

      <section class="panel artists-gallery-shell" style="--artist-gallery-gradient:${activeProfile?.gradient || 'linear-gradient(135deg,#17121a,#43253c)'};${activeImage ? `--artist-gallery-image:url('${activeImage}')` : ''}">
        <aside class="artists-gallery-rail">
          <div class="artists-gallery-rail-head">
            <span class="panel-kicker">Artist Index</span>
            <div class="section-title">Select A Voice</div>
            <p class="section-copy">A quieter selector rail that lets the featured stage stay in front.</p>
          </div>

          <div class="alpha-bar artist-alpha-bar">
            <button class="alpha-btn ${activeLetter === 'All' ? 'active' : ''}" type="button" data-action="filter-artist-letter" data-letter="All">All</button>
            ${letters.map(letter => `
              <button class="alpha-btn ${activeLetter === letter ? 'active' : ''}" type="button" data-action="filter-artist-letter" data-letter="${letter}">
                ${letter}
              </button>
            `).join('')}
          </div>

          ${artistRailFeature(activeProfile, tracks, {
            isPinned: isPinnedArtist,
            isRecent: state.recentArtists.slice(0, 3).includes(activeSlug)
          })}

          <div class="artist-rail-list">
            ${visibleProfiles.length
              ? visibleProfiles.map(profile => artistRailItem(profile, {
                  trackCount: getArtistTracks(profile.slug).length,
                  isPinned: isFavoriteArtist(profile.slug),
                  isRecent: state.recentArtists.slice(0, 4).includes(profile.slug)
                })).join('')
              : '<div class="artist-rail-empty">No other artists in this lane yet.</div>'}
          </div>
        </aside>

        <div class="artists-gallery-stage">
          <div class="artists-gallery-main">
            <div class="artist-stage-copy">
              <div class="artist-stage-topline">
                <span class="panel-kicker">Featured Voice</span>
                <span class="artist-stage-lane">${laneSummary}</span>
              </div>

              <div class="artist-stage-title-block">
                <div class="artist-stage-name">${activeProfile?.name || 'Artist focus'}</div>
                <p class="artist-stage-line">${leadLine}</p>
              </div>

              <div class="artist-stage-tags">
                ${focusTags.map(tag => `<span class="mini-tag">${tag}</span>`).join('')}
                ${isPinnedArtist ? '<span class="mini-tag">Pinned voice</span>' : ''}
                <span class="mini-tag">${activeEra}</span>
              </div>

              <div class="artist-stage-glance">
                <div class="artist-stage-stat">
                  <span>Tracks</span>
                  <strong>${tracks.length}</strong>
                </div>
                <div class="artist-stage-stat">
                  <span>Atmosphere</span>
                  <strong>${getArtistAtmosphere(activeProfile, tracks)}</strong>
                </div>
                <div class="artist-stage-stat">
                  <span>Nearby</span>
                  <strong>${relatedArtists.length}</strong>
                </div>
              </div>

              <div class="inline-actions artist-stage-actions">
                <button class="btn btn-primary" id="playArtistTracks" type="button">Play Frontline</button>
                <button class="btn btn-secondary" id="shuffleArtistTracks" type="button">Shuffle Plane</button>
                <button class="btn btn-secondary" id="buildArtistStack" type="button">Build Artist Stack</button>
                <button class="btn btn-secondary" id="toggleArtistPin" type="button">${isPinnedArtist ? 'Pinned Voice' : 'Pin Artist'}</button>
              </div>

              <div class="artist-stage-nearby">
                <span class="panel-kicker">Move Sideways</span>
                <div class="artist-stage-nearby-row">
                  ${relatedArtists.length
                    ? relatedArtists.map(relatedArtistChip).join('')
                    : '<div class="artist-stage-nearby-empty">More adjacent voices will surface as the catalog grows.</div>'}
                </div>
              </div>
            </div>

            <div class="artist-stage-visual-wrap">
              ${renderArtistStageVisual(activeProfile, tracks, activeTrack, activeImage)}
              <div class="artist-stage-floating-card">
                <span class="panel-kicker">Now Holding</span>
                <strong>${activeTrack?.title || 'Quiet room'}</strong>
                <small>${activeTrack?.artist || 'Choose a track from the listening shelf.'}</small>
              </div>
            </div>
          </div>

          <div class="artist-rotation-band">
            <div class="artist-rotation-head">
              <div>
                <span class="panel-kicker">Listening Shelf</span>
                <div class="section-title">Room In View</div>
              </div>
              <p class="section-copy">${rotationSummary}</p>
            </div>

            ${currentRotation.length
              ? `<div class="artist-rotation-strip">${currentRotation.map((track, index) => rotationTrackCard(track, index, track.videoId === state.currentTrack?.videoId)).join('')}</div>`
              : emptyState('No seeded tracks yet for this artist.')}
          </div>
        </div>
      </section>
    </section>
  `;

  container.querySelectorAll('.artist-rail-feature-thumb img').forEach(img => {
    img.addEventListener('error', () => {
      img.parentElement?.classList.add('is-fallback');
      img.remove();
    }, { once: true });
  });

  container.querySelectorAll('.artist-stage-image').forEach(img => {
    img.addEventListener('error', () => {
      img.closest('.artist-stage-visual-frame')?.classList.add('is-image-missing');
      img.remove();
    }, { once: true });
  });
  document.getElementById('playArtistTracks')?.addEventListener('click', () => {
    if (!tracks.length) return;
    playFromQueue(tracks, 0);
  });

  document.getElementById('shuffleArtistTracks')?.addEventListener('click', () => {
    if (!tracks.length) return;
    const shuffled = tracks.slice().sort(() => Math.random() - 0.5);
    playFromQueue(shuffled, 0);
  });

  document.getElementById('buildArtistStack')?.addEventListener('click', () => {
    const playlist = createPlaylistFromTracks(`${activeProfile?.name || 'Artist'} Stack`, tracks);
    if (!playlist) return;
    toast('Artist stack saved');
    window.dispatchEvent(new CustomEvent('velvet:library-changed'));
  });

  document.getElementById('toggleArtistPin')?.addEventListener('click', () => {
    const pinned = toggleFavoriteArtist(activeSlug);
    toast(pinned ? 'Artist pinned' : 'Artist unpinned');
    renderArtistsPage(container);
  });

  bindSongRowActions(container, {
    'filter-artist-letter': (event, data) => {
      event.preventDefault();
      writeArtistAlphaFilter(data.letter || 'All');
      renderArtistsPage(container);
    },
    'open-artist': (event, data) => {
      event.preventDefault();
      const nextSlug = String(data.slug || '').trim();
      if (!nextSlug) return;

      const nextHash = `#artist-${nextSlug}`;
      if (window.location.hash === nextHash) {
        renderArtistsPage(container);
      } else {
        window.location.hash = nextHash;
      }
    },
    'play-artist-track': (event, data) => {
      event.preventDefault();
      const index = Number(data.index);
      if (Number.isNaN(index) || index < 0 || index >= tracks.length) return;
      playFromQueue(tracks, index);
    }
  });

  if (!hashListenerBound) {
    window.addEventListener('hashchange', () => {
      if (isArtistsRoute()) {
        renderArtistsPage(container);
      }
    });
    hashListenerBound = true;
  }
}
