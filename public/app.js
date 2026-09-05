/* ============================================================
   MyMemes GIF — Front-end application
   - 3 languages (AR / EN / RO) with RTL auto-switch
   - Light (default) + Dark theme, persisted in localStorage
   - Giphy-backed GIF browsing with curated fallback database
   - Per-GIF play counter (in-memory + localStorage + global sync)
   - Category filter · search · infinite scroll · lightbox
   ============================================================ */

/* ---------- Config ---------- */
const SOUNDS_SITE_URL = 'https://mymemes.pages.dev';
const PAGE_SIZE = 24;
const LS_KEY_THEME = 'mymemes_theme';
const LS_KEY_LANG = 'mymemes_lang';
const LS_KEY_PLAYS = 'mymemes_gif_plays';
const LS_KEY_LASTCAT = 'mymemes_gif_lastcat';
const LS_KEY_LASTSORT = 'mymemes_gif_lastsort';

/* ---------- i18n ---------- */
const I18N = {
  en: {
    siteName: 'MyMemes GIF',
    siteTagline: 'Animated Memes Library',
    soundsSite: 'Sounds',
    searchPlaceholder: 'Search GIFs…',
    gifsCount: 'GIFs',
    heroBadge: 'Watch. Copy. Share.',
    heroTitle: 'Explore the GIFs',
    heroSubtitle: 'Thousands of animated GIF memes across every category — reactions, animals, anime, movies, music and more.',
    heroSubtitleLine2: 'Watch, copy embed links, and share!',
    statGifs: 'GIFs',
    statCategories: 'Categories',
    statPlays: 'Plays',
    categoriesTitle: 'Categories',
    sortBy: 'Sort:',
    sortTrending: 'Trending',
    sortPopular: 'Popular',
    sortName: 'Name',
    noGifs: 'No GIFs found',
    emptySearch: 'Try a different keyword.',
    emptyCategory: 'No GIFs in this category yet.',
    clearSearch: 'Clear search',
    loadingMore: 'Loading more…',
    allLoaded: 'All GIFs loaded',
    gifsFrom: 'GIFs from',
    playsCount: 'plays',
    langName: 'English',
    catTrending: 'Trending', catReactions: 'Reactions', catAnimals: 'Animals', catAnime: 'Anime',
    catGaming: 'Gaming', catMovies: 'Movies', catMusic: 'Music', catSports: 'Sports',
    catMemes: 'Memes', catCartoons: 'Cartoons', catFood: 'Food', catNature: 'Nature',
    catTech: 'Tech', catLove: 'Love',
    btnWatch: 'Watch', btnCopy: 'Copy link', btnDownload: 'Download', btnShare: 'Share',
    copiedToast: 'GIF link copied to clipboard!',
    downloadToast: 'Download starting…',
    langShort: { en: 'EN', ar: 'ع', ro: 'RO' },
    resultsInfo: (n) => `${n} GIFs`,
  },
  ar: {
    siteName: 'ماي ميمز GIF',
    siteTagline: 'مكتبة الميمز المتحركة',
    soundsSite: 'الأصوات',
    searchPlaceholder: 'ابحث عن GIF…',
    gifsCount: 'صورة متحركة',
    heroBadge: 'شاهد. انسخ. شارك.',
    heroTitle: 'استكشف الصور المتحركة',
    heroSubtitle: 'آلاف الميمز المتحركة في كل قسم — ردود الأفعال، الحيوانات، الأنمي، الأفلام، الموسيقى والمزيد.',
    heroSubtitleLine2: 'شاهد، انسخ روابط التضمين، وشارك!',
    statGifs: 'صور متحركة',
    statCategories: 'أقسام',
    statPlays: 'مشاهدات',
    categoriesTitle: 'الأقسام',
    sortBy: 'ترتيب:',
    sortTrending: 'الرائج',
    sortPopular: 'الأكثر مشاهدة',
    sortName: 'الاسم',
    noGifs: 'لا توجد صور متحركة',
    emptySearch: 'جرّب كلمة بحث أخرى.',
    emptyCategory: 'لا توجد صور في هذا القسم بعد.',
    clearSearch: 'مسح البحث',
    loadingMore: 'جارٍ تحميل المزيد…',
    allLoaded: 'تم تحميل كل الصور',
    gifsFrom: 'الصور من',
    playsCount: 'مشاهدة',
    langName: 'العربية',
    catTrending: 'الرائج', catReactions: 'ردود الأفعال', catAnimals: 'حيوانات', catAnime: 'أنمي',
    catGaming: 'ألعاب', catMovies: 'أفلام', catMusic: 'موسيقى', catSports: 'رياضة',
    catMemes: 'ميمز', catCartoons: 'كرتون', catFood: 'طعام', catNature: 'طبيعة',
    catTech: 'تقنية', catLove: 'حب',
    btnWatch: 'شاهد', btnCopy: 'نسخ الرابط', btnDownload: 'تحميل', btnShare: 'مشاركة',
    copiedToast: 'تم نسخ رابط الصورة!',
    downloadToast: 'بدأ التحميل…',
    langShort: { en: 'EN', ar: 'ع', ro: 'RO' },
    resultsInfo: (n) => `${n} صورة`,
  },
  ro: {
    siteName: 'MyMemes GIF',
    siteTagline: 'Bibliotecă de meme-uri animate',
    soundsSite: 'Sunete',
    searchPlaceholder: 'Caută GIF-uri…',
    gifsCount: 'GIF-uri',
    heroBadge: 'Vizionează. Copiază. Distribuie.',
    heroTitle: 'Explorează GIF-urile',
    heroSubtitle: 'Mii de meme-uri animate în fiecare categorie — reacții, animale, anime, filme, muzică și altele.',
    heroSubtitleLine2: 'Vizionează, copiază linkurile și distribuie!',
    statGifs: 'GIF-uri',
    statCategories: 'Categorii',
    statPlays: 'Vizionări',
    categoriesTitle: 'Categorii',
    sortBy: 'Sortează:',
    sortTrending: 'Populare',
    sortPopular: 'Top',
    sortName: 'Nume',
    noGifs: 'Niciun GIF găsit',
    emptySearch: 'Încearcă alt cuvânt cheie.',
    emptyCategory: 'Niciun GIF în această categorie.',
    clearSearch: 'Șterge căutarea',
    loadingMore: 'Se încarcă mai multe…',
    allLoaded: 'Toate GIF-urile au fost încărcate',
    gifsFrom: 'GIF-uri de la',
    playsCount: 'vizionări',
    langName: 'Română',
    catTrending: 'Populare', catReactions: 'Reacții', catAnimals: 'Animale', catAnime: 'Anime',
    catGaming: 'Jocuri', catMovies: 'Filme', catMusic: 'Muzică', catSports: 'Sport',
    catMemes: 'Meme-uri', catCartoons: 'Desene', catFood: 'Mâncare', catNature: 'Natură',
    catTech: 'Tehnologie', catLove: 'Dragoste',
    btnWatch: 'Vizionează', btnCopy: 'Copiază link', btnDownload: 'Descarcă', btnShare: 'Distribuie',
    copiedToast: 'Linkul GIF a fost copiat!',
    downloadToast: 'Descărcarea a început…',
    langShort: { en: 'EN', ar: 'ع', ro: 'RO' },
    resultsInfo: (n) => `${n} GIF-uri`,
  },
};

