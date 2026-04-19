import { stations, getStationTracks, getStationVisual } from '../core/catalog.js';
import { fetchSongs } from '../core/youtube.js';
import { playFromQueue, togglePlay } from '../core/player.js';
import { state } from '../core/state.js';
import { pageHead, songRow, emptyState, mediaSlot } from '../ui/templates.js';
import { bindSongRowActions, resolveTrack } from '../core/ui.js';

function formatStationOrdinal(index) {
  return String(index + 1).padStart(2, '0');
}

function isStationsRoute() {
  const fileName = window.location.pathname.split('/').pop() || 'index.html';
  return fileName === 'stations.html';
}

function getNearbyStations(activeIndex) {
  const offsets = [-1, 1, 2];
  return offsets.map(offset => {
    const index = (activeIndex + offset + stations.length) % stations.length;
    return { station: stations[index], index };
  });
}

function stationBrowserItem(station, index, isActive = false) {
  const seedCount = (station.seedIndexes || []).length;
  const sourceLabel = seedCount ? `${seedCount} seeded` : 'Live-led';
  const tags = (station.tags || []).slice(0, 2);

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

function stationHeroStat(label, value, copy) {
  return `
    <article class="stations-browser-stat">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${copy}</small>
    </article>
  `;
}

function stationNeighborCard(entry, slot) {
  return `
    <button class="station-neighbor-card" type="button" data-action="open-station" data-index="${entry.index}" data-slot="${slot}" style="--station-gradient:${entry.station.gradient || 'linear-gradient(135deg,#2a0910,#8b1730)'}">
      <span>Side Deck ${formatStationOrdinal(entry.index)}</span>
      <strong>${entry.station.name}</strong>
      <small>${entry.station.description || entry.station.query}</small>
    </button>
  `;
}

function stationSourceItem(label, value) {
  return `
    <div class="station-source-item">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
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
  const localTracks = getStationTracks(activeIndex);
  const liveCache = container.__velvetStationLiveCache || new Map();
  container.__velvetStationLiveCache = liveCache;

  let liveTracks = liveCache.get(activeIndex);
  if (!liveTracks) {
    try {
      liveTracks = await fetchSongs(station.query, 8);
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
  const seedLabel = seedCount ? `${seedCount} seeded anchors` : 'Open live route';
  const routeMode = seedCount ? (liveTracks.length ? 'Seeded + live' : 'Seeded') : 'Exploratory';
  const nearbyStations = getNearbyStations(activeIndex);
  const heroStats = [
    {
      label: 'Selected route',
      value: station.name,
      copy: 'the station currently steering the chamber player'
    },
    {
      label: 'Route mode',
      value: routeMode,
      copy: 'how fixed or open this station is right now'
    },
    {
      label: 'Queue depth',
      value: `${queue.length}`,
      copy: 'tracks stacked across local and live layers'
    }
  ];

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

  container.innerHTML = `
    <section class="stations-page">
      ${pageHead({
        kicker: 'Station Atlas',
        title: 'Signal Deck',
        copy: 'Pick a station below and the chamber becomes its live player. The shared player stays running while you move through the rest of Velvet.'
      })}

      <article class="panel stations-hero-panel">
        <div class="stations-hero-copy">
          <span class="panel-kicker">Shared Chamber</span>
          <div class="section-title">Atlas With Persistent Playback</div>
          <p class="section-copy">The chamber now behaves like a true route player instead of a second station card. Choose a station below, control it here, and keep listening while you move across Velvet.</p>
        </div>
        <div class="stations-hero-stats">
          ${heroStats.map(stat => stationHeroStat(stat.label, stat.value, stat.copy)).join('')}
        </div>
        <div class="stations-neighbor-strip">
          ${nearbyStations.map(stationNeighborCard).join('')}
        </div>
      </article>

      <div class="stations-layout">
        <aside class="station-player panel detail-panel station-player-panel" style="--station-focus-gradient:${station.gradient || 'linear-gradient(135deg,#17121a,#43253c)'}">
          <div class="station-player-head">
            <div class="station-player-copy-wrap">
              <span class="panel-kicker">Active Chamber Player</span>
              <div class="section-title station-player-title">${station.name}</div>
              <p class="section-copy station-player-copy">${station.description || station.query}</p>
              <div class="meta-tags">${focusTags.map(tag => `<span class="mini-tag">${tag}</span>`).join('')}</div>
            </div>
            <div class="station-player-route-note">
              <span>Route signal</span>
              <strong>${station.query}</strong>
              <small>${seedLabel}</small>
            </div>
          </div>

          <div class="station-player-shell">
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
              <div class="station-player-subline">The footer player keeps this route alive even when you jump to another page.</div>
            </div>
          </div>

          <div class="station-detail-metrics">
            <div class="station-detail-metric">
              <span>Anchors</span>
              <strong>${seedCount || 'Open'}</strong>
            </div>
            <div class="station-detail-metric">
              <span>Loaded</span>
              <strong>${chamberState.isCurrent ? `${chamberState.index + 1}` : 'Ready'}</strong>
            </div>
            <div class="station-detail-metric">
              <span>Live</span>
              <strong>${liveTracks.length}</strong>
            </div>
          </div>

          <div class="station-detail-support">
            <article class="station-source-card">
              <span class="panel-kicker">Route Profile</span>
              <div class="station-source-grid">
                ${stationSourceItem('Search signal', station.query)}
                ${stationSourceItem('Anchor mode', seedLabel)}
                ${stationSourceItem('Shared player', 'Persists across pages')}
                ${stationSourceItem('Mood markers', focusTags.length ? focusTags.join(' / ') : 'Open route')}
              </div>
            </article>

            <div class="station-detail-tracks" id="stationSongList">
              <div class="station-track-head">
                <span class="panel-kicker">Station Queue</span>
                <div class="section-title">On Deck</div>
              </div>
              ${queue.length
                ? `<div class="song-list station-song-list">${queue.map((track, index) => songRow(track, index)).join('')}</div>`
                : emptyState('This station does not have a mix yet.')}
            </div>
          </div>
        </aside>

        <div class="stations-browser">
          <article class="panel stations-browser-panel">
            <div class="stations-browser-head">
              <span class="panel-kicker">Atlas</span>
              <div>
                <div class="section-title">All Routes</div>
                <p class="section-copy">Five across on desktop, with the selected station feeding the chamber player above instead of splitting the page into two competing showcases.</p>
              </div>
            </div>
            <div class="stations-atlas-scroll">
              <div class="stations-list">
                ${stations.map((item, index) => stationBrowserItem(item, index, index === activeIndex)).join('')}
              </div>
            </div>
          </article>
        </div>
      </div>
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
