const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_BYTES = 5 * 1024 * 1024;

app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/", (req, res) => {
  res.json({
    name: "Cookbuc Backend",
    version: "1.1",
    status: "online",
    services: ["browser", "games", "web-fetch"]
  });
});

app.get("/health", (req, res) => res.json({ status: "ok", online: true }));

app.get("/api/browser", (req, res) => {
  res.json({
    name: "Cookbuc Browser 1.0",
    status: "ready",
    fetchEndpoint: "/api/fetch?url=https%3A%2F%2Fexample.com"
  });
});

app.get("/api/games", (req, res) => res.json({ games: [] }));

function blockedHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "::1" || h.endsWith(".local")) return true;
  if (/^(0|10|127)\./.test(h) || /^169\.254\./.test(h) || /^192\.168\./.test(h)) return true;
  const m = h.match(/^172\.(\d+)\./);
  return !!(m && Number(m[1]) >= 16 && Number(m[1]) <= 31);
}

app.get("/api/fetch", async (req, res) => {
  let timer;
  try {
    const raw = String(req.query.url || "").trim();
    if (!raw) return res.status(400).json({ error: "Missing url parameter" });

    let target;
    try { target = new URL(raw); }
    catch { return res.status(400).json({ error: "Invalid URL" }); }

    if (!["http:", "https:"].includes(target.protocol)) {
      return res.status(400).json({ error: "Only http and https URLs are allowed" });
    }
    if (target.username || target.password || blockedHost(target.hostname)) {
      return res.status(403).json({ error: "Target is not allowed" });
    }

    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), 12000);

    const upstream = await fetch(target, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "Cookbuc-Browser/1.0", accept: "*/*" }
    });

    const declared = Number(upstream.headers.get("content-length") || 0);
    if (declared > MAX_BYTES) return res.status(413).json({ error: "Response is too large" });

    const body = Buffer.from(await upstream.arrayBuffer());
    if (body.length > MAX_BYTES) return res.status(413).json({ error: "Response is too large" });

    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Cookbuc-Upstream", target.origin);
    return req.method === "HEAD" ? res.end() : res.send(body);
  } catch (error) {
    if (error && error.name === "AbortError") return res.status(504).json({ error: "Upstream request timed out" });
    return res.status(502).json({ error: "Could not fetch that URL" });
  } finally {
    if (timer) clearTimeout(timer);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Cookbuc Backend running on port ${PORT}`);
});
