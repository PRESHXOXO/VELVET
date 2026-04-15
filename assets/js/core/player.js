import { state, syncPlayback, pushRecent, toggleLike } from './state.js';
import { loadVideo, playVideo, pauseVideo, setVolume, getCurrentTime, getDuration, cueVideo } from './youtube.js';

let els = {};
let progressTimer;

function qs(id){
  return document.getElementById(id);
}

function formatTime(total){
  const value = Math.floor(total || 0);
  const mins = Math.floor(value / 60);
  const secs = String(value % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function renderBar(){
  if(!els.bar){ return; }
  if(!state.currentTrack){
    els.bar.classList.remove('visible');
    return;
  }
  els.bar.classList.add('visible');
  els.art.src = state.currentTrack.thumb || '';
  els.title.textContent = state.currentTrack.title || 'Unknown track';
  els.artist.textContent = state.currentTrack.artist || 'Unknown artist';
  els.like.classList.toggle('on', state.liked.some(item => item.videoId === state.currentTrack.videoId));
  els.play.innerHTML = state.isPlaying ? pauseIcon() : playIcon();
}

function playIcon(){
  return '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none"></path></svg>';
}

function pauseIcon(){
  return '<svg viewBox="0 0 24 24"><path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" stroke="none"></path></svg>';
}

async function startProgress(){
  clearInterval(progressTimer);
  progressTimer = setInterval(async () => {
    if(!state.isPlaying || !state.currentTrack){ return; }
    const current = await getCurrentTime();
    const duration = await getDuration();
    if(els.current){ els.current.textContent = formatTime(current); }
    if(els.duration){ els.duration.textContent = formatTime(duration); }
    if(els.fill){
      const pct = duration ? Math.min(100, (current / duration) * 100) : 0;
      els.fill.style.width = `${pct}%`;
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
    await setVolume(state.volume);
  });
  els.like?.addEventListener('click', () => {
    if(!state.currentTrack){ return; }
    toggleLike(state.currentTrack);
    renderBar();
    window.dispatchEvent(new CustomEvent('velvet:library-changed'));
  });
  els.track?.addEventListener('click', async event => {
    const rect = els.track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const duration = await getDuration();
    const target = duration * pct;
    const yt = await import('./youtube.js');
    const player = await yt.ensurePlayer();
    player.seekTo(target, true);
  });

  if(els.volume){
    els.volume.value = String(state.volume);
    setVolume(state.volume);
  }
  if(state.currentTrack){
    cueVideo(state.currentTrack.videoId);
    renderBar();
  }
}

export async function playTrack(track, queue = null, index = 0){
  if(!track?.videoId){ return; }
  if(Array.isArray(queue)){
    state.queue = queue;
    state.queueIndex = index;
  }
  state.currentTrack = track;
  state.isPlaying = true;
  syncPlayback();
  pushRecent(track);
  await loadVideo(track.videoId);
  await setVolume(state.volume);
  renderBar();
  startProgress();
  window.dispatchEvent(new CustomEvent('velvet:library-changed'));
}

export function setQueue(queue, index = 0){
  state.queue = queue;
  state.queueIndex = index;
  syncPlayback();
}

export async function playFromQueue(queue, index = 0){
  setQueue(queue, index);
  await playTrack(queue[index], queue, index);
}

export async function togglePlay(){
  if(!state.currentTrack){ return; }
  state.isPlaying = !state.isPlaying;
  syncPlayback();
  if(state.isPlaying){
    await playVideo();
    startProgress();
  }else{
    await pauseVideo();
  }
  renderBar();
}

export async function nextTrack(){
  if(!state.queue.length){ return; }
  state.queueIndex = (state.queueIndex + 1) % state.queue.length;
  syncPlayback();
  await playTrack(state.queue[state.queueIndex], state.queue, state.queueIndex);
}

export async function prevTrack(){
  if(!state.queue.length){ return; }
  state.queueIndex = (state.queueIndex - 1 + state.queue.length) % state.queue.length;
  syncPlayback();
  await playTrack(state.queue[state.queueIndex], state.queue, state.queueIndex);
}

export function refreshPlayer(){
  renderBar();
}
