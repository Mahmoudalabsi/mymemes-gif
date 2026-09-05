// Plays counter — global persistent counter using Netlify Blobs.
// GET  /.netlify/functions/plays                 -> { ok, counts: {slug: n, ...} } (only non-zero)
// POST /.netlify/functions/plays  {slug:"x"}    -> { ok, plays: n }  (increments)
// If Netlify Blobs is unavailable, falls back to an in-memory Map so the
// frontend still receives a valid response (per-instance counts).

let blobStore = null;
try {
  const { getStore } = require('@netlify/blobs');
  blobStore = getStore({ name: 'play-counts', consistency: 'strong' });
} catch (err) {
  console.error('[plays] Netlify Blobs unavailable, using memory fallback:', err.message);
}

// In-memory fallback (best effort, per lambda instance)
const memory = {};

const json = (statusCode, obj) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  },
  body: JSON.stringify(obj),
});

const readCounts = async () => {
  if (blobStore) {
    try {
      const data = await blobStore.get('counts', { type: 'json' });
      if (data && typeof data === 'object') return data;
    } catch (err) {
      console.error('[plays] blobs read failed:', err.message);
    }
  }
  return { ...memory };
};

const writeCounts = async (counts) => {
  if (blobStore) {
    try {
      await blobStore.setJSON('counts', counts);
      return true;
    } catch (err) {
      console.error('[plays] blobs write failed:', err.message);
    }
  }
  return false;
};

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') return json(204, {});

  try {
    // ---- GET: return all non-zero counts ----
    if (event.httpMethod === 'GET') {
      const counts = await readCounts();
      return json(200, { ok: true, counts });
    }

    // ---- POST: increment one slug ----
    if (event.httpMethod === 'POST') {
      let slug = null;
      try {
        const body = JSON.parse(event.body || '{}');
        slug = body && body.slug;
      } catch (e) { /* invalid json */ }

      if (!slug || typeof slug !== 'string' || !/^[A-Za-z0-9._-]{1,120}$/.test(slug)) {
        return json(400, { ok: false, error: 'invalid slug' });
      }

      const counts = await readCounts();
      counts[slug] = (counts[slug] || 0) + 1;
      await writeCounts(counts);

      // keep memory fallback in sync too
      memory[slug] = (memory[slug] || 0) + 1;

      return json(200, { ok: true, plays: counts[slug] });
    }

    return json(405, { ok: false, error: 'method not allowed' });
  } catch (err) {
    console.error('[plays] handler error:', err.message);
    // Graceful degradation — never break the frontend
    return json(200, { ok: false, counts: { ...memory } });
  }
};
