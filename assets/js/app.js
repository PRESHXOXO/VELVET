import { initPlayer } from './core/player.js';
import { initGlobalUi, toast } from './core/ui.js';
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
  const index = Number(trigger.dataset.index);
  const videoId = trigger.dataset.video;

  if (action === 'play-track') {
    event.preventDefault();
  async function playTrackByIndex(index, videoId) {
  const track =
    state.currentRows?.[index] ||
    state.stationTracks?.[index] ||
    state.searchResults?.[index] ||
    null;

  if (!track && !videoId) return;
  await playTrack(track || { videoId });
}

  if (action === 'toggle-like') {
    event.preventDefault();
    toggleLike(videoId);
    return;
  }

  if (action === 'add-playlist') {
    event.preventDefault();
    openAddToPlaylist(videoId);
    return;
  }
});