/* ---------- State ---------- */
let state = {
  lang: localStorage.getItem(LS_KEY_LANG) || detectDefaultLang(),
  theme: localStorage.getItem(LS_KEY_THEME) || 'light',
  gifs: [],
  allGifsLoaded: false,
  offset: 0,
  total: 0,
  search: '',
  category: localStorage.getItem(LS_KEY_LASTCAT) || 'trending',
  sort: localStorage.getItem(LS_KEY_LASTSORT) || 'trending',
  loading: false,
  playingId: null,
  categories: [],
  globalPlays: {},
  localPlays: {},
};

function detectDefaultLang() {
  const nav = (navigator.language || 'en').toLowerCase();
  if (nav.startsWith('ar')) return 'ar';
  if (nav.startsWith('ro')) return 'ro';
  return 'en';
}

/* ---------- DOM helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/* ---------- Platform detection (Cloudflare vs Netlify) ---------- */
let PLAT = null;
async function detectPlatform() {
  try {
    const r = await fetch('/api/giphy?categories=1', { method: 'GET' }).catch(() => null);
    if (r && r.ok) { PLAT = 'cf'; return; }
  } catch (e) {}
  try {
    const r = await fetch('/.netlify/functions/giphy?categories=1', { method: 'GET' }).catch(() => null);
    if (r && r.ok) { PLAT = 'netlify'; return; }
  } catch (e) {}
  PLAT = 'cf';
}

