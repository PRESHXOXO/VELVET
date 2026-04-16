import { stations, getStationTracks } from '../core/catalog.js';
import { fetchSongs } from '../core/youtube.js';
import { playFromQueue } from '../core/player.js';
import { pageHead, songRow, emptyState } from '../ui/templates.js';
import { bindSongRowActions, resolveTrack } from '../core/ui.js';

function stationBrowserItem(station, index, isActive = false){
  return `
    <button class="station-list-item ${isActive ? 'is-active' : ''}" data-action="open-station" data-index="${index}">
      <div class="station-list-copy">
        <span class="panel-kicker">Station</span>
        <strong>${station.name}</strong>
        <span>${station.description || station.query}</span>
      </div>
      <span class="station-list-meta">${(station.seedIndexes || []).length || 0}</span>
    </button>
  `;
}

let hashListenerBound = false;

export async function renderStationsPage(container){
  const hashMatch = window.location.hash.match(/station-(\d+)/);
  const activeIndex = hashMatch
    ? Math.max(0, Math.min(Number(hashMatch[1]), stations.length - 1))
    : 0;

  const station = stations[activeIndex];
  const localTracks = getStationTracks(activeIndex);

  let liveTracks = [];
  try{
    liveTracks = await fetchSongs(station.query, 8);
  }catch(_err){
    liveTracks = [];
  }

  const queue = [
    ...localTracks,
    ...liveTracks.filter(track => !localTracks.some(local => local.videoId === track.videoId))
  ];

  container.innerHTML = `
    <section class="stations-page">
      ${pageHead({
        kicker: 'All stations',
        title: 'Genre Stations',
        copy: 'Move between moods without losing the room. Browse on the left, then settle into the station on the right.'
      })}

      <div class="stations-layout">
        <div class="stations-browser">
          <div class="stations-list">
  ${stations.map((item, index) => stationBrowserItem(item, index, index === activeIndex)).join('')}
</div>
        </div>

        <aside class="station-detail panel detail-panel">
          <span class="panel-kicker">Station View</span>
          <div class="section-title station-detail-title">${station.name}</div>
          <p class="section-copy station-detail-copy">
            ${station.description || station.query}
          </p>

          <div class="inline-actions station-detail-actions">
            <button class="btn btn-primary" id="playActiveStation">Play Station</button>
            <button class="btn btn-secondary" id="shuffleActiveStation">Shuffle</button>
          </div>

          <div class="station-detail-tracks" id="stationSongList">
            ${
              queue.length
                ? `<div class="song-list">${queue.map((track, index) => songRow(track, index)).join('')}</div>`
                : emptyState('This station does not have a mix yet.')
            }
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
