import { getSearchResults, getLocalSearchSnapshot, hasSearchMatches, normalizeQuery } from '../core/search.js';
import { playFromQueue } from '../core/player.js';
import { createPlaylistFromTracks } from '../core/state.js';
import { pageHead, artistCard, stationCard, songRow, emptyState } from '../ui/templates.js';
import { bindSongRowActions, toast } from '../core/ui.js';

const RECENT_SEARCHES_KEY = 'vlv_recent_searches';
const SAVED_SEARCHES_KEY = 'vlv_saved_searches';
const SEARCH_FILTERS = ['all', 'catalog', 'live', 'artists', 'stations'];

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

function readSearchCollection(key) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
    if (!Array.isArray(parsed)) return [];

    const seen = new Set();
    return parsed
      .map(normalizeQuery)
      .filter(Boolean)
      .filter(item => {
        const normalized = item.toLowerCase();
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      })
      .slice(0, 8);
  } catch {
    return [];
  }
}

function writeSearchCollection(key, values) {
  window.localStorage.setItem(key, JSON.stringify(values));
}

function pushRecentSearch(query) {
  const normalized = normalizeQuery(query);
  if (!normalized) return readSearchCollection(RECENT_SEARCHES_KEY);

  const next = [
    normalized,
    ...readSearchCollection(RECENT_SEARCHES_KEY).filter(item => item.toLowerCase() !== normalized.toLowerCase())
  ].slice(0, 8);

  writeSearchCollection(RECENT_SEARCHES_KEY, next);
  return next;
}

