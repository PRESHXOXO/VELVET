import { getArtistSlugs, getArtistProfile, getArtistTracks } from '../core/catalog.js';
import { playFromQueue } from '../core/player.js';
import {
  createPlaylistFromTracks,
  isFavoriteArtist,
  pushRecentArtist,
  state,
  toggleFavoriteArtist
} from '../core/state.js';
import { pageHead, songRow, emptyState, mediaSlot } from '../ui/templates.js';
import { bindSongRowActions, resolveTrack, toast } from '../core/ui.js';
import { readStorage, writeStorage } from '../core/storage.js';

const ARTIST_ALPHA_KEY = 'vlv_artist_alpha';

function artistPerspectiveCard({ label, value, copy }) {
  return `
    <article class="artists-perspective-card">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${copy}</small>
    </article>
  `;
}

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

function getTrackPreviewLabel(tracks = []) {
  const leadTrack = tracks[0];
  if (!leadTrack) return 'Open artist';
  return leadTrack.title || leadTrack.artist || 'Open artist';
}

function artistPlaneCard(profile, { trackCount = 0, isActive = false, isPinned = false, isRecent = false } = {}) {
  const portraitImage = profile?.portraitImage || profile?.image || '';
  const artistTracks = getArtistTracks(profile.slug);
  const previewTracks = artistTracks.slice(0, 3);
  const previewText = previewTracks
    .map(track => track?.title)
    .filter(Boolean)
    .slice(0, 2)
    .join(' / ');
  const laneBadge = isActive ? 'Front focus' : (isPinned ? 'Pinned voice' : (isRecent ? 'Recent voice' : 'Artist plane'));

  return `
    <button class="artist-plane-card ${isActive ? 'is-active' : ''}" type="button" data-action="open-artist" data-slug="${profile.slug}" style="--artist-gradient:${profile.gradient || 'linear-gradient(135deg,#17121a,#43253c)'};${portraitImage ? `--artist-image:url('${portraitImage}')` : ''}">
      <div class="artist-plane-visual">
        ${portraitImage
          ? `<img class="artist-plane-image" src="${portraitImage}" alt="${profile.name || 'Artist'} portrait">`
          : `<div class="artist-plane-fallback">${getArtistInitials(profile.name)}</div>`}
        <div class="artist-plane-overlay"></div>
        <div class="artist-plane-top">
          <span class="panel-kicker">${laneBadge}</span>
          <span class="artist-plane-count">${trackCount} tracks</span>
        </div>
        <div class="artist-plane-preview">
          <span>${previewTracks.length ? 'Preview stack' : 'Profile ready'}</span>
          <strong>${getTrackPreviewLabel(previewTracks)}</strong>
          ${previewText ? `<small>${previewText}</small>` : ''}
        </div>
      </div>
      <div class="artist-plane-copy">
        <strong>${profile.name}</strong>
        <span>${profile.description || profile.tagline || 'Velvet artist profile.'}</span>
        <div class="artist-plane-tags">
          ${(profile.tags || []).slice(0, 3).map(tag => `<span class="mini-tag">${tag}</span>`).join('')}
          ${isPinned ? '<span class="mini-tag">Pinned</span>' : ''}
          ${isRecent ? '<span class="mini-tag">Recent</span>' : ''}
        </div>
      </div>
    </button>
  `;
}

