/**
 * Netlify Function (JavaScript) — downloads GIF from Giphy CDN
 * with proper Content-Disposition: attachment header.
 */

const { execFileSync } = require("child_process");

const ALLOWED_HOSTS = new Set([
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
    const path = u.pathname;
    const dot = path.lastIndexOf(".");
    if (dot > -1) ext = path.slice(dot);
  } catch {}
  if (name) {
    const cleaned = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").trim().slice(0, 80);
    if (cleaned) return cleaned + ext;
  }
  return "mymemes-gif" + ext;
}

export async function handler(event) {
  const qs = event.queryStringParameters || {};
  const url = qs.url || "";
  const name = qs.name || "";
  const inline = qs.inline === "1";

  if (!url) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing 'url' parameter" }),
    };
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid url" }),
    };
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
    return {
      statusCode: 403,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Host not allowed" }),
    };
  }

  const filename = safeFilename(name, url);
  const encodedFilename = encodeURIComponent(filename);
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "Content-Disposition",
  };

  try {
    // Use curl with browser-like headers — curl's TLS fingerprint passes Cloudflare
    const args = [
      "-sS",                       // silent but show errors
      "-L",                        // follow redirects
      "--max-time", "25",          // timeout
      "-o", "-",                   // output to stdout
      "-w", "\n__HTTP_STATUS__:%{http_code}\n__CONTENT_TYPE__:%{content_type}\n__SIZE__:%{size_download}",
      "-H", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "-H", "Accept: image/*,*/*;q=0.8",
      url,
    ];

    const output = execFileSync("curl", args, {
      maxBuffer: 50 * 1024 * 1024,  // 50MB max
      timeout: 30000,
    });

    // Split binary output from the trailing metadata
    const buf = Buffer.from(output);
    const sep = Buffer.from("\n__HTTP_STATUS__:");
    const sepIdx = buf.lastIndexOf(sep);
    if (sepIdx === -1) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
        body: JSON.stringify({ error: "No status from curl" }),
      };
    }

    const audioBuffer = buf.slice(0, sepIdx);
    const metaStr = buf.slice(sepIdx).toString("utf-8");
    const statusMatch = metaStr.match(/__HTTP_STATUS__:(\d+)/);
    const ctMatch = metaStr.match(/__CONTENT_TYPE__:([^\n]+)/);
    const sizeMatch = metaStr.match(/__SIZE__:(\d+)/);

    const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;
    let contentType = ctMatch ? ctMatch[1].trim() : "image/gif";
    if (!contentType.startsWith("image") && !contentType.includes("octet-stream")) {
      contentType = "image/gif";
    }
    const reportedSize = sizeMatch ? parseInt(sizeMatch[1], 10) : audioBuffer.length;

    if (status !== 200 || audioBuffer.length === 0) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
        body: JSON.stringify({
          error: `Upstream returned ${status}, size=${reportedSize}`,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        // inline=1 -> stream to <audio> element; otherwise force a download
        "Content-Disposition": inline
          ? `inline; filename*=UTF-8''${encodedFilename}`
          : `attachment; filename*=UTF-8''${encodedFilename}`,
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "public, max-age=86400",
        ...corsHeaders,
      },
      body: audioBuffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json", ...corsHeaders },
      body: JSON.stringify({ error: `Curl error: ${err.message}` }),
    };
  }
}
