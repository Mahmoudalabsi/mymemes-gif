/**
 * Netlify Function — Giphy proxy mirror (v2: big database).
 * Same behavior as functions/api/giphy.js, Netlify handler signature.
 * Falls back to /data/fallback-gifs.json (~34.5k GIFs) when no GIPHY_API_KEY.
 */

const FALLBACK_URL = 'https://raw.githubusercontent.com/Mahmoudalabsi/mymemes-gif/main/public/data/fallback-gifs.json';

const CATEGORY_DEFS = ['trending', 'reactions', 'memes', 'animals', 'anime', 'gaming', 'cartoons', 'movies', 'music', 'sports', 'food', 'nature', 'tech', 'love'];

const CAT_LABELS = {
  trending:   { en: 'Trending',  ar: 'الرائج',      ro: 'Populare' },
  reactions:  { en: 'Reactions', ar: 'ردود الأفعال', ro: 'Reacții' },
  memes:      { en: 'Memes',     ar: 'ميمز',        ro: 'Meme-uri' },
  animals:    { en: 'Animals',   ar: 'حيوانات',      ro: 'Animale' },
  anime:      { en: 'Anime',     ar: 'أنمي',        ro: 'Anime' },
  gaming:     { en: 'Gaming',    ar: 'ألعاب',       ro: 'Jocuri' },
  cartoons:   { en: 'Cartoons',  ar: 'كرتون',       ro: 'Desene' },
  movies:     { en: 'Movies',    ar: 'أفلام',       ro: 'Filme' },
  music:      { en: 'Music',     ar: 'موسيقى',      ro: 'Muzică' },
  sports:     { en: 'Sports',    ar: 'رياضة',       ro: 'Sport' },
  food:       { en: 'Food',      ar: 'طعام',        ro: 'Mâncare' },
  nature:     { en: 'Nature',    ar: 'طبيعة',       ro: 'Natură' },
  tech:       { en: 'Tech',      ar: 'تقنية',       ro: 'Tehnologie' },
  love:       { en: 'Love',      ar: 'حب',         ro: 'Dragoste' },
};

const CAT_PRIORITY = ['trending', 'reactions', 'memes', 'animals', 'anime', 'gaming', 'cartoons', 'movies', 'music', 'sports', 'food', 'nature', 'tech', 'love'];

// per-lambda-instance cache
let _fbCache = { key: null, promise: null };

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
  const proto = (event.headers['x-forwarded-proto'] || 'https');
  const host = event.headers['host'] || '';
  const key = `${proto}://${host}`;
  if (_fbCache.key === key && _fbCache.promise) return _fbCache.promise;
  _fbCache.key = key;
  _fbCache.promise = (async () => {
    try {
      if (host) {
        const r = await fetch(`${key}/data/fallback-gifs.json`);
        if (r.ok) return await r.json();
      }
    } catch (e) {}
    try {
      const r = await fetch(FALLBACK_URL);
      if (r.ok) return await r.json();
    } catch (e) {}
    return { gifs: [], total: 0, categories: [] };
  })();
  return _fbCache.promise;
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

function categoryPriority(cat) {
  const i = CAT_PRIORITY.indexOf(cat);
  return i === -1 ? 99 : i;
}

export async function handler(event) {
  const qs = event.queryStringParameters || {};

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' } };
  }

  if (qs.categories === '1') {
    const fb = await loadFallback(event);
    const counts = {};
    for (const g of (fb.gifs || [])) counts[g.cat] = (counts[g.cat] || 0) + 1;
    const cats = CATEGORY_DEFS.map(c => ({
      id: c,
      label_en: CAT_LABELS[c]?.en || c,
      label_ar: CAT_LABELS[c]?.ar || c,
      label_ro: CAT_LABELS[c]?.ro || c,
      count: counts[c] || (c === 'trending' ? (fb.total || (fb.gifs || []).length) : 0),
    })).filter(c => c.count > 0 || c.id === 'trending');
    return jsonBody({ ok: true, categories: cats, total: fb.total || (fb.gifs || []).length });
  }

  const limit = Math.min(parseInt(qs.limit || '24', 10), 50);
  const offset = parseInt(qs.offset || '0', 10);
  const search = (qs.search || '').trim();
  const catParam = (qs.cat || '').trim().toLowerCase();
  const trending = qs.trending === '1' || (!search && !catParam && !qs.categories);

  if (process.env.GIPHY_API_KEY) {
    try {
      const result = search
        ? await callGiphy('gifs/search', { q: search, limit, offset, rating: 'pg', lang: 'en' })
        : trending
          ? await callGiphy('gifs/trending', { limit, offset, rating: 'pg' })
          : null;
      if (result && Array.isArray(result.data) && result.data.length > 0) {
        const gifs = result.data.map(transformGiphyItem);
        return jsonBody({ ok: true, gifs, total: result.pagination?.total_count || gifs.length, offset, source: 'giphy' });
      }
    } catch (e) {}
  }

  const fb = await loadFallback(event);
  let pool = fb.gifs || [];
  if (pool.length === 0) {
    return jsonBody({ ok: false, gifs: [], total: 0, source: 'none' });
  }

  if (catParam && CAT_PRIORITY.includes(catParam) && catParam !== 'trending') {
    pool = pool.filter(g => g.cat === catParam);
  } else if (search) {
    const qLower = search.toLowerCase();
    if (CAT_PRIORITY.includes(qLower) && qLower !== 'trending') {
      pool = pool.filter(g => g.cat === qLower);
    } else {
      const terms = qLower.split(/\s+/).filter(Boolean);
      pool = pool.filter(g => {
        const title = g.title ? g.title.toLowerCase() : '';
        return terms.every(t => title.includes(t));
      });
      pool.sort((a, b) => {
        const ap = a.title.toLowerCase().startsWith(qLower) ? 0 : 1;
        const bp = b.title.toLowerCase().startsWith(qLower) ? 0 : 1;
        return ap - bp;
      });
    }
  } else if (trending) {
    pool = [...pool].sort((a, b) => categoryPriority(a.cat) - categoryPriority(b.cat));
  }

  const slice = pool.slice(offset, offset + limit);
  return jsonBody({ ok: true, gifs: slice, total: pool.length, offset, source: 'fallback' });
}
