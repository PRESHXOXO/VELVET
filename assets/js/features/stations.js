import { stations, getStationTracks } from '../core/catalog.js';
import { fetchSongs } from '../core/youtube.js';
import { playFromQueue } from '../core/player.js';
import { pageHead, songRow, emptyState } from '../ui/templates.js';
import { bindSongRowActions, resolveTrack } from '../core/ui.js';

function stationBrowserCard(station, index, isActive = false){
  return `
    <article class="station-card ${isActive ? 'is-active' : ''}" style="--station-gradient:${station.gradient}">
      <span class="panel-kicker">Station View</span>
      <h3>${station.name}</h3>
      <p>${station.description || station.query}</p>
      <div class="meta-tags">
        <span class="mini-tag">${(station.seedIndexes || []).length || 0} seeds</span>
        <span class="mini-tag">YouTube pull</span>
      </div>
      <div class="actions">
        <button class="btn btn-primary" data-action="open-station" data-index="${index}">
          Open Station
        </button>
      </div>
    </article>
  `;
}

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
          <div class="stations-grid">
            ${stations.map((item, index) => stationBrowserCard(item, index, index === activeIndex)).join('')}
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
                ? `<div class="song-list">${queue.map(songRow).join('')}</div>`
                : emptyState('This station does not have a mix yet.')
            }
          </div>
        </aside>
      </div>
    </section>
  `;

  document.getElementById('playActiveStation')?.addEventListener('click', () => {
    playFromQueue(queue, 0);
  });

  document.getElementById('shuffleActiveStation')?.addEventListener('click', () => {
    const shuffled = queue.slice().sort(() => Math.random() - 0.5);
    playFromQueue(shuffled, 0);
  });

  bindSongRowActions(container, {
    'play-track': (_event, data) => {
      playFromQueue(queue, Number(data.index));
    },

    'toggle-like': (_event, data) => {
      const track = queue.find(item => item.videoId === data.video) || resolveTrack(data.video);
      window.dispatchEvent(new CustomEvent('velvet:toggle-like', { detail: { track } }));
    },

    'add-playlist': (_event, data) => {
      const track = queue.find(item => item.videoId === data.video) || resolveTrack(data.video);
      window.dispatchEvent(new CustomEvent('velvet:playlist-pick', { detail: { track } }));
    },

    'open-station': (_event, data) => {
      window.location.href = `stations.html#station-${data.index}`;
    }
  });
}
