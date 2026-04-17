import { initPlayer, playFromQueue, refreshPlayer } from './core/player.js';
import { findTrackByVideoId } from './core/catalog.js';
import { getLocalSearchSnapshot, getSearchPreview, getSearchResults, normalizeQuery } from './core/search.js';
import { initGlobalUi } from './core/ui.js';
import { isLiked, toggleLike } from './core/state.js';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function syncLikeButtons() {
  document.querySelectorAll('[data-action="toggle-like"][data-video]').forEach(button => {
    button.classList.toggle('on', isLiked(button.dataset.video));
  });
}

function toggleLikedTrack(track) {
  if (!track?.videoId) return;

  toggleLike(track);
  refreshPlayer();
  window.dispatchEvent(new CustomEvent('velvet:library-changed'));
}

function renderTrackRows(tracks = []) {
  return tracks.map(track => `
    <button class="search-preview-row" type="button" data-preview-track data-video="${track.videoId}">
      <img src="${escapeHtml(track.thumb || '')}" alt="${escapeHtml(track.title || 'Track artwork')}">
      <span class="search-preview-copy">
        <strong>${escapeHtml(track.title || 'Unknown track')}</strong>
        <small>${escapeHtml(track.artist || 'Unknown artist')}</small>
      </span>
    </button>
  `).join('');
}

function renderArtistChips(artists = []) {
  return artists.map(profile => `
    <a class="search-preview-chip" href="artists.html#artist-${profile.slug}">
      <strong>${escapeHtml(profile.name || profile.slug)}</strong>
      <span>Artist</span>
    </a>
  `).join('');
}

function renderStationChips(stations = []) {
  return stations.map(entry => `
    <a class="search-preview-chip" href="stations.html#station-${entry.index}">
      <strong>${escapeHtml(entry.station.name)}</strong>
      <span>Station</span>
    </a>
  `).join('');
}

function buildSearchPreviewMarkup(results, { loading = false } = {}) {
  const preview = getSearchPreview(results, { trackLimit: 4, artistLimit: 3, stationLimit: 2, liveTrackLimit: 4 });
  const sections = [];

  if (preview.tracks.length) {
    sections.push(`
      <div class="search-preview-group">
        <div class="search-preview-label">From Velvet</div>
        <div class="search-preview-list">${renderTrackRows(preview.tracks)}</div>
      </div>
    `);
  }

  if (preview.liveTracks.length) {
    sections.push(`
      <div class="search-preview-group">
        <div class="search-preview-label">Live from YouTube</div>
        <div class="search-preview-list">${renderTrackRows(preview.liveTracks)}</div>
      </div>
    `);
  }

  if (preview.artists.length) {
    sections.push(`
      <div class="search-preview-group">
        <div class="search-preview-label">Artists</div>
        <div class="search-preview-chip-row">${renderArtistChips(preview.artists)}</div>
      </div>
    `);
  }

  if (preview.stations.length) {
    sections.push(`
      <div class="search-preview-group">
        <div class="search-preview-label">Stations</div>
        <div class="search-preview-chip-row">${renderStationChips(preview.stations)}</div>
      </div>
    `);
  }

  const statusMarkup = loading
    ? '<div class="search-preview-status">Pulling fresh results from YouTube while Velvet local matches stay in view.</div>'
    : (!sections.length && results.query
      ? '<div class="search-preview-empty">No quick matches yet. Try another title, artist, or mood.</div>'
      : '');

  return `
    <div class="search-preview-shell">
      <div class="search-preview-head">
        <span class="panel-kicker">Live Search</span>
        <button class="search-preview-link" type="button" data-search-submit>
          View all results for "${escapeHtml(results.query)}"
        </button>
      </div>
      ${sections.join('')}
      ${statusMarkup}
    </div>
  `;
}

function initTopbarSearch(activePage) {
  const form = document.querySelector('.topbar-search');
  const input = form?.querySelector('input[name="q"]');
  if (!form || !input) return;

  const currentUrlQuery = new URLSearchParams(window.location.search).get('q') || '';
  if (!normalizeQuery(input.value) && currentUrlQuery) {
    input.value = currentUrlQuery;
  }

  const panel = document.createElement('div');
  panel.className = 'search-preview';
  form.append(panel);

  let debounceTimer = null;
  let requestToken = 0;
  let previewResults = getLocalSearchSnapshot(input.value);

  function closePreview() {
    form.classList.remove('is-open');
    panel.classList.remove('is-open');
    panel.innerHTML = '';
  }

  function showPreview(results, options = {}) {
    if (!results.query) {
      closePreview();
      return;
    }

    panel.innerHTML = buildSearchPreviewMarkup(results, options);
    form.classList.add('is-open');
    panel.classList.add('is-open');
  }

  async function updatePreview(rawQuery) {
    const query = normalizeQuery(rawQuery);
    const token = ++requestToken;

    previewResults = getLocalSearchSnapshot(query);
    if (!query) {
      closePreview();
      return;
    }

    showPreview(previewResults, { loading: true });

    const resolved = await getSearchResults(query, { liveLimit: 6 });
    if (token !== requestToken || normalizeQuery(input.value) !== query) return;

    previewResults = resolved;
    showPreview(previewResults);
  }

  function schedulePreview() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => updatePreview(input.value), 120);
  }

  input.addEventListener('input', schedulePreview);
  input.addEventListener('focus', () => {
    if (normalizeQuery(input.value)) {
      updatePreview(input.value);
    }
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closePreview();
    }
  });

  panel.addEventListener('click', event => {
    const trackTrigger = event.target.closest('[data-preview-track]');
    if (trackTrigger) {
      const queue = previewResults.combinedTracks || [];
      const trackIndex = queue.findIndex(track => track.videoId === trackTrigger.dataset.video);
      if (trackIndex >= 0) {
        playFromQueue(queue, trackIndex);
      }
      closePreview();
      return;
    }

    const submitTrigger = event.target.closest('[data-search-submit]');
    if (!submitTrigger) return;

    const query = previewResults.query || normalizeQuery(input.value);
    if (!query) return;

    if (activePage === 'search') {
      window.dispatchEvent(new CustomEvent('velvet:search-query', { detail: { query } }));
    } else {
      window.location.href = `search.html?q=${encodeURIComponent(query)}`;
    }

    closePreview();
  });

  document.addEventListener('click', event => {
    if (!form.contains(event.target)) {
      closePreview();
    }
  });

  if (activePage !== 'search') {
    form.addEventListener('submit', event => {
      const query = normalizeQuery(input.value);
      if (!query) {
        event.preventDefault();
      }
      closePreview();
    });
  }
}

export function initSharedApp(activePage){
  document.querySelectorAll('[data-page-link]').forEach(link => {
    link.classList.toggle('active', link.dataset.pageLink === activePage);
  });

  document.querySelectorAll('[data-nav-link]').forEach(link => {
    link.classList.toggle('active', link.dataset.navLink === activePage);
  });

  initPlayer();
  initGlobalUi();
  initTopbarSearch(activePage);
  syncLikeButtons();

  window.addEventListener('velvet:toggle-like', event => {
    const track = event.detail?.track || findTrackByVideoId(event.detail?.videoId);
    if (!track) return;

    toggleLikedTrack(track);
  });

  window.addEventListener('velvet:library-changed', () => {
    syncLikeButtons();
    refreshPlayer();
  });
}

