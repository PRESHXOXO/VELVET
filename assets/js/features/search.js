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

function searchLaneCard({ label, value, copy }) {
  return `
    <article class="search-lane-card">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${copy}</small>
    </article>
  `;
}

function renderSearchState(container, results, { loading = false } = {}) {
  const { query, matches, liveTracks } = results;
  const totalArtists = matches.artists.length;
  const totalStations = matches.stations.length;
  const totalCatalogTracks = matches.tracks.length;
  const totalLiveTracks = liveTracks.length;
  const statChips = [
    totalArtists ? `${totalArtists} artists` : '',
    totalStations ? `${totalStations} stations` : '',
    totalCatalogTracks ? `${totalCatalogTracks} local tracks` : '',
    totalLiveTracks ? `${totalLiveTracks} live pulls` : ''
  ].filter(Boolean);
  const laneCards = query ? [
    {
      label: 'Front plane',
      value: `${totalCatalogTracks} local`,
      copy: 'matches already anchored inside Velvet'
    },
    {
      label: 'Outer pull',
      value: `${totalLiveTracks} live`,
      copy: 'fresh YouTube results widening the frame'
    },
    {
      label: 'Active lane',
      value: escapeHtml(query),
      copy: 'the term currently steering the radar'
    }
  ] : [
    {
      label: 'Front plane',
      value: 'Local catalog',
      copy: 'artists, stations, and tracks already inside Velvet'
    },
    {
      label: 'Outer pull',
      value: 'YouTube live',
      copy: 'fresh search results join when a query arrives'
    },
    {
      label: 'Input',
      value: 'Mood / song / artist',
      copy: 'type once and let the field widen'
    }
  ];

  container.innerHTML = `
    <section class="search-stage">
      ${pageHead({
        kicker: 'Perspective Search',
        title: 'Search Radar',
        copy: 'Sweep through Velvet&apos;s local catalog first, then let live pulls widen the frame without flattening the room.'
      })}
      ${query ? `
        <article class="panel search-hero-panel">
          <div class="search-hero-copy">
            <span class="panel-kicker">Results for</span>
            <div class="search-hero-query">${escapeHtml(query)}</div>
            <p class="section-copy">Velvet matches stay on the front plane. Live YouTube pulls land just behind them so the search field feels deep, not noisy.</p>
          </div>
          <div class="search-hero-meta">
            ${statChips.length ? `<div class="search-hero-stats">${statChips.map(label => `<span class="mini-tag">${label}</span>`).join('')}</div>` : ''}
            ${loading ? '<div class="search-hero-note">Pulling fresh live results into the outer lane...</div>' : '<div class="search-hero-note">Local matches lead. Live pulls layer in behind them.</div>'}
          </div>
          <div class="search-lane-grid">
            ${laneCards.map(searchLaneCard).join('')}
          </div>
        </article>
      ` : `
        <article class="panel search-hero-panel search-hero-panel--empty">
          <div class="search-hero-copy">
            <span class="panel-kicker">Search ready</span>
            <div class="search-hero-query">Start typing.</div>
            <p class="section-copy">Use the top search bar and Velvet will return local matches first, then widen the field with live results.</p>
          </div>
          <div class="search-lane-grid">
            ${laneCards.map(searchLaneCard).join('')}
          </div>
        </article>
      `}
    </section>

    <section class="search-groups">
      ${matches.artists.length ? `<article class="panel search-result-panel search-result-panel--artists">${pageHead({ kicker:'Profiles', title:'Artist Silhouettes', copy:'Voices surfaced from Velvet&apos;s front catalog plane.' })}<div class="artist-grid">${matches.artists.map(artistCard).join('')}</div></article>` : ''}
      ${matches.stations.length ? `<article class="panel search-result-panel search-result-panel--stations">${pageHead({ kicker:'Lanes', title:'Station Matches', copy:'Station routes shaped by the moods already moving through Velvet.' })}<div class="station-grid">${matches.stations.map(entry => stationCard(entry.station, entry.index)).join('')}</div></article>` : ''}
      ${matches.tracks.length ? `<article class="panel search-result-panel search-result-panel--catalog">${pageHead({ kicker:'Frontline', title:'Catalog Matches', copy:'Songs already living in the room, ready to play immediately.' })}<div class="song-list search-song-list">${matches.tracks.slice(0, 12).map(songRow).join('')}</div></article>` : ''}
      ${liveTracks.length ? `<article class="panel search-result-panel search-result-panel--live">${pageHead({ kicker:'Outer Pulls', title:'Expanded Search', copy:'Fresh YouTube pulls layered on top of Velvet&apos;s local results.' })}<div class="song-list search-song-list">${liveTracks.map(songRow).join('')}</div></article>` : ''}
      ${!query ? '' : (!loading && !hasSearchMatches(results) ? emptyState('No matches in the current field. Try a different mood, artist, or song.') : '')}
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
