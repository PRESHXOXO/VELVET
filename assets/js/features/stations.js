import { stations, getStationTracks, getStationVisual } from '../core/catalog.js';
import { fetchSongs } from '../core/youtube.js';
import { playFromQueue } from '../core/player.js';
import { pageHead, songRow, emptyState, mediaSlot } from '../ui/templates.js';
import { bindSongRowActions, resolveTrack } from '../core/ui.js';

function stationBrowserItem(station, index, isActive = false){
  const seedCount = (station.seedIndexes || []).length || 'Live';

  return `
    <button class="station-list-item ${isActive ? 'is-active' : ''}" data-action="open-station" data-index="${index}">
      <div class="station-list-copy">
        <span class="panel-kicker">Lane</span>
        <strong>${station.name}</strong>
        <span>${station.description || station.query}</span>
      </div>
      <span class="station-list-meta">${seedCount}</span>
    </button>
  `;
}

function stationBrowserStat(label, value, copy) {
  return `
    <article class="stations-browser-stat">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${copy}</small>
    </article>
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
  const seedCount = (station.seedIndexes || []).length || 'Live';
  const browserStats = [
    {
      label: 'Active lane',
      value: station.name,
      copy: 'current front-facing station'
    },
    {
      label: 'Seeds',
      value: seedCount,
      copy: 'catalog anchors feeding the mix'
    },
    {
      label: 'Queue depth',
      value: queue.length,
      copy: 'tracks ready across local and live layers'
    }
  ];

  container.innerHTML = `
    <section class="stations-page">
      ${pageHead({
        kicker: 'Perspective Lanes',
        title: 'Station Field',
        copy: 'Browse through side corridors on the left, then let one lane step forward with its own focused mix.'
      })}

      <div class="stations-layout">
        <div class="stations-browser">
          <article class="panel stations-browser-panel">
            <span class="panel-kicker">Lane Browser</span>
            <div class="section-title">Shift the room sideways.</div>
            <p class="section-copy">Each station keeps a different emotional corridor open. Pick a lane, then let it take the foreground.</p>
            <div class="stations-browser-stats">
              ${browserStats.map(stationBrowserStat).join('')}
            </div>
          </article>
          <div class="stations-list">
            ${stations.map((item, index) => stationBrowserItem(item, index, index === activeIndex)).join('')}
          </div>
        </div>

        <aside class="station-detail panel detail-panel station-detail-panel" style="--station-focus-gradient:${station.gradient || 'linear-gradient(135deg,#17121a,#43253c)'};${focusImage ? `--station-focus-image:url('${focusImage}')` : ''}">
          <div class="station-detail-hero">
            <div class="station-detail-copy-wrap">
              <span class="panel-kicker">Front Lane</span>
              <div class="section-title station-detail-title">${station.name}</div>
              <p class="section-copy station-detail-copy">${station.description || station.query}</p>
              <div class="meta-tags">${focusTags.map(tag => `<span class="mini-tag">${tag}</span>`).join('')}</div>
              <div class="inline-actions station-detail-actions">
                <button class="btn btn-primary" id="playActiveStation" type="button">Play Front Lane</button>
                <button class="btn btn-secondary" id="shuffleActiveStation" type="button">Shuffle Lane</button>
              </div>
            </div>
            ${mediaSlot({
              image: focusImage,
              alt: `${station.name || 'Station'} hero visual`,
              label: station.name || 'Station visual',
              eyebrow: 'Front-lane visual',
              monogram: station.name || 'V',
              className: 'station-detail-art',
              kind: 'station-detail',
              ratio: 'landscape'
            })}
          </div>

          <div class="station-detail-metrics">
            <div class="station-detail-metric">
              <span>Seeds</span>
              <strong>${seedCount}</strong>
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

          <div class="station-detail-tracks" id="stationSongList">
            ${queue.length
              ? `<div class="song-list station-song-list">${queue.map((track, index) => songRow(track, index)).join('')}</div>`
              : emptyState('This lane does not have a mix yet.')}
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
