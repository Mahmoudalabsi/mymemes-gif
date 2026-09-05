/**
 * Cloudflare Pages Function — Giphy Proxy
 * ============================================
 * Forwards Giphy API requests with the server-side API key (env.GIPHY_API_KEY).
 * If the key is missing OR Giphy returns an error, gracefully falls back to the
 * curated static fallback-gifs.json (direct CDN URLs, no API key needed).
 *
 * Endpoints:
 *   GET /api/giphy?trending=1&offset=0&limit=24
 *   GET /api/giphy?search=QUERY&offset=0&limit=24
 *   GET /api/giphy?categories=1
 */

const FALLBACK_URL = 'https://raw.githubusercontent.com/Mahmoudalabsi/mymemes-gif/main/public/data/fallback-gifs.json';
// In Cloudflare Pages, the fallback file is also served locally:
//   /data/fallback-gifs.json  (works in dev and prod)
// We use the asset binding via context.env.ASSETS if available, else fetch from raw GitHub.

const CATEGORY_DEFS = [
  { id: 'trending',   label_en: 'Trending',   label_ar: 'الرائج',         label_ro: 'Populare' },
  { id: 'reactions',  label_en: 'Reactions',  label_ar: 'ردود الأفعال',    label_ro: 'Reacții' },
  { id: 'animals',    label_en: 'Animals',    label_ar: 'حيوانات',         label_ro: 'Animale' },
  { id: 'anime',      label_en: 'Anime',      label_ar: 'أنمي',            label_ro: 'Anime' },
  { id: 'gaming',     label_en: 'Gaming',     label_ar: 'ألعاب',           label_ro: 'Jocuri' },
  { id: 'movies',     label_en: 'Movies',     label_ar: 'أفلام',           label_ro: 'Filme' },
  { id: 'music',      label_en: 'Music',      label_ar: 'موسيقى',          label_ro: 'Muzică' },
  { id: 'sports',     label_en: 'Sports',     label_ar: 'رياضة',           label_ro: 'Sport' },
  { id: 'memes',      label_en: 'Memes',      label_ar: 'ميمز',            label_ro: 'Meme-uri' },
  { id: 'cartoons',   label_en: 'Cartoons',   label_ar: 'كرتون',           label_ro: 'Desene' },
  { id: 'food',       label_en: 'Food',       label_ar: 'طعام',            label_ro: 'Mâncare' },
  { id: 'nature',     label_en: 'Nature',     label_ar: 'طبيعة',           label_ro: 'Natură' },
  { id: 'tech',       label_en: 'Tech',       label_ar: 'تقنية',           label_ro: 'Tehnologie' },
  { id: 'love',       label_en: 'Love',       label_ar: 'حب',              label_ro: 'Dragoste' },
];

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
  // Try local asset first via the request URL
  try {
    const url = new URL(request.url);
    const localUrl = `${url.origin}/data/fallback-gifs.json`;
    const r = await fetch(localUrl);
    if (r.ok) return await r.json();
  } catch (e) {}
  // Then try GitHub raw
  try {
    const r = await fetch(FALLBACK_URL, { cf: { cacheTtl: 3600 } });
    if (r.ok) return await r.json();
  } catch (e) {}
  return { gifs: [], total: 0, categories: [] };
}

