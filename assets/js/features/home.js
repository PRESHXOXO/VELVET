import { refreshLibraryState, state } from '../core/state.js';
import { playFromQueue } from '../core/player.js';
import { bindSongRowActions, resolveTrack } from '../core/ui.js';
import { pageHead, emptyState, icon, songRow, getTrackArtwork } from '../ui/templates.js';
import { catalogTracks, getArtistProfile, getArtistSlug, getArtistTracks, getStationTracks, stations } from '../core/catalog.js';
import { getPlaylistPreviewEntries, getPlaylistSignature, getPrimaryPlaylist } from '../core/playlists.js';

const LIBRARY_KEYS = new Set(['vlv_liked', 'vlv_recent', 'vlv_playlists']);

function dedupeTracks(tracks = []) {
  const seen = new Set();

  return tracks.filter(track => {
    if (!track?.videoId || seen.has(track.videoId)) return false;
    seen.add(track.videoId);
    return true;
  });
}

function formatCount(value, singular, plural = `${singular}s`) {
  const safe = Number(value) || 0;
  return `${safe} ${safe === 1 ? singular : plural}`;
}

function getSpotlightTrack() {
  return state.recent[0] || state.liked[0] || getPrimaryPlaylist(state.playlists)?.songs?.slice(-1)[0] || catalogTracks[0] || null;
}

function getSpotlightStations(track) {
  const seededMatches = stations
    .map((station, index) => ({ station, index, tracks: getStationTracks(index) }))
    .filter(entry => entry.tracks.some(item => item.videoId === track?.videoId))
    .map(({ station, index }) => ({ station, index }));

  const fallback = stations
    .map((station, index) => ({ station, index }))
    .filter(entry => !seededMatches.some(match => match.index === entry.index));

  return [...seededMatches, ...fallback].slice(0, 4);
}

function getCuratedTracks(track, artistProfile) {
  const artistTracks = artistProfile ? getArtistTracks(artistProfile.slug) : [];
  const playlistTracks = state.playlists.flatMap(playlist => getPlaylistPreviewEntries(playlist, 2).map(entry => entry.track));

  return dedupeTracks([
    track,
    ...state.recent,
    ...state.liked,
    ...playlistTracks,
    ...artistTracks,
    ...catalogTracks
  ]).slice(0, 8);
}

function homeMiniRow(track, queueIndex, action, extras = '') {
  return `
    <button class="home-mini-row" type="button" data-action="${action}" data-index="${queueIndex}" data-video="${track.videoId}" ${extras}>
      <img src="${getTrackArtwork(track)}" alt="${track.title || 'Track artwork'}">
      <span class="home-mini-row-copy">
        <strong>${track.title || 'Unknown track'}</strong>
        <small>${track.artist || 'Unknown artist'}</small>
      </span>
      <span class="home-mini-row-end">${icon('play')}</span>
    </button>
  `;
}

function homeStationCard(entry) {
  return `
    <article class="home-station-card" style="--station-gradient:${entry.station.gradient}">
      <span class="panel-kicker">Station Lane</span>
      <div class="home-station-copy">
        <h3>${entry.station.name}</h3>
        <p>${entry.station.description || entry.station.query}</p>
      </div>
      <div class="meta-tags">${(entry.station.tags || []).slice(0, 2).map(tag => `<span class="mini-tag">${tag}</span>`).join('')}</div>
      <div class="inline-actions">
        <button class="btn btn-primary" type="button" data-action="open-station" data-index="${entry.index}">${icon('play')} Open</button>
        <button class="btn btn-secondary" type="button" data-action="shuffle-station" data-index="${entry.index}">${icon('shuffle')} Mix</button>
      </div>
    </article>
  `;
}

