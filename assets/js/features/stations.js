import { stations, getStationTracks } from '../core/catalog.js';
import { fetchSongs } from '../core/youtube.js';
import { playFromQueue } from '../core/player.js';
import { pageHead, stationCard, songRow, emptyState } from '../ui/templates.js';
import { bindSongRowActions, resolveTrack, toast } from '../core/ui.js';

export async function renderStationsPage(container){
  const hashMatch = window.location.hash.match(/station-(\d+)/);
  const activeIndex = hashMatch ? Math.max(0, Math.min(Number(hashMatch[1]), stations.length - 1)) : 0;
  const station = stations[activeIndex];
  const localTracks = getStationTracks(activeIndex);
  let liveTracks = [];
  try{
    liveTracks = await fetchSongs(station.query, 8);
  }catch(_err){}

  const queue = [...localTracks, ...liveTracks.filter(track => !localTracks.some(local => local.videoId === track.videoId))];

  container.innerHTML = `
    <section>
      ${pageHead({ kicker:'All stations', title:'Genre Stations', copy:'Move between moods without losing the room. Each station opens into a cleaner, richer listening view.' })}
      <div class="split">
        <div class="station-grid">${stations.map(stationCard).join('')}</div>
        <aside class="panel detail-panel">
          <span class="panel-kicker">Station View</span>
          <div class="section-title" style="margin-top:12px">${station.name}</div>
          <p class="section-copy">${station.query}</p>
          <div class="inline-actions">
            <button class="btn btn-primary" id="playActiveStation">Play Station</button>
            <button class="btn btn-secondary" id="shuffleActiveStation">Shuffle</button>
          </div>
          <div style="margin-top:18px" id="stationSongList">
            ${queue.length ? `<div class="song-list">${queue.map(songRow).join('')}</div>` : emptyState('This station does not have a mix yet.')}
          </div>
        </aside>
      </div>
    </section>
  `;

  document.getElementById('playActiveStation')?.addEventListener('click', () => playFromQueue(queue, 0));
  document.getElementById('shuffleActiveStation')?.addEventListener('click', () => {
    const shuffled = queue.slice().sort(() => Math.random() - 0.5);
    playFromQueue(shuffled, 0);
  });

  bindSongRowActions(container, {
    'play-track': (_event, data) => playFromQueue(queue, Number(data.index)),
    'toggle-like': (_event, data) => {
      const track = queue.find(item => item.videoId === data.video) || resolveTrack(data.video);
      window.dispatchEvent(new CustomEvent('velvet:toggle-like', { detail: { track } }));
    },
    'add-playlist': (_event, data) => {
      const track = queue.find(item => item.videoId === data.video) || resolveTrack(data.video);
      window.dispatchEvent(new CustomEvent('velvet:playlist-pick', { detail: { track } }));
    },
    'open-station': (_event, data) => { window.location.href = `stations.html#station-${data.index}`; },
    'shuffle-station': (_event, data) => { window.location.href = `stations.html#station-${data.index}`; }
  });
}
