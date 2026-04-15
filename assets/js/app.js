import { initPlayer } from './core/player.js';
import { initGlobalUi } from './core/ui.js';
import { toggleLike } from './core/state.js';
import { playTrack } from './player.js';

export function initSharedApp(activePage){
  document.querySelectorAll('[data-page-link]').forEach(link => {
    link.classList.toggle('active', link.dataset.pageLink === activePage);
  });

  document.querySelectorAll('[data-nav-link]').forEach(link => {
    link.classList.toggle('active', link.dataset.navLink === activePage);
  });

  initPlayer();
  initGlobalUi();

  document.addEventListener('click', async (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;

    const action = trigger.dataset.action;
    const videoId = trigger.dataset.video;

    if (action === 'play-track') {
      event.preventDefault();
      if (!videoId) return;
      await playTrack({ videoId });
      return;
    }

    if (action === 'toggle-like') {
      event.preventDefault();
      if (!videoId) return;
      toggleLike(videoId);
      return;
    }

    if (action === 'add-playlist') {
      event.preventDefault();
      console.log('Add to playlist clicked for:', videoId);
      return;
    }
  });
}
