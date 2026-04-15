import { stations, catalogTracks } from '../core/catalog.js';
import { state } from '../core/state.js';
import { playFromQueue } from '../core/player.js';
import { heroBanner, pageHead, stationCard, songRow, shelfCard, emptyState } from '../ui/templates.js';
import { bindSongRowActions, resolveTrack } from '../core/ui.js';

export function renderHome(container){
  const recentCards = state.recent.slice(0, 3);
  container.innerHTML = `
    ${heroBanner({
      kicker:'After Dark Listening',
      title:'Mood-first listening, simplified.',
      copy:'A calmer entry point for stations, playlists, and late-night listening.',
      actions: `
        <button class="btn btn-primary" id="heroStartRoom">Start the room</button>
        <a class="btn btn-secondary" href="stations.html">Browse stations</a>
        <button class="btn btn-secondary" data-open-create-playlist>Create a playlist</button>
      `
    })}
    <section>
      ${pageHead({ kicker:'Stations', title:'Mood Stations', copy:'A cleaner station shelf with one consistent rhythm, built for easier scanning and better entry points.', linkText:'See all', linkHref:'stations.html' })}
      <div class="station-grid">${stations.slice(0, 6).map(stationCard).join('')}</div>
    </section>
    <section>
      ${pageHead({ kicker:'For tonight', title:'Top Picks', copy:'A simple, tighter listening list that keeps the homepage active without turning it into another shelf wall.' })}
      <div class="song-list" id="homeSongList">${catalogTracks.slice(0, 10).map(songRow).join('')}</div>
    </section>
    <section>
      ${pageHead({ kicker:'Back to it', title:'Recently Played', copy:'The fastest path back into what already matched your mood.' })}
      <div class="card-grid">
        ${recentCards.length ? recentCards.map(track => shelfCard({
          image: track.thumb,
          kicker: 'Velvet Return',
          title: track.title,
          copy: `Return to ${track.artist} without rebuilding the mood.`
        })).join('') : emptyState('No recent tracks yet. Start the room and your returns will collect here.')}
      </div>
    </section>
  `;

  document.getElementById('heroStartRoom')?.addEventListener('click', () => playFromQueue(catalogTracks.slice(0, 12), 0));

  bindSongRowActions(container, {
    'play-track': (_event, data) => {
      const index = Number(data.index);
      playFromQueue(catalogTracks.slice(0, 10), index);
    },
    'toggle-like': (_event, data) => {
      const track = resolveTrack(data.video);
      window.dispatchEvent(new CustomEvent('velvet:toggle-like', { detail: { track } }));
    },
    'add-playlist': (_event, data) => {
      const track = resolveTrack(data.video);
      window.dispatchEvent(new CustomEvent('velvet:playlist-pick', { detail: { track } }));
    },
    'open-station': (_event, data) => {
      window.location.href = `stations.html#station-${data.index}`;
    },
    'shuffle-station': (_event, data) => {
      window.location.href = `stations.html#station-${data.index}`;
    }
  });
}
