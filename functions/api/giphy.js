/**
 * Cloudflare Pages Function — Giphy Proxy (v2: big database)
 * ==========================================================
 * Serves GIFs from Giphy API when env.GIPHY_API_KEY is set,
 * otherwise from the aggregated fallback database (~34.5k GIFs
 * aggregated from giphy.com + tenor.com, direct CDN URLs).
 *
 * Endpoints:
 *   GET /api/giphy?trending=1&offset=0&limit=24
 *   GET /api/giphy?search=QUERY&offset=0&limit=24
 *   GET /api/giphy?categories=1
 */

let _fallbackPromise = null;      // per-isolate cache of parsed fallback DB
let _fallbackMeta = null;         // { origin, fetchedAt }

const CATEGORY_DEFS = [
  { id: 'trending' }, { id: 'reactions' }, { id: 'memes' }, { id: 'animals' },
  { id: 'anime' }, { id: 'gaming' }, { id: 'cartoons' }, { id: 'movies' },
  { id: 'music' }, { id: 'sports' }, { id: 'food' }, { id: 'nature' },
  { id: 'tech' }, { id: 'love' },
];

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

function json(data, status = 200, cacheMaxAge = 60) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'Content-Type',
      'cache-control': `public, max-age=${cacheMaxAge}, s-maxage=${cacheMaxAge * 6}`,
    },
  });
}

async function loadFallback(request) {
  const url = new URL(request.url);
  const origin = url.origin;
  // Per-isolate cache keyed by origin
  if (_fallbackPromise && _fallbackMeta && _fallbackMeta.origin === origin) {
    return _fallbackPromise;
  }
  _fallbackMeta = { origin, fetchedAt: Date.now() };
  _fallbackPromise = (async () => {
    try {
      const r = await fetch(`${origin}/data/fallback-gifs.json`, {
        cf: { cacheTtl: 86400, cacheEverything: true },
      });
      if (r.ok) return await r.json();
    } catch (e) {}
    // Retry without cf options
    try {
      const r = await fetch(`${origin}/data/fallback-gifs.json`);
      if (r.ok) return await r.json();
    } catch (e) {}
    return { gifs: [], total: 0, categories: [] };
  })();
  return _fallbackPromise;
}

