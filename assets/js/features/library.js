import { state } from '../core/state.js';
import { playFromQueue } from '../core/player.js';
import { pageHead, shelfCard, playlistCard, emptyState } from '../ui/templates.js';

export function renderLibraryPage(container){
  const likedCount = state.liked.length;
  const recentCount = state.recent.length;
  const cards = [
    {
      image: state.recent[0]?.thumb || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80',
      kicker:'Browse Velvet',
      title:'Artist Profiles',
      copy:'Profiles, essentials, and station cross-links for the voices defining Velvet.'
    },
    {
      image: state.liked[0]?.thumb || 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=80',
      kicker:'Your red stamps',
      title:'Liked Songs',
      copy:`${likedCount} saved songs waiting for another late-night pass.`
    },
    {
      image: state.recent[0]?.thumb || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1200&q=80',
      kicker:'Last session',
      title:'Recently Played',
      copy:`${recentCount} tracks touched most recently.`
    }
  ];

  container.innerHTML = `
    <section class="library-shelves">
      <div class="panel">
        <span class="panel-kicker">Your Shelves</span>
        <div class="section-title" style="margin-top:12px">Library</div>
        <p class="section-copy">Collections, saved moments, and playlists surfaced as cards instead of plain rows.</p>
      </div>
      <div class="card-grid" style="margin-top:14px">${cards.map(shelfCard).join('')}</div>
    </section>
    <section>
      ${pageHead({ kicker:'Playlists', title:'Your room stacks', copy:'A lighter playlist system with local saves so you can keep building without freezing the whole app.' })}
      <div class="inline-actions"><button class="btn btn-primary" data-open-create-playlist>Create a playlist</button></div>
      <div class="playlist-grid" style="margin-top:14px">
        ${state.playlists.length ? state.playlists.map(playlistCard).join('') : emptyState('No playlists yet. Create one and start stacking songs from stations, search, or artists.')}
      </div>
    </section>
    <section>
      ${pageHead({ kicker:'Saved', title:'Liked Songs', copy:'The tracks you marked for return.' })}
      <div class="song-list">${state.liked.length ? state.liked.slice(0, 12).map((track, index) => `
        <article class="song-row">
          <button class="song-index" data-play-liked="${index}">${index + 1}</button>
          <img src="${track.thumb}" alt="">
          <div class="song-main"><div class="song-title">${track.title}</div><div class="song-sub">${track.artist}</div></div>
          <div></div><div></div>
        </article>
      `).join('') : emptyState('No liked songs yet. Tap the heart on any track row or in the player to start building this list.')}
      </div>
    </section>
  `;

  container.querySelectorAll('[data-play-liked]').forEach(button => {
    button.addEventListener('click', () => playFromQueue(state.liked, Number(button.dataset.playLiked)));
  });
  container.querySelectorAll('[data-play-playlist]').forEach(button => {
    button.addEventListener('click', () => {
      const playlist = state.playlists.find(item => item.id === Number(button.dataset.playlist));
      if(playlist?.songs?.length){
        playFromQueue(playlist.songs, 0);
      }
    });
  });
}