function transformGiphyItem(item) {
  const id = item.id || '';
  const title = (item.title || 'GIF').trim();
  // Extract slug from bitly or url field
  let slug = item.slug || (item.url ? item.url.replace(/^\/?gifs\//, '') : id);
  // Strip trailing ID from slug
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

  // Categories endpoint — always works
  if (params.get('categories') === '1') {
    const fb = await loadFallback(request);
    const cats = CATEGORY_DEFS.map(c => ({
      ...c,
      count: fb.gifs ? fb.gifs.filter(g => g.cat === c.id).length : 0
    })).filter(c => c.count > 0 || c.id === 'trending');
    return json({ ok: true, categories: cats });
  }

  const limit = Math.min(parseInt(params.get('limit') || '24', 10), 50);
  const offset = parseInt(params.get('offset') || '0', 10);
  const search = params.get('search') || '';
  const trending = params.get('trending') === '1' || (!search && !params.get('categories'));

  // Try Giphy API first
  if (env?.GIPHY_API_KEY) {
    try {
      const result = search
        ? await callGiphy(env, 'gifs/search', { q: search, limit, offset, rating: 'pg', lang: 'en' })
        : trending
          ? await callGiphy(env, 'gifs/trending', { limit, offset, rating: 'pg' })
          : null;
      if (result && Array.isArray(result.data) && result.data.length > 0) {
        const gifs = result.data.map(transformGiphyItem);
        // For search results, derive category from search term by reusing CATEGORY_RULES keyword match
        const slugLower = search.toLowerCase();
        const cat = matchCategory(slugLower);
        gifs.forEach(g => g.cat = cat);
        return json({
          ok: true,
          gifs,
          total: result.pagination?.total_count || gifs.length,
          offset,
          source: 'giphy'
        }, 200, 60);
      }
    } catch (e) {
      console.error('Giphy API error:', e.message);
    }
  }

  // Fall back to curated static database
  const fb = await loadFallback(request);
  if (!fb.gifs || fb.gifs.length === 0) {
    return json({ ok: false, gifs: [], total: 0, source: 'none', error: 'no_api_key_and_no_fallback' }, 200, 30);
  }

  let pool = fb.gifs;
  // Filter
  if (search) {
    const q = search.toLowerCase();
    pool = pool.filter(g =>
      g.title.toLowerCase().includes(q) ||
      g.slug.toLowerCase().includes(q) ||
      (g.tags || []).some(t => t.toLowerCase().includes(q))
    );
  } else if (trending) {
    // "trending" in fallback = all sorted by category priority
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

const CAT_PRIORITY = ['trending', 'reactions', 'memes', 'animals', 'anime', 'gaming', 'cartoons', 'movies', 'music', 'sports', 'food', 'nature', 'tech', 'love'];

function categoryPriority(cat) {
  const i = CAT_PRIORITY.indexOf(cat);
  return i === -1 ? 99 : i;
}

const CAT_KEYWORDS = CATEGORY_DEFS.map(c => c.id).filter(c => c !== 'trending').flatMap(cat => {
  const map = {
    reactions: ['laugh', 'cry', 'sad', 'happy', 'shock', 'angry', 'love', 'heart', 'wow', 'omg', 'facepalm', 'smile', 'wink', 'thumbs', 'clap', 'dance', 'wave', 'nod', 'shrug', 'sigh', 'bored', 'confused', 'scared', 'excited', 'tired', 'hungry', 'sick', 'yawn', 'lol', 'lmao'],
    animals: ['cat', 'dog', 'puppy', 'kitten', 'horse', 'cow', 'pig', 'bird', 'fish', 'shark', 'snake', 'frog', 'rabbit', 'panda', 'bear', 'fox', 'wolf', 'lion', 'tiger', 'monkey', 'elephant', 'dino', 'duck', 'owl', 'penguin'],
    anime: ['anime', 'manga', 'kawaii', 'senpai', 'waifu', 'mecha', 'gundam', 'pokemon', 'naruto', 'ghibli'],
    gaming: ['game', 'gaming', 'arcade', 'nintendo', 'playstation', 'xbox', 'minecraft', 'mario', 'zelda', 'sonic'],
    movies: ['movie', 'film', 'cinema', 'marvel', 'batman', 'superman', 'spiderman', 'avengers', 'star-wars', 'harry-potter'],
    music: ['music', 'song', 'dance', 'singing', 'guitar', 'drum', 'piano', 'concert', 'dj', 'rap', 'rock', 'metal', 'pop', 'jazz'],
    sports: ['sport', 'football', 'soccer', 'basketball', 'baseball', 'tennis', 'hockey', 'golf', 'boxing', 'mma', 'wrestling', 'wwe', 'ufc', 'skate', 'snowboard', 'ski', 'surf', 'swim', 'cycling', 'gym', 'goal', 'slam-dunk', 'touchdown'],
    memes: ['meme', 'dank', 'viral', 'tiktok', 'instagram', 'twitter', 'facebook', 'youtube', 'funny', 'lol', 'joke', 'comedy', 'spongebob', 'rick-roll'],
    cartoons: ['cartoon', 'rick', 'morty', 'simpsons', 'family-guy', 'south-park', 'spongebob', 'adventure-time', 'futurama', 'avatar', 'steven-universe'],
    food: ['food', 'pizza', 'burger', 'taco', 'sushi', 'ramen', 'cake', 'cookie', 'donut', 'coffee', 'tea', 'beer', 'wine', 'chocolate', 'ice-cream'],
    nature: ['nature', 'mountain', 'ocean', 'sea', 'beach', 'sunset', 'sunrise', 'rain', 'snow', 'storm', 'cloud', 'sky', 'star', 'galaxy', 'space', 'forest', 'tree', 'flower', 'waterfall', 'rainbow'],
    tech: ['tech', 'computer', 'laptop', 'phone', 'internet', 'wifi', 'coding', 'programmer', 'ai', 'robot', 'cyber', 'hacker', 'crypto', 'bitcoin'],
    love: ['love', 'heart', 'kiss', 'hug', 'romance', 'romantic', 'cupid', 'valentine', 'wedding', 'marriage', 'couple', 'relationship'],
  };
  return (map[cat] || []).map(kw => ({ kw, cat }));
});

function matchCategory(text) {
  const t = (text || '').toLowerCase();
  for (const { kw, cat } of CAT_KEYWORDS) {
    if (t.includes(kw)) return cat;
  }
  return 'trending';
}
