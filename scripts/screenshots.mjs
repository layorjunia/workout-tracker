#!/usr/bin/env node
// App Store screenshots of the Workout Tracker, taken from made-up demo data (scripts/screenshots/demo.js).
//
//   node scripts/screenshots.mjs
//
// Renders the real app in headless Google Chrome at an iPhone Pro Max size (440 x 956 points at 3x =
// 1320 x 2868, the App Store's 6.9-inch size) and writes store/screenshots/iphone-6.9/*.png.
// Nothing of anyone's real data is used. Everything it generates stays inside this folder and is
// removed again (scratch/screenshots).
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// DEV=1 node scripts/screenshots.mjs  writes full-length pages to scratch/dev-shots instead of the store set
// (ONLY=03-steps,04-goals limits which); the store screenshots are left alone.
const DEV = !!process.env.DEV;
const OUT = DEV ? path.join(ROOT, "scratch/dev-shots") : path.join(ROOT, "store/screenshots/iphone-6.9");
const WORK = path.join(ROOT, "scratch/screenshots");
const W = 440, H = 956, SCALE = 3;
const SHOTS = [                                   // [file name, demo page query]
  ["01-today", "view=today&scrollY=330"],
  ["02-progress", "view=progress&scrollTo=%23progress-exercise&pad=150"],
  ["03-steps", "view=steps"],
  ["04-analytics", "view=goals&seg=analytics"],
  ["05-goals", "view=goals"],
  ["06-health", "view=health&scrollTo=%23health-snapshot&pad=185"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let chrome, server, ws;

async function main() {
  if (!fs.existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME} (set CHROME=...)`);
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  if (!process.env.ONLY) for (const f of fs.readdirSync(OUT)) if (f.endsWith(".png")) fs.rmSync(path.join(OUT, f));   // a full run replaces the whole set

  // The demo page: the real index.html with fixed iPhone safe-area insets (a desktop browser has none),
  // plus the demo data loaded after app.js.
  const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8")
    .replaceAll("env(safe-area-inset-top)", "62px").replaceAll("env(safe-area-inset-bottom)", "34px");
  fs.writeFileSync(path.join(WORK, "styles_demo.css"), css);
  let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8")
    .replace("<head>", '<head>\n<base href="/">')
    .replace(/href="styles\.css\?v=\d+"/, 'href="/scratch/screenshots/styles_demo.css"')
    .replace(/(<script src="capacitor-health\.js\?v=\d+"><\/script>)/, '$1\n<script src="/scripts/screenshots/demo.js"></script>');
  if (!html.includes("styles_demo.css") || !html.includes("screenshots/demo.js")) throw new Error("index.html changed shape: update the replacements in scripts/screenshots.mjs");
  fs.writeFileSync(path.join(WORK, "index_demo.html"), html);

  // A small static server, localhost only, for the files the page needs.
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
  const allowed = (p) => !/\/\./.test(p) && !p.startsWith("/node_modules/") && !p.startsWith("/ios/") && (!p.startsWith("/scripts/") || p.startsWith("/scripts/screenshots/"));
  server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
    if (!file.startsWith(ROOT + path.sep) || !allowed(url.pathname)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end("not found"); return; }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(data);
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;

  // Chrome, driven over its DevTools protocol so the viewport is exactly an iPhone's.
  chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${path.join(WORK, "chrome-profile")}`,
    "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--mute-audio", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  const browserWs = await new Promise((resolve, reject) => {
    let buf = "";
    chrome.stderr.on("data", (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]); });
    chrome.on("exit", (c) => reject(new Error("Chrome exited early (" + c + ")")));
    setTimeout(() => reject(new Error("Chrome did not start")), 20000);
  });
  const debugPort = new URL(browserWs).port;
  const page = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find((t) => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));

  let nextId = 0;
  const pending = new Map(), eventWaiters = [];
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    else if (m.method) eventWaiters.filter((w) => w.method === m.method).forEach((w) => w.res(m.params));
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const id = ++nextId; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
  const waitEvent = (method) => new Promise((res) => eventWaiters.push({ method, res }));
  const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result?.value;
  const waitFor = async (expression, ms) => {
    for (let t = 0; t < ms; t += 150) { if (await evaluate(expression)) return; await sleep(150); }
    throw new Error("timed out waiting for " + expression);
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: SCALE, mobile: true });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });   // no count-up animations: final numbers

  const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
  for (const [name, query] of SHOTS) {
    if (only && !only.includes(name)) continue;
    const loaded = waitEvent("Page.loadEventFired");
    await send("Page.navigate", { url: `${base}/scratch/screenshots/index_demo.html?${query}` });
    await loaded;
    await waitFor("window.__demoReady === true", 30000);
    await sleep(1500);                                         // let charts and renders settle
    const errors = await evaluate("window.__errors ? window.__errors.join(' | ') : ''");
    if (DEV) {
      const full = await evaluate("Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)");
      await send("Emulation.setDeviceMetricsOverride", { width: W, height: Math.max(H, full), deviceScaleFactor: SCALE, mobile: true });
      await sleep(900);
    }
    const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    if (DEV) await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: SCALE, mobile: true });
    fs.writeFileSync(path.join(OUT, name + ".png"), Buffer.from(data, "base64"));
    console.log("wrote", path.relative(ROOT, path.join(OUT, name + ".png")), errors ? "  page errors: " + errors : "");
  }
}

main()
  .catch((e) => { console.error("screenshots failed:", e.message); process.exitCode = 1; })
  .finally(() => {
    try { ws?.close(); } catch {}
    try { chrome?.kill("SIGKILL"); } catch {}
    try { server?.close(); } catch {}
    setTimeout(() => { fs.rmSync(WORK, { recursive: true, force: true }); process.exit(process.exitCode || 0); }, 400);
  });
