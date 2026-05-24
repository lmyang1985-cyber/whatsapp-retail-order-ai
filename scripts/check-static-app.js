import { existsSync } from "node:fs";

const requiredFiles = [
  "index.html",
  "src/main.js",
  "src/styles.css",
  "src/domain/orderAi.js",
  "src/domain/pricing.js",
  "src/domain/summaries.js",
  "src/domain/payments.js",
];

const missing = requiredFiles.filter((file) => !existsSync(file));
if (missing.length) {
  console.error(`Missing required files: ${missing.join(", ")}`);
  process.exit(1);
}

await import("../src/main.js").catch((error) => {
  if (error.message.includes("document is not defined")) return;
  throw error;
});

console.log("Static app files are present and modules parse.");
