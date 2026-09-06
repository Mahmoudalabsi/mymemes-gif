/**
 * Cloudflare Pages Function — Giphy Proxy (v3: compact big database)
 * ==================================================================
 * Serves GIFs from Giphy API when env.GIPHY_API_KEY is set,
 * otherwise from the aggregated fallback database (compact format v3).
 *
 * Compact record: { s:'g'|'t', i:<id>, l:<tenor-slug>, t:<title>, c:<cat>, p:<plays> }
 * Records are expanded to full shape only for the returned page slice.
 * The JSON is pre-sorted at build time — trending requests are pure slices.
 *
 * Endpoints:
 *   GET /api/giphy?trending=1&offset=0&limit=24
 *   GET /api/giphy?search=QUERY&offset=0&limit=24
 *   GET /api/giphy?cat=animals&offset=0&limit=24
 *   GET /api/giphy?categories=1
 *   Optional: &sort=name | &sort=popular  (applied to the WHOLE pool
 *   server-side, so pagination windows stay globally ordered)
 */

let _fallbackPromise = null;      // per-isolate cache of parsed fallback DB
let _fallbackMeta = null;         // { origin, fetchedAt }

const CATEGORY_DEFS = [
  { id: 'trending' }, { id: 'classic' }, { id: 'reactions' }, { id: 'memes' }, { id: 'animals' },
  { id: 'anime' }, { id: 'gaming' }, { id: 'cartoons' }, { id: 'movies' },
  { id: 'music' }, { id: 'sports' }, { id: 'food' }, { id: 'nature' },
  { id: 'tech' }, { id: 'love' },
];

const CAT_LABELS = {
  trending:   { en: 'Trending',  ar: 'الرائج',      ro: 'Populare' },
  classic:    { en: 'Classic Memes', ar: 'ميمز شهيرة', ro: 'Meme-uri Celebre' },
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

const CAT_PRIORITY = ['trending', 'classic', 'reactions', 'memes', 'animals', 'anime', 'gaming', 'cartoons', 'movies', 'music', 'sports', 'food', 'nature', 'tech', 'love'];

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
      const r = await fetch(`${origin}/data/fallback-gifs.json?v=3`, {
        cf: { cacheTtl: 86400, cacheEverything: true },
      });
      if (r.ok) return await r.json();
    } catch (e) {}
    // Retry without cf options
    try {
      const r = await fetch(`${origin}/data/fallback-gifs.json?v=3`);
      if (r.ok) return await r.json();
    } catch (e) {}
    return { gifs: [], total: 0, categories: [] };
  })();
  return _fallbackPromise;
}

/* ---------- Compact record expansion ---------- */

function titleFromSlug(slug) {
  const parts = String(slug || '').replace(/\.(gif|webp|mp4|png|jpg)$/i, '').split(/[-_]+/).filter(Boolean);
  const title = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ').slice(0, 80);
  return title || 'GIF';
}

function expandRecord(r) {
  // v4 compact format: { i, t, c, u, h, p?, pl?, s, a }
  if (r.u) {
    return {
      id: r.i,
      title: r.t || r.i,
      cat: r.c || 'trending',
      url: r.u,
      thumb: r.h || r.u,
      preview: r.p || r.h || r.u,
      plays: r.pl || 0,
      source: r.s || '',
      added_at: r.a || 1,
      tags: [],
    };
  }
  // Legacy full-record passthrough (v2 format)
  if (r.url) return r;
  if (r.s === 't') {
    const slug = r.l || r.i;
    return {
      id: r.i,
      title: r.t || titleFromSlug(slug),
      cat: r.c || 'trending',
      url: `https://media.tenor.com/${r.i}AAAAd/${slug}.gif`,
      thumb: `https://media.tenor.com/${r.i}AAAAM/${slug}.gif`,
      preview: `https://media.tenor.com/${r.i}AAAA1/${slug}.webp`,
      plays: r.p || 0,
      tags: [],
      source: 'tenor',
    };
  }
  return {
    id: r.i,
    title: r.t || titleFromSlug(r.i),
    cat: r.c || 'trending',
    url: `https://media.giphy.com/media/${r.i}/giphy.gif`,
    thumb: `https://media.giphy.com/media/${r.i}/200.gif`,
    preview: `https://media.giphy.com/media/${r.i}/giphy_s.gif`,
    plays: r.p || 0,
    tags: [],
    source: 'giphy',
  };
}

// Search text per record — supports BOTH storage formats:
//   compact v3: { s:'g'|'t', i, l:<tenor-slug>, t:<title> }
//   legacy full: { id, title, url, ... }
// (The deployed fallback-gifs.json is legacy full-format, so the compact-only
//  lookup here used to return '' for every record — search matched nothing.)
function searchText(r) {
  return r.t || r.title || r.l || '';
}

