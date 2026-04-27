const API_ENDPOINT = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video';

function cleanText(value = '') {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toSafeMax(value) {
  return Math.max(1, Math.min(25, Number(value) || 12));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'YouTube search is not configured' });
    return;
  }

  const query = cleanText(req.query?.q || '').slice(0, 120);
  const max = toSafeMax(req.query?.max);

  if (!query) {
    res.status(400).json({ error: 'Missing query' });
    return;
  }

  const url = `${API_ENDPOINT}&maxResults=${max}&q=${encodeURIComponent(query)}&key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      res.status(response.status).json({ error: 'YouTube request failed' });
      return;
    }

    const data = await response.json();
    const items = (Array.isArray(data.items) ? data.items : []).map(item => {
      const snippet = item?.snippet || {};
      return {
        title: cleanText(snippet.title || 'Untitled'),
        artist: cleanText(snippet.channelTitle || 'YouTube'),
        videoId: cleanText(item?.id?.videoId || ''),
        thumb:
          snippet?.thumbnails?.high?.url ||
          snippet?.thumbnails?.medium?.url ||
          snippet?.thumbnails?.default?.url ||
          ''
      };
    });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ items });
  } catch (_err) {
    res.status(502).json({ error: 'Unable to reach YouTube' });
  }
}
