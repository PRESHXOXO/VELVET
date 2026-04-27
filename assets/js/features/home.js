import { createPlaylistFromTracks, getTrackPlayCount, getVelvetPickVideoId, isFavoriteStation, refreshLibraryState, state, toggleFavoriteStation } from '../core/state.js';
import { nextTrack, playFromQueue, prevTrack, togglePlay, updateVolume } from '../core/player.js';
import { bindSongRowActions, resolveTrack, toast } from '../core/ui.js';
import { icon, getTrackArtwork } from '../ui/templates.js';
import { catalogTracks, findTrackByVideoId, getArtistProfile, getArtistSlug, getArtistTracks, getStationTracks, getStationVisual, stations } from '../core/catalog.js';
import { getPlaylistPreviewEntries, getPlaylistSignature, getPrimaryPlaylist } from '../core/playlists.js';
import { dedupeByVideoId, formatCount } from '../core/tracks.js';
import { cycleRepeatMode, toggleShufflePlayback } from '../core/state.js';

const APP_STATE_KEYS = new Set(['vlv_liked', 'vlv_recent', 'vlv_playlists', 'vlv_favorite_stations', 'vlv_recent_stations', 'vlv_play_counts', 'vlv_daily_pick']);

// Customizable home rail: these are the station suites Velvet should spotlight on Home.
const HOME_STATION_SEQUENCE = ['90s R&B', 'Neo Soul', 'Slow Jams', 'Girl Power', 'Chill Vibes', 'Southern Soul', 'Late Night Drive'];

function getSpotlightTrack() {
  const pickVideoId = getVelvetPickVideoId(catalogTracks[0]?.videoId || '');
  const candidateTracks = dedupeByVideoId([
    ...state.recent,
    ...state.liked,
    ...state.playlists.flatMap(playlist => playlist.songs || []),
    ...catalogTracks
  ]);

  return candidateTracks.find(track => track.videoId === pickVideoId) || findTrackByVideoId(pickVideoId) || catalogTracks[0] || null;
}

function formatDisplayText(value = '') {
  const raw = String(value || '').trim().replace(/[_-]+/g, ' ');
  if (!raw) return '';

  return raw
    .split(/\s+/)
    .map(part => /^[a-z]+$/.test(part) ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : part)
    .join(' ');
}

