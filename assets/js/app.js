import { initPlayer, playFromQueue, refreshPlayer } from './core/player.js';
import { findTrackByVideoId } from './core/catalog.js';
import { getLocalSearchSnapshot, getSearchPreview, getSearchResults, normalizeQuery } from './core/search.js';
import { initGlobalUi } from './core/ui.js';
import { isLiked, toggleLike } from './core/state.js';
import { mountHomePage } from './features/home.js';
import { renderArtistsPage } from './features/artists.js';
import { mountLibraryPage } from './features/library.js';
import { mountSearchPage } from './features/search.js';
import { renderStationsPage } from './features/stations.js';

const ROUTES = {
  home: {
    path: 'index.html',
    bodyClass: 'page-home',
    title: 'Velvet | Home',
    description: 'Velvet home view with a perspective-driven listening room for after-hours R&B and soul.',
    brandNote: 'After-hours R&B and soul arranged in layered lanes, guided depth, and a quieter home view.',
    sidebarKicker: 'Perspective Mode',
    sidebarCopy: 'Front plane, side lanes, and lower rails now shape the home room before the rest of the catalog steps in.',
    overline: 'Perspective Listening Room',
    searchPlaceholder: 'Search songs, artists, and mood lanes',
    render: mountHomePage
  },
  stations: {
    path: 'stations.html',
    bodyClass: 'page-home page-stations',
    title: 'Velvet | Stations',
    description: 'Velvet stations view with perspective-driven mood lanes, side corridors, and a front-focused station mix.',
    brandNote: 'After-hours R&B and soul arranged in layered lanes, guided depth, and station-led movement.',
    sidebarKicker: 'Mood Lanes',
    sidebarCopy: 'Station browsing now reads like side corridors, with one active lane stepping into focus.',
    overline: 'Perspective Lane Browser',
    searchPlaceholder: 'Search songs, artists, and mood lanes',
    render: renderStationsPage
  },
  search: {
    path: 'search.html',
    bodyClass: 'page-home page-search',
    title: 'Velvet | Search',
    description: 'Velvet search view with perspective-driven radar, layered local matches, and live YouTube pulls.',
    brandNote: 'After-hours R&B and soul arranged in layered lanes, guided depth, and search-first motion.',
    sidebarKicker: 'Search Lanes',
    sidebarCopy: 'Local matches lead, live pulls trail behind, and the catalog stays layered instead of flat.',
    overline: 'Perspective Search Radar',
    searchPlaceholder: 'Search songs, artists, and mood lanes',
    render: mountSearchPage
  },
  artists: {
    path: 'artists.html',
    bodyClass: 'page-home page-artists',
    title: 'Velvet | Artists',
    description: 'Velvet artist view mapped as a perspective-driven index of voices, essentials, and front-plane profiles.',
    brandNote: 'After-hours R&B and soul arranged in layered lanes, guided depth, and artist-first focus.',
    sidebarKicker: 'Artist Plane',
    sidebarCopy: 'Profiles step forward here, with one voice in focus and the rest held in the side field.',
    overline: 'Perspective Artist Index',
    searchPlaceholder: 'Search artists, tracks, and mood lanes',
    render: renderArtistsPage
  },
  library: {
    path: 'library.html',
    bodyClass: 'page-home page-library',
    title: 'Velvet | Library',
    description: 'Velvet library view with perspective-driven stacks, saved tracks, and return lanes kept in one memory room.',
    brandNote: 'After-hours R&B and soul arranged in layered lanes, guided depth, and a memory-first library.',
    sidebarKicker: 'Memory Stacks',
    sidebarCopy: 'Saved tracks, playlists, and return paths stay stacked here as one evolving field.',
    overline: 'Perspective Memory Room',
    searchPlaceholder: 'Search songs, artists, and mood lanes',
    render: mountLibraryPage
  }
};

const routeRuntime = {
  initialized: false,
  activePage: null,
  pageRoot: null,
  routeRoots: new Map(),
  closePreview: () => {},
  searchInput: null
};

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getRouteFromLocation(urlLike = window.location) {
  const pathname = urlLike instanceof URL
    ? urlLike.pathname
    : (urlLike?.pathname || new URL(String(urlLike), window.location.href).pathname);
  const fileName = pathname.split('/').pop() || 'index.html';

  switch (fileName) {
    case '':
    case 'index.html':
      return 'home';
    case 'stations.html':
      return 'stations';
    case 'search.html':
      return 'search';
    case 'artists.html':
      return 'artists';
    case 'library.html':
      return 'library';
    default:
      return null;
  }
}

function isPlainLeftClick(event) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
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

function updateShellChrome(page) {
  const route = ROUTES[page];
  if (!route) return;

  document.body.className = route.bodyClass;
  document.title = route.title;

  const description = document.querySelector('meta[name="description"]');
  if (description) {
    description.setAttribute('content', route.description);
  }

  const brandNote = document.querySelector('.brand-note');
  if (brandNote) {
    brandNote.textContent = route.brandNote;
  }

  const sidebarKicker = document.querySelector('.sidebar-foot .panel-kicker');
  if (sidebarKicker) {
    sidebarKicker.textContent = route.sidebarKicker;
  }

  const sidebarCopy = document.querySelector('.sidebar-foot p');
  if (sidebarCopy) {
    sidebarCopy.textContent = route.sidebarCopy;
  }

  const topbarOverline = document.querySelector('.topbar-overline');
  if (topbarOverline) {
    topbarOverline.textContent = route.overline;
  }

  if (routeRuntime.searchInput) {
    routeRuntime.searchInput.placeholder = route.searchPlaceholder;

    if (document.activeElement !== routeRuntime.searchInput) {
      const query = new URLSearchParams(window.location.search).get('q') || '';
      routeRuntime.searchInput.value = query;
    }
  }
}