function recCat(r) {
  return r.c || r.cat || 'trending';
}

function recTitle(r) {
  return r.t || r.title || '';
}

/* ---------- Server-side global sort ---------- */

function recId(r) {
  return String(r.i || r.id || '');
}

// Human-readable name for sorting (title, else slug words, else id)
function recNameText(r) {
  const t = recTitle(r);
  if (t) return t;
  if (r.l) return String(r.l).replace(/[-_.]+/g, ' ');
  return recId(r);
}

// Memoized name-sort of the FULL pool (the common unfiltered path) — sorting
// 25k+ records on every request would waste CPU; filtered pools (category /
// search) are small enough to sort per request.
let _nameSortedSrc = null;
let _nameSortedPool = null;
function nameSorted(pool) {
  if (_nameSortedSrc === pool && _nameSortedPool) return _nameSortedPool;
  const arr = pool.slice().sort((a, b) => {
    const an = recNameText(a).toLowerCase();
    const bn = recNameText(b).toLowerCase();
    if (an !== bn) return an < bn ? -1 : 1;
    return recId(a) < recId(b) ? -1 : 1; // deterministic pagination
  });
  _nameSortedSrc = pool;
  _nameSortedPool = arr;
  return arr;
}

// Global play counts (KV "counts" map, keyed by gif id) — 60s isolate cache.
// One KV read per minute per isolate instead of one per request.
let _playsCache = { at: 0, counts: null };
async function loadPlays(env) {
  const kv = env && env.PLAYS_KV;
  if (!kv) return {};
  const now = Date.now();
  if (_playsCache.counts && now - _playsCache.at < 60000) return _playsCache.counts;
  try {
    const counts = (await kv.get('counts', 'json')) || {};
    _playsCache = { at: now, counts };
    return counts;
  } catch (e) {
    return _playsCache.counts || {};
  }
}

// Global download counts (KV "download-counts" map, keyed by gif id) — 60s isolate cache.
// Separate from play counts so the two counters stay independent.
let _downloadsCache = { at: 0, counts: null };
async function loadDownloads(env) {
  const kv = env && env.PLAYS_KV;
  if (!kv) return {};
  const now = Date.now();
  if (_downloadsCache.counts && now - _downloadsCache.at < 60000) return _downloadsCache.counts;
  try {
    const counts = (await kv.get('download-counts', 'json')) || {};
    _downloadsCache = { at: now, counts };
    return counts;
  } catch (e) {
    return _downloadsCache.counts || {};
  }
}

// Popular = static DB plays + live KV counts. Stable sort: ties keep the
// build-time trending order (no arbitrary id shuffle when counts are equal).
function popularSorted(pool, counts) {
  return pool.slice().sort((a, b) => {
    const pa = (a.pl || a.p || a.plays || 0) + (counts[recId(a)] || 0);
    const pb = (b.pl || b.p || b.plays || 0) + (counts[recId(b)] || 0);
    return pb - pa;
  });
}

// Memoized new-sort of the FULL pool — sorts by added_at DESC (newest batch
// first), then by reverse insertion order within the same batch. Stable.
let _newSortedSrc = null;
let _newSortedPool = null;
function newSorted(pool) {
  if (_newSortedSrc === pool && _newSortedPool) return _newSortedPool;
  // Build a position index so ties resolve in reverse-insertion order
  const pos = new Map();
  for (let i = 0; i < pool.length; i++) pos.set(pool[i], i);
  const arr = pool.slice().sort((a, b) => {
    const aa = a.a || a.added_at || 1;
    const bb = b.a || b.added_at || 1;
    if (aa !== bb) return bb - aa;          // higher added_at = newer = first
    return pos.get(b) - pos.get(a);          // within same batch, later in array = first
  });
  _newSortedSrc = pool;
  _newSortedPool = arr;
  return arr;
}

// Downloads sort — uses live KV download-counts. Stable: ties keep pool order.
function downloadsSorted(pool, counts) {
  return pool.slice().sort((a, b) => {
    const da = counts[recId(a)] || 0;
    const db = counts[recId(b)] || 0;
    return db - da;
  });
}

/* ---------- Live Giphy API (optional key) ---------- */

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

/* ---------- Category auto-matching for live search results ---------- */

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

function categoryPriority(cat) {
  const i = CAT_PRIORITY.indexOf(cat);
  return i === -1 ? 99 : i;
}