function giphyEndpoint(params) {
  const qs = new URLSearchParams(params).toString();
  return PLAT === 'netlify'
    ? `/.netlify/functions/giphy?${qs}`
    : `/api/giphy?${qs}`;
}
function playsEndpoint() {
  return PLAT === 'netlify' ? '/.netlify/functions/plays' : '/api/plays';
}
function downloadEndpoint() {
  return PLAT === 'netlify' ? '/.netlify/functions/download' : '/download';
}

/* ---------- Local plays storage ---------- */
function loadLocalPlays() {
  try {
    state.localPlays = JSON.parse(localStorage.getItem(LS_KEY_PLAYS) || '{}');
  } catch (e) { state.localPlays = {}; }
}
function saveLocalPlays() {
  try { localStorage.setItem(LS_KEY_PLAYS, JSON.stringify(state.localPlays)); } catch (e) {}
}

function effectivePlays(gifId, basePlays) {
  const local = state.localPlays[gifId] || 0;
  const global = state.globalPlays[gifId] || 0;
  return Math.max(basePlays || 0, local, global);
}

function registerPlay(gif) {
  const id = gif.id;
  state.localPlays[id] = (state.localPlays[id] || 0) + 1;
  saveLocalPlays();
  // Fire-and-forget global increment
  fetch(playsEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: id })
  }).catch(() => {});
  // Update UI immediately
  const card = document.querySelector(`.gif-card[data-id="${id}"]`);
  if (card) {
    const playsEl = card.querySelector('.gif-card-plays-count');
    if (playsEl) {
      playsEl.textContent = formatNumber(effectivePlays(id, gif.plays) + 1);
    }
    card.classList.add('playing');
    setTimeout(() => card.classList.remove('playing'), 2500);
  }
}

function formatNumber(n) {
  n = Number(n) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K';
  return String(n);
}

/* ---------- Global plays sync ---------- */
async function syncGlobalPlays() {
  try {
    const r = await fetch(playsEndpoint(), { method: 'GET' });
    if (!r.ok) return;
    const data = await r.json();
    if (data && data.counts) {
      state.globalPlays = data.counts;
      let total = 0;
      for (const k of Object.keys(data.counts)) total += data.counts[k];
      const footer = $('#footer-plays');
      if (footer) footer.textContent = formatNumber(total);
      const heroStat = $('#stat-plays');
      if (heroStat) heroStat.textContent = formatNumber(total);
    }
  } catch (e) {}
}

/* ---------- Theme ---------- */
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(LS_KEY_THEME, theme); } catch (e) {}
}
function initTheme() {
  const saved = localStorage.getItem(LS_KEY_THEME) || 'light';
  applyTheme(saved);
  $('#theme-btn').addEventListener('click', () => {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  });
}

/* ---------- Language ---------- */
function applyLang(lang) {
  state.lang = lang;
  const dict = I18N[lang] || I18N.en;
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    if (dict[k] != null) el.textContent = dict[k];
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const k = el.getAttribute('data-i18n-ph');
    if (dict[k] != null) el.setAttribute('placeholder', dict[k]);
  });
  document.querySelector('.lang-current-label').textContent = dict.langName;
  try { localStorage.setItem(LS_KEY_LANG, lang); } catch (e) {}
  // Re-render categories with translated labels
  renderCategories();
  // Update results info text
  updateResultsInfo();
}