function updateActiveNav(page) {
  document.querySelectorAll('[data-page-link]').forEach(link => {
    link.classList.toggle('active', link.dataset.pageLink === page);
  });

  document.querySelectorAll('[data-nav-link]').forEach(link => {
    link.classList.toggle('active', link.dataset.navLink === page);
  });
}

function ensureRouteRoot(page) {
  if (routeRuntime.routeRoots.has(page)) {
    return routeRuntime.routeRoots.get(page);
  }

  const root = document.createElement('div');
  root.className = 'page-stack route-root';
  root.dataset.routeRoot = page;
  routeRuntime.routeRoots.set(page, root);
  return root;
}

function mountRouteRoot(page) {
  const root = ensureRouteRoot(page);

  if (routeRuntime.pageRoot.firstElementChild !== root) {
    routeRuntime.pageRoot.replaceChildren(root);
  }

  return root;
}

async function renderRoute(page, { scroll = true } = {}) {
  const route = ROUTES[page];
  if (!route) return;

  routeRuntime.activePage = page;
  updateShellChrome(page);
  updateActiveNav(page);

  const root = mountRouteRoot(page);
  await route.render(root);

  syncLikeButtons();
  refreshPlayer();

  if (scroll) {
    window.scrollTo(0, 0);
  }
}

export async function navigateTo(href, { replace = false, scroll = true } = {}) {
  const url = new URL(String(href), window.location.href);
  const page = getRouteFromLocation(url);
  const nextHref = url.toString();

  if (url.origin !== window.location.origin || !page) {
    window.location.href = nextHref;
    return false;
  }

  const current = window.location.href;
  if (current === nextHref) {
    try {
      await renderRoute(page, { scroll: false });
    } catch (error) {
      console.error('Velvet route render failed', error);
      window.location.href = nextHref;
    }
    return true;
  }

  try {
    if (replace) {
      window.history.replaceState({}, '', nextHref);
    } else {
      window.history.pushState({}, '', nextHref);
    }

    routeRuntime.closePreview();
    await renderRoute(page, { scroll });
  } catch (error) {
    console.error('Velvet navigation failed', error);
    window.location.href = nextHref;
    return false;
  }

  return true;
}

function initTopbarSearch() {
  const form = document.querySelector('.topbar-search');
  const input = form?.querySelector('input[name="q"]');
  if (!form || !input) return;

  routeRuntime.searchInput = input;

  const existingPanel = form.querySelector('.search-preview');
  const panel = existingPanel || document.createElement('div');
  if (!existingPanel) {
    panel.className = 'search-preview';
    form.append(panel);
  }

  let debounceTimer = null;
  let requestToken = 0;
  let previewResults = getLocalSearchSnapshot(input.value);

  function closePreview() {
    form.classList.remove('is-open');
    panel.classList.remove('is-open');
    panel.innerHTML = '';
  }

  routeRuntime.closePreview = closePreview;

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

  function submitSearch(query) {
    const normalized = normalizeQuery(query);
    if (!normalized) {
      closePreview();
      return;
    }

    closePreview();
    navigateTo(`search.html?q=${encodeURIComponent(normalized)}`);
  }

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => updatePreview(input.value), 120);
  });

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

  form.addEventListener('submit', event => {
    event.preventDefault();
    submitSearch(input.value);
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

    submitSearch(previewResults.query || input.value);
  });

  document.addEventListener('click', event => {
    if (!form.contains(event.target)) {
      closePreview();
    }
  });
}

function initInternalRouting() {
  document.addEventListener('click', event => {
    if (!isPlainLeftClick(event)) return;

    const anchor = event.target.closest('a[href]');
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;

    const href = anchor.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    const url = new URL(anchor.href, window.location.href);
    const page = getRouteFromLocation(url);
    if (url.origin !== window.location.origin || !page) return;

    event.preventDefault();
    navigateTo(url.href).catch(() => {
      window.location.href = url.href;
    });
  });

  window.addEventListener('popstate', () => {
    const page = getRouteFromLocation(window.location) || 'home';
    routeRuntime.closePreview();
    renderRoute(page, { scroll: false }).catch(() => {
      window.location.reload();
    });
  });

  window.addEventListener('velvet:navigate', event => {
    const href = event.detail?.href;
    if (!href) return;
    navigateTo(href).catch(() => {
      window.location.href = href;
    });
  });
}

function initSharedRuntime() {
  initPlayer();
  initGlobalUi();
  initTopbarSearch();
  initInternalRouting();
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

export async function bootApp(initialPage = 'home') {
  if (!routeRuntime.initialized) {
    routeRuntime.pageRoot = document.getElementById('pageRoot');
    if (!routeRuntime.pageRoot) return;

    routeRuntime.pageRoot.innerHTML = '';
    initSharedRuntime();
    routeRuntime.initialized = true;
  }

  const page = getRouteFromLocation(window.location) || initialPage;
  await renderRoute(page, { scroll: false });
}

export const initSharedApp = bootApp;
