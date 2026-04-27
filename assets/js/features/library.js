import { refreshLibraryState, isLiked, state } from '../core/state.js';
import { playFromQueue } from '../core/player.js';
import { bindSongRowActions, resolveTrack } from '../core/ui.js';
import { getPlaylistPreviewEntries, getPlaylistSignature, getPrimaryPlaylist } from '../core/playlists.js';
import { pageHead, emptyState, icon, getTrackArtwork, libraryPlaylistCard } from '../ui/templates.js';
import { formatCount } from '../core/tracks.js';

const LIBRARY_KEYS = new Set(['vlv_liked', 'vlv_recent', 'vlv_playlists']);
const LIBRARY_VIEWS = ['playlists', 'liked', 'recent'];
let activeLibraryView = 'playlists';


function getPlaylistsTrackCount() {
  return state.playlists.reduce((total, playlist) => total + (playlist.songs?.length || 0), 0);
}

function getLastSavedLabel() {
  if (state.liked[0]?.artist) return `Front memory: ${state.liked[0].artist}`;
  if (state.recent[0]?.artist) return `Return lane: ${state.recent[0].artist}`;
  return 'Save a few tracks and the memory field will start layering itself.';
}

function getOverviewCards() {
  return [
    {
      kicker: 'Front memory',
      value: formatCount(state.liked.length, 'saved track'),
      copy: state.liked[0]?.title ? `${state.liked[0].title} is holding the near edge.` : 'No saved tracks yet.'
    },
    {
      kicker: 'Stack depth',
      value: formatCount(state.playlists.length, 'playlist'),
      copy: state.playlists.length ? `${formatCount(getPlaylistsTrackCount(), 'track')} distributed through your stacks.` : 'Build your first stack to give the room shape.'
    },
    {
      kicker: 'Return lane',
      value: formatCount(state.recent.length, 'warm return'),
      copy: state.recent[0]?.title ? `${state.recent[0].title} is still hanging in the room.` : 'Your replay path will surface here.'
    }
  ];
}

function getMemoryStrip(primaryPlaylist, primarySignature) {
  return [
    {
      label: 'Saved plane',
      value: formatCount(state.liked.length, 'track'),
      copy: 'ready to re-enter the room'
    },
    {
      label: 'Lead stack',
      value: primaryPlaylist?.name || 'None yet',
      copy: primarySignature?.topMood || 'waiting for a signature mood'
    },
    {
      label: 'Nearest return',
      value: state.recent[0]?.title || 'Nothing replayed yet',
      copy: state.recent[0]?.artist || 'start a session to warm the return lane'
    }
  ];
}

function libraryFilterButton(view, label) {
  return `
    <button class="library-filter${activeLibraryView === view ? ' is-active' : ''}" type="button" data-library-view="${view}">
      ${label}
    </button>
  `;
}

function queueForSource(source, playlistId) {
  if (source === 'liked') return state.liked;
  if (source === 'recent') return state.recent;
  if (source === 'playlist') {
    return state.playlists.find(item => item.id === Number(playlistId))?.songs || [];
  }
  return [];
}

function resolveLibraryTrack(data = {}) {
  const sourceQueue = queueForSource(data.source, data.playlist);
  const indexed = sourceQueue[Number(data.index)];
  if (indexed?.videoId) return indexed;
  return sourceQueue.find(track => track.videoId === data.video) || resolveTrack(data.video);
}

function renderLibraryPlaylistCard(playlist) {
  const signature = getPlaylistSignature(playlist);
  const previewEntries = getPlaylistPreviewEntries(playlist, 4);

  return libraryPlaylistCard(playlist, signature, previewEntries);
}

function librarySongRow(track, index, source, playlistId = '') {
  return `
    <article class="song-row">
      <button class="song-index" data-action="play-library-track" data-source="${source}" data-playlist="${playlistId}" data-index="${index}" data-video="${track.videoId}">
        ${icon('play')}
      </button>

      <img
        class="song-thumb"
        src="${getTrackArtwork(track)}"
        alt="${track.title || 'Track artwork'}"
        data-action="play-library-track"
        data-source="${source}"
        data-playlist="${playlistId}"
        data-index="${index}"
        data-video="${track.videoId}"
      >

      <div
        class="song-main"
        data-action="play-library-track"
        data-source="${source}"
        data-playlist="${playlistId}"
        data-index="${index}"
        data-video="${track.videoId}"
      >
        <div class="song-title">${track.title || 'Unknown track'}</div>
        <div class="song-sub">${track.artist || 'Unknown artist'}</div>
      </div>

      <button class="btn-icon ${isLiked(track.videoId) ? 'on' : ''}" data-action="toggle-like" data-source="${source}" data-playlist="${playlistId}" data-index="${index}" data-video="${track.videoId}">
        ${icon('heart')}
      </button>

      <button class="btn-icon" data-action="add-playlist" data-source="${source}" data-playlist="${playlistId}" data-index="${index}" data-video="${track.videoId}">
        ${icon('plus')}
      </button>
    </article>
  `;
}