function transformGiphyItem(item) {
  const id = item.id || '';
  const title = (item.title || 'GIF').trim();
  let slug = item.slug || (item.url ? item.url.replace(/^\/?gifs\//, '') : id);
  slug = slug.replace(/-[A-Za-z0-9]+$/, '');
  return {
    id,
    slug,
    title: title.length > 60 ? title.slice(0, 57) + '…' : title,
    cat: 'trending',
    url: item.images?.original?.url || `https://media.giphy.com/media/${id}/giphy.gif`,
    thumb: item.images?.fixed_height_small?.url || item.images?.downsized?.url || `https://media.giphy.com/media/${id}/200.gif`,
    preview: item.images?.fixed_height_small_still?.url || `https://media.giphy.com/media/${id}/giphy_s.gif`,
    plays: 0,
    tags: [],
    source: 'giphy'
  };
}

async function callGiphy(env, endpoint, params) {
  const apiKey = env?.GIPHY_API_KEY;
  if (!apiKey) return null;
  const url = new URL(`https://api.giphy.com/v1/${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url.toString(), { cf: { cacheTtl: 300 } });
  if (!r.ok) return null;
  return await r.json();
}

function categoryPriority(cat) {
  const i = CAT_PRIORITY.indexOf(cat);
  return i === -1 ? 99 : i;
}

const CAT_KEYWORDS = (() => {
  const map = {
    reactions: ['laugh', 'cry', 'sad', 'happy', 'shock', 'angry', 'love', 'heart', 'wow', 'omg', 'facepalm', 'smile', 'wink', 'thumbs', 'clap', 'dance', 'wave', 'nod', 'shrug', 'sigh', 'bored', 'confused', 'scared', 'excited', 'tired', 'hungry', 'sick', 'yawn', 'lol', 'lmao', 'funny', 'haha'],
    memes: ['meme', 'dank', 'viral', 'tiktok', 'instagram', 'twitter', 'facebook', 'youtube', 'funny', 'joke', 'comedy', 'spongebob', 'rick-roll', 'work', 'office', 'school', 'birthday', 'christmas', 'halloween', 'party'],
    animals: ['cat', 'dog', 'puppy', 'kitten', 'horse', 'cow', 'pig', 'bird', 'fish', 'shark', 'snake', 'frog', 'rabbit', 'panda', 'bear', 'fox', 'wolf', 'lion', 'tiger', 'monkey', 'elephant', 'dino', 'duck', 'owl', 'penguin', 'hamster', 'bunny'],
    anime: ['anime', 'manga', 'kawaii', 'senpai', 'waifu', 'mecha', 'gundam', 'pokemon', 'naruto', 'ghibli', 'pikachu'],
    gaming: ['game', 'gaming', 'arcade', 'nintendo', 'playstation', 'xbox', 'minecraft', 'mario', 'zelda', 'sonic', 'fortnite'],
    movies: ['movie', 'film', 'cinema', 'marvel', 'batman', 'superman', 'spiderman', 'avengers', 'star-wars', 'harry-potter', 'disney'],
    music: ['music', 'song', 'dance', 'singing', 'guitar', 'drum', 'piano', 'concert', 'dj', 'rap', 'rock', 'metal', 'pop', 'jazz'],
    sports: ['sport', 'football', 'soccer', 'basketball', 'baseball', 'tennis', 'hockey', 'golf', 'boxing', 'mma', 'wrestling', 'wwe', 'ufc', 'skate', 'snowboard', 'ski', 'surf', 'swim', 'cycling', 'gym', 'goal', 'slam-dunk', 'touchdown', 'nba'],
    cartoons: ['cartoon', 'rick', 'morty', 'simpsons', 'family-guy', 'south-park', 'spongebob', 'adventure-time', 'futurama', 'avatar', 'steven-universe', 'disney'],
    food: ['food', 'pizza', 'burger', 'taco', 'sushi', 'ramen', 'cake', 'cookie', 'donut', 'coffee', 'tea', 'beer', 'wine', 'chocolate', 'ice-cream'],
    nature: ['nature', 'mountain', 'ocean', 'sea', 'beach', 'sunset', 'sunrise', 'rain', 'snow', 'storm', 'cloud', 'sky', 'star', 'galaxy', 'space', 'forest', 'tree', 'flower', 'waterfall', 'rainbow'],
    tech: ['tech', 'computer', 'laptop', 'phone', 'internet', 'wifi', 'coding', 'programmer', 'ai', 'robot', 'cyber', 'hacker', 'crypto', 'bitcoin'],
    love: ['love', 'heart', 'kiss', 'hug', 'romance', 'romantic', 'cupid', 'valentine', 'wedding', 'marriage', 'couple', 'relationship'],
  };
  const out = [];
  for (const [cat, kws] of Object.entries(map)) {
    for (const kw of kws) out.push({ kw, cat });
  }
  return out;
})();

function matchCategory(text) {
  const t = (text || '').toLowerCase();
  for (const { kw, cat } of CAT_KEYWORDS) {
    if (t.includes(kw)) return cat;
  }
  return 'trending';
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const params = url.searchParams;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'Content-Type',
    }});
  }

  // Categories endpoint — cached with the DB
  if (params.get('categories') === '1') {
    const fb = await loadFallback(request);
    const counts = {};
    for (const g of (fb.gifs || [])) {
      counts[g.cat] = (counts[g.cat] || 0) + 1;
    }
    const cats = CATEGORY_DEFS.map(c => ({
      id: c.id,
      label_en: CAT_LABELS[c.id]?.en || c.id,
      label_ar: CAT_LABELS[c.id]?.ar || c.id,
      label_ro: CAT_LABELS[c.id]?.ro || c.id,
      count: counts[c.id] || (c.id === 'trending' ? (fb.total || (fb.gifs || []).length) : 0),
    })).filter(c => c.count > 0 || c.id === 'trending');
    return json({ ok: true, categories: cats, total: fb.total || (fb.gifs || []).length });
  }

  const limit = Math.min(parseInt(params.get('limit') || '24', 10), 50);
  const offset = parseInt(params.get('offset') || '0', 10);
  const search = (params.get('search') || '').trim();
  const catParam = (params.get('cat') || '').trim().toLowerCase();
  const trending = params.get('trending') === '1' || (!search && !catParam && !params.get('categories'));

  // Try Giphy API first (only when key is configured)
  if (env?.GIPHY_API_KEY) {
    try {
      const result = search
        ? await callGiphy(env, 'gifs/search', { q: search, limit, offset, rating: 'pg', lang: 'en' })
        : trending
          ? await callGiphy(env, 'gifs/trending', { limit, offset, rating: 'pg' })
          : null;
      if (result && Array.isArray(result.data) && result.data.length > 0) {
        const gifs = result.data.map(transformGiphyItem);
        const cat = search ? matchCategory(search) : 'trending';
        gifs.forEach(g => g.cat = cat);
        return json({
          ok: true, gifs,
          total: result.pagination?.total_count || gifs.length,
          offset, source: 'giphy'
        }, 200, 60);
      }
    } catch (e) {
      console.error('Giphy API error:', e.message);
    }
  }

  // Fallback database (34.5k GIFs)
  const fb = await loadFallback(request);
  let pool = fb.gifs || [];
  if (pool.length === 0) {
    return json({ ok: false, gifs: [], total: 0, source: 'none', error: 'no_api_key_and_no_fallback' }, 200, 30);
  }

  if (catParam && CAT_PRIORITY.includes(catParam) && catParam !== 'trending') {
    // Explicit category filter
    pool = pool.filter(g => g.cat === catParam);
  } else if (search) {
    // If search matches a category id, treat as category browse
    const qLower = search.toLowerCase();
    if (CAT_PRIORITY.includes(qLower) && qLower !== 'trending') {
      pool = pool.filter(g => g.cat === qLower);
    } else {
      const terms = qLower.split(/\s+/).filter(Boolean);
      pool = pool.filter(g => {
        const title = g.title ? g.title.toLowerCase() : '';
        for (const t of terms) {
          if (!title.includes(t)) return false;
        }
        return true;
      });
      // Relevance: prefix matches first
      pool.sort((a, b) => {
        const ap = a.title.toLowerCase().startsWith(qLower) ? 0 : 1;
        const bp = b.title.toLowerCase().startsWith(qLower) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return 0;
      });
    }
  } else if (trending) {
    // stable sort by category priority (already sorted in the JSON, but keep for safety)
    pool = [...pool].sort((a, b) => categoryPriority(a.cat) - categoryPriority(b.cat));
  }

  const slice = pool.slice(offset, offset + limit);
  return json({
    ok: true,
    gifs: slice,
    total: pool.length,
    offset,
    source: 'fallback'
  }, 200, 60);
}
