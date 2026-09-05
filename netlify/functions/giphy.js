/**
 * Netlify Function — Giphy proxy mirror.
 * Same logic as functions/api/giphy.js (Cloudflare), but using Netlify's handler signature.
 * Falls back to /data/fallback-gifs.json (served as a static asset).
 */

const FALLBACK_URL = 'https://raw.githubusercontent.com/Mahmoudalabsi/mymemes-gif/main/public/data/fallback-gifs.json';

const CATEGORY_DEFS = [
  { id: 'trending' }, { id: 'reactions' }, { id: 'animals' }, { id: 'anime' },
  { id: 'gaming' }, { id: 'movies' }, { id: 'music' }, { id: 'sports' },
  { id: 'memes' }, { id: 'cartoons' }, { id: 'food' }, { id: 'nature' },
  { id: 'tech' }, { id: 'love' },
];

function jsonBody(data, status = 200) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'public, max-age=60',
    },
    body: JSON.stringify(data),
  };
}

async function loadFallback(event) {
  try {
    const proto = event.headers['x-forwarded-proto'] || 'https';
    const host = event.headers['host'];
    if (host) {
      const localUrl = `${proto}://${host}/data/fallback-gifs.json`;
      const r = await fetch(localUrl);
      if (r.ok) return await r.json();
    }
  } catch (e) {}
  try {
    const r = await fetch(FALLBACK_URL);
    if (r.ok) return await r.json();
  } catch (e) {}
  return { gifs: [], total: 0, categories: [] };
}

function transformGiphyItem(item) {
  const id = item.id || '';
  const title = (item.title || 'GIF').trim();
  let slug = item.slug || id;
  slug = slug.replace(/-[A-Za-z0-9]+$/, '');
  return {
    id, slug,
    title: title.length > 60 ? title.slice(0, 57) + '…' : title,
    cat: 'trending',
    url: item.images?.original?.url || `https://media.giphy.com/media/${id}/giphy.gif`,
    thumb: item.images?.fixed_height_small?.url || `https://media.giphy.com/media/${id}/200.gif`,
    preview: item.images?.fixed_height_small_still?.url || `https://media.giphy.com/media/${id}/giphy_s.gif`,
    plays: 0, tags: [], source: 'giphy'
  };
}

async function callGiphy(endpoint, params) {
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) return null;
  const url = new URL(`https://api.giphy.com/v1/${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url.toString());
  if (!r.ok) return null;
  return await r.json();
}

export async function handler(event) {
  const qs = event.queryStringParameters || {};

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' } };
  }

  if (qs.categories === '1') {
    const fb = await loadFallback(event);
    const cats = CATEGORY_DEFS.map(c => ({
      ...c,
      count: fb.gifs ? fb.gifs.filter(g => g.cat === c.id).length : 0
    })).filter(c => c.count > 0 || c.id === 'trending');
    return jsonBody({ ok: true, categories: cats });
  }

  const limit = Math.min(parseInt(qs.limit || '24', 10), 50);
  const offset = parseInt(qs.offset || '0', 10);
  const search = qs.search || '';
  const trending = qs.trending === '1' || (!search && !qs.categories);

  if (process.env.GIPHY_API_KEY) {
    try {
      const result = search
        ? await callGiphy('gifs/search', { q: search, limit, offset, rating: 'pg', lang: 'en' })
        : trending
          ? await callGiphy('gifs/trending', { limit, offset, rating: 'pg' })
          : null;
      if (result && Array.isArray(result.data) && result.data.length > 0) {
        const gifs = result.data.map(transformGiphyItem);
        return jsonBody({
          ok: true, gifs,
          total: result.pagination?.total_count || gifs.length,
          offset, source: 'giphy'
        });
      }
    } catch (e) {}
  }

  const fb = await loadFallback(event);
  if (!fb.gifs || fb.gifs.length === 0) {
    return jsonBody({ ok: false, gifs: [], total: 0, source: 'none' });
  }

  let pool = fb.gifs;
  if (search) {
    const q = search.toLowerCase();
    pool = pool.filter(g =>
      g.title.toLowerCase().includes(q) ||
      g.slug.toLowerCase().includes(q) ||
      (g.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }
  const slice = pool.slice(offset, offset + limit);
  return jsonBody({ ok: true, gifs: slice, total: pool.length, offset, source: 'fallback' });
}
