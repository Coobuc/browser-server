const express = require("express");
const dns = require("node:dns").promises;
const net = require("node:net");

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 15000;

app.disable("x-powered-by");
app.use(express.raw({ type: () => true, limit: "2mb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Cookbuc-Target");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

function privateIP(ip) {
  if (!net.isIP(ip)) return false;
  if (ip === "::1" || ip === "0.0.0.0") return true;
  if (ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("169.254.")) return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  const v6 = ip.toLowerCase();
  return v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80:");
}

async function validateTarget(raw) {
  const target = new URL(raw);
  if (!["http:", "https:"].includes(target.protocol)) throw new Error("protocol");
  if (target.username || target.password) throw new Error("credentials");
  const host = target.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("host");
  if (privateIP(host)) throw new Error("host");
  const answers = await dns.lookup(host, { all: true });
  if (!answers.length || answers.some(a => privateIP(a.address))) throw new Error("host");
  return target;
}

function proxyURL(url) {
  return "/api/proxy?url=" + encodeURIComponent(url);
}

function rewriteHTML(html, finalURL) {
  const base = new URL(finalURL);
  html = html.replace(/<head(\s[^>]*)?>/i, m => m + '<base href="' + base.href.replace(/"/g, "&quot;") + '">');
  html = html.replace(/\b(href|src|action)=(["'])([^"'#][^"']*)\2/gi, (all, attr, q, value) => {
    try {
      const absolute = new URL(value, base).href;
      if (!/^https?:/i.test(absolute)) return all;
      return attr + "=" + q + proxyURL(absolute) + q;
    } catch { return all; }
  });
  return html;
}

const browserHTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cookbuc Browser 1.0</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#0b1220;color:#fff;font-family:Arial,sans-serif}
header{height:58px;display:flex;align-items:center;gap:12px;padding:0 18px;background:#0a1323;border-bottom:1px solid #243249;font-weight:700}
.logo{width:31px;height:31px;border-radius:9px;background:#11b75c;display:grid;place-items:center}
.toolbar{display:flex;gap:8px;padding:12px;background:#101b2e}.toolbar button{border:0;border-radius:10px;background:#1b2b45;color:#fff;padding:0 15px;font-size:16px;cursor:pointer}
form{display:flex;gap:8px;flex:1}.address{width:100%;height:44px;border:0;border-radius:12px;padding:0 16px;font-size:16px;outline:none}.go{background:#11b75c!important;font-weight:700}
.home{height:calc(100vh - 126px);display:grid;place-items:center;background:radial-gradient(circle at top,#162641,#080d17 65%)}.card{text-align:center;width:min(720px,90%)}.card h1{font-size:42px;margin:0 0 8px}.card p{color:#a9b8cc;margin-bottom:25px}.search{display:flex;background:#fff;border-radius:16px;padding:5px}.search input{flex:1;border:0;padding:14px;font-size:17px;outline:none}.search button{border:0;background:#11b75c;color:white;border-radius:11px;padding:0 22px;font-weight:700}
.hint{font-size:13px;color:#71829a;margin-top:18px}
</style>
</head>
<body>
<header><div class="logo">C</div>Cookbuc Browser 1.0</header>
<div class="toolbar"><button onclick="history.back()">←</button><button onclick="history.forward()">→</button><button onclick="location.href='/'">⌂</button><button onclick="location.reload()">↻</button>
<form id="bar"><input class="address" id="url" autocomplete="off" placeholder="Search the web or enter a URL"><button class="go">Go</button></form></div>
<main class="home"><div class="card"><h1>Cookbuc</h1><p>Browser 1.0</p><form class="search" id="homeSearch"><input id="query" placeholder="Search the web or enter a website"><button>Search</button></form><div class="hint">Web pages are requested through your Cookbuc backend.</div></div></main>
<script>
function destination(value){
 value=value.trim(); if(!value)return null;
 if(/^https?:\/\//i.test(value))return value;
 if(/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value))return 'https://'+value;
 return 'https://www.google.com/search?q='+encodeURIComponent(value);
}
function openValue(v){const u=destination(v);if(u)location.href='/api/proxy?url='+encodeURIComponent(u)}
document.getElementById('bar').onsubmit=e=>{e.preventDefault();openValue(document.getElementById('url').value)};
document.getElementById('homeSearch').onsubmit=e=>{e.preventDefault();openValue(document.getElementById('query').value)};
</script></body></html>`;

app.get("/", (req, res) => res.type("html").send(browserHTML));
app.get("/api", (req, res) => res.json({
  name: "Cookbuc Backend", version: "1.3", status: "online",
  services: ["browser", "games", "web-proxy"]
}));
app.get("/health", (req, res) => res.json({ status: "ok", online: true, version: "1.3" }));
app.get("/api/browser", (req, res) => res.json({name:"Cookbuc Browser 1.0",status:"ready",proxyEndpoint:"/api/proxy?url=https%3A%2F%2Fexample.com"}));
app.get("/api/games", (req, res) => res.json({ games: [] }));

app.all(["/api/fetch", "/api/proxy"], async (req, res) => {
  let timer;
  try {
    const raw = String(req.query.url || req.get("x-cookbuc-target") || "").trim();
    if (!raw) return res.status(400).json({ error: "Missing url parameter" });
    const target = await validateTarget(raw);
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const headers = {
      "user-agent": req.get("user-agent") || "Cookbuc-Browser/1.0",
      "accept": req.get("accept") || "*/*",
      "accept-language": req.get("accept-language") || "en-US,en;q=0.9"
    };
    if (req.get("content-type")) headers["content-type"] = req.get("content-type");
    if (req.get("authorization")) headers["authorization"] = req.get("authorization");
    if (req.get("cookie")) headers["cookie"] = req.get("cookie");
    if (req.get("referer")) headers["referer"] = req.get("referer");
    const hasBody = !["GET", "HEAD"].includes(req.method);
    const upstream = await fetch(target, {method:req.method,headers,body:hasBody && req.body?.length ? req.body : undefined,redirect:"follow",signal:controller.signal});
    const finalURL = await validateTarget(upstream.url);
    const declared = Number(upstream.headers.get("content-length") || 0);
    if (declared > MAX_BYTES) return res.status(413).json({ error: "Response is too large" });
    let body = Buffer.from(await upstream.arrayBuffer());
    if (body.length > MAX_BYTES) return res.status(413).json({ error: "Response is too large" });
    const type = upstream.headers.get("content-type") || "application/octet-stream";
    if (type.includes("text/html")) body = Buffer.from(rewriteHTML(body.toString("utf8"), finalURL.href));
    res.status(upstream.status); res.setHeader("Content-Type", type); res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Cookbuc-Upstream", finalURL.origin); res.setHeader("X-Cookbuc-Final-URL", finalURL.href);
    const setCookies = upstream.headers.getSetCookie ? upstream.headers.getSetCookie() : [];
    for (const cookie of setCookies) res.append("Set-Cookie", cookie);
    return req.method === "HEAD" ? res.end() : res.send(body);
  } catch (error) {
    if (error?.name === "AbortError") return res.status(504).json({ error: "Upstream request timed out" });
    if (["protocol","credentials","host"].includes(error?.message)) return res.status(403).json({ error: "Target is not allowed" });
    return res.status(502).json({ error: "Could not proxy that URL" });
  } finally { if (timer) clearTimeout(timer); }
});
app.listen(PORT, "0.0.0.0", () => console.log(`Cookbuc Backend running on port ${PORT}`));
