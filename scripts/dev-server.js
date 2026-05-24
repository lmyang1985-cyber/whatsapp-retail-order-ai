import { appendFileSync, createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT ?? 4173);
const root = process.cwd();
const log = (line) => appendFileSync(join(root, "server.log"), `${new Date().toISOString()} ${line}\n`);

process.on("uncaughtException", (error) => {
  log(`ERROR ${error.stack ?? error.message}`);
  process.exit(1);
});
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
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
}).listen(port, "127.0.0.1", () => {
  const message = `WhatsApp Retail Order AI running at http://127.0.0.1:${port}`;
  log(message);
  console.log(message);
});
