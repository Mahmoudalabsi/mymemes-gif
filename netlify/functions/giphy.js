/**
 * Netlify Function — Giphy proxy mirror (v3: compact big database).
 * Same logic as functions/api/giphy.js with Netlify handler signature.
 * Compact records expanded on serve; JSON pre-sorted at build time.
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
  return {
    statusCode: status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'Content-Type',
      'cache-control': `public, max-age=${cacheMaxAge}, s-maxage=${cacheMaxAge * 6}`,
    },
    body: JSON.stringify(data),
  };
}

const FALLBACK_URL = 'https://raw.githubusercontent.com/Mahmoudalabsi/mymemes-gif/main/public/data/fallback-gifs.json';

async function loadFallback() {
  if (_fallbackPromise) return _fallbackPromise;
  _fallbackPromise = (async () => {
    try {
      const r = await fetch(`${FALLBACK_URL}?t=${Date.now()}`);
      if (r.ok) return await r.json();
    } catch (e) {}
    try {
      const r = await fetch('/data/fallback-gifs.json');
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

// Search text per record — supports BOTH storage formats (compact v3 and
// legacy full). See functions/api/giphy.js for the regression note.
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

// Memoized name-sort of the FULL pool (see functions/api/giphy.js)
let _nameSortedSrc = null;
let _nameSortedPool = null;
function nameSorted(pool) {
  if (_nameSortedSrc === pool && _nameSortedPool) return _nameSortedPool;
  const arr = pool.slice().sort((a, b) => {
    const an = recNameText(a).toLowerCase();
    const bn = recNameText(b).toLowerCase();
    if (an !== bn) return an < bn ? -1 : 1;
    return recId(a) < recId(b) ? -1 : 1;
  });
  _nameSortedSrc = pool;
  _nameSortedPool = arr;
  return arr;
}

// Play counts from Netlify Blobs (same "play-counts" store the plays mirror
// writes to) — 60s cache; degrades to static plays if blobs unavailable.
let _blobStore = null;
let _blobStoreTried = false;
async function getBlobStore() {
  if (_blobStoreTried) return _blobStore;
  _blobStoreTried = true;
  try {
    const { getStore } = await import('@netlify/blobs');
    _blobStore = getStore({ name: 'play-counts', consistency: 'strong' });
  } catch (e) { _blobStore = null; }
  return _blobStore;
}

let _playsCache = { at: 0, counts: null };
async function loadPlays() {
  const now = Date.now();
  if (_playsCache.counts && now - _playsCache.at < 60000) return _playsCache.counts;
  try {
    const store = await getBlobStore();
    if (store) {
      const counts = (await store.get('counts', { type: 'json' })) || {};
      _playsCache = { at: now, counts };
      return counts;
    }
  } catch (e) { /* fall through */ }
  return _playsCache.counts || {};
}

// Popular = static DB plays + live counts. Stable sort: ties keep the
// build-time trending order.
function popularSorted(pool, counts) {
  return pool.slice().sort((a, b) => {
    const pa = (a.p || 0) + (counts[recId(a)] || 0);
    const pb = (b.p || 0) + (counts[recId(b)] || 0);
    return pb - pa;
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
  const r = await fetch(url.toString());
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

export async function handler(event) {
  const env = process.env;
  const q = event.queryStringParameters || {};
  const params = new URLSearchParams(q);
  const method = event.httpMethod || 'GET';

  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, OPTIONS',
        'access-control-allow-headers': 'Content-Type',
      },
      body: '',
    };
  }

  // Categories endpoint — uses precomputed cat_counts when available
  if (params.get('categories') === '1') {
    const fb = await loadFallback();
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
          const counts = sortParam === 'popular' ? await loadPlays() : null;
          gifs.sort((a, b) => {
            if (sortParam === 'name') {
              const an = (a.title || '').toLowerCase();
              const bn = (b.title || '').toLowerCase();
              return an < bn ? -1 : an > bn ? 1 : (a.id < b.id ? -1 : 1);
            }
            const pa = (a.plays || 0) + (counts[a.id] || 0);
            const pb = (b.plays || 0) + (counts[b.id] || 0);
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
  const fb = await loadFallback();
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
  // name/popular: sort the WHOLE pool server-side so pagination stays ordered.
  let cacheAge = 60;
  if (sortParam === 'name') {
    pool = nameSorted(pool);
    cacheAge = 300;
  } else if (sortParam === 'popular') {
    const counts = await loadPlays();
    pool = popularSorted(pool, counts);
    cacheAge = 30;
  }

  const slice = pool.slice(offset, offset + limit).map(expandRecord);
  return json({
    ok: true,
    gifs: slice,
    total: pool.length,
    offset,
    sort: sortParam === 'name' || sortParam === 'popular' ? sortParam : 'trending',
    source: 'fallback'
  }, 200, cacheAge);
}
