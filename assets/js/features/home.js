import { createPlaylistFromTracks, isFavoriteStation, refreshLibraryState, state, toggleFavoriteStation } from '../core/state.js';
import { playFromQueue } from '../core/player.js';
import { bindSongRowActions, resolveTrack, toast } from '../core/ui.js';
import { pageHead, emptyState, icon, songRow, getTrackArtwork, mediaSlot } from '../ui/templates.js';
import { catalogTracks, getArtistProfile, getArtistSlug, getArtistTracks, getStationTracks, getStationVisual, stations } from '../core/catalog.js';
import { getPlaylistPreviewEntries, getPlaylistSignature, getPrimaryPlaylist } from '../core/playlists.js';

const APP_STATE_KEYS = new Set(['vlv_liked', 'vlv_recent', 'vlv_playlists', 'vlv_favorite_stations', 'vlv_recent_stations']);

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

function homeDepthCard({ label, value, copy }) {
  return `
    <article class="home-depth-card">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${copy}</small>
    </article>
  `;
}

function homeAxisRow(entry, slot) {
  const stationTag = isFavoriteStation(entry.index)
    ? 'Pinned lane'
    : (state.recentStations.includes(entry.index) ? 'Recent lane' : ((entry.station.tags || []).find(Boolean) || 'Open lane'));

  return `
    <button class="home-axis-row" type="button" data-action="open-station" data-index="${entry.index}">
      <span class="home-axis-row-copy">
        <small>Lane ${String(slot + 1).padStart(2, '0')}</small>
        <strong>${entry.station.name}</strong>
      </span>
      <span class="home-axis-row-meta">${stationTag}</span>
    </button>
  `;
}

function homeStationCard(entry) {
  const stationLeadTrack = getStationTracks(entry.index)[0];
  const stationImage = entry.station.cardImage || entry.station.image || getStationVisual(entry.index) || (stationLeadTrack ? getTrackArtwork(stationLeadTrack) : '');
  const seedCount = (entry.station.seedIndexes || []).length;
  const stationSourceLabel = seedCount ? `${seedCount} curated` : 'Live-led';
  const isPinned = isFavoriteStation(entry.index);
  const isRecent = state.recentStations.includes(entry.index);
  const stationTags = [
    ...(isPinned ? ['Pinned lane'] : []),
    ...(isRecent && !isPinned ? ['Recent lane'] : []),
    ...(entry.station.tags || []).slice(0, 2)
  ].slice(0, 3);

  return `
    <article class="home-station-card" style="--station-gradient:${entry.station.gradient};${stationImage ? `--station-image:url('${stationImage}')` : ''}">
      <div class="home-station-top">
        <span class="panel-kicker">Station Lane</span>
        <span class="home-station-meta">${stationSourceLabel}</span>
      </div>
      <div class="home-station-shell">
        <div class="home-station-copy">
          <h3>${entry.station.name}</h3>
          <p>${entry.station.description || entry.station.query}</p>
          <div class="meta-tags">${stationTags.map(tag => `<span class="mini-tag">${tag}</span>`).join('')}</div>
        </div>
        ${mediaSlot({
          image: stationImage,
          alt: `${entry.station.name || 'Station'} visual`,
          label: entry.station.name || 'Station visual',
          eyebrow: 'Station visual',
          monogram: entry.station.name || 'V',
          className: 'home-station-media',
          kind: 'station-home',
          ratio: 'portrait'
        })}
      </div>
      <div class="inline-actions">
        <button class="btn btn-primary" type="button" data-action="open-station" data-index="${entry.index}">${icon('play')} Open</button>
        <button class="btn btn-secondary" type="button" data-action="shuffle-station" data-index="${entry.index}">${icon('shuffle')} Mix</button>
        <button class="btn btn-secondary" type="button" data-action="toggle-station-pin" data-index="${entry.index}">${icon('heart')} ${isPinned ? 'Pinned' : 'Pin lane'}</button>
      </div>
    </article>
  `;
}

