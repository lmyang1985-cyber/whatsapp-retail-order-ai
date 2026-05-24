import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { chromium } from "file:///C:/Users/Yang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs";

const outputDir = join(process.cwd(), "tmp", "qa");
mkdirSync(outputDir, { recursive: true });
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:4174");
  const requestedPath = normalize(url.pathname === "/" ? "index.html" : url.pathname.slice(1));
  const filePath = join(process.cwd(), requestedPath);
  if (!filePath.startsWith(process.cwd()) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream" });
  createReadStream(filePath).pipe(response);
});

await new Promise((resolve) => server.listen(4174, "127.0.0.1", resolve));

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto("http://127.0.0.1:4174/", { waitUntil: "load" });

const title = await page.title();
const heading = await page.locator("h1").innerText();
const metrics = await page.locator(".metrics").innerText();

await page.locator('button[data-action="select-message"]').filter({ hasText: "Unknown customer" }).click();
const selectedMessage = await page.locator(".inbox-panel .detail-box").innerText();

await page.locator('button[data-action="mark-reviewed"]').click();
const reviewMetric = await page.locator(".metrics article").first().innerText();

await page.locator('textarea[name="text"]').fill("Tomorrow 65 old coconuts");
await page.locator('button[type="submit"]').click();
const outbound = await page.locator(".composer small").innerText();

await page.screenshot({ fullPage: true, path: join(outputDir, "desktop.png") });

const mobile = await browser.newPage({ viewport: { width: 390, height: 900 } });
await mobile.goto("http://127.0.0.1:4174/", { waitUntil: "load" });
const mobileHeading = await mobile.locator("h1").innerText();
await mobile.screenshot({ fullPage: false, path: join(outputDir, "mobile.png") });

await browser.close();
await new Promise((resolve) => server.close(resolve));

console.log(
  JSON.stringify(
    {
      title,
      heading,
      metrics,
      selectedMessage,
      reviewMetric,
      outbound,
      mobileHeading,
      screenshots: {
        desktop: join(outputDir, "desktop.png"),
        mobile: join(outputDir, "mobile.png"),
      },
    },
    null,
    2,
  ),
);
