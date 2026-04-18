import { stations, getStationTracks, getStationVisual } from '../core/catalog.js';
import { fetchSongs } from '../core/youtube.js';
import { playFromQueue } from '../core/player.js';
import { pageHead, songRow, emptyState, mediaSlot } from '../ui/templates.js';
import { bindSongRowActions, resolveTrack } from '../core/ui.js';

function formatStationOrdinal(index) {
  return String(index + 1).padStart(2, '0');
}

function getNearbyStations(activeIndex) {
  const offsets = [-1, 1, 2];
  return offsets.map(offset => {
    const index = (activeIndex + offset + stations.length) % stations.length;
    return { station: stations[index], index };
  });
}

function stationBrowserItem(station, index, isActive = false){
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

let hashListenerBound = false;

export async function renderStationsPage(container){
  const hashMatch = window.location.hash.match(/station-(\d+)/);
  const activeIndex = hashMatch ? Number(hashMatch[1]) : 0;
  const station = stations[activeIndex] || stations[0];
  const localTracks = getStationTracks(activeIndex);

  let liveTracks = [];
  try{
    liveTracks = await fetchSongs(station.query, 8);
  }catch(_err){
    liveTracks = [];
  }

  const queue = [
    ...localTracks.filter(track => track && track.videoId),
    ...liveTracks.filter(track =>
      track &&
      track.videoId &&
      !localTracks.some(local => local.videoId === track.videoId)
    )
  ];

  const focusImage = station.heroImage || station.image || getStationVisual(activeIndex) || '';
  const focusTags = (station.tags || []).slice(0, 4);
  const seedCount = (station.seedIndexes || []).length;
  const seedLabel = seedCount ? `${seedCount} seeded anchors` : 'Open live route';
  const routeMode = seedCount ? (liveTracks.length ? 'Seeded + live' : 'Seeded') : 'Exploratory';
  const nearbyStations = getNearbyStations(activeIndex);
  const heroStats = [
    {
      label: 'Active deck',
      value: station.name,
      copy: 'the station currently pulled into the chamber'
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

  container.innerHTML = `
    <section class="stations-page">
      ${pageHead({
        kicker: 'Station Atlas',
        title: 'Signal Deck',
        copy: 'A deeper map of routes, side rooms, and active pressure instead of a flat picker.'
      })}

      <article class="panel stations-hero-panel">
        <div class="stations-hero-copy">
          <span class="panel-kicker">Current Chamber</span>
          <div class="section-title">${station.name}</div>
          <p class="section-copy">${station.description || station.query}</p>
        </div>
        <div class="stations-hero-stats">
          ${heroStats.map(stat => stationHeroStat(stat.label, stat.value, stat.copy)).join('')}
        </div>
        <div class="stations-neighbor-strip">
          ${nearbyStations.map(stationNeighborCard).join('')}
        </div>
      </article>

      <div class="stations-layout">
        <div class="stations-browser">
          <article class="panel stations-browser-panel">
            <div class="stations-browser-head">
              <span class="panel-kicker">Atlas</span>
              <div>
                <div class="section-title">All Routes</div>
                <p class="section-copy">The full station map, staged like decks instead of flat cards.</p>
              </div>
            </div>
            <div class="stations-list">
              ${stations.map((item, index) => stationBrowserItem(item, index, index === activeIndex)).join('')}
            </div>
          </article>
        </div>

        <aside class="station-detail panel detail-panel station-detail-panel" style="--station-focus-gradient:${station.gradient || 'linear-gradient(135deg,#17121a,#43253c)'};${focusImage ? `--station-focus-image:url('${focusImage}')` : ''}">
          <div class="station-detail-overview">
            <div class="station-detail-copy-wrap">
              <span class="panel-kicker">Active Chamber</span>
              <div class="section-title station-detail-title">${station.name}</div>
              <p class="section-copy station-detail-copy">${station.description || station.query}</p>
              <div class="meta-tags">${focusTags.map(tag => `<span class="mini-tag">${tag}</span>`).join('')}</div>
              <div class="inline-actions station-detail-actions">
                <button class="btn btn-primary" id="playActiveStation" type="button">Play Chamber</button>
                <button class="btn btn-secondary" id="shuffleActiveStation" type="button">Shuffle Route</button>
              </div>
            </div>

            <div class="station-detail-scene">
              <div class="station-detail-plane station-detail-plane--rear"></div>
              <div class="station-detail-plane station-detail-plane--mid"></div>
              <div class="station-detail-art-shell">
                ${mediaSlot({
                  image: focusImage,
                  alt: `${station.name || 'Station'} hero visual`,
                  label: station.name || 'Station visual',
                  eyebrow: 'Active route visual',
                  monogram: station.name || 'V',
                  className: 'station-detail-art',
                  kind: 'station-detail',
                  ratio: 'landscape'
                })}
              </div>
              <div class="station-detail-note station-detail-note--upper">
                <span>Signal</span>
                <strong>${station.query}</strong>
                <small>The search phrase feeding this route.</small>
              </div>
              <div class="station-detail-note station-detail-note--lower">
                <span>Next Side Deck</span>
                <strong>${nearbyStations[1]?.station.name || 'Open route'}</strong>
                <small>${nearbyStations[1]?.station.description || 'Another chamber waiting nearby.'}</small>
              </div>
            </div>
          </div>

          <div class="station-detail-metrics">
            <div class="station-detail-metric">
              <span>Anchors</span>
              <strong>${seedCount || 'Open'}</strong>
            </div>
            <div class="station-detail-metric">
              <span>Local</span>
              <strong>${localTracks.length}</strong>
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
                ${stationSourceItem('Mood markers', focusTags.length ? focusTags.join(' / ') : 'Open route')}
              </div>
            </article>

            <div class="station-detail-tracks" id="stationSongList">
              <div class="station-track-head">
                <span class="panel-kicker">Queue Stack</span>
                <div class="section-title">On Deck</div>
              </div>
              ${queue.length
                ? `<div class="song-list station-song-list">${queue.map((track, index) => songRow(track, index)).join('')}</div>`
                : emptyState('This station does not have a mix yet.')}
            </div>
          </div>
        </aside>
      </div>
    </section>
  `;

  document.getElementById('playActiveStation')?.addEventListener('click', () => {
    if (!queue.length) return;
    playFromQueue(queue, 0);
  });

  document.getElementById('shuffleActiveStation')?.addEventListener('click', () => {
    if (!queue.length) return;
    const shuffled = queue.slice().sort(() => Math.random() - 0.5);
    playFromQueue(shuffled, 0);
  });

  bindSongRowActions(container, {
    'play-track': (event, data) => {
      event.preventDefault();
      const index = Number(data.index);
      if (Number.isNaN(index)) return;
      playFromQueue(queue, index);
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
      renderStationsPage(container);
    });
    hashListenerBound = true;
  }
}