function overviewMarkup() {
  const cards = getOverviewCards();
  const primaryPlaylist = getPrimaryPlaylist(state.playlists);
  const primarySignature = primaryPlaylist ? getPlaylistSignature(primaryPlaylist) : null;
  const memoryStrip = getMemoryStrip(primaryPlaylist, primarySignature);

  return `
    <section class="library-stage">
      <article class="panel library-hero-panel">
        <div class="library-hero-copy">
          <span class="panel-kicker">Memory Plane</span>
          <div class="section-title" style="margin-top:12px">Stacks with depth.</div>
          <p class="section-copy">Likes, playlists, and recent returns stay in one controlled vault so the library feels like hardware memory, not a dashboard.</p>
        </div>
        <div class="library-hero-actions inline-actions">
          <button class="btn btn-primary" type="button" data-open-create-playlist>Build new stack</button>
          <button class="btn btn-secondary" type="button" data-action="play-liked-collection">Play saved plane</button>
          <a class="btn btn-secondary" href="search.html">Open search lanes</a>
        </div>
        <div class="library-filter-bar">
          ${libraryFilterButton('all', 'All')}
          ${libraryFilterButton('playlists', 'Stacks')}
          ${libraryFilterButton('liked', 'Saved')}
          ${libraryFilterButton('recent', 'Returns')}
        </div>
        <div class="library-memory-strip">
          ${memoryStrip.map(card => `
            <article class="library-memory-card">
              <span>${card.label}</span>
              <strong>${card.value}</strong>
              <small>${card.copy}</small>
            </article>
          `).join('')}
        </div>
      </article>

      <aside class="library-side-panel">
        <div class="panel library-insight-panel">
          <span class="panel-kicker">Depth check</span>
          <div class="library-insight-value">${formatCount(getPlaylistsTrackCount(), 'stored track')}</div>
          <p class="section-copy">${getLastSavedLabel()}</p>
        </div>
        <div class="panel library-insight-panel">
          <span class="panel-kicker">Lead stack</span>
          <div class="library-insight-value">${primaryPlaylist?.name || 'No stack yet'}</div>
          <p class="section-copy">${primarySignature?.summary || 'Build a stack and it will surface here automatically.'}</p>
        </div>
      </aside>

      <div class="library-summary-grid">
        ${cards.map(card => `
          <article class="library-summary-card">
            <span class="panel-kicker">${card.kicker}</span>
            <strong>${card.value}</strong>
            <p>${card.copy}</p>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function playlistsSection() {
  return `
    <section>
      ${pageHead({
        kicker: 'Layered stacks',
        title: 'Playlist Field',
        copy: 'Each playlist reads like its own shelf in the room, with artwork, tags, and preview tracks pulling from the actual songs inside.'
      })}
      <div class="library-playlist-grid">
        ${state.playlists.length ? state.playlists.map(renderLibraryPlaylistCard).join('') : emptyState('No playlists yet. Create one and start stacking songs from search, stations, or artists.')}
      </div>
    </section>
  `;
}

function songSection({ kicker, title, copy, tracks, source, emptyCopy }) {
  return `
    <section>
      ${pageHead({ kicker, title, copy })}
      <div class="library-song-list">
        ${tracks.length ? tracks.map((track, index) => librarySongRow(track, index, source)).join('') : emptyState(emptyCopy)}
      </div>
    </section>
  `;
}

function renderLibraryView(container) {
  const sections = [];

  sections.push(overviewMarkup());

  if (activeLibraryView === 'playlists') {
    sections.push(playlistsSection());
  }

  if (activeLibraryView === 'liked') {
    sections.push(songSection({
      kicker: 'Saved plane',
      title: 'Front Saved',
      copy: 'The songs you marked for return, held nearest so they can slide back into the room quickly.',
      tracks: state.liked.slice(0, 18),
      source: 'liked',
      emptyCopy: 'No saved tracks yet. Tap the heart on any row or in the player to build the front plane.'
    }));
  }

  if (activeLibraryView === 'recent') {
    sections.push(songSection({
      kicker: 'Return lane',
      title: 'Warm Returns',
      copy: 'The latest tracks that shaped the room, kept within reach for another pass.',
      tracks: state.recent.slice(0, 18),
      source: 'recent',
      emptyCopy: 'No recent tracks yet. Start playing and Velvet will keep the return lane warm.'
    }));
  }

  container.innerHTML = sections.join('');

  container.querySelectorAll('[data-library-view]').forEach(button => {
    button.addEventListener('click', () => {
      const nextView = button.dataset.libraryView;
      if (!LIBRARY_VIEWS.includes(nextView) || nextView === activeLibraryView) return;
      activeLibraryView = nextView;
      renderLibraryView(container);
    });
  });

  bindSongRowActions(container, {
    'play-library-track': (_event, data) => {
      const queue = queueForSource(data.source, data.playlist);
      const index = Number(data.index);
      if (queue[index]) {
        playFromQueue(queue, index);
      }
    },
    'play-playlist': (_event, data) => {
      const playlist = state.playlists.find(item => item.id === Number(data.playlist));
      if (playlist?.songs?.length) {
        playFromQueue(playlist.songs, 0);
      }
    },
    'play-liked-collection': () => {
      if (state.liked.length) {
        playFromQueue(state.liked, 0);
      }
    },
    'toggle-like': (_event, data) => {
      const track = resolveLibraryTrack(data);
      if (!track) return;
      window.dispatchEvent(new CustomEvent('velvet:toggle-like', { detail: { track } }));
    },
    'add-playlist': (_event, data) => {
      const track = resolveLibraryTrack(data);
      if (!track) return;
      window.dispatchEvent(new CustomEvent('velvet:playlist-pick', { detail: { track } }));
    }
  });
}

export function mountLibraryPage(container) {
  if (!container) return;

  if (!container.__velvetLibraryMounted) {
    container.__velvetLibraryMounted = true;

    const rerender = () => renderLibraryView(container);
    container.__velvetLibraryRender = rerender;

    window.addEventListener('velvet:library-changed', rerender);
    window.addEventListener('storage', event => {
      if (!event.key || LIBRARY_KEYS.has(event.key)) {
        refreshLibraryState();
        rerender();
      }
    });
  }

  renderLibraryView(container);
}


