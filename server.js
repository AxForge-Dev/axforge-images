// AxForge images starter: a small server that keeps your API key and passes image calls to the API.
//
// The browser never sees the key. The page talks to this server, and this server adds the key
// and calls the AxForge API, which speaks the OpenAI images shape. No dependencies: Node.js only.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

try {
  process.loadEnvFile(); // reads .env when it is there
} catch {}

const API = (process.env.AXFORGE_BASE_URL || "https://api.axforge.ai/v1").replace(/\/$/, "");
const KEY = (process.env.AXFORGE_API_KEY || "").trim();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC = join(import.meta.dirname, "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };

async function readJson(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return JSON.parse(body || "{}");
}

function sendJson(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}

// Call the API with the key and hand its answer back to the page as it is.
async function forward(res, path, payload) {
  const upstream = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(300_000), // a new image takes tens of seconds
  });
  res.writeHead(upstream.status, { "Content-Type": upstream.headers.get("content-type") || "application/json" });
  res.end(Buffer.from(await upstream.arrayBuffer()));
}

// POST /api/generate {prompt, size}: a new image from ERNIE Image Turbo.
async function generate(req, res) {
  const { prompt, size } = await readJson(req);
  await forward(res, "/images/generations", { model: "ernie-image-turbo", prompt, size: size || "1024x1024", n: 1 });
}

// POST /api/edit {prompt, image}: an existing image (a data URL) changed by FLUX.2 Klein.
async function edit(req, res) {
  const { prompt, image } = await readJson(req);
  await forward(res, "/images/edits", { model: "flux2-klein-4b", prompt, image });
}

async function serveFile(req, res) {
  const name = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  if (!/^\/[\w.-]+$/.test(name)) return sendJson(res, 404, { error: { message: "Not found" } });
  try {
    const body = await readFile(join(PUBLIC, name));
    res.writeHead(200, { "Content-Type": TYPES[extname(name)] || "application/octet-stream" });
    res.end(body);
  } catch {
    sendJson(res, 404, { error: { message: "Not found" } });
  }
}

const routes = { "POST /api/generate": generate, "POST /api/edit": edit };

createServer(async (req, res) => {
  try {
    const route = routes[`${req.method} ${req.url}`];
    if (!route) return await serveFile(req, res);
    if (!KEY) return sendJson(res, 500, { error: { message: "No API key yet: put AXFORGE_API_KEY in .env and restart." } });
    await route(req, res);
  } catch (err) {
    if (!res.headersSent) sendJson(res, 502, { error: { message: `Could not reach the API: ${err.message}` } });
    else res.end();
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`AxForge images is running at http://127.0.0.1:${PORT}`);
  if (!KEY) console.log("No API key yet: copy .env.example to .env, paste your key, and restart.");
});
