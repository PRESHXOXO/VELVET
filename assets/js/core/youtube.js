import { normalizeText, sanitizeTrack, safeVideoId } from './sanitize.js';

const API_ENDPOINT = '/api/youtube-search';

let iframeApiPromise = null;
let playerInstance = null;
let playerCreatePromise = null;
let playerReadyResolver = null;
let playerReadyPromise = null;
let loadRequestToken = 0;

function createPlayerReadyPromise() {
  playerReadyPromise = new Promise(resolve => {
    playerReadyResolver = resolve;
  });
}

createPlayerReadyPromise();

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isPlayerReady(player) {
  return !!player && typeof player.loadVideoById === 'function';
}

function safePlayer(player) {
  return player?.player || player?.instance || player?.yt || player;
}

function ytThumb(videoId = '') {
  const safeId = safeVideoId(videoId);
  return safeId ? `https://i.ytimg.com/vi/${safeId}/hqdefault.jpg` : '';
}

function looksPlayable(videoId = '') {
  return typeof videoId === 'string' && safeVideoId(videoId).length >= 6;
}

function ensureIframeApi() {
  if (iframeApiPromise) return iframeApiPromise;

  iframeApiPromise = new Promise(resolve => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous();
      resolve(window.YT);
    };
  });

  return iframeApiPromise;
}

export async function ensurePlayer() {
  if (isPlayerReady(playerInstance)) return playerInstance;
  if (playerCreatePromise) return playerCreatePromise;

  playerCreatePromise = (async () => {
    await ensureIframeApi();

    const target = document.getElementById('yt-wrap');
    if (!target) {
      throw new Error('Missing #yt-wrap player target');
    }

    const created = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('YouTube player init timed out')), 12000);

      const yt = new window.YT.Player(target, {
        height: '270',
        width: '480',
        videoId: '',
        playerVars: {
          playsinline: 1,
          modestbranding: 1,
          rel: 0
        },
        events: {
          onReady: () => {
            clearTimeout(timeout);
            resolve(yt);
            if (playerReadyResolver) playerReadyResolver(yt);
          },
          onError: () => {
            // keep player alive; load-specific errors handled elsewhere
          }
        }
      });
    });

    playerInstance = created;
    return playerInstance;
  })();

  return playerCreatePromise;
}

async function waitForPlayerReady() {
  if (isPlayerReady(playerInstance)) return playerInstance;
  await ensurePlayer();
  return playerReadyPromise;
}

export async function loadVideo(videoId) {
  const safeId = safeVideoId(videoId);
  if (!looksPlayable(safeId)) {
    throw new Error('Invalid videoId');
  }

  const requestToken = ++loadRequestToken;
  const yt = safePlayer(await waitForPlayerReady());

  yt.loadVideoById(safeId);

  await wait(120);

  if (requestToken !== loadRequestToken) {
    throw new Error('Stale video load ignored');
  }

  return yt;
}

export async function cueVideo(videoId) {
  const safeId = safeVideoId(videoId);
  if (!looksPlayable(safeId)) {
    throw new Error('Invalid videoId');
  }

  const yt = safePlayer(await waitForPlayerReady());
  yt.cueVideoById(safeId);
  return yt;
}

export async function playVideo() {
  const yt = safePlayer(await waitForPlayerReady());
  yt.playVideo();
}

export async function pauseVideo() {
  const yt = safePlayer(await waitForPlayerReady());
  yt.pauseVideo();
}

export async function setVolume(volume) {
  const yt = safePlayer(await waitForPlayerReady());
  if (yt && typeof yt.setVolume === 'function') {
    yt.setVolume(Number(volume) || 0);
  }
}

export async function getCurrentTime() {
  const yt = safePlayer(playerInstance);
  if (!yt || typeof yt.getCurrentTime !== 'function') return 0;
  return yt.getCurrentTime() || 0;
}

export async function getDuration() {
  const yt = safePlayer(playerInstance);
  if (!yt || typeof yt.getDuration !== 'function') return 0;
  return yt.getDuration() || 0;
}

export { ytThumb };

export async function fetchSongs(query, max = 12) {
  const normalizedQuery = normalizeText(query, { maxLength: 120 });
  if (!normalizedQuery) return [];

  if (window.location.protocol === 'file:') {
    return [];
  }

  const safeMax = Math.max(1, Math.min(25, Number(max) || 12));
  const url = `${API_ENDPOINT}?q=${encodeURIComponent(normalizedQuery)}&max=${safeMax}`;

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('YouTube request failed');
  }

  const data = await response.json();
  return (Array.isArray(data.items) ? data.items : [])
    .map(item => sanitizeTrack({
      title: item.title,
      artist: item.artist,
      videoId: item.videoId,
      thumb: item.thumb || ytThumb(item.videoId)
    }))
    .filter(item =>
      looksPlayable(item.videoId) &&
      item.title &&
      !item.title.toLowerCase().includes('deleted video') &&
      !item.title.toLowerCase().includes('private video')
    );
}
