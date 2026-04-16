import { createPlaylist, addTrackToPlaylist, state } from './state.js';
import { catalogTracks } from './catalog.js';

let toastTimer;

export function initGlobalUi(){
  const createButtons = document.querySelectorAll('[data-open-create-playlist]');
  createButtons.forEach(button => button.addEventListener('click', openPlaylistModal));

  document.getElementById('createPlaylistClose')?.addEventListener('click', closePlaylistModal);
  document.getElementById('createPlaylistSave')?.addEventListener('click', () => {
    const input = document.getElementById('createPlaylistName');
    const playlist = createPlaylist(input.value);

    if (playlist) {
      input.value = '';
      closePlaylistModal();
      toast('Playlist created');
      window.dispatchEvent(new CustomEvent('velvet:library-changed'));
    }
  });

  window.addEventListener('velvet:playlist-pick', event => {
    if (!event.detail?.track) return;
    openAddModal(event.detail.track);
  });

  document.getElementById('addPlaylistClose')?.addEventListener('click', closeAddModal);
}

export function toast(message){
  const node = document.getElementById('toast');
  if (!node) return;

  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 2200);
}

export function resolveTrack(videoId){
  return catalogTracks.find(track => track.videoId === videoId) || null;
}

export function bindSongRowActions(root, handlers = {}){
  if (!root) return;

  root.__velvetSongHandlers = handlers;
  if (root.__velvetSongBound) return;

  root.__velvetSongBound = true;
  root.addEventListener('click', event => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger || !root.contains(trigger)) return;

    const action = trigger.dataset.action;
    const currentHandlers = root.__velvetSongHandlers || {};
    if (!currentHandlers[action]) return;

    currentHandlers[action](event, trigger.dataset, trigger);
  });
}

function openPlaylistModal(){
  document.getElementById('createPlaylistModal')?.classList.add('open');
}

function closePlaylistModal(){
  document.getElementById('createPlaylistModal')?.classList.remove('open');
}

function openAddModal(track){
  const modal = document.getElementById('addPlaylistModal');
  const list = document.getElementById('addPlaylistList');
  if (!modal || !list) return;

  modal.dataset.video = track.videoId;

  list.innerHTML = state.playlists.length
    ? state.playlists.map(playlist => `
      <button class="playlist-card" data-playlist="${playlist.id}">
        <span class="panel-kicker">Playlist</span>
        <h4>${playlist.name}</h4>
        <p class="section-copy">${playlist.songs.length} tracks</p>
      </button>
    `).join('')
    : '<div class="empty">Create a playlist first, then come back to stack tracks.</div>';

  list.querySelectorAll('[data-playlist]').forEach(button => {
    button.addEventListener('click', () => {
      const added = addTrackToPlaylist(track, Number(button.dataset.playlist));
      if (added) {
        toast('Track added to playlist');
        window.dispatchEvent(new CustomEvent('velvet:library-changed'));
      }
      closeAddModal();
    });
  });

  modal.classList.add('open');
}

function closeAddModal(){
  document.getElementById('addPlaylistModal')?.classList.remove('open');
}
