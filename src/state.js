import fs from "node:fs/promises";
import path from "node:path";

/** Reads a JSON file. Returns `fallback` when the file is missing or invalid. */
export async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`Could not parse ${file}, using defaults: ${error.message}`);
    }
    return fallback;
  }
}

/** Writes a file atomically (temp file + rename) so a crash never leaves it half-written. */
export async function writeFileAtomic(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, text, "utf8");
  await fs.rename(tmp, file);
}

export function writeJsonAtomic(file, data) {
  return writeFileAtomic(file, JSON.stringify(data, null, 2) + "\n");
}
