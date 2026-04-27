import { isLiked } from '../core/state.js';
import { getStationVisual } from '../core/catalog.js';
import { escapeHtml, normalizeText, safeUrl } from '../core/sanitize.js';

export function getInitials(value = '') {
  return String(value)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('') || 'V';
}

function escapeAttr(value = '') {
  return escapeHtml(value);
}

function safeStyleValue(value = '', fallback = '') {
  return escapeAttr(String(value || fallback).replace(/[;{}<>]/g, ' ').trim() || fallback);
}

function safeText(value = '', fallback = '') {
  return escapeHtml(normalizeText(value, { fallback, maxLength: 260 }));
}

function safeIdValue(value = '') {
  return escapeAttr(String(value ?? '').replace(/["<>`\s]/g, '').trim());
}

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
        <span class="panel-kicker">${safeText(kicker)}</span>
        <h1>${safeText(title)}</h1>
        <p>${safeText(copy)}</p>
      </div>
      <div class="hero-actions">${actions || ''}</div>
    </section>
  `;
}

export function mediaSlot({
  image = '',
  alt = 'Velvet visual',
  label = 'Image slot',
  eyebrow = 'Velvet visual',
  monogram = 'V',
  className = '',
  kind = 'generic',
  ratio = 'square',
  forceMeta = false
} = {}) {
  const safeImage = safeUrl(image, '');
  const safeAlt = escapeAttr(normalizeText(alt, { fallback: 'Velvet visual', maxLength: 140 }));
  const safeLabel = safeText(label, 'Image slot');
  const safeEyebrow = safeText(eyebrow, 'Velvet visual');
  const showMeta = forceMeta || !safeImage;
  const filledClass = safeImage ? 'is-filled' : 'is-empty';

  return `
    <div class="media-slot media-slot--${escapeAttr(ratio)} media-slot--${escapeAttr(kind)} ${filledClass} ${escapeAttr(className)}" data-media-slot="${escapeAttr(kind)}">
      ${safeImage ? `
        <img src="${escapeAttr(safeImage)}" alt="${safeAlt}">
      ` : `
        <div class="media-slot-placeholder" aria-hidden="true">
          <div class="media-slot-glow"></div>
          <span class="media-slot-monogram">${escapeHtml(getInitials(monogram || label))}</span>
          <div class="media-slot-lines"><span></span><span></span><span></span></div>
        </div>
      `}
      ${showMeta ? `
        <div class="media-slot-meta">
          <span>${safeEyebrow}</span>
          <strong>${safeLabel}</strong>
        </div>
      ` : ''}
    </div>
  `;
}

export function stationCard(station, index){
  const seedCount = (station.seedIndexes || []).length;
  const seedLabel = seedCount ? `${seedCount} curated` : 'Live-led';
  const stationImage = safeUrl(station.cardImage || station.image || station.heroImage || getStationVisual(index), '');

  return `
    <article class="station-card" style="--station-gradient:${safeStyleValue(station.gradient, 'linear-gradient(135deg,#17121a,#43253c)')}">
      <div class="station-card-top">
        <span class="panel-kicker">Station View</span>
        <span class="station-card-seed">${safeText(seedLabel)}</span>
      </div>
      <div class="station-card-shell">
        <div class="station-card-copy">
          <h3>${safeText(station.name, 'Station')}</h3>
          <p>${safeText(station.description || station.query, 'Station route')}</p>
        </div>
        ${mediaSlot({
          image: stationImage,
          alt: `${station.name || 'Station'} visual`,
          label: station.name || 'Station visual',
          eyebrow: 'Station visual',
          monogram: station.name || 'V',
          className: 'station-card-media',
          kind: 'station-card',
          ratio: 'portrait'
        })}
      </div>
      <div class="meta-tags">
        <span class="mini-tag">${safeText(`${seedCount} seeds`)}</span>
        <span class="mini-tag">YouTube pull</span>
      </div>
      <div class="actions">
        <button class="btn btn-primary" data-action="open-station" data-index="${Number(index)}">${icon('play')} Play Station</button>
        <button class="btn btn-secondary" data-action="shuffle-station" data-index="${Number(index)}">${icon('shuffle')} Shuffle</button>
      </div>
    </article>
  `;
}

export function getTrackArtwork(track = {}){
  return safeUrl(
    track.thumb ||
    track.thumbnail ||
    track.image ||
    track.artwork ||
    (track.snippet && track.snippet.thumbnails && track.snippet.thumbnails.high && track.snippet.thumbnails.high.url) ||
    (track.snippet && track.snippet.thumbnails && track.snippet.thumbnails.medium && track.snippet.thumbnails.medium.url) ||
    (track.snippet && track.snippet.thumbnails && track.snippet.thumbnails.default && track.snippet.thumbnails.default.url) ||
    (track.videoId ? `https://i.ytimg.com/vi/${safeIdValue(track.videoId)}/hqdefault.jpg` : ''),
    ''
  );
}

export function renderPlaylistArtwork(entries = [], { emptyClass = '', emptyLabel = 'V' } = {}){
  if (!entries.length) {
    return `<div class="${escapeAttr(emptyClass)}">${escapeHtml(getInitials(emptyLabel))}</div>`;
  }

  return entries.slice(0, 4).map(entry => {
    const artwork = getTrackArtwork(entry.track);
    const alt = escapeAttr(normalizeText(entry.track?.title || 'Track artwork', { fallback: 'Track artwork', maxLength: 140 }));
    return `<img src="${escapeAttr(artwork)}" alt="${alt}">`;
  }).join('');
}

export function songRow(track, index){
  const thumb = getTrackArtwork(track);
  const title = safeText(track.title, 'Unknown track');
  const artist = safeText(track.artist, 'Unknown artist');
  const videoId = safeIdValue(track.videoId);

  return `
    <article class="song-row">
      <button class="song-index" data-action="play-track" data-video="${videoId}" data-index="${Number(index)}">
        ${icon('play')}
      </button>

      <img
        class="song-thumb"
        src="${escapeAttr(thumb)}"
        alt="${escapeAttr(normalizeText(track.title || 'Track artwork', { fallback: 'Track artwork', maxLength: 140 }))}"
        data-action="play-track"
        data-video="${videoId}"
        data-index="${Number(index)}"
      >

      <div
        class="song-main"
        data-action="play-track"
        data-video="${videoId}"
        data-index="${Number(index)}"
      >
        <div class="song-title">${title}</div>
        <div class="song-sub">${artist}</div>
      </div>

      <button class="btn-icon ${isLiked(track.videoId) ? 'on' : ''}" data-action="toggle-like" data-video="${videoId}">
        ${icon('heart')}
      </button>

      <button class="btn-icon" data-action="add-playlist" data-video="${videoId}">
        ${icon('plus')}
      </button>
    </article>
  `;
}

export function shelfCard(card){
  return `
    <article class="shelf-card">
      <div class="shelf-card-media"><img src="${escapeAttr(safeUrl(card.image, ''))}" alt=""></div>
      <div class="shelf-card-copy">
        <span class="panel-kicker">${safeText(card.kicker)}</span>
        <h3>${safeText(card.title)}</h3>
        <p>${safeText(card.copy)}</p>
      </div>
    </article>
  `;
}

export function artistCard(profile){
  const portraitImage = safeUrl(profile.portraitImage || profile.image || '', '');

  return `
    <article class="artist-card" style="--artist-gradient:${safeStyleValue(profile.gradient || 'linear-gradient(135deg,#17121a,#43253c)')};${portraitImage ? `--artist-image:url('${escapeAttr(portraitImage)}')` : ''}">
      <div class="artist-card-visual">
        ${mediaSlot({
          image: portraitImage,
          alt: `${profile.name || 'Artist'} portrait`,
          label: profile.name || 'Artist portrait',
          eyebrow: 'Artist portrait',
          monogram: profile.name || 'V',
          className: 'artist-card-media',
          kind: 'artist-card',
          ratio: 'portrait'
        })}
        <span class="panel-kicker">Artist Profile</span>
      </div>
      <div class="artist-card-body">
        <h3>${safeText(profile.name, 'Artist')}</h3>
        <p>${safeText(profile.description || 'Velvet artist profile')}</p>
        <div class="meta-tags">${(profile.tags || []).slice(0,3).map(tag => `<span class="mini-tag">${safeText(tag)}</span>`).join('')}</div>
        <div class="actions">
          <button class="btn btn-primary" data-action="open-artist" data-slug="${escapeAttr(profile.slug || '')}">${icon('play')} Open Artist</button>
        </div>
      </div>
    </article>
  `;
}

export function libraryPlaylistCard(playlist, signature, previewEntries){
  return `
    <article class="library-playlist-card" style="--playlist-gradient:${safeStyleValue(signature.gradient, 'linear-gradient(135deg,#17121a,#43253c)')}">
      <div class="library-playlist-cover">
        <div class="library-playlist-collage">
          ${renderPlaylistArtwork(previewEntries, { emptyClass: 'library-playlist-cover-empty' })}
        </div>
        <span class="library-playlist-badge">${safeText(signature.topMood || 'Open Stack')}</span>
      </div>

      <div class="library-playlist-head">
        <div>
          <span class="panel-kicker">Playlist</span>
          <h3>${safeText(playlist.name, 'Untitled Playlist')}</h3>
        </div>
        <div class="library-playlist-metric">${safeText(signature.caption || '')}</div>
      </div>

      <p class="library-playlist-copy">${safeText(signature.summary || '')}</p>
      <div class="meta-tags">${(signature.tags || []).map(tag => `<span class="mini-tag">${safeText(tag)}</span>`).join('')}</div>

      <div class="library-playlist-preview">
        ${previewEntries.length ? previewEntries.map(entry => `
          <button class="library-playlist-track" type="button" data-action="play-library-track" data-source="playlist" data-playlist="${Number(playlist.id)}" data-index="${Number(entry.queueIndex)}" data-video="${safeIdValue(entry.track.videoId)}">
            <img src="${escapeAttr(getTrackArtwork(entry.track))}" alt="${escapeAttr(normalizeText(entry.track.title || 'Track artwork', { fallback: 'Track artwork', maxLength: 140 }))}">
            <span>
              <strong>${safeText(entry.track.title, 'Unknown track')}</strong>
              <small>${safeText(entry.track.artist, 'Unknown artist')}</small>
            </span>
          </button>
        `).join('') : '<div class="library-empty-inline">No tracks here yet.</div>'}
      </div>

      <div class="inline-actions">
        <button class="btn btn-primary" type="button" data-action="play-playlist" data-playlist="${Number(playlist.id)}">${icon('play')} Play stack</button>
      </div>
    </article>
  `;
}

export function playlistPickerCard(playlist, signature, match, previewEntries){
  return `
    <button class="playlist-picker-card is-${escapeAttr(match.tone || 'default')}" data-playlist="${Number(playlist.id)}" ${match.disabled ? 'disabled' : ''}>
      <div class="playlist-picker-art" style="--playlist-gradient:${safeStyleValue(signature.gradient, 'linear-gradient(135deg,#17121a,#43253c)')}">
        ${renderPlaylistArtwork(previewEntries, { emptyClass: 'playlist-picker-art-empty' })}
      </div>
      <div class="playlist-picker-copy">
        <div class="playlist-picker-topline">
          <span class="panel-kicker">Playlist</span>
          <span class="playlist-picker-match is-${escapeAttr(match.tone || 'default')}">${safeText(match.label || '')}</span>
        </div>
        <h4>${safeText(playlist.name, 'Untitled Playlist')}</h4>
        <p class="section-copy">${safeText(signature.summary || '')}</p>
        <div class="meta-tags">${(signature.tags || []).map(tag => `<span class="mini-tag">${safeText(tag)}</span>`).join('')}</div>
      </div>
    </button>
  `;
}

export function emptyState(copy){
  return `<div class="empty">${safeText(copy)}</div>`;
}

export function pageHead({ kicker, title, copy, linkText = '', linkHref = '' }){
  const safeHref = safeUrl(linkHref, '');
  return `
    <div class="section-head">
      <div>
        <span class="panel-kicker">${safeText(kicker)}</span>
        <div class="section-title">${safeText(title)}</div>
        <p class="section-copy">${safeText(copy)}</p>
      </div>
      ${linkText && safeHref ? `<a class="section-link" href="${escapeAttr(safeHref)}">${safeText(linkText)}</a>` : ''}
    </div>
  `;
}

export { escapeHtml, safeUrl };