function getRelatedArtists(activeProfile, profiles = [], limit = 4) {
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

function relatedArtistButton(entry) {
  const sharedLabel = entry.sharedTags.length
    ? entry.sharedTags.slice(0, 2).join(' / ')
    : `${entry.trackCount} seeded tracks`;

  return `
    <button class="artist-nearby-chip" type="button" data-action="open-artist" data-slug="${entry.profile.slug}">
      <span>${entry.profile.name}</span>
      <strong>${sharedLabel}</strong>
    </button>
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

  pushRecentArtist(activeSlug);

  const activeImage = activeProfile?.portraitImage || activeProfile?.image || '';
  const focusTags = (activeProfile?.tags || []).slice(0, 4);
  const pinnedCount = state.favoriteArtists.length;
  const recentLabel = state.recentArtists
    .slice(0, 3)
    .map(slug => getArtistProfile(slug)?.name)
    .filter(Boolean)
    .join(' / ') || 'No recent voices yet.';
  const perspectiveCards = [
    {
      label: 'Visible profiles',
      value: `${filteredProfiles.length}`,
      copy: activeLetter === 'All'
        ? `All ${profiles.length} voices are visible in the artist plane.`
        : `${activeLetter} lane is isolating the artists that start there.`
    },
    {
      label: 'Pinned voices',
      value: `${pinnedCount}`,
      copy: pinnedCount
        ? 'Pinned artists stay easy to return to as you move through Velvet.'
        : 'Pin artists here to keep your core voices close.'
    },
    {
      label: 'Recent focus',
      value: activeLetter === 'All' ? 'All lanes' : `${activeLetter} lane`,
      copy: recentLabel
    }
  ];
  const relatedArtists = getRelatedArtists(activeProfile, profiles);
  const isPinnedArtist = isFavoriteArtist(activeSlug);
  const filteredTrackCount = filteredProfiles.reduce((sum, profile) => sum + getArtistTracks(profile.slug).length, 0);

  container.innerHTML = `
    <section class="artists-page">
      ${pageHead({
        kicker: 'Perspective Profiles',
        title: 'Artist Plane',
        copy: 'Browse by voice, isolate a letter lane, and turn any artist focus into a playable stack.',
        linkText: 'Back Home',
        linkHref: 'index.html'
      })}

      <div class="alpha-bar artist-alpha-bar">
        <button class="alpha-btn ${activeLetter === 'All' ? 'active' : ''}" type="button" data-action="filter-artist-letter" data-letter="All">All</button>
        ${letters.map(letter => `
          <button class="alpha-btn ${activeLetter === letter ? 'active' : ''}" type="button" data-action="filter-artist-letter" data-letter="${letter}">
            ${letter}
          </button>
        `).join('')}
      </div>

      <div class="artists-perspective-band">
        ${perspectiveCards.map(artistPerspectiveCard).join('')}
      </div>

      <div class="split artists-layout">
        <section class="panel artists-browser-panel">
          <div class="artists-browser-head">
            <div>
              <span class="panel-kicker">Artist Directory</span>
              <div class="section-title">Voices by Letter</div>
              <p class="section-copy">Jump by alphabet, scan the portraits, and move one artist into the front plane at a time.</p>
            </div>
            <div class="artists-browser-note">
              <span>Current lane</span>
              <strong>${activeLetter === 'All' ? 'All voices' : `${activeLetter} lane`}</strong>
              <small>${filteredTrackCount} total tracks visible in this pass.</small>
            </div>
          </div>
          <div class="artist-grid artist-plane-grid">
            ${filteredProfiles.length
              ? filteredProfiles.map(profile => artistPlaneCard(profile, {
                  trackCount: getArtistTracks(profile.slug).length,
                  isActive: profile.slug === activeSlug,
                  isPinned: isFavoriteArtist(profile.slug),
                  isRecent: state.recentArtists.slice(0, 4).includes(profile.slug)
                })).join('')
              : emptyState('No artists match this letter yet.')}
          </div>
        </section>

        <aside class="panel detail-panel artist-detail-panel" style="--artist-focus-gradient:${activeProfile?.gradient || 'linear-gradient(135deg,#17121a,#43253c)'};${activeImage ? `--artist-focus-image:url('${activeImage}')` : ''}">
          <div class="artist-detail-hero">
            ${mediaSlot({
              image: activeImage,
              alt: `${activeProfile?.name || 'Artist'} portrait`,
              label: activeProfile?.name || 'Artist portrait',
              eyebrow: 'Front-plane portrait',
              monogram: activeProfile?.name || 'V',
              className: 'artist-detail-media',
              kind: 'artist-detail',
              ratio: 'portrait'
            })}
            <div class="artist-detail-copy">
              <span class="panel-kicker">Front Plane</span>
              <div class="section-title artist-detail-title">${activeProfile?.name || 'Artist focus'}</div>
              <p class="section-copy">${activeProfile?.description || activeProfile?.tagline || 'Velvet artist profile.'}</p>
              <div class="meta-tags">${focusTags.map(tag => `<span class="mini-tag">${tag}</span>`).join('')}</div>
              <div class="inline-actions">
                <button class="btn btn-primary" id="playArtistTracks" type="button">Play Frontline</button>
                <button class="btn btn-secondary" id="shuffleArtistTracks" type="button">Shuffle Plane</button>
                <button class="btn btn-secondary" id="buildArtistStack" type="button">Build Artist Stack</button>
                <button class="btn btn-secondary" id="toggleArtistPin" type="button">${isPinnedArtist ? 'Pinned Voice' : 'Pin Artist'}</button>
              </div>
            </div>
          </div>

          <div class="artist-detail-metrics">
            <div class="artist-detail-metric">
              <span>Lane</span>
              <strong>${focusTags[0] || 'Core voice'}</strong>
              <small>${activeLetter === 'All' ? 'Visible in the full directory.' : `Surfaced from the ${activeLetter} lane.`}</small>
            </div>
            <div class="artist-detail-metric">
              <span>Tracks</span>
              <strong>${tracks.length}</strong>
              <small>Seeded songs ready to drive the player and stacks.</small>
            </div>
            <div class="artist-detail-metric">
              <span>Nearby</span>
              <strong>${relatedArtists.length}</strong>
              <small>Related voices are surfaced below for quick pivots.</small>
            </div>
          </div>

          <div class="artist-nearby-panel">
            <div class="artist-nearby-head">
              <span class="panel-kicker">Nearby Voices</span>
              <div class="section-title">Move Sideways</div>
              <p class="section-copy">Open adjacent artists without losing the mood you're already in.</p>
            </div>
            <div class="artist-nearby-row">
              ${relatedArtists.length
                ? relatedArtists.map(relatedArtistButton).join('')
                : '<div class="empty">More related voices will surface as the catalog grows.</div>'}
            </div>
          </div>

          <div class="artist-detail-tracklist">
            <div class="artist-track-head">
              <span class="panel-kicker">Frontline Queue</span>
              <div class="section-title">On This Voice</div>
              <p class="section-copy">${tracks.length ? 'Play from the queue or send individual tracks into a stack.' : 'No seeded tracks yet for this artist.'}</p>
            </div>
            ${tracks.length ? `<div class="song-list artist-detail-song-list">${tracks.map(songRow).join('')}</div>` : emptyState('No seeded tracks yet for this artist.')}
          </div>
        </aside>
      </div>
    </section>
  `;

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
    'play-track': (_event, data) => {
      const queueIndex = tracks.findIndex(track => track.videoId === data.video);
      if (queueIndex < 0) return;
      playFromQueue(tracks, queueIndex);
    },
    'toggle-like': (_event, data) => {
      const track = tracks.find(item => item.videoId === data.video) || resolveTrack(data.video);
      if (!track) return;
      window.dispatchEvent(new CustomEvent('velvet:toggle-like', { detail: { track } }));
    },
    'add-playlist': (_event, data) => {
      const track = tracks.find(item => item.videoId === data.video) || resolveTrack(data.video);
      if (!track) return;
      window.dispatchEvent(new CustomEvent('velvet:playlist-pick', { detail: { track } }));
    },
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
