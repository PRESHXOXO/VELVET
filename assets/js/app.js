import { initPlayer } from './core/player.js';
import { initGlobalUi, toast } from './core/ui.js';
import { toggleLike } from './core/state.js';

export function initSharedApp(activePage){
  document.querySelectorAll('[data-page-link]').forEach(link => {
    link.classList.toggle('active', link.dataset.pageLink === activePage);
  });
  document.querySelectorAll('[data-nav-link]').forEach(link => {
    link.classList.toggle('active', link.dataset.navLink === activePage);
  });

  initPlayer();
  initGlobalUi();

  window.addEventListener('velvet:toggle-like', event => {
    const track = event.detail?.track;
    if(!track){ return; }
    const on = toggleLike(track);
    toast(on ? 'Added to liked songs' : 'Removed from liked songs');
    window.dispatchEvent(new CustomEvent('velvet:library-changed'));
  });
}