function escapeRegex(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeHomeHeroPhrase(value = '') {
  return formatDisplayText(value)
    .replace(/\((official|audio|video|visualizer|lyrics?|explicit|clean|live|performance|hd|4k)[^)]*\)/ig, ' ')
    .replace(/\[(official|audio|video|visualizer|lyrics?|explicit|clean|live|performance|hd|4k)[^\]]*\]/ig, ' ')
    .replace(/\b(?:ft|feat)\.?\b.*$/i, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function trimHeroTitle(value = '') {
  const words = String(value || '').split(/\s+/).filter(Boolean);
  if (words.length <= 7) return String(value || '').trim();
  return `${words.slice(0, 7).join(' ')}...`;
}

function getHomeHeroTitle(track, artistName = '') {
  const title = normalizeHomeHeroPhrase(track?.title || '');
  if (!title) return '';

  const cleanedArtist = formatDisplayText(artistName || track?.artist || '');
  const stripped = cleanedArtist
    ? title.replace(new RegExp(`^${escapeRegex(cleanedArtist)}(?:\\s*[-:|]\\s*|\\s+)`, 'i'), '').trim()
    : title;

  return trimHeroTitle(stripped || title);
}

function getStationPriority(index) {
  let score = 0;

  if (isFavoriteStation(index)) {
    score += 100;
  }

  const recentIndex = state.recentStations.indexOf(index);
  if (recentIndex >= 0) {
    score += Math.max(24 - recentIndex * 4, 4);
  }

  return score;
}

function getSpotlightStations(track) {
  const seededMatches = stations
    .map((station, index) => ({ station, index, tracks: getStationTracks(index) }))
    .filter(entry => entry.tracks.some(item => item.videoId === track?.videoId))
    .map(({ station, index }) => ({ station, index }))
    .sort((a, b) => getStationPriority(b.index) - getStationPriority(a.index));

  const fallback = stations
    .map((station, index) => ({ station, index }))
    .filter(entry => !seededMatches.some(match => match.index === entry.index))
    .sort((a, b) => getStationPriority(b.index) - getStationPriority(a.index));

  return [...seededMatches, ...fallback].slice(0, 4);
}

function getCuratedTracks(track, artistProfile) {
  const artistTracks = artistProfile ? getArtistTracks(artistProfile.slug) : [];
  const playlistTracks = state.playlists.flatMap(playlist => getPlaylistPreviewEntries(playlist, 2).map(entry => entry.track));

  return dedupeByVideoId([
    track,
    ...state.recent,
    ...state.liked,
    ...playlistTracks,
    ...artistTracks,
    ...catalogTracks
  ]).slice(0, 10);
}

function getLuxuryHomeStations(spotlightStations = []) {
  const selected = HOME_STATION_SEQUENCE
    .map(name => {
      const index = stations.findIndex(station => station.name === name);
      if (index < 0) return null;
      return { station: stations[index], index };
    })
    .filter(Boolean);

  const fallback = spotlightStations.filter(entry => !selected.some(item => item.index === entry.index));
  return [...selected, ...fallback].slice(0, 7);
}

function getTrackAlbumLabel(track, artistProfile, lane) {
  if (track?.album) return track.album;
  if (artistProfile?.name) return `${artistProfile.name} Selects`;
  if (lane?.station?.name) return `${lane.station.name} Suite`;
  return 'Velvet Select';
}

function getSuiteAccent(index = 0) {
  const tones = [
    '169,13,42',
    '145,24,51',
    '185,42,31',
    '120,18,40',
    '147,31,63',
    '109,18,27',
    '208,60,52'
  ];

  return tones[Math.abs(index) % tones.length];
}

function homeQueueRow(track, index, isCurrent = false) {
  const stateMarkup = isCurrent
    ? `<span class="nano-queue-state nano-queue-state--live"><span class="nano-queue-eq" aria-hidden="true"><i></i><i></i><i></i></span><em>Live</em></span>`
    : '<span class="nano-queue-state">Up next</span>';

  return `
    <button class="nano-queue-row ${isCurrent ? 'is-current' : ''}" type="button" data-action="play-home-queue" data-index="${index}" data-video="${track.videoId}">
      <span class="nano-queue-index">${String(index + 1).padStart(2, '0')}</span>
      <img src="${getTrackArtwork(track)}" alt="${track.title || 'Track artwork'}">
      <span class="nano-queue-copy">
        <strong>${track.title || 'Unknown track'}</strong>
        <small>${track.artist || 'Unknown artist'}</small>
      </span>
      ${stateMarkup}
    </button>
  `;
}

function buildSuiteSignal(index = 0, seedCount = 0) {
  return Array.from({ length: 4 }, (_, barIndex) => {
    const level = 28 + (((index + 1) * (barIndex + 2) * 11) + seedCount * 7) % 46;
    return `<span style="--suite-level:${level}%"></span>`;
  }).join('');
}

function stationFeatureCard(entry) {
  const stationTracks = getStationTracks(entry.index);
  const seedCount = (entry.station.seedIndexes || []).length;
  const stationImage = entry.station.cardImage || entry.station.image || entry.station.heroImage || getStationVisual(entry.index) || getTrackArtwork(stationTracks[0] || {});
  const tags = (entry.station.tags || []).slice(0, 2);
  const sampleArtists = [...new Set(stationTracks.map(track => track?.artist).filter(Boolean))].slice(0, 3);
  const suiteLabel = entry.station.signal || entry.station.name;
  const accent = getSuiteAccent(entry.index);

  return `
    <article class="nano-suite-card" style="--suite-rgb:${accent};${stationImage ? `--suite-image:url('${stationImage}')` : ''}">
      <div class="nano-suite-card-head">
        <span class="nano-suite-ordinal">${String(entry.index + 1).padStart(2, '0')}</span>
        <span class="nano-suite-status">${seedCount ? `${seedCount} curated` : 'Live-led'}</span>
      </div>
      <div class="nano-suite-card-visual">
        ${stationImage ? `<img src="${stationImage}" alt="${entry.station.name || 'Station'} visual">` : ''}
      </div>
      <div class="nano-suite-card-body">
        <div class="nano-suite-signal">
          <span>${suiteLabel}</span>
          <div class="nano-suite-bars" aria-hidden="true">${buildSuiteSignal(entry.index, seedCount)}</div>
        </div>
        <h3>${entry.station.name}</h3>
        <p>${entry.station.description || entry.station.query}</p>
        <div class="nano-suite-artists">${sampleArtists.length ? sampleArtists.map(name => `<span>${name}</span>`).join('') : '<span>Velvet suite</span>'}</div>
        <div class="nano-suite-tags">${tags.map(tag => `<span>${tag}</span>`).join('')}</div>
      </div>
      <div class="nano-suite-card-foot">
        <button class="btn btn-primary" type="button" data-action="open-station" data-index="${entry.index}">${icon('play')} Enter suite</button>
      </div>
    </article>
  `;
}

function playlistArtworkWall(tracks = []) {
  const visuals = tracks.slice(0, 4).map(track => getTrackArtwork(track)).filter(Boolean);
  if (!visuals.length) {
    return '<div class="nano-library-cover-wall-empty">V</div>';
  }

  return visuals.map((image, index) => `<img src="${image}" alt="Playlist artwork ${index + 1}">`).join('');
}

function searchChip(label, query) {
  return `<button class="nano-search-chip" type="button" data-action="run-home-search" data-query="${query}">${label}</button>`;
}

function renderHomeView(container) {
  const spotlightTrack = getSpotlightTrack();
  const spotlightArtist = spotlightTrack ? getArtistProfile(getArtistSlug(spotlightTrack)) : null;
  const spotlightStations = getSpotlightStations(spotlightTrack);
  const homeStations = getLuxuryHomeStations(spotlightStations);
  const leadStation = spotlightStations[0] || homeStations[0] || null;
  const curatedTracks = getCuratedTracks(spotlightTrack, spotlightArtist);
  const primaryPlaylist = getPrimaryPlaylist(state.playlists);
  const primaryPlaylistSignature = primaryPlaylist ? getPlaylistSignature(primaryPlaylist) : null;
  const primaryPlaylistPreview = primaryPlaylist ? getPlaylistPreviewEntries(primaryPlaylist, 4).map(entry => entry.track) : [];
  const queueTracks = state.queue.length ? state.queue : curatedTracks;
  const queueActiveIndex = queueTracks.findIndex(track => track.videoId === state.currentTrack?.videoId);
  const dashboardTrack = state.currentTrack || spotlightTrack;
  const dashboardArtist = dashboardTrack ? getArtistProfile(getArtistSlug(dashboardTrack)) : spotlightArtist;
  const dashboardAlbum = getTrackAlbumLabel(dashboardTrack, dashboardArtist, leadStation);
  const dashboardVisual = dashboardArtist?.featureImage || dashboardArtist?.heroImage || getTrackArtwork(dashboardTrack) || '';
  const spotlightTitle = getHomeHeroTitle(dashboardTrack, dashboardArtist?.name || dashboardTrack?.artist || 'Velvet') || 'Velvet pick';
  const spotlightArtistName = formatDisplayText(dashboardArtist?.name || dashboardTrack?.artist || 'Velvet');
  const heroBlurb = dashboardArtist?.tagline || dashboardArtist?.bio || dashboardArtist?.description || `A fixed editorial pick keeps the room collected while the player stays immediate and tactile.`;
  const spotlightPlayCount = getTrackPlayCount(dashboardTrack?.videoId);
  const likedCount = state.liked.length;
  const playlistCount = state.playlists.length;
  const recentCount = state.recent.length;
  const buildStackName = leadStation?.station?.name ? `${leadStation.station.name} Velvet Stack` : `${spotlightArtistName} Velvet Stack`;
  const spotlightIndex = curatedTracks.findIndex(track => track.videoId === spotlightTrack?.videoId);
  const heroAccent = getSuiteAccent(leadStation?.index || 0);
  const heroStateLabel = state.currentTrack ? 'Now Playing' : 'Velvet Pick of the Day';
  const quickSearchTerms = [
    { label: 'Snoh Aalegra', query: 'Snoh Aalegra' },
    { label: 'Neo Soul', query: 'Neo Soul' },
    { label: 'Late Night Drive', query: 'Late Night Drive' },
    { label: 'Girl Power', query: 'Girl Power' }
  ];

  container.innerHTML = `
    <section class="nano-home-shell">
      <section class="nano-home-top">
        <article class="panel nano-nowplaying-hero" data-player-surface style="--hero-rgb:${heroAccent}">
          <div class="nano-nowplaying-head">
            <span class="nano-device-label">${heroStateLabel}</span>
            <span class="nano-source-badge">Source: YouTube <em>HQ / Adaptive</em></span>
          </div>
          <div class="nano-nowplaying-grid">
            <div class="nano-vinyl-stage">
              <div class="nano-vinyl-disc" aria-hidden="true"></div>
              <div class="nano-cover-card">
                <img src="${dashboardVisual}" alt="${spotlightTitle} cover art" data-player-artwork>
              </div>
            </div>
            <div class="nano-nowplaying-copy">
              <span class="nano-track-kicker" data-player-track-album>${dashboardAlbum}</span>
              <h1 data-player-track-title>${spotlightTitle}</h1>
              <div class="nano-track-line">
                <span data-player-track-artist>${spotlightArtistName}</span>
                <span class="divider" aria-hidden="true"></span>
                <span>${dashboardTrack?.year || 'Velvet select'}</span>
              </div>
              <p class="nano-track-blurb">${heroBlurb}</p>

              <div class="nano-progress-stack">
                <div class="nano-progress-meta">
                  <span class="velvet-player-time" data-player-progress-current>0:00</span>
                  <div class="nano-progress-track"><div class="nano-progress-fill" data-player-progress-fill></div></div>
                  <span class="velvet-player-time" data-player-progress-duration>0:00</span>
                </div>
              </div>

              <div class="nano-main-controls">
                <button class="btn-icon" type="button" data-action="home-prev-track" aria-label="Previous track"><svg viewBox="0 0 24 24"><path d="M11 19 2 12l9-7v14z" fill="currentColor" stroke="none"></path><path d="M22 5v14" stroke="currentColor" stroke-width="1.8"></path></svg></button>
                <button class="nano-primary-button" type="button" data-action="home-toggle-track" data-player-command="toggle" aria-label="Play or pause"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none"></path></svg></button>
                <button class="btn-icon" type="button" data-action="home-next-track" aria-label="Next track"><svg viewBox="0 0 24 24"><path d="m13 5 9 7-9 7V5z" fill="currentColor" stroke="none"></path><path d="M2 5v14" stroke="currentColor" stroke-width="1.8"></path></svg></button>
                <div class="nano-aux-controls">
                  <button class="btn-icon" type="button" data-action="home-toggle-shuffle" data-player-command="shuffle" aria-label="Toggle shuffle">${icon('shuffle')}</button>
                  <button class="btn-icon" type="button" data-action="home-toggle-repeat" data-player-command="repeat" aria-label="Toggle repeat"><svg viewBox="0 0 24 24"><path d="M17 1l4 4-4 4"></path><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><path d="M7 23l-4-4 4-4"></path><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg><span class="player-repeat-badge" data-repeat-badge>Off</span></button>
                </div>
              </div>

              <div class="nano-secondary-controls">
                <button class="nano-secondary-button" type="button" data-action="home-toggle-like" data-player-like-toggle aria-label="Like current track">
                  <span>Cloud Like</span>
                  <strong>Save to likes</strong>
                </button>
                <button class="nano-secondary-button" type="button" data-action="open-station" data-index="${leadStation?.index ?? 0}" aria-label="Create a station from the current suite">
                  <span>Radio Sail</span>
                  <strong>${leadStation?.station?.name || 'Open suite'}</strong>
                </button>
                <label class="nano-volume-strip">
                  <span>Output</span>
                  <input class="velvet-volume-slider" type="range" min="0" max="100" value="${state.volume}" data-action="set-home-volume" data-player-volume-input aria-label="Adjust playback volume">
                  <small data-player-volume-value>${state.volume}%</small>
                </label>
              </div>

              <div class="nano-detail-strip">
                <div class="nano-detail-card">
                  <span>Suite</span>
                  <strong>${leadStation?.station?.name || 'Velvet room'}</strong>
                </div>
                <div class="nano-detail-card">
                  <span>State</span>
                  <strong>${state.isPlaying ? 'Playing' : 'Standby'}</strong>
                </div>
                <div class="nano-detail-card">
                  <span>Most played</span>
                  <strong>${formatCount(spotlightPlayCount, 'play')}</strong>
                </div>
              </div>
            </div>
          </div>
        </article>

        <aside class="panel nano-queue-dock">
          <div class="nano-queue-head">
            <div>
              <span class="panel-kicker">Queue</span>
              <h2>On deck</h2>
            </div>
            <span class="nano-queue-stamp">${primaryPlaylist?.name || (leadStation?.station?.name ? `${leadStation.station.name} suite` : 'Daily queue')}</span>
          </div>
          <div class="nano-queue-list">
            ${queueTracks.length ? queueTracks.slice(0, 6).map((track, index) => homeQueueRow(track, index, index === queueActiveIndex)).join('') : '<div class="empty">Start the room and the queue will settle here.</div>'}
          </div>
          <div class="nano-queue-actions">
            <button class="btn btn-primary" type="button" data-action="build-home-stack" data-name="${buildStackName}">${icon('plus')} Build stack</button>
            <a class="btn btn-secondary" href="library.html">Open library</a>
          </div>
        </aside>
      </section>

      <section class="panel nano-suite-deck">
        <div class="nano-station-head">
          <div>
            <span class="panel-kicker">Browse / Stations</span>
            <h2>Genre suites</h2>
          </div>
          <span class="nano-queue-stamp">${homeStations.length} surfaced</span>
        </div>
        <div class="nano-suite-grid">
          ${homeStations.map(stationFeatureCard).join('')}
        </div>
      </section>

      <section class="nano-home-support">
        <article class="panel nano-module-card">
          <div class="nano-module-head">
            <div>
              <span class="panel-kicker">Library</span>
              <h2>Private stacks</h2>
            </div>
            <a class="section-link" href="library.html">Open library</a>
          </div>
          <div class="nano-library-grid">
            <div class="nano-library-cover-wall">${playlistArtworkWall(primaryPlaylistPreview)}</div>
            <div class="nano-library-copy">
              <p>${primaryPlaylistSignature?.summary || 'Likes, playlists, and recently played tracks stay in one crisp vault so the app feels collected, not crowded.'}</p>
              <div class="nano-library-stats">
                <article class="nano-library-stat"><span>Likes</span><strong>${formatCount(likedCount, 'track')}</strong></article>
                <article class="nano-library-stat"><span>Playlists</span><strong>${formatCount(playlistCount, 'stack')}</strong></article>
                <article class="nano-library-stat"><span>Recent</span><strong>${formatCount(recentCount, 'track')}</strong></article>
              </div>
              <div class="nano-module-actions">
                <button class="btn btn-secondary" type="button" data-action="play-liked-collection">${icon('play')} Play likes</button>
                <button class="btn btn-secondary" type="button" data-open-create-playlist>Create playlist</button>
              </div>
            </div>
          </div>
        </article>

        <article class="panel nano-module-card">
          <div class="nano-module-head">
            <div>
              <span class="panel-kicker">Search</span>
              <h2>Archive sweep</h2>
            </div>
            <a class="section-link" href="search.html">Open search</a>
          </div>
          <div class="nano-search-copy">
            <p>Search should feel like using a premium device: tight controls, quick thumbnails, and a direct path back into playback.</p>
            <form class="nano-search-form" action="search.html" method="get">
              <label class="visually-hidden" for="homeSearchQuery">Search Velvet</label>
              <input id="homeSearchQuery" name="q" type="text" placeholder="Search titles, artists, albums, or suites">
              <button class="btn btn-primary" type="submit">Search</button>
            </form>
            <div class="nano-search-shortcuts">
              ${quickSearchTerms.map(item => searchChip(item.label, item.query)).join('')}
            </div>
            <div class="nano-search-insights">
              <div><span>Lead voice</span><strong>${spotlightArtistName}</strong></div>
              <div><span>Album</span><strong>${dashboardAlbum}</strong></div>
              <div><span>Suite</span><strong>${leadStation?.station?.name || 'Velvet room'}</strong></div>
            </div>
          </div>
        </article>
      </section>
    </section>
  `;

  const rerender = () => renderHomeView(container);

  bindSongRowActions(container, {
    'play-spotlight': () => {
      if (spotlightIndex >= 0) {
        playFromQueue(curatedTracks, spotlightIndex);
      }
    },
    'home-toggle-track': async () => {
      if (state.currentTrack?.videoId) {
        await togglePlay();
        return;
      }
      if (spotlightIndex >= 0) {
        await playFromQueue(curatedTracks, spotlightIndex);
      }
    },
    'home-prev-track': async () => {
      if (state.currentTrack?.videoId) {
        await prevTrack();
      } else if (spotlightIndex >= 0) {
        await playFromQueue(curatedTracks, spotlightIndex);
      }
    },
    'home-next-track': async () => {
      if (state.currentTrack?.videoId) {
        await nextTrack();
      } else if (spotlightIndex >= 0) {
        await playFromQueue(curatedTracks, spotlightIndex);
      }
    },
    'home-toggle-shuffle': () => {
      toggleShufflePlayback();
      window.dispatchEvent(new CustomEvent('velvet:playback-changed'));
    },
    'home-toggle-repeat': () => {
      cycleRepeatMode();
      window.dispatchEvent(new CustomEvent('velvet:playback-changed'));
    },
    'home-toggle-like': () => {
      const targetTrack = state.currentTrack || dashboardTrack;
      if (!targetTrack) return;
      window.dispatchEvent(new CustomEvent('velvet:toggle-like', { detail: { track: targetTrack } }));
    },
    'set-home-volume': async (_event, data, trigger) => {
      await updateVolume(trigger.value);
    },
    'play-home-queue': async (_event, data) => {
      const index = Number(data.index);
      if (queueTracks[index]) {
        await playFromQueue(queueTracks, index);
      }
    },
    'build-home-stack': (_event, data) => {
      const playlist = createPlaylistFromTracks(data.name || buildStackName, queueTracks.length ? queueTracks : curatedTracks);
      if (!playlist) return;
      toast('Velvet stack created');
      window.dispatchEvent(new CustomEvent('velvet:library-changed'));
      rerender();
    },
    'open-station': (_event, data) => {
      window.dispatchEvent(new CustomEvent('velvet:navigate', { detail: { href: `stations.html#station-${data.index}` } }));
    },
    'play-liked-collection': () => {
      if (state.liked.length) {
        playFromQueue(state.liked, 0);
      }
    },
    'run-home-search': (_event, data) => {
      const query = String(data.query || '').trim();
      if (!query) return;
      window.dispatchEvent(new CustomEvent('velvet:navigate', { detail: { href: `search.html?q=${encodeURIComponent(query)}` } }));
    }
  });
}
export function mountHomePage(container){
  if (!container) return;

  if (!container.__velvetHomeMounted) {
    container.__velvetHomeMounted = true;

    const rerender = () => renderHomeView(container);
    container.__velvetHomeRender = rerender;

    window.addEventListener('velvet:library-changed', rerender);
    window.addEventListener('velvet:stations-changed', rerender);
    window.addEventListener('velvet:playback-changed', rerender);
    window.addEventListener('storage', event => {
      if (!event.key || APP_STATE_KEYS.has(event.key)) {
        refreshLibraryState();
        rerender();
      }
    });
  }

  renderHomeView(container);
}


