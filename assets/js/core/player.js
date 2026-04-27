import { state, syncPlayback, registerTrackPlayback, toggleLike, toggleShufflePlayback, cycleRepeatMode } from './state.js';
import {
  loadVideo,
  playVideo,
  pauseVideo,
  setVolume,
  getCurrentTime,
  getDuration,
  cueVideo
} from './youtube.js';

let els = {};
let progressTimer = null;
let playRequestToken = 0;

function qs(id){
  return document.getElementById(id);
}

function formatTime(total){
  const value = Math.floor(total || 0);
  const mins = Math.floor(value / 60);
  const secs = String(value % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function playIcon(){
  return '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none"></path></svg>';
}

function pauseIcon(){
  return '<svg viewBox="0 0 24 24"><path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" stroke="none"></path></svg>';
}

function shuffleIcon(){
  return '<svg viewBox="0 0 24 24"><path d="M16 3h5v5"></path><path d="M4 20l8-8"></path><path d="M12 12l4-4 5 5"></path><path d="M4 4l5 5"></path></svg>';
}

function repeatIcon(){
  return '<svg viewBox="0 0 24 24"><path d="M17 1l4 4-4 4"></path><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><path d="M7 23l-4-4 4-4"></path><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>';
}

function getAlbumLabel(track = null) {
  if (!track) return 'Velvet select';
  return track.album || track.collection || track.signal || 'Velvet select';
}

function stopProgress(){
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

function emitPlaybackChange() {
  window.dispatchEvent(new CustomEvent('velvet:playback-changed', {
    detail: {
      currentTrack: state.currentTrack,
      queueIndex: state.queueIndex,
      isPlaying: state.isPlaying,
      shuffle: state.shuffle,
      repeatMode: state.repeatMode
    }
  }));
}

function syncPlayerMirrors({ current = 0, duration = 0 } = {}) {
  const track = state.currentTrack;
  const isLikedTrack = track?.videoId
    ? state.liked.some(item => item.videoId === track.videoId)
    : false;
  const progressWidth = duration ? `${Math.min(100, (current / duration) * 100)}%` : '0%';

  document.querySelectorAll('[data-player-progress-current]').forEach(node => {
    node.textContent = formatTime(current);
  });
  document.querySelectorAll('[data-player-progress-duration]').forEach(node => {
    node.textContent = formatTime(duration);
  });
  document.querySelectorAll('[data-player-progress-fill]').forEach(node => {
    node.style.width = progressWidth;
  });
  document.querySelectorAll('[data-player-volume-value]').forEach(node => {
    node.textContent = `${state.volume}%`;
  });
  document.querySelectorAll('[data-player-volume-input]').forEach(node => {
    if (document.activeElement !== node) {
      node.value = String(state.volume);
    }
  });

  document.querySelectorAll('[data-player-command="shuffle"]').forEach(button => {
    button.classList.toggle('is-active', state.shuffle);
    button.setAttribute('aria-pressed', String(Boolean(state.shuffle)));
    button.setAttribute('aria-label', state.shuffle ? 'Disable shuffle' : 'Enable shuffle');
    if (!button.querySelector('svg')) {
      button.innerHTML = shuffleIcon();
    }
  });

  document.querySelectorAll('[data-player-command="repeat"]').forEach(button => {
    const isActive = state.repeatMode !== 'off';
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
    button.setAttribute('data-repeat-mode', state.repeatMode);
    button.setAttribute('aria-label', state.repeatMode === 'one' ? 'Repeat one track' : (state.repeatMode === 'all' ? 'Repeat queue' : 'Repeat off'));
    const badge = button.querySelector('[data-repeat-badge]');
    if (badge) {
      badge.textContent = state.repeatMode === 'one' ? '1' : (state.repeatMode === 'all' ? 'All' : 'Off');
    }
    if (!button.querySelector('svg')) {
      button.innerHTML = `${repeatIcon()}<span class="player-repeat-badge" data-repeat-badge>${state.repeatMode === 'one' ? '1' : (state.repeatMode === 'all' ? 'All' : 'Off')}</span>`;
    }
  });

  document.querySelectorAll('[data-player-command="toggle"]').forEach(button => {
    button.innerHTML = state.isPlaying ? pauseIcon() : playIcon();
    button.setAttribute('aria-label', state.isPlaying ? 'Pause playback' : 'Start playback');
  });

  document.querySelectorAll('[data-player-like-toggle]').forEach(button => {
    button.classList.toggle('on', isLikedTrack);
    button.setAttribute('aria-pressed', String(isLikedTrack));
  });

  if (!track) {
    return;
  }

  document.querySelectorAll('[data-player-artwork]').forEach(node => {
    if (node.tagName === 'IMG') {
      node.src = track.thumb || '';
      node.alt = track.title || 'Current track artwork';
    }
  });

  document.querySelectorAll('[data-player-track-title]').forEach(node => {
    node.textContent = track.title || 'Unknown track';
  });

  document.querySelectorAll('[data-player-track-artist]').forEach(node => {
    node.textContent = track.artist || 'Unknown artist';
  });

  document.querySelectorAll('[data-player-track-album]').forEach(node => {
    node.textContent = getAlbumLabel(track);
  });

  document.querySelectorAll('[data-player-surface]').forEach(node => {
    node.classList.toggle('is-playing', state.isPlaying);
  });
}

function renderBar(){
  if (!els.bar) return;

  if (!state.currentTrack) {
    els.bar.classList.remove('visible');
    syncPlayerMirrors({ current: 0, duration: 0 });
    emitPlaybackChange();
    return;
  }

  els.bar.classList.add('visible');

  if (els.art) {
    els.art.src = state.currentTrack.thumb || '';
    els.art.alt = state.currentTrack.title || 'Current track artwork';
  }
  if (els.title) els.title.textContent = state.currentTrack.title || 'Unknown track';
  if (els.artist) els.artist.textContent = state.currentTrack.artist || 'Unknown artist';

  if (els.like) {
    els.like.classList.toggle(
      'on',
      state.liked.some(item => item.videoId === state.currentTrack.videoId)
    );
  }

  if (els.play) {
    els.play.innerHTML = state.isPlaying ? pauseIcon() : playIcon();
  }

  if (els.shuffle) {
    els.shuffle.classList.toggle('is-active', state.shuffle);
  }

  if (els.repeat) {
    els.repeat.classList.toggle('is-active', state.repeatMode !== 'off');
    els.repeat.setAttribute('data-repeat-mode', state.repeatMode);
    const badge = els.repeat.querySelector('[data-repeat-badge]');
    if (badge) {
      badge.textContent = state.repeatMode === 'one' ? '1' : (state.repeatMode === 'all' ? 'All' : 'Off');
    }
  }

  syncPlayerMirrors();
  emitPlaybackChange();
}

async function startProgress(){
  stopProgress();

  progressTimer = setInterval(async () => {
    if (!state.isPlaying || !state.currentTrack) return;

    try {
      const current = await getCurrentTime();
      const duration = await getDuration();

      if (els.current) els.current.textContent = formatTime(current);
      if (els.duration) els.duration.textContent = formatTime(duration);

      if (els.fill) {
        const pct = duration ? Math.min(100, (current / duration) * 100) : 0;
        els.fill.style.width = `${pct}%`;
      }

      syncPlayerMirrors({ current, duration });
    } catch (_err) {
      // keep UI alive even if player timing hiccups
    }
  }, 500);
}

export async function updateVolume(value) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  state.volume = safeValue;
  syncPlayback();
  syncPlayerMirrors();

  try {
    await setVolume(state.volume);
  } catch (_err) {}
}

export function initPlayer(){
  els = {
    bar: qs('playerBar'),
    art: qs('playerArt'),
    title: qs('playerTitle'),
    artist: qs('playerArtist'),
    play: qs('playerToggle'),
    prev: qs('playerPrev'),
    next: qs('playerNext'),
    shuffle: qs('playerShuffle'),
    repeat: qs('playerRepeat'),
    fill: qs('playerFill'),
    current: qs('playerTimeCurrent'),
    duration: qs('playerTimeDuration'),
    track: qs('playerTrack'),
    volume: qs('playerVolume'),
    like: qs('playerLike')
  };

  els.play?.addEventListener('click', togglePlay);
  els.prev?.addEventListener('click', prevTrack);
  els.next?.addEventListener('click', nextTrack);
  els.shuffle?.addEventListener('click', () => {
    toggleShufflePlayback();
    renderBar();
  });
  els.repeat?.addEventListener('click', () => {
    cycleRepeatMode();
    renderBar();
  });

  els.volume?.addEventListener('input', async event => {
    await updateVolume(event.target.value);
  });

  els.like?.addEventListener('click', () => {
    if (!state.currentTrack) return;

    toggleLike(state.currentTrack);
    renderBar();
    window.dispatchEvent(new CustomEvent('velvet:library-changed'));
  });

  els.track?.addEventListener('click', async event => {
    if (!state.currentTrack) return;

    try {
      const rect = els.track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const duration = await getDuration();
      const target = duration * pct;
      const yt = await import('./youtube.js');
      const player = await yt.ensurePlayer();
      if (player && typeof player.seekTo === 'function') {
        player.seekTo(target, true);
      }
    } catch (_err) {}
  });

  if (els.volume) {
    els.volume.value = String(state.volume);
    setVolume(state.volume).catch(() => {});
  }

  if (state.currentTrack?.videoId) {
    cueVideo(state.currentTrack.videoId).catch(() => {});
    renderBar();
  } else {
    syncPlayerMirrors();
  }
}

export function setQueue(queue, index = 0){
  state.queue = Array.isArray(queue) ? queue : [];
  state.queueIndex = index;
  syncPlayback();
}

export async function playTrack(track, queue = null, index = 0){
  if (!track?.videoId) return;

  const requestToken = ++playRequestToken;

  if (Array.isArray(queue)) {
    state.queue = queue;
    state.queueIndex = index;
  }

  state.currentTrack = track;
  state.isPlaying = true;
  syncPlayback();
  registerTrackPlayback(track);
  renderBar();
  stopProgress();

  try {
    await loadVideo(track.videoId);

    if (requestToken !== playRequestToken) return;

    await setVolume(state.volume);

    if (requestToken !== playRequestToken) return;

    renderBar();
    startProgress();
    window.dispatchEvent(new CustomEvent('velvet:library-changed'));
  } catch (_err) {
    if (requestToken === playRequestToken) {
      state.isPlaying = false;
      syncPlayback();
      renderBar();
    }
  }
}

export async function playFromQueue(queue, index = 0){
  if (!Array.isArray(queue) || !queue.length) return;
  if (!queue[index]?.videoId) return;

  setQueue(queue, index);
  await playTrack(queue[index], queue, index);
}

export async function togglePlay(){
  if (!state.currentTrack?.videoId) return;

  state.isPlaying = !state.isPlaying;
  syncPlayback();

  try {
    if (state.isPlaying) {
      await playVideo();
      startProgress();
    } else {
      await pauseVideo();
      stopProgress();
    }
  } catch (_err) {
    state.isPlaying = !state.isPlaying;
    syncPlayback();
  }

  renderBar();
}

function resolveNextQueueIndex(direction = 1) {
  if (!state.queue.length) return -1;

  if (state.repeatMode === 'one' && state.currentTrack?.videoId) {
    return state.queueIndex;
  }

  if (state.shuffle && state.queue.length > 1) {
    let nextIndex = state.queueIndex;
    while (nextIndex === state.queueIndex) {
      nextIndex = Math.floor(Math.random() * state.queue.length);
    }
    return nextIndex;
  }

  const targetIndex = state.queueIndex + direction;
  if (targetIndex < 0) {
    return state.repeatMode === 'all' ? state.queue.length - 1 : -1;
  }

  if (targetIndex >= state.queue.length) {
    return state.repeatMode === 'all' ? 0 : -1;
  }

  return targetIndex;
}

export async function nextTrack(){
  if (!state.queue.length) return;

  const nextIndex = resolveNextQueueIndex(1);
  if (nextIndex < 0) return;

  state.queueIndex = nextIndex;
  syncPlayback();

  await playTrack(state.queue[nextIndex], state.queue, nextIndex);
}

export async function prevTrack(){
  if (!state.queue.length) return;

  const prevIndex = resolveNextQueueIndex(-1);
  if (prevIndex < 0) return;

  state.queueIndex = prevIndex;
  syncPlayback();

  await playTrack(state.queue[prevIndex], state.queue, prevIndex);
}

export function refreshPlayer(){
  renderBar();
}
