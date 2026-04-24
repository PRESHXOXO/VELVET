import { state, syncPlayback, pushRecent, recordTrackPlay, toggleLike } from './state.js';
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
let playerReady = false;

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

function stopProgress(){
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

function renderBar(){
  if (!els.bar) return;

  if (!state.currentTrack) {
    els.bar.classList.remove('visible');
    return;
  }

  els.bar.classList.add('visible');

  if (els.art) els.art.src = state.currentTrack.thumb || '';
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
    } catch (_err) {
      // keep UI alive even if player timing hiccups
    }
  }, 500);
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

  els.volume?.addEventListener('input', async event => {
    state.volume = Number(event.target.value);
    syncPlayback();

    try {
      await setVolume(state.volume);
    } catch (_err) {}
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
  }

  playerReady = true;
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
  pushRecent(track);
  recordTrackPlay(track);
  renderBar();
  stopProgress();

  try {
    await loadVideo(track.videoId);

    // if a newer play request happened while this one was loading, abort
    if (requestToken !== playRequestToken) return;

    await setVolume(state.volume);

    if (requestToken !== playRequestToken) return;

    renderBar();
    startProgress();
    window.dispatchEvent(new CustomEvent('velvet:library-changed'));
  } catch (_err) {
    // rollback to a safer state if the latest request fails
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
    // revert if playback command fails
    state.isPlaying = !state.isPlaying;
    syncPlayback();
  }

  renderBar();
}

export async function nextTrack(){
  if (!state.queue.length) return;

  const nextIndex = (state.queueIndex + 1) % state.queue.length;
  state.queueIndex = nextIndex;
  syncPlayback();

  await playTrack(state.queue[nextIndex], state.queue, nextIndex);
}

export async function prevTrack(){
  if (!state.queue.length) return;

  const prevIndex = (state.queueIndex - 1 + state.queue.length) % state.queue.length;
  state.queueIndex = prevIndex;
  syncPlayback();

  await playTrack(state.queue[prevIndex], state.queue, prevIndex);
}

export function refreshPlayer(){
  renderBar();
}

