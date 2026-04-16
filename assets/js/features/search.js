import { getSearchResults, getLocalSearchSnapshot, hasSearchMatches, normalizeQuery } from '../core/search.js';
import { playFromQueue } from '../core/player.js';
import { pageHead, artistCard, stationCard, songRow, emptyState } from '../ui/templates.js';
import { bindSongRowActions } from '../core/ui.js';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getQuery(){
  const params = new URLSearchParams(window.location.search);
  return normalizeQuery(params.get('q') || '');
}

function setQuery(query) {
  const url = new URL(window.location.href);

  if (query) {
    url.searchParams.set('q', query);
  } else {
    url.searchParams.delete('q');
  }

  window.history.replaceState({}, '', url);
}

function renderSearchState(container, results, { loading = false } = {}) {
  const { query, matches, liveTracks } = results;

  container.innerHTML = `
    <section>
      ${pageHead({ kicker:'Search Velvet', title:'Search', copy:'Type once and let Velvet surface local favorites and live YouTube pulls together.' })}
      ${query ? `
        <div class="panel search-status-panel">
          <div>
            <span class="panel-kicker">Results for</span>
            <div class="section-title" style="margin-top:12px">${escapeHtml(query)}</div>
          </div>
          <p class="section-copy">Velvet matches land first. Live YouTube results stream in right behind them.</p>
        </div>
      ` : '<div class="empty">Start typing in the top search bar and Velvet will respond in real time.</div>'}
    </section>
    <section class="search-groups">
      ${matches.artists.length ? `<div>${pageHead({ kicker:'Artists', title:'Artist Results', copy:'Profiles surfaced from Velvet\'s catalog.' })}<div class="artist-grid">${matches.artists.map(artistCard).join('')}</div></div>` : ''}
      ${matches.stations.length ? `<div>${pageHead({ kicker:'Stations', title:'Station Results', copy:'Station matches shaped by the moods already inside Velvet.' })}<div class="station-grid">${matches.stations.map(entry => stationCard(entry.station, entry.index)).join('')}</div></div>` : ''}
      ${matches.tracks.length ? `<div>${pageHead({ kicker:'Catalog', title:'From Your Catalog', copy:'Velvet matches already living in the room.' })}<div class="song-list">${matches.tracks.slice(0, 12).map(songRow).join('')}</div></div>` : ''}
      ${liveTracks.length ? `<div>${pageHead({ kicker:'Live from YouTube', title:'Expanded Search', copy:'Fresh YouTube pulls layered on top of Velvet\'s local results.' })}<div class="song-list">${liveTracks.map(songRow).join('')}</div></div>` : ''}
      ${loading && query ? `
        <div class="panel search-status-panel">
          <div>
            <span class="panel-kicker">Searching</span>
            <div class="section-title" style="margin-top:12px">Pulling from YouTube</div>
          </div>
          <p class="section-copy">Keep typing. Velvet is refreshing results without forcing a full page jump.</p>
        </div>
      ` : ''}
      ${!query ? '' : (!loading && !hasSearchMatches(results) ? emptyState('No matches yet. Try a different keyword.') : '')}
    </section>
  `;
}

export function mountSearchPage(container){
  const form = document.querySelector('.topbar-search');
  const input = form?.querySelector('input[name="q"]');
  let debounceTimer = null;
  let requestToken = 0;
  let currentResults = getLocalSearchSnapshot(getQuery());

  if (input) {
    input.value = currentResults.query;
  }

  const render = (options = {}) => {
    renderSearchState(container, currentResults, options);

    bindSongRowActions(container, {
      'play-track': (_event, data) => {
        const queue = currentResults.combinedTracks || [];
        const trackIndex = queue.findIndex(track => track.videoId === data.video);
        if (trackIndex >= 0) {
          playFromQueue(queue, trackIndex);
        }
      },
      'toggle-like': (_event, data) => {
        const track = (currentResults.combinedTracks || []).find(item => item.videoId === data.video);
        if (!track) return;
        window.dispatchEvent(new CustomEvent('velvet:toggle-like', { detail: { track } }));
      },
      'add-playlist': (_event, data) => {
        const track = (currentResults.combinedTracks || []).find(item => item.videoId === data.video);
        if (!track) return;
        window.dispatchEvent(new CustomEvent('velvet:playlist-pick', { detail: { track } }));
      },
      'open-station': (_event, data) => { window.location.href = `stations.html#station-${data.index}`; },
      'open-artist': (_event, data) => { window.location.href = `artists.html#artist-${data.slug}`; }
    });
  };

  async function updateQuery(rawQuery, { syncUrl = true } = {}) {
    const query = normalizeQuery(rawQuery);
    const token = ++requestToken;

    if (input && input.value !== query) {
      input.value = query;
    }

    currentResults = getLocalSearchSnapshot(query);
    render({ loading: Boolean(query) });

    if (syncUrl) {
      setQuery(query);
    }

    if (!query) {
      return;
    }

    const resolved = await getSearchResults(query, { liveLimit: 12 });
    if (token !== requestToken) return;

    currentResults = resolved;
    render();
  }

  form?.addEventListener('submit', event => {
    event.preventDefault();
    updateQuery(input?.value || '');
  });

  input?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => updateQuery(input.value), 180);
  });

  window.addEventListener('velvet:search-query', event => {
    updateQuery(event.detail?.query || '');
  });

  window.addEventListener('popstate', () => {
    updateQuery(getQuery(), { syncUrl: false });
  });

  updateQuery(currentResults.query, { syncUrl: false });
}
