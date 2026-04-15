import { searchCatalog } from '../core/catalog.js';
import { fetchSongs } from '../core/youtube.js';
import { playFromQueue } from '../core/player.js';
import { pageHead, artistCard, stationCard, songRow, emptyState } from '../ui/templates.js';
import { bindSongRowActions, resolveTrack } from '../core/ui.js';

function getQuery(){
  const params = new URLSearchParams(window.location.search);
  return (params.get('q') || '').trim();
}

export async function renderSearchPage(container){
  const query = getQuery();
  const matches = query ? searchCatalog(query) : { tracks: [], artists: [], stations: [] };
  let liveTracks = [];
  if(query){
    try{
      liveTracks = await fetchSongs(query, 12);
    }catch(_err){}
  }

  container.innerHTML = `
    <section>
      ${pageHead({ kicker:'Search Velvet', title:'Search', copy:'Find something silky across Velvet and YouTube without dragging the whole interface down.' })}
      ${query ? `<div class="panel"><span class="panel-kicker">Results for</span><div class="section-title" style="margin-top:12px">${query}</div></div>` : '<div class="empty">Try artist names, moods, or song titles from the top search bar.</div>'}
    </section>
    <section class="search-groups">
      ${matches.artists.length ? `<div>${pageHead({ kicker:'Artists', title:'Artist Results', copy:'Profiles surfaced from Velvet’s catalog.' })}<div class="artist-grid">${matches.artists.map(artistCard).join('')}</div></div>` : ''}
      ${matches.stations.length ? `<div>${pageHead({ kicker:'Stations', title:'Station Results', copy:'Station matches shaped by the moods already inside Velvet.' })}<div class="station-grid">${matches.stations.map(entry => stationCard(entry.station, entry.index)).join('')}</div></div>` : ''}
      ${matches.tracks.length ? `<div>${pageHead({ kicker:'Catalog', title:'From Your Catalog', copy:'Velvet matches already living in the local room.' })}<div class="song-list">${matches.tracks.slice(0, 12).map(songRow).join('')}</div></div>` : ''}
      ${liveTracks.length ? `<div>${pageHead({ kicker:'Live from YouTube', title:'Expanded Search', copy:'Fresh YouTube pulls layered on top of Velvet’s local results.' })}<div class="song-list">${liveTracks.map(songRow).join('')}</div></div>` : ''}
      ${!query ? '' : (!matches.artists.length && !matches.stations.length && !matches.tracks.length && !liveTracks.length ? emptyState('No matches yet. Try a different keyword.') : '')}
    </section>
  `;

  bindSongRowActions(container, {
    'play-track': (_event, data) => {
      const queue = [...matches.tracks, ...liveTracks];
      const combinedIndex = queue.findIndex(track => track.videoId === data.video);
      if(combinedIndex >= 0){ playFromQueue(queue, combinedIndex); }
    },
    'toggle-like': (_event, data) => {
      const track = [...matches.tracks, ...liveTracks].find(item => item.videoId === data.video) || resolveTrack(data.video);
      window.dispatchEvent(new CustomEvent('velvet:toggle-like', { detail: { track } }));
    },
    'add-playlist': (_event, data) => {
      const track = [...matches.tracks, ...liveTracks].find(item => item.videoId === data.video) || resolveTrack(data.video);
      window.dispatchEvent(new CustomEvent('velvet:playlist-pick', { detail: { track } }));
    },
    'open-station': (_event, data) => { window.location.href = `stations.html#station-${data.index}`; },
    'open-artist': (_event, data) => { window.location.href = `artists.html#artist-${data.slug}`; }
  });
}
