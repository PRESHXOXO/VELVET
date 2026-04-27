import { createPlaylistFromTracks, getTrackPlayCount, getVelvetPickVideoId, isFavoriteStation, refreshLibraryState, state, toggleFavoriteStation } from '../core/state.js';
import { nextTrack, playFromQueue, prevTrack, togglePlay, updateVolume } from '../core/player.js';
import { bindSongRowActions, resolveTrack, toast } from '../core/ui.js';
import { icon, pageHead, getTrackArtwork, mediaSlot } from '../ui/templates.js';
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

function homeQueueRow(track, index, isCurrent = false) {
  return `
    <button class="velvet-queue-row ${isCurrent ? 'is-current' : ''}" type="button" data-action="play-home-queue" data-index="${index}" data-video="${track.videoId}">
      <span class="velvet-queue-row-index">${String(index + 1).padStart(2, '0')}</span>
      <img src="${getTrackArtwork(track)}" alt="${track.title || 'Track artwork'}">
      <span class="velvet-queue-row-copy">
        <strong>${track.title || 'Unknown track'}</strong>
        <small>${track.artist || 'Unknown artist'}</small>
      </span>
      <span class="velvet-queue-row-state">${isCurrent ? 'Playing' : 'Queue'}</span>
    </button>
  `;
}

function stationFeatureCard(entry) {
  const seedCount = (entry.station.seedIndexes || []).length;
  const stationImage = entry.station.cardImage || entry.station.image || entry.station.heroImage || getStationVisual(entry.index) || getTrackArtwork(getStationTracks(entry.index)[0] || {});
  const tags = (entry.station.tags || []).slice(0, 2);
  const pinned = isFavoriteStation(entry.index);

  return `
    <article class="velvet-station-card" style="--station-gradient:${entry.station.gradient};${stationImage ? `--station-image:url('${stationImage}')` : ''}">
      <div class="velvet-station-card-top">
        <span class="panel-kicker">${pinned ? 'Pinned lane' : 'Genre suite'}</span>
        <span class="velvet-station-card-count">${seedCount ? `${seedCount} anchors` : 'Live-led'}</span>
      </div>
      <div class="velvet-station-card-body">
        <div class="velvet-station-card-copy">
          <h3>${entry.station.name}</h3>
          <p>${entry.station.description || entry.station.query}</p>
          <div class="meta-tags">${tags.map(tag => `<span class="mini-tag">${tag}</span>`).join('')}</div>
        </div>
      </div>
      <div class="velvet-station-card-actions">
        <button class="btn btn-primary" type="button" data-action="open-station" data-index="${entry.index}">${icon('play')} Open lane</button>
      </div>
    </article>
  `;
}

function playlistArtworkWall(tracks = []) {
  const visuals = tracks.slice(0, 4).map(track => getTrackArtwork(track)).filter(Boolean);
  if (!visuals.length) {
    return '<div class="velvet-cover-wall-empty">V</div>';
  }

  return visuals.map((image, index) => `<img src="${image}" alt="Playlist artwork ${index + 1}">`).join('');
}