function renderHomeView(container) {
  const spotlightTrack = getSpotlightTrack();
  const spotlightArtist = spotlightTrack ? getArtistProfile(getArtistSlug(spotlightTrack)) : null;
  const spotlightStations = getSpotlightStations(spotlightTrack);
  const curatedTracks = getCuratedTracks(spotlightTrack, spotlightArtist);
  const returnTracks = dedupeTracks([...state.recent, ...state.liked]).slice(0, 4);
  const artistEssentials = dedupeTracks([
    spotlightTrack,
    ...(spotlightArtist ? getArtistTracks(spotlightArtist.slug) : [])
  ]).slice(0, 4);
  const primaryPlaylist = getPrimaryPlaylist(state.playlists);
  const primaryPlaylistSignature = primaryPlaylist ? getPlaylistSignature(primaryPlaylist) : null;
  const primaryPlaylistPreview = primaryPlaylist ? getPlaylistPreviewEntries(primaryPlaylist, 3) : [];
  const spotlightTags = (spotlightTrack?.moods || []).slice(0, 3);
  const spotlightIndex = curatedTracks.findIndex(track => track.videoId === spotlightTrack?.videoId);

  container.innerHTML = `
    <section class="home-stage">
      <article class="panel home-feature-panel">
        <div class="home-feature-grid">
          <div class="home-feature-copy">
            <span class="panel-kicker">Tonight's Spotlight</span>
            <div class="home-feature-title">${spotlightTrack?.title || 'Velvet'}</div>
            <div class="home-feature-meta">
              <span>${spotlightTrack?.artist || 'Private listening club'}</span>
              ${spotlightTrack?.year ? `<span>${spotlightTrack.year}</span>` : ''}
            </div>
            <p class="home-feature-blurb">${spotlightArtist?.description || 'Velvet now opens with a stronger editorial center: one lead record, one voice, and a cleaner path into the rest of the room.'}</p>
            <div class="meta-tags">
              ${(spotlightTags.length ? spotlightTags : ['after-hours', 'editorial', 'velvet']).map(tag => `<span class="mini-tag">${tag}</span>`).join('')}
            </div>
            <div class="inline-actions">
              <button class="btn btn-primary" type="button" data-action="play-spotlight">${icon('play')} Start here</button>
              ${spotlightArtist ? `<button class="btn btn-secondary" type="button" data-action="open-artist" data-slug="${spotlightArtist.slug}">Open artist</button>` : ''}
              ${spotlightStations[0] ? `<button class="btn btn-secondary" type="button" data-action="open-station" data-index="${spotlightStations[0].index}">Open station</button>` : ''}
            </div>
          </div>

          <div class="home-feature-visual">
            <div class="home-feature-art">
              <img src="${getTrackArtwork(spotlightTrack)}" alt="${spotlightTrack?.title || 'Spotlight artwork'}">
            </div>
            <div class="home-feature-stat-row">
              <div class="home-feature-stat">
                <small>Liked</small>
                <strong>${formatCount(state.liked.length, 'song')}</strong>
              </div>
              <div class="home-feature-stat">
                <small>Playlists</small>
                <strong>${formatCount(state.playlists.length, 'stack')}</strong>
              </div>
              <div class="home-feature-stat">
                <small>Recents</small>
                <strong>${formatCount(state.recent.length, 'return')}</strong>
              </div>
            </div>
          </div>
        </div>
      </article>

      <aside class="home-side-stack">
        <article class="panel home-artist-panel">
          <span class="panel-kicker">Featured Voice</span>
          <h3 class="home-side-title">${spotlightArtist?.name || 'Velvet'}</h3>
          <p class="section-copy">${spotlightArtist?.tagline || 'A moody streaming room for R&B, soul, and after-hours replay value.'}</p>
          <div class="meta-tags">${(spotlightArtist?.tags || ['late night', 'editorial']).slice(0, 3).map(tag => `<span class="mini-tag">${tag}</span>`).join('')}</div>
          ${spotlightArtist ? `<div class="inline-actions"><button class="btn btn-secondary" type="button" data-action="open-artist" data-slug="${spotlightArtist.slug}">Profile</button></div>` : ''}
        </article>

        <article class="panel home-stack-panel">
          <span class="panel-kicker">Room Stack</span>
          <div class="home-side-title">${primaryPlaylist?.name || 'Keep building the room'}</div>
          <p class="section-copy">${primaryPlaylistSignature?.summary || 'Create a playlist and the strongest one will surface here automatically.'}</p>
          ${primaryPlaylistSignature?.tags?.length ? `<div class="meta-tags">${primaryPlaylistSignature.tags.map(tag => `<span class="mini-tag">${tag}</span>`).join('')}</div>` : ''}
          <div class="home-side-list">
            ${primaryPlaylistPreview.length
              ? primaryPlaylistPreview.map(entry => homeMiniRow(entry.track, entry.queueIndex, 'play-home-playlist-track', `data-playlist="${primaryPlaylist.id}"`)).join('')
              : (returnTracks.length ? returnTracks.map((track, index) => homeMiniRow(track, index, 'play-home-return')).join('') : '<div class="empty">Play or save a few songs and this shelf will start to feel personal fast.</div>')}
          </div>
          <div class="inline-actions">
            ${primaryPlaylist?.songs?.length ? `<button class="btn btn-primary" type="button" data-action="play-home-playlist" data-playlist="${primaryPlaylist.id}">${icon('play')} Play stack</button>` : '<button class="btn btn-primary" type="button" data-open-create-playlist>Create playlist</button>'}
          </div>
        </article>
      </aside>
    </section>

    <section class="home-editorial-grid">
      <article class="panel home-rail-panel">
        ${pageHead({ kicker:'Stations', title:'Mood Lanes', copy:'A tighter station shelf shaped around the record currently leading the room.', linkText:'See all', linkHref:'stations.html' })}
        <div class="home-station-grid">${spotlightStations.map(homeStationCard).join('')}</div>
      </article>

      <article class="panel home-rail-panel">
        ${pageHead({ kicker:'For tonight', title:'Top Picks', copy:'A smarter first queue pulled from recents, likes, artist essentials, and the catalog core.' })}
        <div class="song-list home-song-grid">${curatedTracks.map(songRow).join('')}</div>
      </article>
    </section>

    <section class="home-editorial-grid home-secondary-grid">
      <article class="panel home-rail-panel">
        ${pageHead({ kicker:'Return path', title:'Continue Listening', copy:'The fastest route back into the songs that already shaped your last session.' })}
        <div class="home-side-list">
          ${returnTracks.length ? returnTracks.map((track, index) => homeMiniRow(track, index, 'play-home-return')).join('') : emptyState('No recent or liked songs yet. Start the room and Velvet will hold onto the right moments here.')}
        </div>
      </article>

      <article class="panel home-rail-panel">
        ${pageHead({ kicker:'Essentials', title:'Artist Focus', copy:'A tighter second rail built from the featured voice instead of another generic card wall.' })}
        <div class="home-side-list">
          ${artistEssentials.length ? artistEssentials.map((track, index) => homeMiniRow(track, index, 'play-home-essential')).join('') : emptyState('No artist essentials yet. Velvet will surface them as the catalog grows.')}
        </div>
      </article>
    </section>
  `;

  bindSongRowActions(container, {
    'play-spotlight': () => {
      if (spotlightIndex >= 0) {
        playFromQueue(curatedTracks, spotlightIndex);
      }
    },
    'play-track': (_event, data) => {
      const index = Number(data.index);
      if (curatedTracks[index]) {
        playFromQueue(curatedTracks, index);
      }
    },
    'toggle-like': (_event, data) => {
      const track = curatedTracks.find(item => item.videoId === data.video) || resolveTrack(data.video);
      if (!track) return;
      window.dispatchEvent(new CustomEvent('velvet:toggle-like', { detail: { track } }));
    },
    'add-playlist': (_event, data) => {
      const track = curatedTracks.find(item => item.videoId === data.video) || resolveTrack(data.video);
      if (!track) return;
      window.dispatchEvent(new CustomEvent('velvet:playlist-pick', { detail: { track } }));
    },
    'open-station': (_event, data) => {
      window.location.href = `stations.html#station-${data.index}`;
    },
    'shuffle-station': (_event, data) => {
      window.location.href = `stations.html#station-${data.index}`;
    },
    'open-artist': (_event, data) => {
      window.location.href = `artists.html#artist-${data.slug}`;
    },
    'play-home-return': (_event, data) => {
      const index = Number(data.index);
      if (returnTracks[index]) {
        playFromQueue(returnTracks, index);
      }
    },
    'play-home-essential': (_event, data) => {
      const index = Number(data.index);
      if (artistEssentials[index]) {
        playFromQueue(artistEssentials, index);
      }
    },
    'play-home-playlist': (_event, data) => {
      const playlist = state.playlists.find(item => item.id === Number(data.playlist));
      if (playlist?.songs?.length) {
        playFromQueue(playlist.songs, 0);
      }
    },
    'play-home-playlist-track': (_event, data) => {
      const playlist = state.playlists.find(item => item.id === Number(data.playlist));
      const index = Number(data.index);
      if (playlist?.songs?.[index]) {
        playFromQueue(playlist.songs, index);
      }
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
    window.addEventListener('storage', event => {
      if (!event.key || LIBRARY_KEYS.has(event.key)) {
        refreshLibraryState();
        rerender();
      }
    });
  }

  renderHomeView(container);
}
