import { isLiked } from '../core/state.js';

export function icon(name){
  const icons = {
    play:'<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none"></path></svg>',
    plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    heart:'<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.2A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    shuffle:'<svg viewBox="0 0 24 24"><path d="M16 3h5v5"/><path d="m4 20 8-8"/><path d="m12 12 4-4 5 5"/><path d="m4 4 5 5"/></svg>',
    search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.2-4.2"/></svg>'
  };
  return icons[name] || '';
}

export function heroBanner({ kicker, title, copy, actions }){
  return `
    <section class="hero-banner">
      <div class="hero-copy">
        <span class="panel-kicker">${kicker}</span>
        <h1>${title}</h1>
        <p>${copy}</p>
      </div>
      <div class="hero-actions">${actions}</div>
    </section>
  `;
}

export function stationCard(station, index){
  return `
    <article class="station-card" style="--station-gradient:${station.gradient}">
      <span class="panel-kicker">Station View</span>
      <h3>${station.name}</h3>
      <p>${station.description || station.query}</p>
      <div class="meta-tags">
        <span class="mini-tag">${(station.seedIndexes || []).length || 'Live'} seeds</span>
        <span class="mini-tag">YouTube pull</span>
      </div>
      <div class="actions">
        <button class="btn btn-primary" data-action="open-station" data-index="${index}">${icon('play')} Play Station</button>
        <button class="btn btn-secondary" data-action="shuffle-station" data-index="${index}">${icon('shuffle')} Shuffle</button>
      </div>
    </article>
  `;
}

export function songRow(track, index){
  const thumb =
    track.thumb ||
    track.thumbnail ||
    track.image ||
    track.artwork ||
    (track.snippet && track.snippet.thumbnails && track.snippet.thumbnails.high && track.snippet.thumbnails.high.url) ||
    (track.snippet && track.snippet.thumbnails && track.snippet.thumbnails.medium && track.snippet.thumbnails.medium.url) ||
    (track.snippet && track.snippet.thumbnails && track.snippet.thumbnails.default && track.snippet.thumbnails.default.url) ||
    (track.videoId ? `https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg` : '');

  return `
    <article class="song-row">
      <button class="song-index" data-action="play-track" data-video="${track.videoId}" data-index="${index}">
        ${icon('play')}
      </button>

      <img
        class="song-thumb"
        src="${thumb}"
        alt="${track.title || 'Track artwork'}"
        data-action="play-track"
        data-video="${track.videoId}"
        data-index="${index}"
      >

      <div
        class="song-main"
        data-action="play-track"
        data-video="${track.videoId}"
        data-index="${index}"
      >
        <div class="song-title">${track.title || 'Unknown track'}</div>
        <div class="song-sub">${track.artist || 'Unknown artist'}</div>
      </div>

      <button class="btn-icon ${isLiked(track.videoId) ? 'on' : ''}" data-action="toggle-like" data-video="${track.videoId}">
        ${icon('heart')}
      </button>

      <button class="btn-icon" data-action="add-playlist" data-video="${track.videoId}">
        ${icon('plus')}
      </button>
    </article>
  `;
}

export function shelfCard(card){
  return `
    <article class="shelf-card">
      <div class="shelf-card-media"><img src="${card.image}" alt=""></div>
      <div class="shelf-card-copy">
        <span class="panel-kicker">${card.kicker}</span>
        <h3>${card.title}</h3>
        <p>${card.copy}</p>
      </div>
    </article>
  `;
}

export function artistCard(profile){
  return `
    <article class="artist-card" style="background:${profile.gradient || 'linear-gradient(135deg,#17121a,#43253c)'}">
      <span class="panel-kicker">Artist Profile</span>
      <h3>${profile.name}</h3>
      <p>${profile.description || 'Velvet artist profile'}</p>
      <div class="meta-tags">${(profile.tags || []).slice(0,3).map(tag => `<span class="mini-tag">${tag}</span>`).join('')}</div>
      <div class="actions">
        <button class="btn btn-primary" data-action="open-artist" data-slug="${profile.slug}">${icon('play')} Open Artist</button>
      </div>
    </article>
  `;
}

export function playlistCard(playlist){
  return `
    <article class="playlist-card">
      <span class="panel-kicker">Playlist</span>
      <h4>${playlist.name}</h4>
      <p class="section-copy">${playlist.songs.length} tracks ready to stack into your room.</p>
      <div class="inline-actions">
        <button class="btn btn-secondary" data-play-playlist="${playlist.id}" data-playlist="${playlist.id}">${icon('play')} Play</button>
      </div>
    </article>
  `;
}

export function emptyState(copy){
  return `<div class="empty">${copy}</div>`;
}

export function pageHead({ kicker, title, copy, linkText = '', linkHref = '' }){
  return `
    <div class="section-head">
      <div>
        <span class="panel-kicker">${kicker}</span>
        <div class="section-title">${title}</div>
        <p class="section-copy">${copy}</p>
      </div>
      ${linkText ? `<a class="section-link" href="${linkHref}">${linkText}</a>` : ''}
    </div>
  `;
}
