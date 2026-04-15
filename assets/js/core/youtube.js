import { API_ENDPOINT, API_KEY } from '../data/catalog.js';

let apiReady;
let playerReady;
let player;

function ensureIframeApi(){
  if(playerReady){ return playerReady; }
  playerReady = new Promise(resolve => {
    if(window.YT?.Player){
      resolve(window.YT);
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    document.head.appendChild(tag);
  });
  return playerReady;
}

export async function ensurePlayer(){
  if(player){ return player; }
  await ensureIframeApi();
  const target = document.getElementById('yt-wrap');
  player = new window.YT.Player(target, {
    height: '270',
    width: '480',
    videoId: '',
    playerVars: { playsinline: 1, modestbranding: 1, rel: 0 },
    events: {}
  });
  return player;
}

export async function loadVideo(videoId){
  const yt = await ensurePlayer();
  yt.loadVideoById(videoId);
  return yt;
}

export async function cueVideo(videoId){
  const yt = await ensurePlayer();
  yt.cueVideoById(videoId);
  return yt;
}

export async function playVideo(){
  const yt = await ensurePlayer();
  yt.playVideo();
}

export async function pauseVideo(){
  const yt = await ensurePlayer();
  yt.pauseVideo();
}

export async function setVolume(volume){
  const yt = await ensurePlayer();
  yt.setVolume(volume);
}

export async function getCurrentTime(){
  if(!player){ return 0; }
  return player.getCurrentTime?.() || 0;
}

export async function getDuration(){
  if(!player){ return 0; }
  return player.getDuration?.() || 0;
}

export function ytThumb(videoId){
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';
}

export async function fetchSongs(query, max = 12){
  if(!API_KEY){
    return [];
  }
  const url = `${API_ENDPOINT}&maxResults=${max}&q=${encodeURIComponent(query)}&key=${API_KEY}`;
  const response = await fetch(url);
  if(!response.ok){
    throw new Error('YouTube request failed');
  }
  const data = await response.json();
  return (data.items || []).map(item => {
    const videoId = item.id?.videoId || '';
    return {
      title: item.snippet?.title || 'Untitled',
      artist: item.snippet?.channelTitle || 'YouTube',
      videoId,
      thumb: ytThumb(videoId)
    };
  }).filter(item => item.videoId);
}
