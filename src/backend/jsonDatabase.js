import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export class JsonDatabase {
  constructor({ filePath, initialData }) {
    this.filePath = filePath;
    this.data = filePath && existsSync(filePath)
      ? JSON.parse(readFileSync(filePath, "utf8"))
      : structuredClone(initialData);
    if (filePath && !existsSync(filePath)) this.persist();
  }

  snapshot() {
    return structuredClone(this.data);
  }

  update(mutator) {
    const draft = this.snapshot();
    const next = mutator(draft) ?? draft;
    this.data = next;
    this.persist();
    return this.snapshot();
  }

  persist() {
    if (!this.filePath) return;
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify(this.data, null, 2)}\n`);
  }
}
