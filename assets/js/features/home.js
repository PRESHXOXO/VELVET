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

function homeRibbonTrack(track, index) {
  return `
    <button class="home-feature-ribbon-track" type="button" data-action="play-home-curated" data-index="${index}" data-video="${track.videoId}">
      <img src="${getTrackArtwork(track)}" alt="${track.title || 'Track artwork'}">
      <span class="home-feature-ribbon-copy">
        <strong>${track.title || 'Unknown track'}</strong>
        <small>${track.artist || 'Unknown artist'}</small>
      </span>
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
  const spotlightArt = getTrackArtwork(spotlightTrack);
  const spotlightVisual = spotlightArtist?.featureImage || spotlightArtist?.heroImage || spotlightArt || '';
  const spotlightRibbon = curatedTracks.filter(track => track.videoId !== spotlightTrack?.videoId).slice(0, 3);
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
      label: 'Front Plane',
      value: spotlightArtist?.name || spotlightTrack?.artist || 'Velvet',
      copy: 'Lead voice carrying the room.'
    },
    {
      label: 'Axis Lane',
      value: leadStation?.station.name || 'Open lane',
      copy: leadStation?.station.description || leadStation?.station.query || 'A guiding mood lane for the night.'
    },
    {
      label: 'Room Stack',
      value: primaryPlaylist?.name || 'Build a stack',
      copy: primaryPlaylistSignature?.caption || 'Your most coherent personal layer surfaces here.'
    }
  ];

  container.innerHTML = `
    <section class="home-stage">
      <article class="panel home-feature-panel" style="${spotlightVisual ? `--spotlight-image:url('${spotlightVisual}')` : ''}">
        <div class="home-feature-grid">
          <div class="home-feature-copy">
            <div class="home-feature-heading">
              <span class="panel-kicker">Tonight's Spotlight</span>
              <div class="home-feature-meta">
                <span>${spotlightTrack?.artist || 'Private listening club'}</span>
                ${spotlightTrack?.year ? `<span>${spotlightTrack.year}</span>` : ''}
                <span>Lead record</span>
              </div>
              <div class="home-feature-title">${spotlightTrack?.title || 'Velvet'}</div>
              <p class="home-feature-blurb">${spotlightArtist?.description || 'Velvet now opens with a stronger editorial center: one lead record, one voice, and a cleaner path into the rest of the room.'}</p>
            </div>

            <div class="meta-tags home-feature-tags">
              ${(spotlightTags.length ? spotlightTags : ['after-hours', 'editorial', 'velvet']).map(tag => `<span class="mini-tag">${tag}</span>`).join('')}
            </div>

            <div class="home-feature-depth-grid">
              ${depthCards.map(homeDepthCard).join('')}
            </div>

            <div class="inline-actions">
              <button class="btn btn-primary" type="button" data-action="play-spotlight">${icon('play')} Start here</button>
              ${spotlightArtist ? `<button class="btn btn-secondary" type="button" data-action="open-artist" data-slug="${spotlightArtist.slug}">Open artist</button>` : ''}
              ${spotlightStations[0] ? `<button class="btn btn-secondary" type="button" data-action="open-station" data-index="${spotlightStations[0].index}">Open station</button>` : ''}
            </div>

            ${spotlightRibbon.length ? `
              <div class="home-feature-ribbon-shell">
                <div class="home-feature-ribbon-head">
                  <span class="panel-kicker">Side Planes</span>
                  <p>Three nearby tracks that keep the scene coherent without flattening the mood.</p>
                </div>
                <div class="home-feature-ribbon">
                  ${spotlightRibbon.map(track => homeRibbonTrack(track, curatedTracks.findIndex(item => item.videoId === track.videoId))).join('')}
                </div>
              </div>
            ` : ''}
          </div>

          <div class="home-feature-visual">
            <div class="home-feature-scene">
              <div class="home-feature-plane home-feature-plane--rear"></div>
              <div class="home-feature-plane home-feature-plane--mid"></div>
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
              <div class="home-feature-float-card">
                <span>Vantage Point</span>
                <strong>${leadStation?.station.name || 'Open lane'}</strong>
                <small>${leadStation?.station.description || leadStation?.station.query || 'Pick a station lane and let the rest of the room fall into place.'}</small>
              </div>
              <div class="home-feature-track-card">
                <span>Now Framed</span>
                <strong>${spotlightTrack?.title || 'Velvet'}</strong>
                <small>${spotlightTrack?.artist || 'Private listening club'}</small>
              </div>
            </div>
            <div class="home-feature-stat-row">
              <div class="home-feature-stat">
                <small>Saved</small>
                <strong>${formatCount(state.liked.length, 'song')}</strong>
              </div>
              <div class="home-feature-stat">
                <small>Stacks</small>
                <strong>${formatCount(state.playlists.length, 'stack')}</strong>
              </div>
              <div class="home-feature-stat">
                <small>Returns</small>
                <strong>${formatCount(state.recent.length, 'return')}</strong>
              </div>
            </div>
          </div>
        </div>
      </article>

      <aside class="panel home-companion-panel">
        <div class="home-companion-block home-companion-block--voice">
          <span class="panel-kicker">Depth Map</span>
          <h3 class="home-side-title">Move through the room by lane</h3>
          <p class="section-copy">Perspective works best when every alternate path feels placed on purpose instead of piled on top of the hero.</p>
          <div class="home-axis-list">
            ${spotlightStations.map(homeAxisRow).join('')}
          </div>
        </div>

        <div class="home-companion-divider"></div>

        <div class="home-companion-block home-companion-block--stack">
          <span class="panel-kicker">Room Stack</span>
          <div class="home-side-title">${primaryPlaylist?.name || 'Keep building the room'}</div>
          <p class="section-copy">${primaryPlaylistSignature?.summary || 'Build the current room into a real stack so this side of Velvet starts reacting like a library, not a placeholder.'}</p>
          ${primaryPlaylistSignature?.tags?.length ? `<div class="meta-tags">${primaryPlaylistSignature.tags.map(tag => `<span class="mini-tag">${tag}</span>`).join('')}</div>` : ''}
          <div class="home-side-list">
            ${primaryPlaylistPreview.length
              ? primaryPlaylistPreview.map(entry => homeMiniRow(entry.track, entry.queueIndex, 'play-home-playlist-track', `data-playlist="${primaryPlaylist.id}"`)).join('')
              : (returnTracks.length ? returnTracks.map((track, index) => homeMiniRow(track, index, 'play-home-return')).join('') : '<div class="empty">Play or save a few songs and this shelf will start to feel personal fast.</div>')}
          </div>
          <div class="inline-actions">
            ${primaryPlaylist?.songs?.length
              ? `<button class="btn btn-primary" type="button" data-action="play-home-playlist" data-playlist="${primaryPlaylist.id}">${icon('play')} Play stack</button>`
              : `<button class="btn btn-primary" type="button" data-action="build-home-stack" data-name="${buildHomeStackName}">${icon('plus')} Build current room</button>
                 <button class="btn btn-secondary" type="button" data-open-create-playlist>Create empty stack</button>`}
          </div>
        </div>
      </aside>
    </section>

    <section class="panel home-band home-band--stations">
      ${pageHead({ kicker:'Stations', title:'Mood Lanes', copy:'Four angled station worlds arranged around the lead record, each one built to feel like a deliberate side plane instead of a repeated card.', linkText:'See all', linkHref:'stations.html' })}
      <div class="home-station-grid home-station-grid--panoramic">${spotlightStations.map(homeStationCard).join('')}</div>
    </section>

    <section class="panel home-band home-band--queue">
      ${pageHead({ kicker:'For tonight', title:'Frontline Queue', copy:'A front-facing queue pulled from recents, likes, artist essentials, and the catalog core, ordered to keep the home scene coherent.' })}
      <div class="song-list home-song-grid home-song-grid--wide">${curatedTracks.map(songRow).join('')}</div>
    </section>

    <section class="home-editorial-grid home-lower-grid">
      <article class="panel home-rail-panel home-rail-panel--returns">
        ${pageHead({ kicker:'Return path', title:'Continue Listening', copy:'The quickest route back into the songs that already shaped your last session, kept in a clear lower layer instead of competing with the hero.' })}
        <div class="home-side-list">
          ${returnTracks.length ? returnTracks.map((track, index) => homeMiniRow(track, index, 'play-home-return')).join('') : emptyState('No recent or liked songs yet. Start the room and Velvet will hold onto the right moments here.')}
        </div>
      </article>

      <article class="panel home-rail-panel home-rail-panel--focus">
        ${pageHead({ kicker:'Essentials', title:'Artist Layer', copy:'A dedicated lower rail built from the featured voice instead of another generic card wall, so the perspective hierarchy stays intact.' })}
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
