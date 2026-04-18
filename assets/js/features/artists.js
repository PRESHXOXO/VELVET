import { getArtistSlugs, getArtistProfile, getArtistTracks } from '../core/catalog.js';
import { playFromQueue } from '../core/player.js';
import { pageHead, artistCard, songRow, emptyState, mediaSlot } from '../ui/templates.js';
import { bindSongRowActions, resolveTrack } from '../core/ui.js';

function artistPerspectiveCard({ label, value, copy }) {
  return `
    <article class="artists-perspective-card">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${copy}</small>
    </article>
  `;
}

export function renderArtistsPage(container){
  const slugs = getArtistSlugs();
  const fallbackSlug = slugs[0];
  const hashMatch = window.location.hash.match(/artist-(.+)$/);
  const requestedSlug = hashMatch ? hashMatch[1] : fallbackSlug;
  const profiles = slugs.map(slug => getArtistProfile(slug)).filter(Boolean);
  const activeProfile = getArtistProfile(requestedSlug) || getArtistProfile(fallbackSlug);
  const activeSlug = activeProfile?.slug || fallbackSlug;
  const tracks = getArtistTracks(activeSlug);
  const letters = [...new Set(profiles.map(profile => profile.name.charAt(0).toUpperCase()).filter(Boolean))].sort();
  const activeImage = activeProfile?.portraitImage || activeProfile?.image || '';
  const focusTags = (activeProfile?.tags || []).slice(0, 4);
  const perspectiveCards = [
    {
      label: 'Visible profiles',
      value: `${profiles.length}`,
      copy: 'voices currently mapped across the artist plane'
    },
    {
      label: 'Front focus tracks',
      value: `${tracks.length}`,
      copy: activeProfile?.name ? `${activeProfile.name} is carrying the foreground.` : 'No active focus selected.'
    },
    {
      label: 'Signal markers',
      value: focusTags[0] || 'Core voice',
      copy: focusTags.length > 1 ? focusTags.slice(1).join(' / ') : 'Tags on this artist become the side cues.'
    }
  ];

  container.innerHTML = `
    <section class="artists-page">
      ${pageHead({
        kicker: 'Perspective Profiles',
        title: 'Artist Plane',
        copy: 'Move across the voices shaping Velvet from front focus to supporting silhouettes.',
        linkText: 'Back Home',
        linkHref: 'index.html'
      })}
      <div class="alpha-bar">
        <button class="alpha-btn active">All</button>
        ${letters.map(letter => `<button class="alpha-btn">${letter}</button>`).join('')}
      </div>
      <div class="artists-perspective-band">
        ${perspectiveCards.map(artistPerspectiveCard).join('')}
      </div>
      <div class="split artists-layout">
        <div class="artist-grid">${profiles.map(artistCard).join('')}</div>
        <aside class="panel detail-panel artist-detail-panel" style="--artist-focus-gradient:${activeProfile?.gradient || 'linear-gradient(135deg,#17121a,#43253c)'};${activeImage ? `--artist-focus-image:url('${activeImage}')` : ''}">
          <div class="artist-detail-hero">
            ${mediaSlot({
              image: activeImage,
              alt: `${activeProfile?.name || 'Artist'} portrait`,
              label: activeProfile?.name || 'Artist portrait',
              eyebrow: 'Front-plane portrait',
              monogram: activeProfile?.name || 'V',
              className: 'artist-detail-media',
              kind: 'artist-detail',
              ratio: 'portrait'
            })}
            <div class="artist-detail-copy">
              <span class="panel-kicker">Front Plane</span>
              <div class="section-title artist-detail-title">${activeProfile?.name || 'Artist focus'}</div>
              <p class="section-copy">${activeProfile?.description || 'Velvet artist profile.'}</p>
              <div class="meta-tags">${focusTags.map(tag => `<span class="mini-tag">${tag}</span>`).join('')}</div>
              <div class="inline-actions">
                <button class="btn btn-primary" id="playArtistTracks">Play Frontline</button>
                <button class="btn btn-secondary" id="shuffleArtistTracks">Shuffle Plane</button>
              </div>
            </div>
          </div>
          <div class="artist-detail-metrics">
            <div class="artist-detail-metric">
              <span>Lane</span>
              <strong>${focusTags[0] || 'Core voice'}</strong>
            </div>
            <div class="artist-detail-metric">
              <span>Tracks</span>
              <strong>${tracks.length}</strong>
            </div>
            <div class="artist-detail-metric">
              <span>Nearby</span>
              <strong>${Math.max(profiles.length - 1, 0)}</strong>
            </div>
          </div>
          <div class="artist-detail-tracklist">
            ${tracks.length ? `<div class="song-list artist-detail-song-list">${tracks.map(songRow).join('')}</div>` : emptyState('No seeded tracks yet for this artist.')}
          </div>
        </aside>
      </div>
    </section>
  `;

  document.getElementById('playArtistTracks')?.addEventListener('click', () => playFromQueue(tracks, 0));
  document.getElementById('shuffleArtistTracks')?.addEventListener('click', () => {
    const shuffled = tracks.slice().sort(() => Math.random() - 0.5);
    playFromQueue(shuffled, 0);
  });

  bindSongRowActions(container, {
    'play-track': (_event, data) => playFromQueue(tracks, tracks.findIndex(track => track.videoId === data.video)),
    'toggle-like': (_event, data) => {
      const track = tracks.find(item => item.videoId === data.video) || resolveTrack(data.video);
      window.dispatchEvent(new CustomEvent('velvet:toggle-like', { detail: { track } }));
    },
    'add-playlist': (_event, data) => {
      const track = tracks.find(item => item.videoId === data.video) || resolveTrack(data.video);
      window.dispatchEvent(new CustomEvent('velvet:playlist-pick', { detail: { track } }));
    },
    'open-artist': (_event, data) => { window.location.href = `artists.html#artist-${data.slug}`; }
  });
}