function toggleSavedSearch(query) {
  const normalized = normalizeQuery(query);
  const current = readSearchCollection(SAVED_SEARCHES_KEY);
  if (!normalized) return { saved: false, values: current };

  const exists = current.some(item => item.toLowerCase() === normalized.toLowerCase());
  const next = exists
    ? current.filter(item => item.toLowerCase() !== normalized.toLowerCase())
    : [normalized, ...current.filter(item => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 8);

  writeSearchCollection(SAVED_SEARCHES_KEY, next);
  return { saved: !exists, values: next };
}

function isSavedSearch(query, savedSearches = []) {
  const normalized = normalizeQuery(query).toLowerCase();
  return Boolean(normalized) && savedSearches.some(item => item.toLowerCase() === normalized);
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

function searchFilterButton(filter, label, count, activeFilter) {
  return `
    <button class="search-filter${activeFilter === filter ? ' is-active' : ''}" type="button" data-action="set-search-filter" data-filter="${filter}">
      <span>${label}</span>
      <strong>${count}</strong>
    </button>
  `;
}

function searchQueryChip(query, saved = false) {
  return `
    <button class="search-query-chip${saved ? ' is-saved' : ''}" type="button" data-action="run-search-query" data-query="${escapeHtml(query)}">
      ${escapeHtml(query)}
    </button>
  `;
}

function renderSearchState(container, results, { loading = false, activeFilter = 'all', recentSearches = [], savedSearches = [] } = {}) {
  const { query, matches, liveTracks } = results;
  const totalArtists = matches.artists.length;
  const totalStations = matches.stations.length;
  const totalCatalogTracks = matches.tracks.length;
  const totalLiveTracks = liveTracks.length;
  const filterButtons = [
    searchFilterButton('all', 'All', totalArtists + totalStations + totalCatalogTracks + totalLiveTracks, activeFilter),
    searchFilterButton('catalog', 'Local tracks', totalCatalogTracks, activeFilter),
    searchFilterButton('live', 'Live pulls', totalLiveTracks, activeFilter),
    searchFilterButton('artists', 'Artists', totalArtists, activeFilter),
    searchFilterButton('stations', 'Stations', totalStations, activeFilter)
  ].join('');
  const statChips = [
    totalArtists ? `${totalArtists} artists` : '',
    totalStations ? `${totalStations} stations` : '',
    totalCatalogTracks ? `${totalCatalogTracks} local tracks` : '',
    totalLiveTracks ? `${totalLiveTracks} live pulls` : ''
  ].filter(Boolean);
  const showArtists = activeFilter === 'all' || activeFilter === 'artists';
  const showStations = activeFilter === 'all' || activeFilter === 'stations';
  const showCatalog = activeFilter === 'all' || activeFilter === 'catalog';
  const showLive = activeFilter === 'all' || activeFilter === 'live';
  const savedSearch = isSavedSearch(query, savedSearches);
  const primaryStation = matches.stations[0] || null;
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
  const queryBanksMarkup = (savedSearches.length || recentSearches.length) ? `
    <div class="search-query-banks">
      ${savedSearches.length ? `
        <div class="search-query-bank">
          <div class="search-query-bank-head">
            <span class="panel-kicker">Saved searches</span>
            <p class="section-copy">Pinned phrases you want to jump back into fast.</p>
          </div>
          <div class="search-query-bank-chips">
            ${savedSearches.map(item => searchQueryChip(item, true)).join('')}
          </div>
        </div>
      ` : ''}
      ${recentSearches.length ? `
        <div class="search-query-bank">
          <div class="search-query-bank-head">
            <span class="panel-kicker">Recent passes</span>
            <p class="section-copy">The latest terms that widened the room.</p>
          </div>
          <div class="search-query-bank-chips">
            ${recentSearches.map(item => searchQueryChip(item)).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  ` : '';

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
            <div class="inline-actions search-utility-row">
              ${results.combinedTracks.length ? `<button class="btn btn-primary" type="button" data-action="build-search-stack">${query ? `Build ${escapeHtml(query)} stack` : 'Build stack'}</button>` : ''}
              ${query ? `<button class="btn btn-secondary" type="button" data-action="toggle-save-search">${savedSearch ? 'Saved query' : 'Save query'}</button>` : ''}
              ${primaryStation ? `<button class="btn btn-secondary" type="button" data-action="open-first-station" data-index="${primaryStation.index}">Open top lane</button>` : ''}
            </div>
          </div>
          <div class="search-filter-bar">
            ${filterButtons}
          </div>
          <div class="search-lane-grid">
            ${laneCards.map(searchLaneCard).join('')}
          </div>
          ${queryBanksMarkup}
        </article>
      ` : `
        <article class="panel search-hero-panel search-hero-panel--empty">
          <div class="search-hero-copy">
            <span class="panel-kicker">Search ready</span>
            <div class="search-hero-query">Start typing.</div>
            <p class="section-copy">Use the top search bar and Velvet will return local matches first, then widen the field with live results.</p>
          </div>
          <div class="search-filter-bar">
            ${filterButtons}
          </div>
          <div class="search-lane-grid">
            ${laneCards.map(searchLaneCard).join('')}
          </div>
          ${queryBanksMarkup}
        </article>
      `}
    </section>

    <section class="search-groups">
      ${showArtists && matches.artists.length ? `<article class="panel search-result-panel search-result-panel--artists">${pageHead({ kicker:'Profiles', title:'Artist Silhouettes', copy:'Voices surfaced from Velvet&apos;s front catalog plane.' })}<div class="artist-grid">${matches.artists.map(artistCard).join('')}</div></article>` : ''}
      ${showStations && matches.stations.length ? `<article class="panel search-result-panel search-result-panel--stations">${pageHead({ kicker:'Lanes', title:'Station Matches', copy:'Station routes shaped by the moods already moving through Velvet.' })}<div class="station-grid">${matches.stations.map(entry => stationCard(entry.station, entry.index)).join('')}</div></article>` : ''}
      ${showCatalog && matches.tracks.length ? `<article class="panel search-result-panel search-result-panel--catalog">${pageHead({ kicker:'Frontline', title:'Catalog Matches', copy:'Songs already living in the room, ready to play immediately.' })}<div class="song-list search-song-list">${matches.tracks.slice(0, 12).map(songRow).join('')}</div></article>` : ''}
      ${showLive && liveTracks.length ? `<article class="panel search-result-panel search-result-panel--live">${pageHead({ kicker:'Outer Pulls', title:'Expanded Search', copy:'Fresh YouTube pulls layered on top of Velvet&apos;s local results.' })}<div class="song-list search-song-list">${liveTracks.map(songRow).join('')}</div></article>` : ''}
      ${!query ? '' : (!loading && !hasSearchMatches(results) ? emptyState('No matches in the current field. Try a different mood, artist, or song.') : '')}
    </section>
  `;
}

export function mountSearchPage(container){
  if (!container) return;

  const requestToken = (container.__velvetSearchRequestToken || 0) + 1;
  container.__velvetSearchRequestToken = requestToken;
  let currentResults = getLocalSearchSnapshot(getQuery());
  let activeFilter = 'all';
  let recentSearches = readSearchCollection(RECENT_SEARCHES_KEY);
  let savedSearches = readSearchCollection(SAVED_SEARCHES_KEY);

  const render = (options = {}) => {
    renderSearchState(container, currentResults, {
      ...options,
      activeFilter,
      recentSearches,
      savedSearches
    });

    bindSongRowActions(container, {
      'set-search-filter': (_event, data) => {
        const nextFilter = data.filter || 'all';
        if (!SEARCH_FILTERS.includes(nextFilter) || nextFilter === activeFilter) return;
        activeFilter = nextFilter;
        render();
      },
      'run-search-query': (_event, data) => {
        const query = normalizeQuery(data.query);
        if (!query) return;
        window.dispatchEvent(new CustomEvent('velvet:navigate', { detail: { href: `search.html?q=${encodeURIComponent(query)}` } }));
      },
      'toggle-save-search': () => {
        if (!currentResults.query) return;
        const update = toggleSavedSearch(currentResults.query);
        savedSearches = update.values;
        toast(update.saved ? 'Search saved' : 'Search removed');
        render();
      },
      'build-search-stack': () => {
        if (!currentResults.combinedTracks?.length) return;
        const playlist = createPlaylistFromTracks(`${currentResults.query || 'Velvet'} Search`, currentResults.combinedTracks.slice(0, 20));
        if (!playlist) return;
        toast('Search stack created');
        window.dispatchEvent(new CustomEvent('velvet:library-changed'));
      },
      'open-first-station': (_event, data) => {
        if (data.index == null) return;
        window.dispatchEvent(new CustomEvent('velvet:navigate', { detail: { href: `stations.html#station-${data.index}` } }));
      },
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
      'open-station': (_event, data) => {
        window.dispatchEvent(new CustomEvent('velvet:navigate', { detail: { href: `stations.html#station-${data.index}` } }));
      },
      'open-artist': (_event, data) => {
        window.dispatchEvent(new CustomEvent('velvet:navigate', { detail: { href: `artists.html#artist-${data.slug}` } }));
      }
    });
  };

  async function updateQuery(rawQuery) {
    const query = normalizeQuery(rawQuery);
    if (query) {
      recentSearches = pushRecentSearch(query);
    }
    savedSearches = readSearchCollection(SAVED_SEARCHES_KEY);

    currentResults = getLocalSearchSnapshot(query);
    render({ loading: Boolean(query) });

    if (!query) {
      return;
    }

    const resolved = await getSearchResults(query, { liveLimit: 12 });
    if (container.__velvetSearchRequestToken !== requestToken) return;

    currentResults = resolved;
    render();
  }

  updateQuery(currentResults.query);
}
