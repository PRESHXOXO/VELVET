import { getArtistSlugs, getArtistProfile, getArtistTracks } from '../core/catalog.js';
import { playFromQueue } from '../core/player.js';
import { pageHead, artistCard, songRow, emptyState, mediaSlot } from '../ui/templates.js';
import { bindSongRowActions, resolveTrack } from '../core/ui.js';

export function renderArtistsPage(container){
  const hashMatch = window.location.hash.match(/artist-(.+)$/);
  const activeSlug = hashMatch ? hashMatch[1] : getArtistSlugs()[0];
  const profiles = getArtistSlugs().map(slug => getArtistProfile(slug));
  const activeProfile = getArtistProfile(activeSlug);
  const tracks = getArtistTracks(activeSlug);
  const letters = [...new Set(profiles.map(profile => profile.name.charAt(0).toUpperCase()).filter(Boolean))].sort();
  const activeImage = activeProfile?.portraitImage || activeProfile?.image || '';

  container.innerHTML = `
    <section class="artists-page">
      ${pageHead({ kicker:'Artist Profiles', title:'Artists', copy:'Profiles and cross-links for the voices shaping Velvet.', linkText:'Back Home', linkHref:'index.html' })}
      <div class="alpha-bar">
        <button class="alpha-btn active">All</button>
        ${letters.map(letter => `<button class="alpha-btn">${letter}</button>`).join('')}
      </div>
      <div class="split artists-layout">
        <div class="artist-grid">${profiles.map(artistCard).join('')}</div>
        <aside class="panel detail-panel artist-detail-panel" style="--artist-focus-gradient:${activeProfile?.gradient || 'linear-gradient(135deg,#17121a,#43253c)'};${activeImage ? `--artist-focus-image:url('${activeImage}')` : ''}">
          <div class="artist-detail-hero">
            ${mediaSlot({
              image: activeImage,
              alt: `${activeProfile.name || 'Artist'} portrait`,
              label: activeProfile.name || 'Artist portrait',
              eyebrow: 'Portrait slot',
              monogram: activeProfile?.name || 'V',
              className: 'artist-detail-media',
              kind: 'artist-detail',
              ratio: 'portrait'
            })}
            <div class="artist-detail-copy">
              <span class="panel-kicker">Artist Focus</span>
              <div class="section-title artist-detail-title">${activeProfile.name}</div>
              <p class="section-copy">${activeProfile.description || 'Velvet artist profile.'}</p>
              <div class="meta-tags">${(activeProfile.tags || []).slice(0, 4).map(tag => `<span class="mini-tag">${tag}</span>`).join('')}</div>
              <div class="inline-actions">
                <button class="btn btn-primary" id="playArtistTracks">Play Artist</button>
                <button class="btn btn-secondary" id="shuffleArtistTracks">Shuffle</button>
              </div>
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