function buildLangSwitcher() {
  const btn = $('#lang-btn');
  const dropdown = $('#lang-dropdown');
  if (!btn || !dropdown) return;
  const langs = [
    { code: 'en', name: 'English', flag: 'EN' },
    { code: 'ar', name: 'العربية', flag: 'ع' },
    { code: 'ro', name: 'Română', flag: 'RO' },
  ];
  dropdown.innerHTML = '';
  langs.forEach(l => {
    const item = document.createElement('button');
    item.className = 'lang-item';
    item.setAttribute('data-lang', l.code);
    item.innerHTML = `<span class="lang-flag">${l.flag}</span> ${l.name}`;
    item.addEventListener('click', () => {
      applyLang(l.code);
      dropdown.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    });
    dropdown.appendChild(item);
  });
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !dropdown.hidden;
    dropdown.hidden = open;
    btn.setAttribute('aria-expanded', String(!open));
  });
  document.addEventListener('click', (e) => {
    if (!$('#lang-switcher').contains(e.target)) {
      dropdown.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ---------- Categories ---------- */
async function fetchCategories() {
  try {
    const r = await fetch(giphyEndpoint({ categories: '1' }));
    if (!r.ok) return [];
    const data = await r.json();
    return data.categories || [];
  } catch (e) { return []; }
}

function catLabel(catId) {
  const dict = I18N[state.lang] || I18N.en;
  const k = 'cat' + catId.charAt(0).toUpperCase() + catId.slice(1);
  return dict[k] || catId;
}

function renderCategories() {
  const list = $('#category-list');
  if (!list) return;
  list.innerHTML = '';
  // Always include "Trending" first
  const cats = [{ id: 'trending', count: state.total || state.gifs.length }];
  state.categories.forEach(c => {
    if (c.id !== 'trending') cats.push(c);
  });
  cats.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn' + (state.category === c.id ? ' active' : '');
    btn.setAttribute('data-cat', c.id);
    btn.innerHTML = `<span>${catLabel(c.id)}</span>${c.count != null ? `<span class="cat-count">${c.count}</span>` : ''}`;
    btn.addEventListener('click', () => {
      state.category = c.id;
      try { localStorage.setItem(LS_KEY_LASTCAT, c.id); } catch (e) {}
      $$('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      resetAndLoad();
    });
    list.appendChild(btn);
  });
}

/* ---------- Fetch GIFs ---------- */
async function fetchGifs(opts = {}) {
  const { offset = 0, search = '', category = 'trending' } = opts;
  const params = { limit: String(PAGE_SIZE), offset: String(offset) };
  if (search) {
    params.search = search;
  } else if (category && category !== 'trending') {
    // Explicit category filter (server-side, filters the cat field)
    params.cat = category;
  } else {
    params.trending = '1';
  }
  const r = await fetch(giphyEndpoint(params));
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return await r.json();
}

/* ---------- Render GIF cards ---------- */
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function renderGifCard(gif) {
  const dict = I18N[state.lang] || I18N.en;
  const card = document.createElement('div');
  card.className = 'sound-card gif-card';
  card.setAttribute('data-id', gif.id);
  card.setAttribute('data-cat', gif.cat || 'trending');

  const plays = effectivePlays(gif.id, gif.plays);
  const title = escapeHtml(gif.title || 'GIF');
  const cat = gif.cat || 'trending';

  card.innerHTML = `
    <div class="gif-thumb-wrap">
      <img class="gif-thumb" loading="lazy" alt="${title}"
           src="${gif.preview || gif.thumb || gif.url}"
           data-src="${gif.thumb || gif.url}"
           onerror="this.onerror=null;this.src='${gif.url}';">
      <div class="gif-overlay">
        <span class="gif-badge-gif">GIF</span>
        <span class="gif-badge-live"><span class="live-dot"></span>${dict.btnWatch}</span>
      </div>
    </div>
    <div class="gif-card-info">
      <div class="gif-card-title" title="${title}">${title}</div>
      <div class="gif-card-meta">
        <span class="gif-card-cat">${escapeHtml(catLabel(cat))}</span>
        <span class="gif-card-plays">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          <span class="gif-card-plays-count">${formatNumber(plays)}</span>
        </span>
      </div>
    </div>
    <div class="gif-actions">
      <button class="gif-action primary gif-watch" title="${dict.btnWatch}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
      </button>
      <button class="gif-action gif-copy" title="${dict.btnCopy}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
      </button>
      <button class="gif-action gif-download" title="${dict.btnDownload}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
      </button>
    </div>
  `;

  // Wire up buttons
  card.querySelector('.gif-watch').addEventListener('click', (e) => {
    e.stopPropagation();
    registerPlay(gif);
    openLightbox(gif);
  });
  card.querySelector('.gif-thumb-wrap').addEventListener('click', () => {
    registerPlay(gif);
    openLightbox(gif);
  });
  card.querySelector('.gif-copy').addEventListener('click', (e) => {
    e.stopPropagation();
    copyToClipboard(gif.url);
    e.currentTarget.classList.add('copied');
    setTimeout(() => e.currentTarget.classList.remove('copied'), 1500);
    showToast(dict.copiedToast);
  });
  card.querySelector('.gif-download').addEventListener('click', (e) => {
    e.stopPropagation();
    downloadGif(gif);
  });

  // Lazy-load full GIF on hover (desktop)
  card.addEventListener('mouseenter', () => {
    const img = card.querySelector('.gif-thumb');
    const fullSrc = img.getAttribute('data-src');
    if (fullSrc && img.src !== fullSrc) img.src = fullSrc;
  }, { once: true });

  return card;
}

/* ---------- Lightbox ---------- */
let lightboxEl = null;
function ensureLightbox() {
  if (lightboxEl) return lightboxEl;
  lightboxEl = document.createElement('div');
  lightboxEl.className = 'lightbox';
  lightboxEl.innerHTML = `
    <div class="lightbox-inner">
      <button class="lightbox-close" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
      <img class="lightbox-img" alt="">
      <div class="lightbox-body">
        <div class="lightbox-title"></div>
        <div class="lightbox-actions"></div>
      </div>
    </div>
  `;
  document.body.appendChild(lightboxEl);
  lightboxEl.addEventListener('click', (e) => {
    if (e.target === lightboxEl || e.target.closest('.lightbox-close')) {
      closeLightbox();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
  return lightboxEl;
}

function openLightbox(gif) {
  const dict = I18N[state.lang] || I18N.en;
  const lb = ensureLightbox();
  lb.querySelector('.lightbox-img').src = gif.url;
  lb.querySelector('.lightbox-img').alt = gif.title || 'GIF';
  lb.querySelector('.lightbox-title').textContent = gif.title || 'GIF';
  const actions = lb.querySelector('.lightbox-actions');
  actions.innerHTML = '';
  // Copy
  const copyBtn = document.createElement('button');
  copyBtn.className = 'gif-action primary';
  copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> ${dict.btnCopy}`;
  copyBtn.addEventListener('click', () => { copyToClipboard(gif.url); showToast(dict.copiedToast); });
  actions.appendChild(copyBtn);
  // Download
  const dlBtn = document.createElement('button');
  dlBtn.className = 'gif-action';
  dlBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> ${dict.btnDownload}`;
  dlBtn.addEventListener('click', () => downloadGif(gif));
  actions.appendChild(dlBtn);
  // Share
  if (navigator.share) {
    const shareBtn = document.createElement('button');
    shareBtn.className = 'gif-action';
    shareBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg> ${dict.btnShare}`;
    shareBtn.addEventListener('click', async () => {
      try { await navigator.share({ title: gif.title || 'MyMemes GIF', url: gif.url }); } catch (e) {}
    });
    actions.appendChild(shareBtn);
  }
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  if (!lightboxEl) return;
  lightboxEl.classList.remove('open');
  document.body.style.overflow = '';
  const img = lightboxEl.querySelector('.lightbox-img');
  if (img) img.src = '';
}

/* ---------- Toast ---------- */
let toastEl = null, toastTimer = null;
function showToast(msg) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2500);
}

/* ---------- Clipboard ---------- */
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch (e) {}
  // Fallback
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
}

/* ---------- Download ---------- */
function downloadGif(gif) {
  const dict = I18N[state.lang] || I18N.en;
  const name = (gif.slug || gif.title || 'mymemes-gif').replace(/[^\w\-]+/g, '-').slice(0, 60);
  // Use our download proxy to force attachment
  const url = `${downloadEndpoint()}?url=${encodeURIComponent(gif.url)}&name=${encodeURIComponent(name)}`;
  // Open in new tab — browser will start download
  const a = document.createElement('a');
  a.href = url;
  a.download = name + '.gif';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast(dict.downloadToast);
}

/* ---------- Sort ---------- */
function sortGifs(gifs) {
  const arr = [...gifs];
  if (state.sort === 'name') {
    arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  } else if (state.sort === 'popular') {
    arr.sort((a, b) => effectivePlays(b.id, b.plays) - effectivePlays(a.id, a.plays));
  }
  // 'trending' = original order from API
  return arr;
}

function initSortButtons() {
  $$('.sort-btn').forEach(btn => {
    if (btn.getAttribute('data-sort') === state.sort) btn.classList.add('active');
    btn.addEventListener('click', () => {
      $$('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.sort = btn.getAttribute('data-sort');
      try { localStorage.setItem(LS_KEY_LASTSORT, state.sort); } catch (e) {}
      // Re-sort existing GIFs without refetching
      state.gifs = sortGifs(state.gifs);
      renderGifs(true);
    });
  });
}

/* ---------- Rendering ---------- */
function renderGifs(replace = false) {
  const grid = $('#sounds-grid');
  if (!grid) return;
  if (replace) {
    // Full rebuild (first load, category/search/sort change)
    grid.innerHTML = '';
    state.gifs.forEach(gif => grid.appendChild(renderGifCard(gif)));
  } else {
    // Incremental append: only add cards that are NOT already in the DOM.
    // Appending the whole array here used to re-attach every previously
    // rendered card on each new page — the "duplicates when scrolling" bug.
    const already = grid.children.length;
    if (already < state.gifs.length) {
      const frag = document.createDocumentFragment();
      for (let i = already; i < state.gifs.length; i++) {
        frag.appendChild(renderGifCard(state.gifs[i]));
      }
      grid.appendChild(frag);
    }
  }
  // Toggle empty state
  const empty = $('#empty-state');
  if (state.gifs.length === 0) {
    empty.hidden = false;
    const msg = $('#empty-msg');
    if (msg) msg.textContent = state.search ? (I18N[state.lang]||I18N.en).emptySearch : (I18N[state.lang]||I18N.en).emptyCategory;
    $('#clear-search-btn').hidden = !state.search;
  } else {
    empty.hidden = true;
  }
  // Loaded count
  const lc = $('#loaded-count');
  if (lc) lc.textContent = state.gifs.length;
  // All-loaded indicator
  const allLoaded = $('#all-loaded');
  const loadingMore = $('#loading-more');
  if (allLoaded && loadingMore) {
    if (state.allGifsLoaded) {
      allLoaded.hidden = false;
      loadingMore.hidden = true;
    } else {
      allLoaded.hidden = true;
    }
  }
  updateResultsInfo();
  // Update hero stat
  const statGifs = $('#stat-gifs');
  if (statGifs) statGifs.textContent = formatNumber(state.total || state.gifs.length);
  const headerCount = $('#header-count');
  if (headerCount) headerCount.textContent = formatNumber(state.total || state.gifs.length);
}

function updateResultsInfo() {
  const el = $('#results-info');
  if (!el) return;
  const dict = I18N[state.lang] || I18N.en;
  el.textContent = dict.resultsInfo(state.total || state.gifs.length);
}

function showSkeletons(show) {
  const sk = $('#loading-skeleton');
  if (sk) sk.hidden = !show;
  const grid = $('#sounds-grid');
  if (grid && show) grid.innerHTML = '';
}

/* ---------- Loading orchestration ---------- */
async function loadNextPage() {
  if (state.loading || state.allGifsLoaded) return;
  state.loading = true;
  $('#loading-more').hidden = false;
  let orderChanged = false;
  try {
    const data = await fetchGifs({ offset: state.offset, search: state.search, category: state.category });
    if (!data || !data.ok) {
      state.allGifsLoaded = true;
    } else {
      const newGifs = data.gifs || [];
      state.total = data.total || state.total;
      if (newGifs.length === 0) {
        state.allGifsLoaded = true;
      } else {
        // Dedupe by id (guards against server-side order shifts between pages)
        const seen = new Set(state.gifs.map(g => g.id));
        const fresh = newGifs.filter(g => !seen.has(g.id));
        state.gifs = state.gifs.concat(fresh);
        // Advance by what the server actually returned — advancing by fresh.length
        // would re-fetch overlapping windows and stall near the tail.
        state.offset += newGifs.length;
        if (state.sort !== 'trending') {
          // keep the active sort applied across appended pages — the array is
          // re-sorted GLOBALLY, so the DOM must be rebuilt (not incrementally
          // appended) to reflect the new order.
          state.gifs = sortGifs(state.gifs);
          orderChanged = true;
        }
        if (newGifs.length < PAGE_SIZE || state.offset >= state.total) {
          state.allGifsLoaded = true;
        }
      }
    }
    renderGifs(orderChanged);
  } catch (e) {
    console.error('loadNextPage error:', e);
    state.allGifsLoaded = true;
  } finally {
    state.loading = false;
    $('#loading-more').hidden = true;
  }
}

async function resetAndLoad() {
  state.gifs = [];
  state.offset = 0;
  state.total = 0;
  state.allGifsLoaded = false;
  state.loading = false;
  showSkeletons(true);
  renderGifs(true);
  await loadNextPage();
  showSkeletons(false);
}

/* ---------- Search ---------- */
function initSearch() {
  const inputs = [$('#search'), $('#search-mobile')].filter(Boolean);
  let searchTimer = null;
  inputs.forEach(input => {
    input.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      // Sync other input
      inputs.forEach(other => { if (other !== e.target) other.value = val; });
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.search = val;
        resetAndLoad();
      }, 350);
    });
  });

  const clearBtn = $('#clear-search-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      inputs.forEach(i => i.value = '');
      state.search = '';
      resetAndLoad();
    });
  }
}

/* ---------- Infinite scroll ---------- */
function initInfiniteScroll() {
  const trigger = $('#load-more-trigger');
  if (!trigger) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !state.loading && !state.allGifsLoaded) {
        loadNextPage();
      }
    });
  }, { rootMargin: '400px' });
  obs.observe(trigger);
}

/* ---------- Mobile menu toggle ---------- */
function initMobileMenu() {
  const btn = $('#menu-toggle');
  const search = $('#mobile-search');
  if (!btn || !search) return;
  btn.addEventListener('click', () => {
    search.hidden = !search.hidden;
  });
}

/* ---------- Switch-site button ---------- */
function initSwitchSite() {
  const btn = $('#switch-site-btn');
  if (!btn) return;
  // Already a hyperlink in HTML, but ensure click works on touch
  btn.addEventListener('click', (e) => {
    // Allow normal anchor navigation
  });
}

/* ---------- Init ---------- */
async function init() {
  loadLocalPlays();
  initTheme();
  buildLangSwitcher();
  applyLang(state.lang);
  initSortButtons();
  initSearch();
  initInfiniteScroll();
  initMobileMenu();
  initSwitchSite();
  await detectPlatform();
  state.categories = await fetchCategories();
  renderCategories();
  // Sync global plays before first render so counts are accurate
  await syncGlobalPlays();
  // Periodic sync every 30s
  setInterval(syncGlobalPlays, 30000);
  // Initial load
  await resetAndLoad();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
