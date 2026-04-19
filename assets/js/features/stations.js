import { stations, getStationTracks, getStationVisual } from '../core/catalog.js';
import { fetchSongs } from '../core/youtube.js';
import { playFromQueue, togglePlay } from '../core/player.js';
import { createPlaylistFromTracks, isFavoriteStation, pushRecentStation, state, toggleFavoriteStation } from '../core/state.js';
import { pageHead, songRow, emptyState, mediaSlot } from '../ui/templates.js';
import { bindSongRowActions, resolveTrack, toast } from '../core/ui.js';

function formatStationOrdinal(index) {
  return String(index + 1).padStart(2, '0');
}

function normalizeMatchText(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/&amp;/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactMatchText(value = '') {
  return normalizeMatchText(value).replace(/\s+/g, '');
}

function matchesStationTerm(haystack = '', term = '') {
  const normalizedTerm = normalizeMatchText(term);
  if (!normalizedTerm) return false;

  const compactTerm = normalizedTerm.replace(/\s+/g, '');
  const normalizedHaystack = normalizeMatchText(haystack);
  const compactHaystack = compactMatchText(haystack);

  return normalizedHaystack.includes(normalizedTerm) || compactHaystack.includes(compactTerm);
}

function filterStationLiveTracks(tracks = [], station = {}, localTracks = []) {
  const matchTerms = Array.isArray(station.matchTerms) ? station.matchTerms : [];
  const localArtists = localTracks.map(track => track?.artist).filter(Boolean);
  const terms = [...new Set([...matchTerms, ...localArtists].map(normalizeMatchText).filter(Boolean))];
  const blockedTerms = ['playlist', 'full album', 'full mixtape', 'slowed', 'reverb', 'karaoke', 'instrumental', '8d', 'sped up', 'loop'];

  return tracks.filter(track => {
    const haystack = `${track?.title || ''} ${track?.artist || ''}`;
    const normalizedHaystack = normalizeMatchText(haystack);
    if (!normalizedHaystack) return false;

    if (blockedTerms.some(term => normalizedHaystack.includes(term))) {
      return false;
    }

    if (!terms.length) {
      return true;
    }

    return terms.some(term => matchesStationTerm(haystack, term));
  });
}

function isStationsRoute() {
  const fileName = window.location.pathname.split('/').pop() || 'index.html';
  return fileName === 'stations.html';
}

function stationBrowserItem(station, index, isActive = false) {
  const seedCount = (station.seedIndexes || []).length;
  const sourceLabel = seedCount ? `${seedCount} curated` : 'Live-led';
  const tags = [
    ...(isFavoriteStation(index) ? ['Pinned lane'] : []),
    ...(station.tags || [])
  ].slice(0, 2);

  return `
    <button class="station-list-item ${isActive ? 'is-active' : ''}" data-action="open-station" data-index="${index}" style="--station-gradient:${station.gradient || 'linear-gradient(135deg,#2a0910,#8b1730)'}">
      <span class="station-list-ordinal">${formatStationOrdinal(index)}</span>
      <div class="station-list-copy">
        <strong>${station.name}</strong>
        <span>${station.description || station.query}</span>
        <div class="station-list-tags">${tags.map(tag => `<span class="mini-tag">${tag}</span>`).join('')}</div>
      </div>
      <div class="station-list-side">
        <span class="station-list-meta">${seedCount || 'YT'}</span>
        <small>${sourceLabel}</small>
      </div>
    </button>
  `;
}

function getActiveQueueTrack(queue = []) {
  const activeIndex = queue.findIndex(track => track.videoId === state.currentTrack?.videoId);
  if (activeIndex >= 0) {
    return { track: queue[activeIndex], index: activeIndex, isCurrent: true };
  }

  return { track: queue[0] || null, index: 0, isCurrent: false };
}

let hashListenerBound = false;

export async function renderStationsPage(container) {
  if (!container) return;

  const hashMatch = window.location.hash.match(/station-(\d+)/);
  const activeIndex = hashMatch ? Number(hashMatch[1]) : 0;
  const station = stations[activeIndex] || stations[0];
  pushRecentStation(activeIndex);
  const localTracks = getStationTracks(activeIndex);
  const liveCache = container.__velvetStationLiveCache || new Map();
  container.__velvetStationLiveCache = liveCache;
  const liveCount = Number.isFinite(station.liveCount)
    ? Math.max(0, station.liveCount)
    : (localTracks.length ? 4 : 8);

  let liveTracks = liveCache.get(activeIndex);
  if (!liveTracks) {
    try {
      if (!liveCount) {
        liveTracks = [];
      } else {
        const fetchedTracks = await fetchSongs(station.query, Math.max(liveCount * 2, liveCount));
        const filteredTracks = filterStationLiveTracks(fetchedTracks, station, localTracks);

        if (localTracks.length) {
          liveTracks = filteredTracks.slice(0, liveCount);
        } else {
          liveTracks = (filteredTracks.length ? filteredTracks : fetchedTracks).slice(0, liveCount);
        }
      }
    } catch (_err) {
      liveTracks = [];
    }

    liveCache.set(activeIndex, liveTracks);
  }

  const queue = [
    ...localTracks.filter(track => track && track.videoId),
    ...liveTracks.filter(track =>
      track &&
      track.videoId &&
      !localTracks.some(local => local.videoId === track.videoId)
    )
  ];

  const focusTags = (station.tags || []).slice(0, 4);
  const seedCount = (station.seedIndexes || []).length;
  const seedLabel = seedCount ? `${seedCount} curated anchors` : 'Live-led route';
  const chamberState = getActiveQueueTrack(queue);
  const chamberTrack = chamberState.track;
  const chamberArtwork =
    chamberTrack?.thumb ||
    station.heroImage ||
    station.image ||
    getStationVisual(activeIndex) ||
    '';
  const playerPrimaryLabel = chamberState.isCurrent
    ? (state.isPlaying ? 'Pause Chamber' : 'Resume Chamber')
    : 'Play Chamber';
  const playerLeadLabel = chamberState.isCurrent ? 'Current queue track' : 'Highlighted queue track';
  const playerLeadCopy = chamberTrack
    ? `${chamberTrack.artist || 'Unknown artist'}`
    : 'Press play to load this station into the persistent player.';
  const isPinnedLane = isFavoriteStation(activeIndex);
  const routePlaylistName = `${station.name} Route`;

  container.innerHTML = `
    <section class="stations-page">
      ${pageHead({
        kicker: 'Station Atlas',
        title: 'Signal Deck',
        copy: 'Choose a route, control it in the chamber, and keep the rest of the page contained instead of stacked into one long spill.'
      })}

      <div class="stations-layout">
        <aside class="station-player panel station-player-panel" style="--station-focus-gradient:${station.gradient || 'linear-gradient(135deg,#17121a,#43253c)'}">
          <div class="station-player-head">
            <div class="station-player-copy-wrap">
              <span class="panel-kicker">Chamber Player</span>
              <div class="section-title station-player-title">${station.name}</div>
              <p class="section-copy station-player-copy">${station.description || station.query}</p>
              <div class="meta-tags">${focusTags.map(tag => `<span class="mini-tag">${tag}</span>`).join('')}</div>
            </div>
            <div class="station-player-route-note">
              <span>Route signal</span>
              <strong>${station.signal || station.name}</strong>
              <small>${seedLabel}</small>
            </div>
          </div>

          <div class="station-player-shell">
            <div class="station-player-main">
              <div class="station-player-art-shell">
                ${mediaSlot({
                  image: chamberArtwork,
                  alt: `${chamberTrack?.title || station.name || 'Station'} artwork`,
                  label: chamberTrack?.title || station.name || 'Station artwork',
                  eyebrow: playerLeadLabel,
                  monogram: chamberTrack?.title || station.name || 'V',
                  className: 'station-player-art',
                  kind: 'station-player',
                  ratio: 'landscape'
                })}
              </div>

              <div class="station-player-now">
                <span class="panel-kicker">${playerLeadLabel}</span>
                <div class="section-title station-player-track-title">${chamberTrack?.title || 'Station ready'}</div>
                <p class="section-copy station-player-track-copy">${playerLeadCopy}</p>
                <div class="station-player-action-row">
                  <button class="btn btn-primary" id="playActiveStation" type="button">${playerPrimaryLabel}</button>
                  <button class="btn btn-secondary" id="stepActiveStation" type="button">Next In Queue</button>
                  <button class="btn btn-secondary" id="shuffleActiveStation" type="button">Shuffle Route</button>
                </div>
                <div class="inline-actions station-player-utility-row">
                  <button class="btn btn-secondary" id="buildStationStack" type="button">Build Stack</button>
                  <button class="btn btn-secondary" id="toggleStationPin" type="button">${isPinnedLane ? 'Pinned Lane' : 'Pin Lane'}</button>
                </div>
                <div class="station-player-subline">The footer player keeps this route alive even when you jump to another page.</div>
              </div>
            </div>

            <div class="station-player-side">
              <div class="station-queue-panel" id="stationSongList">
                <div class="station-track-head station-track-head--chamber">
                  <span class="panel-kicker">Queue</span>
                  <div class="section-title">On Deck</div>
                  <p class="section-copy">${queue.length} tracks loaded for this station.</p>
                </div>
                <div class="station-song-scroll station-song-scroll--chamber">
                  ${queue.length
                    ? `<div class="song-list station-song-list">${queue.map((track, index) => songRow(track, index)).join('')}</div>`
                    : emptyState('This station does not have a mix yet.')}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <section class="stations-atlas-section">
        <div class="stations-browser">
          <article class="panel stations-browser-panel">
            <div class="stations-browser-head">
              <span class="panel-kicker">Atlas</span>
              <div>
                <div class="section-title">All Routes</div>
                <p class="section-copy">The atlas now lives in its own section below the chamber so the player stays clear and the route grid does not slide over it.</p>
              </div>
            </div>
            <div class="stations-atlas-scroll">
              <div class="stations-list">
                ${stations.map((item, index) => stationBrowserItem(item, index, index === activeIndex)).join('')}
              </div>
            </div>
          </article>
        </div>
      </section>
    </section>
  `;

  const rerenderStation = () => {
    if (isStationsRoute()) {
      renderStationsPage(container);
    }
  };

  const playSelectedStation = async () => {
    if (!queue.length) return;

    if (chamberState.isCurrent) {
      await togglePlay();
    } else {
      await playFromQueue(queue, chamberState.index);
    }

    rerenderStation();
  };

  const stepStationQueue = async () => {
    if (!queue.length) return;

    const nextIndex = chamberState.isCurrent
      ? (chamberState.index + 1) % queue.length
      : 0;

    await playFromQueue(queue, nextIndex);
    rerenderStation();
  };

  const shuffleStationQueue = async () => {
    if (!queue.length) return;

    const shuffled = queue.slice().sort(() => Math.random() - 0.5);
    await playFromQueue(shuffled, 0);
    rerenderStation();
  };

  document.getElementById('playActiveStation')?.addEventListener('click', playSelectedStation);
  document.getElementById('stepActiveStation')?.addEventListener('click', stepStationQueue);
  document.getElementById('shuffleActiveStation')?.addEventListener('click', shuffleStationQueue);
  document.getElementById('buildStationStack')?.addEventListener('click', () => {
    const playlist = createPlaylistFromTracks(routePlaylistName, queue);
    if (!playlist) return;
    toast('Route saved to stack');
    window.dispatchEvent(new CustomEvent('velvet:library-changed'));
  });
  document.getElementById('toggleStationPin')?.addEventListener('click', () => {
    const pinned = toggleFavoriteStation(activeIndex);
    toast(pinned ? 'Lane pinned' : 'Lane unpinned');
    window.dispatchEvent(new CustomEvent('velvet:stations-changed'));
    rerenderStation();
  });

  bindSongRowActions(container, {
    'play-track': async (event, data) => {
      event.preventDefault();
      const index = Number(data.index);
      if (Number.isNaN(index)) return;
      await playFromQueue(queue, index);
      rerenderStation();
    },

    'toggle-like': (event, data) => {
      event.preventDefault();
      event.stopPropagation();

      const track = queue.find(item => item.videoId === data.video) || resolveTrack(data.video);
      if (!track) return;

      window.dispatchEvent(new CustomEvent('velvet:toggle-like', { detail: { track } }));
    },

    'add-playlist': (event, data) => {
      event.preventDefault();
      event.stopPropagation();

      const track = queue.find(item => item.videoId === data.video) || resolveTrack(data.video);
      if (!track) return;

      window.dispatchEvent(new CustomEvent('velvet:playlist-pick', { detail: { track } }));
    },

    'open-station': (event, data) => {
      event.preventDefault();

      const nextIndex = Number(data.index);
      if (Number.isNaN(nextIndex)) return;

      const nextHash = `#station-${nextIndex}`;

      if (window.location.hash === nextHash) {
        renderStationsPage(container);
      } else {
        window.location.hash = nextHash;
      }
    }
  });

  if (!hashListenerBound) {
    window.addEventListener('hashchange', () => {
      if (isStationsRoute()) {
        renderStationsPage(container);
      }
    });
    hashListenerBound = true;
  }
}