function searchChip(label, query) {
  return `<button class="velvet-search-chip" type="button" data-action="run-home-search" data-query="${query}">${label}</button>`;
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
  const spotlightVisual = spotlightArtist?.featureImage || spotlightArtist?.heroImage || getTrackArtwork(spotlightTrack) || '';
  const spotlightTitle = getHomeHeroTitle(spotlightTrack, spotlightArtist?.name || spotlightTrack?.artist || 'Velvet') || 'Velvet pick';
  const spotlightArtistName = formatDisplayText(spotlightArtist?.name || spotlightTrack?.artist || 'Velvet');
  const spotlightAlbum = getTrackAlbumLabel(spotlightTrack, spotlightArtist, leadStation);
  const spotlightBlurb = spotlightArtist?.bio || spotlightArtist?.description || `A fixed editorial pick that keeps the home room intentional instead of drifting with every recent play.`;
  const spotlightTags = (spotlightTrack?.tags || spotlightTrack?.moods || []).slice(0, 3);
  const spotlightPlayCount = getTrackPlayCount(spotlightTrack?.videoId);
  const likedCount = state.liked.length;
  const playlistCount = state.playlists.length;
  const recentCount = state.recent.length;
  const buildStackName = leadStation?.station?.name ? `${leadStation.station.name} Velvet Stack` : `${spotlightArtistName} Velvet Stack`;
  const spotlightIndex = curatedTracks.findIndex(track => track.videoId === spotlightTrack?.videoId);
  const quickSearchTerms = [
    { label: 'Snoh Aalegra', query: 'Snoh Aalegra' },
    { label: 'Late Night Drive', query: 'Late Night Drive' },
    { label: 'Neo Soul', query: 'Neo Soul' },
    { label: 'Slow Jams', query: 'Slow Jams' }
  ];

  container.innerHTML = `
    <section class="velvet-home-shell">
      <article class="panel velvet-home-hero" style="${spotlightVisual ? `--hero-image:url('${spotlightVisual}')` : ''}">
        <div class="velvet-home-hero-copy">
          <span class="panel-kicker">Velvet Pick of the Day</span>
          <div class="velvet-home-hero-meta">
            <span>${spotlightArtistName}</span>
            <span>${spotlightTrack?.year || 'After hours'}</span>
            <span>${formatCount(spotlightPlayCount, 'play')}</span>
          </div>
          <h1>${spotlightTitle}</h1>
          <p>${spotlightBlurb}</p>
          <div class="meta-tags velvet-home-hero-tags">
            ${(spotlightTags.length ? spotlightTags : ['editorial', 'night drive', 'velvet']).map(tag => `<span class="mini-tag">${tag}</span>`).join('')}
          </div>
          <div class="velvet-home-hero-actions inline-actions">
            <button class="btn btn-primary" type="button" data-action="play-spotlight">${icon('play')} Play pick</button>
            ${leadStation ? `<button class="btn btn-secondary" type="button" data-action="open-station" data-index="${leadStation.index}">Open ${leadStation.station.name}</button>` : ''}
            ${spotlightArtist?.slug ? `<a class="btn btn-secondary" href="artists.html#artist-${spotlightArtist.slug}">Open artist</a>` : ''}
          </div>
        </div>
        <div class="velvet-home-hero-visual">
          <div class="velvet-home-hero-float velvet-home-hero-float--lead">
            <span>Lead suite</span>
            <strong>${leadStation?.station?.name || 'Velvet room'}</strong>
            <small>${leadStation?.station?.description || 'Editorial route of the day.'}</small>
          </div>
          <div class="velvet-home-hero-art-shell">
            ${mediaSlot({
              image: spotlightVisual,
              alt: `${spotlightTitle} cover art`,
              label: spotlightArtistName || 'Velvet pick',
              eyebrow: spotlightAlbum,
              monogram: spotlightArtistName || 'V',
              className: 'velvet-home-hero-art',
              kind: 'feature',
              ratio: 'hero'
            })}
          </div>
          <div class="velvet-home-hero-float velvet-home-hero-float--album">
            <span>Album focus</span>
            <strong>${spotlightAlbum}</strong>
            <small>${leadStation?.station?.signal || 'Luxury editorial playback'}</small>
          </div>
        </div>
      </article>

      <section class="velvet-home-dashboard-grid">
        <article class="panel velvet-player-dashboard" data-player-surface>
          <div class="velvet-player-dashboard-head">
            <div>
              <span class="panel-kicker">Main player dashboard</span>
              <p class="velvet-player-dashboard-label">${state.currentTrack ? 'Current room playback' : 'Ready to start the room'}</p>
            </div>
            <span class="velvet-player-dashboard-state">${state.isPlaying ? 'Live' : 'Idle'}</span>
          </div>

          <div class="velvet-player-dashboard-grid">
            <div class="velvet-player-album-column">
              <div class="velvet-player-album-shell">
                ${mediaSlot({
                  image: dashboardVisual,
                  alt: `${dashboardTrack?.title || 'Velvet track'} artwork`,
                  label: dashboardArtist?.name || dashboardTrack?.artist || 'Velvet',
                  eyebrow: dashboardAlbum,
                  monogram: dashboardArtist?.name || dashboardTrack?.artist || 'V',
                  className: 'velvet-player-album-art',
                  kind: 'player-album',
                  ratio: 'portrait'
                })}
              </div>
            </div>

            <div class="velvet-player-copy-column">
              <div class="velvet-player-copy-stack">
                <span class="velvet-player-overline">Now holding</span>
                <h2 class="velvet-player-track-title" data-player-track-title>${dashboardTrack?.title || 'Velvet pick'}</h2>
                <div class="velvet-player-track-meta">
                  <span data-player-track-artist>${dashboardTrack?.artist || spotlightArtistName}</span>
                  <span class="velvet-player-divider">/</span>
                  <span data-player-track-album>${dashboardAlbum}</span>
                </div>
                <p class="velvet-player-description">${dashboardArtist?.tagline || 'A polished front-and-center track surface with tactile controls, floating depth, and a queue that stays close.'}</p>
              </div>

              <div class="velvet-player-control-row">
                <button class="btn-icon velvet-control-button" type="button" data-action="home-prev-track" data-player-command="prev" aria-label="Previous track"><svg viewBox="0 0 24 24"><path d="M11 19 2 12l9-7v14z" fill="currentColor" stroke="none"></path><path d="M22 5v14" stroke="currentColor" stroke-width="1.8"></path></svg></button>
                <button class="velvet-control-main" type="button" data-action="home-toggle-track" data-player-command="toggle" aria-label="Play or pause">
                  <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none"></path></svg>
                </button>
                <button class="btn-icon velvet-control-button" type="button" data-action="home-next-track" data-player-command="next" aria-label="Next track"><svg viewBox="0 0 24 24"><path d="m13 5 9 7-9 7V5z" fill="currentColor" stroke="none"></path><path d="M2 5v14" stroke="currentColor" stroke-width="1.8"></path></svg></button>
                <button class="btn-icon velvet-control-button" type="button" data-action="home-toggle-shuffle" data-player-command="shuffle" aria-label="Toggle shuffle">${icon('shuffle')}</button>
                <button class="btn-icon velvet-control-button velvet-control-button--repeat" type="button" data-action="home-toggle-repeat" data-player-command="repeat" aria-label="Toggle repeat"><svg viewBox="0 0 24 24"><path d="M17 1l4 4-4 4"></path><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><path d="M7 23l-4-4 4-4"></path><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg><span class="player-repeat-badge" data-repeat-badge>Off</span></button>
                <button class="btn-icon velvet-control-button" type="button" data-action="home-toggle-like" data-player-like-toggle aria-label="Like current track"><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.2A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"></path></svg></button>
              </div>

              <div class="velvet-player-progress-block">
                <span class="velvet-player-time" data-player-progress-current>0:00</span>
                <div class="velvet-player-progress-track">
                  <div class="velvet-player-progress-fill" data-player-progress-fill></div>
                </div>
                <span class="velvet-player-time" data-player-progress-duration>0:00</span>
              </div>

              <div class="velvet-player-support-row">
                <label class="velvet-volume-control">
                  <span>Volume</span>
                  <input class="velvet-volume-slider" type="range" min="0" max="100" value="${state.volume}" data-action="set-home-volume" data-player-volume-input aria-label="Adjust playback volume">
                </label>
                <div class="velvet-player-support-card">
                  <span>Queue loaded</span>
                  <strong>${formatCount(queueTracks.length, 'track')}</strong>
                </div>
                <div class="velvet-player-support-card">
                  <span>Volume</span>
                  <strong data-player-volume-value>${state.volume}%</strong>
                </div>
              </div>
            </div>
          </div>
        </article>

        <aside class="panel velvet-queue-panel">
          <div class="velvet-queue-head">
            <div>
              <span class="panel-kicker">Queue</span>
              <h3>On deck</h3>
            </div>
            <span class="velvet-queue-caption">${primaryPlaylist?.name || (leadStation?.station?.name ? `${leadStation.station.name} suite` : 'Daily pick queue')}</span>
          </div>
          <div class="velvet-queue-list">
            ${queueTracks.length ? queueTracks.slice(0, 7).map((track, index) => homeQueueRow(track, index, index === queueActiveIndex)).join('') : '<div class="empty">Start the room and the queue will settle here.</div>'}
          </div>
          <div class="velvet-queue-actions inline-actions">
            <button class="btn btn-primary" type="button" data-action="build-home-stack" data-name="${buildStackName}">${icon('plus')} Build stack</button>
            <a class="btn btn-secondary" href="library.html">Open library</a>
          </div>
        </aside>
      </section>

      <section class="panel velvet-station-salon">
        ${pageHead({
          kicker: 'Genre stations',
          title: 'Float between suites',
          copy: 'Curated lanes designed to feel like suspended editorial cards instead of a basic genre grid.'
        })}
        <div class="velvet-station-grid">
          ${homeStations.map(stationFeatureCard).join('')}
        </div>
      </section>

      <section class="velvet-home-lower-grid">
        <article class="panel velvet-library-vault">
          <div class="velvet-vault-head">
            <div>
              <span class="panel-kicker">Library vault</span>
              <h3>Your private stacks</h3>
            </div>
            <a class="section-link" href="library.html">Open library</a>
          </div>
          <div class="velvet-vault-grid">
            <div class="velvet-cover-wall">${playlistArtworkWall(primaryPlaylistPreview)}</div>
            <div class="velvet-vault-copy">
              <p>${primaryPlaylistSignature?.summary || 'Liked songs, recently played tracks, and custom stacks stay close so the app feels collected instead of cluttered.'}</p>
              <div class="velvet-vault-stats">
                <article><span>Liked</span><strong>${formatCount(likedCount, 'song')}</strong></article>
                <article><span>Recent</span><strong>${formatCount(recentCount, 'track')}</strong></article>
                <article><span>Playlists</span><strong>${formatCount(playlistCount, 'stack')}</strong></article>
              </div>
              <div class="inline-actions">
                <button class="btn btn-secondary" type="button" data-action="play-liked-collection">${icon('play')} Play liked</button>
                <button class="btn btn-secondary" type="button" data-open-create-playlist>Create playlist</button>
              </div>
            </div>
          </div>
        </article>

        <article class="panel velvet-search-lounge">
          <div class="velvet-search-lounge-head">
            <div>
              <span class="panel-kicker">Search lounge</span>
              <h3>Find the next mood</h3>
            </div>
            <a class="section-link" href="search.html">Open search</a>
          </div>
          <form class="velvet-search-lounge-form" action="search.html" method="get">
            <label class="visually-hidden" for="homeSearchQuery">Search Velvet</label>
            <input id="homeSearchQuery" name="q" type="text" placeholder="Search titles, artists, albums, or suites">
            <button class="btn btn-primary" type="submit">Search Velvet</button>
          </form>
          <div class="velvet-search-chip-row">
            ${quickSearchTerms.map(item => searchChip(item.label, item.query)).join('')}
          </div>
          <div class="velvet-search-support">
            <div>
              <span>Lead voice</span>
              <strong>${spotlightArtistName}</strong>
            </div>
            <div>
              <span>Album focus</span>
              <strong>${spotlightAlbum}</strong>
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