function renderHomeView(container) {
  const spotlightTrack = getSpotlightTrack();
  const spotlightArtist = spotlightTrack ? getArtistProfile(getArtistSlug(spotlightTrack)) : null;
  const spotlightStations = getSpotlightStations(spotlightTrack);
  const featuredStations = spotlightStations.slice(0, 3);
  const curatedTracks = getCuratedTracks(spotlightTrack, spotlightArtist);
  const displayCuratedTracks = curatedTracks.slice(0, 6);
  const returnTracks = dedupeTracks([...state.recent, ...state.liked]).slice(0, 4);
  const artistEssentials = dedupeTracks([
    spotlightTrack,
    ...(spotlightArtist ? getArtistTracks(spotlightArtist.slug) : [])
  ]).slice(0, 4);
  const primaryPlaylist = getPrimaryPlaylist(state.playlists);
  const primaryPlaylistSignature = primaryPlaylist ? getPlaylistSignature(primaryPlaylist) : null;
  const primaryPlaylistPreview = primaryPlaylist ? getPlaylistPreviewEntries(primaryPlaylist, 3) : [];
  const hasPrimaryPlaylistSongs = Boolean(primaryPlaylist?.songs?.length);
  const stackRowsMarkup = hasPrimaryPlaylistSongs
    ? primaryPlaylistPreview.map(entry => homeMiniRow(entry.track, entry.queueIndex, 'play-home-playlist-track', `data-playlist="${primaryPlaylist.id}"`)).join('')
    : (primaryPlaylist
      ? '<div class="empty">This stack is still empty. Build the current room into it or add songs from search, stations, and artists.</div>'
      : (returnTracks.length
        ? returnTracks.map((track, index) => homeMiniRow(track, index, 'play-home-return')).join('')
        : '<div class="empty">Play or save a few songs and this shelf will start to feel personal fast.</div>'));
  const spotlightTags = (spotlightTrack?.moods || []).slice(0, 3);
  const spotlightIndex = curatedTracks.findIndex(track => track.videoId === spotlightTrack?.videoId);
  const spotlightArt = getTrackArtwork(spotlightTrack);
  const spotlightVisual = spotlightArtist?.featureImage || spotlightArtist?.heroImage || spotlightArt || '';
  const leadStation = spotlightStations[0] || null;
  const defaultStackTracks = dedupeTracks([
    ...curatedTracks,
    ...returnTracks,
    ...artistEssentials
  ]).slice(0, 10);
  const buildHomeStackName = leadStation?.station?.name
    ? `${leadStation.station.name} Room`
    : `${spotlightTrack?.artist || 'Velvet'} Room`;
  const depthCards = [
    {
      label: 'Lead voice',
      value: spotlightArtist?.name || spotlightTrack?.artist || 'Velvet',
      copy: 'Tonight starts here.'
    },
    {
      label: 'Lane in focus',
      value: leadStation?.station.name || 'Open lane',
      copy: isFavoriteStation(leadStation?.index) ? 'Pinned and ready to open.' : (leadStation?.station.description || leadStation?.station.query || 'A guiding route for the room.')
    },
    {
      label: 'Room memory',
      value: primaryPlaylist?.name || formatCount(state.liked.length, 'saved song'),
      copy: primaryPlaylist?.songs?.length
        ? `${formatCount(primaryPlaylist.songs.length, 'track')} inside your lead stack.`
        : 'Build the current room into a real stack.'
    }
  ];
  const stackOrbitControl = hasPrimaryPlaylistSongs
    ? `<a class="home-feature-orb home-feature-orb--stack" href="library.html">
         <span>Room stack</span>
         <strong>${primaryPlaylist?.name || 'Open stack'}</strong>
         <small>${formatCount(primaryPlaylist?.songs?.length || 0, 'song')}</small>
       </a>`
    : `<button class="home-feature-orb home-feature-orb--stack" type="button" data-action="build-home-stack" data-name="${buildHomeStackName}">
         <span>Room stack</span>
         <strong>Build one</strong>
         <small>Save this room</small>
       </button>`;
  const artistOrbitControl = spotlightArtist?.slug
    ? `<a class="home-feature-orb home-feature-orb--artist" href="artists.html#artist-${spotlightArtist.slug}">
         <span>Lead voice</span>
         <strong>${spotlightArtist.name}</strong>
         <small>Open portrait</small>
       </a>`
    : '';

  container.innerHTML = `
    <section class="home-stage">
      <article class="panel home-feature-panel" style="${spotlightVisual ? `--spotlight-image:url('${spotlightVisual}')` : ''}">
        <div class="home-feature-grid">
          <div class="home-feature-copy">
            <div class="home-feature-heading">
              <span class="panel-kicker">Tonight's Room</span>
              <div class="home-feature-meta">
                <span>${spotlightTrack?.artist || 'Private listening club'}</span>
                ${spotlightTrack?.year ? `<span>${spotlightTrack.year}</span>` : ''}
                <span>${leadStation?.station.name || 'Lead record'}</span>
              </div>
              <div class="home-feature-title">${spotlightTrack?.title || 'Velvet'}</div>
              <p class="home-feature-blurb">${spotlightArtist?.description || 'Start with one front record, move into one lane, and build the room from there instead of splitting attention across too many equal surfaces.'}</p>
            </div>

            <div class="meta-tags home-feature-tags">
              ${(spotlightTags.length ? spotlightTags : ['after-hours', 'editorial', 'velvet']).map(tag => `<span class="mini-tag">${tag}</span>`).join('')}
            </div>

            <div class="home-feature-orbit-strip">
              ${leadStation?.station
                ? `<button class="home-feature-orbit-pill" type="button" data-action="open-station" data-index="${leadStation.index}">
                     <span>Lead lane</span>
                     <strong>${leadStation.station.name}</strong>
                   </button>`
                : ''}
              ${spotlightArtist?.slug
                ? `<a class="home-feature-orbit-pill" href="artists.html#artist-${spotlightArtist.slug}">
                     <span>Lead voice</span>
                     <strong>${spotlightArtist.name}</strong>
                   </a>`
                : ''}
              <button class="home-feature-orbit-pill" type="button" data-action="play-spotlight">
                <span>Start here</span>
                <strong>${spotlightTrack?.title || 'Velvet room'}</strong>
              </button>
            </div>

            <div class="inline-actions">
              <button class="btn btn-primary" type="button" data-action="play-spotlight">${icon('play')} Start room</button>
              ${primaryPlaylist?.songs?.length
                ? `<button class="btn btn-secondary" type="button" data-action="play-home-playlist" data-playlist="${primaryPlaylist.id}">${icon('play')} Play stack</button>`
                : `<button class="btn btn-secondary" type="button" data-action="build-home-stack" data-name="${buildHomeStackName}">${icon('plus')} Build room</button>`}
              ${spotlightStations[0] ? `<button class="btn btn-secondary" type="button" data-action="open-station" data-index="${spotlightStations[0].index}">Open lane</button>` : ''}
            </div>

            <div class="home-feature-depth-grid">
              ${depthCards.map(homeDepthCard).join('')}
            </div>
          </div>

          <div class="home-feature-visual">
            <div class="home-feature-scene">
              <div class="home-feature-halo home-feature-halo--primary"></div>
              <div class="home-feature-halo home-feature-halo--soft"></div>
              <div class="home-feature-bubble home-feature-bubble--one"></div>
              <div class="home-feature-bubble home-feature-bubble--two"></div>
              <div class="home-feature-bubble home-feature-bubble--three"></div>
              <div class="home-feature-art-shell">
                ${mediaSlot({
                  image: spotlightVisual,
                  alt: `${spotlightTrack?.title || 'Velvet'} feature visual`,
                  label: spotlightArtist?.name || spotlightTrack?.artist || 'Feature visual',
                  eyebrow: 'Feature visual',
                  monogram: spotlightArtist?.name || spotlightTrack?.artist || 'V',
                  className: 'home-feature-art',
                  kind: 'feature',
                  ratio: 'hero'
                })}
              </div>
              ${leadStation?.station
                ? `<button class="home-feature-orb home-feature-orb--lane" type="button" data-action="open-station" data-index="${leadStation.index}">
                     <span>Open lane</span>
                     <strong>${leadStation.station.name}</strong>
                     <small>${leadStation.station.tags?.[0] || 'Guiding route'}</small>
                   </button>`
                : ''}
              ${stackOrbitControl}
              ${artistOrbitControl}
              <div class="home-feature-float-card">
                <span>Room weather</span>
                <strong>${spotlightTags[0] || 'Soft focus'}</strong>
                <small>${leadStation?.station.description || leadStation?.station.query || 'Pick a lane and let the chamber take over from there.'}</small>
              </div>
            </div>
          </div>
        </div>
      </article>

      <aside class="panel home-companion-panel">
        <div class="home-companion-block home-companion-block--voice">
          <span class="panel-kicker">Depth Map</span>
          <h3 class="home-side-title">Choose a lane</h3>
          <p class="section-copy">Open one route from here and let the station page carry the heavier listening controls.</p>
          <div class="home-axis-list">
            ${spotlightStations.map(homeAxisRow).join('')}
          </div>
        </div>

        <div class="home-companion-divider"></div>

        <div class="home-companion-block home-companion-block--stack">
          <span class="panel-kicker">Room Stack</span>
          <div class="home-side-title">${primaryPlaylist?.name || 'Current room'}</div>
          <p class="section-copy">${primaryPlaylistSignature?.summary || 'Build or save the room once, then keep using Library as the place where it evolves.'}</p>
          ${primaryPlaylistSignature?.tags?.length ? `<div class="meta-tags">${primaryPlaylistSignature.tags.map(tag => `<span class="mini-tag">${tag}</span>`).join('')}</div>` : ''}
          <div class="home-side-list">
            ${stackRowsMarkup}
          </div>
          <div class="inline-actions">
            ${hasPrimaryPlaylistSongs
              ? `<a class="btn btn-secondary" href="library.html">Open library</a>`
              : `<button class="btn btn-secondary" type="button" data-action="build-home-stack" data-name="${buildHomeStackName}">${icon('plus')} Build room</button>
                 <button class="btn btn-secondary" type="button" data-open-create-playlist>Create empty stack</button>`}
          </div>
        </div>
      </aside>
    </section>

    <section class="panel home-band home-band--stations">
      ${pageHead({ kicker:'Stations', title:'Open a lane', copy:'Three strong routes surfaced from the current room, kept lighter than the hero so they feel like options instead of competing fronts.', linkText:'See all', linkHref:'stations.html' })}
      <div class="home-station-grid home-station-grid--panoramic">${featuredStations.map(homeStationCard).join('')}</div>
    </section>

    <section class="panel home-band home-band--queue">
      ${pageHead({ kicker:'For tonight', title:'Room picks', copy:'A shorter queue pulled from returns, saves, and the catalog core so the home page stays quick to scan.' })}
      <div class="song-list home-song-grid home-song-grid--wide">${displayCuratedTracks.map(songRow).join('')}</div>
    </section>

    <section class="home-editorial-grid home-lower-grid">
      <article class="panel home-rail-panel home-rail-panel--returns">
        ${pageHead({ kicker:'Return path', title:'Continue listening', copy:'A clean lower rail for the tracks that already shaped the room.' })}
        <div class="home-side-list">
          ${returnTracks.length ? returnTracks.map((track, index) => homeMiniRow(track, index, 'play-home-return')).join('') : emptyState('No recent or liked songs yet. Start the room and Velvet will hold onto the right moments here.')}
        </div>
      </article>

      <article class="panel home-rail-panel home-rail-panel--focus">
        ${pageHead({ kicker:'Essentials', title:'Artist layer', copy:'A tighter lower shelf built from the featured voice, not another full page of competing cards.' })}
        <div class="home-side-list">
          ${artistEssentials.length ? artistEssentials.map((track, index) => homeMiniRow(track, index, 'play-home-essential')).join('') : emptyState('No artist essentials yet. Velvet will surface them as the catalog grows.')}
        </div>
      </article>
    </section>
  `;

  const rerender = () => renderHomeView(container);

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
    'play-home-curated': (_event, data) => {
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
      window.dispatchEvent(new CustomEvent('velvet:navigate', { detail: { href: `stations.html#station-${data.index}` } }));
    },
    'shuffle-station': (_event, data) => {
      window.dispatchEvent(new CustomEvent('velvet:navigate', { detail: { href: `stations.html#station-${data.index}` } }));
    },
    'toggle-station-pin': (_event, data) => {
      const index = Number(data.index);
      const pinned = toggleFavoriteStation(index);
      toast(pinned ? 'Lane pinned' : 'Lane unpinned');
      window.dispatchEvent(new CustomEvent('velvet:stations-changed'));
      rerender();
    },
    'open-artist': (_event, data) => {
      window.dispatchEvent(new CustomEvent('velvet:navigate', { detail: { href: `artists.html#artist-${data.slug}` } }));
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
    },
    'build-home-stack': (_event, data) => {
      const playlist = createPlaylistFromTracks(data.name || buildHomeStackName, defaultStackTracks);
      if (!playlist) return;
      toast('Room stack created');
      window.dispatchEvent(new CustomEvent('velvet:library-changed'));
      rerender();
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
    window.addEventListener('storage', event => {
      if (!event.key || APP_STATE_KEYS.has(event.key)) {
        refreshLibraryState();
        rerender();
      }
    });
  }

  renderHomeView(container);
}

