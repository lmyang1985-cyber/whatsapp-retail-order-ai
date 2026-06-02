import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { createApi } from "../src/backend/api.js";
import { createSeedDatabase } from "../src/backend/createSeedDatabase.js";

const port = Number(process.env.PORT ?? 4173);
const root = process.cwd();
const database = createSeedDatabase({
  filePath: process.env.DATA_FILE ?? join(root, "data", "local-db.json"),
});
const api = createApi({ database });

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);

  if (url.pathname.startsWith("/api/")) {
    const apiResponse = await api.handle({
      method: request.method ?? "GET",
      pathname: url.pathname,
      query: url.searchParams,
      body: await readJsonBody(request),
    });
    response.writeHead(apiResponse.status, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(apiResponse.body));
    return;
  }

  serveStatic(url, response);
}).listen(port, "127.0.0.1", () => {
  console.log(`WhatsApp Retail Order AI backend running at http://127.0.0.1:${port}`);
});

function serveStatic(url, response) {
  const requestedPath = normalize(url.pathname === "/" ? "index.html" : url.pathname.slice(1));
  const filePath = join(root, requestedPath);
  if (!filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  response.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
}

async function readJsonBody(request) {
  if (!["POST", "PATCH", "PUT"].includes(request.method ?? "GET")) return null;
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : null;
}
