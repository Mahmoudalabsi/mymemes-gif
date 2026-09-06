/**
 * Cloudflare Pages Function — global persistent downloads counter.
 * Route:  GET  /api/downloads            -> { ok, counts: {slug: n, ...} }
 *         POST /api/downloads {slug}     -> { ok, downloads: n }  (increments)
 *
 * Storage: Cloudflare KV namespace bound as env.PLAYS_KV (see wrangler.toml).
 * A single "download-counts" key holds the whole {slug: n} map — kept separate
 * from the play-counts key in the same KV namespace so both counters stay
 * independent and share the same binding. If KV is not bound, degrades
 * gracefully so the frontend never breaks.
 */

const CORS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

const KEY = "download-counts";

const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: CORS });

export async function onRequest(context) {
  const { request, env } = context;

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    const kv = env && env.PLAYS_KV;

    // ---- GET: return all non-zero counts ----
    if (request.method === "GET") {
      const counts = kv ? ((await kv.get(KEY, "json")) || {}) : {};
      return json(200, { ok: true, counts });
    }

    // ---- POST: increment one slug ----
    if (request.method === "POST") {
      let slug = null;
      try {
        slug = (await request.json()).slug;
      } catch (e) { /* invalid json */ }

      if (!slug || typeof slug !== "string" || !/^[A-Za-z0-9._-]{1,120}$/.test(slug)) {
        return json(400, { ok: false, error: "invalid slug" });
      }

      if (!kv) return json(200, { ok: false, downloads: 0 });

      const counts = (await kv.get(KEY, "json")) || {};
      counts[slug] = (counts[slug] || 0) + 1;
      await kv.put(KEY, JSON.stringify(counts));
      return json(200, { ok: true, downloads: counts[slug] });
    }

    return json(405, { ok: false, error: "method not allowed" });
  } catch (err) {
    console.error("[downloads] error:", err && err.message);
    // Graceful degradation — never break the frontend
    return json(200, { ok: false, counts: {} });
  }
}