/* ---------- Request handler ---------- */

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

  // Categories endpoint — uses precomputed cat_counts when available
  if (params.get('categories') === '1') {
    const fb = await loadFallback(request);
    const gifs = fb.gifs || [];
    let counts = fb.cat_counts || null;
    if (!counts) {
      counts = {};
      for (const g of gifs) {
        const c = recCat(g);
        counts[c] = (counts[c] || 0) + 1;
      }
    }
    const cats = CATEGORY_DEFS.map(c => ({
      id: c.id,
      label_en: CAT_LABELS[c.id]?.en || c.id,
      label_ar: CAT_LABELS[c.id]?.ar || c.id,
      label_ro: CAT_LABELS[c.id]?.ro || c.id,
      count: counts[c.id] || (c.id === 'trending' ? (fb.total || gifs.length) : 0),
    })).filter(c => c.count > 0 || c.id === 'trending');
    return json({ ok: true, categories: cats, total: fb.total || gifs.length });
  }

  const limit = Math.min(parseInt(params.get('limit') || '24', 10), 50);
  const offset = parseInt(params.get('offset') || '0', 10);
  const search = (params.get('search') || '').trim();
  const catParam = (params.get('cat') || '').trim().toLowerCase();
  const sortParam = (params.get('sort') || '').trim().toLowerCase();
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
        // Live API has no global sort — apply to the returned page slice
        if (sortParam === 'name' || sortParam === 'popular') {
          const counts = sortParam === 'popular' ? await loadPlays(env) : null;
          gifs.sort((a, b) => {
            if (sortParam === 'name') {
              const an = (a.title || a.t || '').toLowerCase();
              const bn = (b.title || b.t || '').toLowerCase();
              return an < bn ? -1 : an > bn ? 1 : ((a.id||a.i) < (b.id||b.i) ? -1 : 1);
            }
            const pa = (a.plays || a.pl || a.p || 0) + (counts[a.id || a.i] || 0);
            const pb = (b.plays || b.pl || b.p || 0) + (counts[b.id || b.i] || 0);
            return pb - pa; // stable
          });
        }
        return json({
          ok: true, gifs,
          total: result.pagination?.total_count || gifs.length,
          offset, sort: sortParam || 'trending', source: 'giphy'
        }, 200, 60);
      }
    } catch (e) {
      console.error('Giphy API error:', e.message);
    }
  }

  // Fallback database (compact v3)
  const fb = await loadFallback(request);
  let pool = fb.gifs || [];
  if (pool.length === 0) {
    return json({ ok: false, gifs: [], total: 0, source: 'none', error: 'no_api_key_and_no_fallback' }, 200, 30);
  }

  if (catParam && CAT_PRIORITY.includes(catParam) && catParam !== 'trending') {
    // Explicit category filter
    pool = pool.filter(g => recCat(g) === catParam);
  } else if (search) {
    // If search matches a category id, treat as category browse
    const qLower = search.toLowerCase();
    if (CAT_PRIORITY.includes(qLower) && qLower !== 'trending') {
      pool = pool.filter(g => recCat(g) === qLower);
    } else {
      const terms = qLower.split(/\s+/).filter(Boolean);
      pool = pool.filter(g => {
        const text = searchText(g).toLowerCase();
        if (!text) return false;
        for (const t of terms) {
          if (!text.includes(t)) return false;
        }
        return true;
      });
      // Relevance: prefix matches first (stable)
      pool.sort((a, b) => {
        const ap = searchText(a).toLowerCase().startsWith(qLower) ? 0 : 1;
        const bp = searchText(b).toLowerCase().startsWith(qLower) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        // tie-break deterministic by id
        return (a.i || a.id || '') < (b.i || b.id || '') ? -1 : 1;
      });
    }
  }
  // trending: JSON is pre-sorted at build time — pure slice, no sort cost.
  // name/popular/new/downloads: sort the WHOLE pool server-side so every
  // pagination window stays globally ordered (client just appends pages in
  // arrival order).
  let cacheAge = 60;
  if (sortParam === 'name') {
    pool = nameSorted(pool);
    cacheAge = 300; // static data — safe to cache longer
  } else if (sortParam === 'popular') {
    const counts = await loadPlays(env);
    pool = popularSorted(pool, counts);
    cacheAge = 30; // counts evolve — keep short
  } else if (sortParam === 'new') {
    pool = newSorted(pool);
    cacheAge = 300; // added_at is static — safe to cache longer
  } else if (sortParam === 'downloads') {
    const dlCounts = await loadDownloads(env);
    pool = downloadsSorted(pool, dlCounts);
    cacheAge = 30; // counts evolve — keep short
  }

  const slice = pool.slice(offset, offset + limit).map(expandRecord);
  return json({
    ok: true,
    gifs: slice,
    total: pool.length,
    offset,
    sort: ['name','popular','new','downloads'].includes(sortParam) ? sortParam : 'trending',
    source: 'fallback'
  }, 200, cacheAge);
}
