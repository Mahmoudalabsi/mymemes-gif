/**
 * Cloudflare Pages Function — proxies GIF downloads from Giphy CDN.
 * Route: GET /download?url=<upstream>&name=<filename>
 *   Streams the GIF file with Content-Disposition: attachment.
 *
 * Giphy CDN media.giphy.com / media1-4.giphy.com already serves CORS * and
 * doesn't require an API key for direct media URLs. This proxy exists to:
 *   1. Force attachment download (browsers usually open .gif inline).
 *   2. Cache aggressively at Cloudflare's edge.
 */

const ALLOWED_HOSTS = new Set([
  "media.tenor.com",
  "media1.tenor.com",
  "media2.tenor.com",
  "media3.tenor.com",
  "media.giphy.com",
  "media1.giphy.com",
  "media2.giphy.com",
  "media3.giphy.com",
  "media4.giphy.com",
]);

function safeFilename(name, url) {
  let ext = ".gif";
  try {
    const u = new URL(url);
    const dot = u.pathname.lastIndexOf(".");
    if (dot > -1) ext = u.pathname.slice(dot);
  } catch {}
  if (name) {
    const cleaned = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").trim().slice(0, 80);
    if (cleaned) return cleaned + ext;
  }
  return "mymemes-gif" + ext;
}

const json = (status, obj) => new Response(JSON.stringify(obj), {
  status,
  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
});

export async function onRequest(context) {
  const { request } = context;
  const qs = new URL(request.url).searchParams;
  const url = qs.get("url") || "";
  const name = qs.get("name") || "";
  const inline = qs.get("inline") === "1";

  if (!url) return json(400, { error: "Missing 'url' parameter" });

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return json(400, { error: "Invalid url" });
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
    return json(403, { error: "Host not allowed" });
  }

  const filename = safeFilename(name, url);
  const encodedFilename = encodeURIComponent(filename);

  try {
    const upstream = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "image/*,*/*;q=0.8",
      },
      cf: { cacheTtl: 2592000, cacheEverything: true },
    });

    if (!upstream.ok || !upstream.body) {
      return json(502, { error: `Upstream returned ${upstream.status}` });
    }

    let contentType = upstream.headers.get("Content-Type") || "image/gif";
    if (!contentType.startsWith("image") && !contentType.includes("octet-stream")) {
      contentType = "image/gif";
    }

    const headers = {
      "Content-Type": contentType,
      "Content-Disposition": inline
        ? `inline; filename*=UTF-8''${encodedFilename}`
        : `attachment; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "Content-Disposition",
    };
    const len = upstream.headers.get("Content-Length");
    if (len) headers["Content-Length"] = len;

    return new Response(upstream.body, { status: 200, headers });
  } catch (err) {
    return json(502, { error: `Fetch error: ${(err && err.message) || "unknown"}` });
  }
}
