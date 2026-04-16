import { refreshLibraryState, isLiked, state } from '../core/state.js';
import { playFromQueue } from '../core/player.js';
import { bindSongRowActions, resolveTrack } from '../core/ui.js';
import { pageHead, emptyState, icon } from '../ui/templates.js';

const LIBRARY_KEYS = new Set(['vlv_liked', 'vlv_recent', 'vlv_playlists']);
const LIBRARY_VIEWS = ['all', 'playlists', 'liked', 'recent'];
let activeLibraryView = 'all';

function formatCount(value, singular, plural = `${singular}s`) {
  const safe = Number(value) || 0;
  return `${safe} ${safe === 1 ? singular : plural}`;
}

function getPlaylistsTrackCount() {
  return state.playlists.reduce((total, playlist) => total + (playlist.songs?.length || 0), 0);
}

function getPrimaryPlaylist() {
  return state.playlists
    .slice()
    .sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0))[0] || null;
}

function getLastSavedLabel() {
  if (state.liked[0]?.artist) return `Latest like: ${state.liked[0].artist}`;
  if (state.recent[0]?.artist) return `Latest spin: ${state.recent[0].artist}`;
  return 'Start saving songs to give the room memory.';
}

function getOverviewCards() {
  return [
    {
      kicker: 'Stamped in red',
      value: formatCount(state.liked.length, 'song'),
      copy: state.liked[0]?.title ? `Holding onto ${state.liked[0].title}.` : 'No liked songs yet.'
    },
    {
      kicker: 'Room stacks',
      value: formatCount(state.playlists.length, 'playlist'),
      copy: state.playlists.length ? `${formatCount(getPlaylistsTrackCount(), 'track')} spread across your stacks.` : 'Create your first playlist.'
    },
    {
      kicker: 'Still in motion',
      value: formatCount(state.recent.length, 'recent play', 'recent plays'),
      copy: state.recent[0]?.title ? `${state.recent[0].title} is still warm.` : 'Your return path will collect here.'
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

function librarySongRow(track, index, source, playlistId = '') {
  return `
    <article class="song-row">
      <button class="song-index" data-action="play-library-track" data-source="${source}" data-playlist="${playlistId}" data-index="${index}" data-video="${track.videoId}">
        ${icon('play')}
      </button>

      <img
        class="song-thumb"
        src="${track.thumb || ''}"
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

function playlistCard(playlist) {
  const preview = playlist.songs.slice(0, 3);
  const latest = playlist.songs[0];

  return `
    <article class="library-playlist-card">
      <div class="library-playlist-head">
        <div>
          <span class="panel-kicker">Playlist</span>
          <h3>${playlist.name}</h3>
        </div>
        <div class="library-playlist-metric">${formatCount(playlist.songs.length, 'track')}</div>
      </div>

      <p class="library-playlist-copy">
        ${latest ? `Leaning on ${latest.artist} and the rest of this stack.` : 'Still empty. Add songs from search, stations, or artist pages.'}
      </p>

      <div class="library-playlist-preview">
        ${preview.length ? preview.map((track, index) => `
          <button class="library-playlist-track" type="button" data-action="play-library-track" data-source="playlist" data-playlist="${playlist.id}" data-index="${index}" data-video="${track.videoId}">
            <img src="${track.thumb || ''}" alt="${track.title || 'Track artwork'}">
            <span>
              <strong>${track.title}</strong>
              <small>${track.artist}</small>
            </span>
          </button>
        `).join('') : '<div class="library-empty-inline">No tracks here yet.</div>'}
      </div>

      <div class="inline-actions">
        <button class="btn btn-primary" type="button" data-action="play-playlist" data-playlist="${playlist.id}">${icon('play')} Play stack</button>
      </div>
    </article>
  `;
}

function overviewMarkup() {
  const cards = getOverviewCards();
  const primaryPlaylist = getPrimaryPlaylist();

  return `
    <section class="library-stage">
      <article class="panel library-hero-panel">
        <div class="library-hero-copy">
          <span class="panel-kicker">Your Library</span>
          <div class="section-title" style="margin-top:12px">A room with memory.</div>
          <p class="section-copy">Your liked songs, recent spins, and playlists now move together like one living collection instead of separate dead shelves.</p>
        </div>
        <div class="library-hero-actions inline-actions">
          <button class="btn btn-primary" type="button" data-open-create-playlist>Create playlist</button>
          <button class="btn btn-secondary" type="button" data-action="play-liked-collection">Play liked songs</button>
          <a class="btn btn-secondary" href="search.html">Find more music</a>
        </div>
        <div class="library-filter-bar">
          ${libraryFilterButton('all', 'All')}
          ${libraryFilterButton('playlists', 'Playlists')}
          ${libraryFilterButton('liked', 'Liked')}
          ${libraryFilterButton('recent', 'Recent')}
        </div>
      </article>

      <aside class="library-side-panel">
        <div class="panel library-insight-panel">
          <span class="panel-kicker">Tonight</span>
          <div class="library-insight-value">${formatCount(getPlaylistsTrackCount(), 'saved track')}</div>
          <p class="section-copy">${getLastSavedLabel()}</p>
        </div>
        <div class="panel library-insight-panel">
          <span class="panel-kicker">Lead stack</span>
          <div class="library-insight-value">${primaryPlaylist?.name || 'No playlist yet'}</div>
          <p class="section-copy">${primaryPlaylist ? `${formatCount(primaryPlaylist.songs.length, 'track')} ready to run.` : 'Build a stack and it will surface here automatically.'}</p>
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
      ${pageHead({ kicker:'Playlists', title:'Room stacks', copy:'Playlists stay lightweight, but they now read like active shelves with previews and quick-start actions.' })}
      <div class="library-playlist-grid">
        ${state.playlists.length ? state.playlists.map(playlistCard).join('') : emptyState('No playlists yet. Create one and start stacking songs from search, stations, or artists.')}
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

  if (activeLibraryView === 'all' || activeLibraryView === 'playlists') {
    sections.push(playlistsSection());
  }

  if (activeLibraryView === 'all' || activeLibraryView === 'liked') {
    sections.push(songSection({
      kicker: 'Saved',
      title: 'Liked Songs',
      copy: 'The tracks you marked for return, ready to play or route into playlists.',
      tracks: state.liked.slice(0, 18),
      source: 'liked',
      emptyCopy: 'No liked songs yet. Tap the heart on any track row or in the player to start building this list.'
    }));
  }

  if (activeLibraryView === 'all' || activeLibraryView === 'recent') {
    sections.push(songSection({
      kicker: 'Recently Played',
      title: 'Return Path',
      copy: 'The latest songs that shaped the room, kept ready for another pass.',
      tracks: state.recent.slice(0, 18),
      source: 'recent',
      emptyCopy: 'No recent tracks yet. Start playing and Velvet will keep your return path warm.'
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
