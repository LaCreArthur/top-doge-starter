// Plays your game as the hub's practice does, at http://localhost:5300/play.html: ?field adds five bots to beat,
// ?check plays your bot's run as yours, ?key=3 flies another level. Node 24 or later, nothing to install.
import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { stripTypeScriptTypes } from "node:module"
import { extname, join, normalize } from "node:path"

const port = Number(process.env.PORT ?? 5300)
const TYPES: Record<string, string> = { ".html": "text/html", ".ts": "text/javascript", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".woff2": "font/woff2" }

createServer(async (req, res) => {
  if (req.method === "POST") return void res.writeHead(204).end() // the page's run notes: not kept here
  // Normalized while it starts with "/", so no ".." climbs out of this folder.
  const path = normalize(decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname)).replace(/^\/+/, "") || "play.html"
  // The page imports the platform as @doge-brawl/shared/<name>, mapped to /shared/ (top-doge/play.html).
  const file = path === "play.html" ? "top-doge/play.html" : path.startsWith("shared/") ? `top-doge/${path.slice(7).replace(/\.ts$/, "")}.ts` : path
  const type = TYPES[extname(file)]
  if (!type) return void res.writeHead(404).end()
  try {
    const body = await readFile(join(import.meta.dirname, file))
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" }).end(file.endsWith(".ts") ? stripTypeScriptTypes(body.toString("utf8")) : body)
  } catch {
    if (path === "dev.ts" || path === "notes.ts") return void res.writeHead(200, { "content-type": TYPES[".js"] }).end("export {}") // optional files of a game
    res.writeHead(404).end()
  }
}).listen(port, () => console.log(`Your game: http://localhost:${port}/play.html`))
