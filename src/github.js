import fs from "node:fs/promises";
import path from "node:path";
import { readJson, writeFileAtomic, writeJsonAtomic } from "./state.js";

const SUB_DIR = "subscriptions";
const STATE_FILE = "state/rotation.json";
const SLOT_COUNT = 7;
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

const slotName = index => `${index}.txt`;
const slotPath = index => path.join(SUB_DIR, slotName(index));

async function ensureSlots() {
  await fs.mkdir(SUB_DIR, { recursive: true });
  for (let i = 1; i <= SLOT_COUNT; i++) {
    try {
      await fs.access(slotPath(i));
    } catch {
      await writeFileAtomic(slotPath(i), "");
    }
  }
}

/**
 * Time of the last publish for a slot, taken only from the recorded state.
 * File mtime is not used: in CI every checkout gets the same mtime, which made
 * slot 1 look oldest forever. A slot that was never published counts as 0,
 * so it is chosen before any slot that has already been published.
 */
function lastPublishedAt(index, state) {
  const recorded = new Date(state.files[slotName(index)]?.lastUpdated || "").getTime();
  return Number.isFinite(recorded) ? recorded : 0;
}

/**
 * Replaces the least recently published subscription file with `configs`.
 * @returns {Promise<{file: string, url: string, firstUpdated: string, lastUpdated: string}>}
 */
export async function publishRotation(configs, repository = process.env.GITHUB_REPOSITORY) {
  if (!REPO_RE.test(repository || "")) {
    throw new Error("GITHUB_REPOSITORY نامعتبر است");
  }
  if (!configs.length) throw new Error("No configs to publish");

  await ensureSlots();
  const state = await readJson(STATE_FILE, { files: {} });
  state.files ||= {};

  const candidates = [];
  for (let i = 1; i <= SLOT_COUNT; i++) {
    candidates.push({ index: i, time: lastPublishedAt(i, state) });
  }
  candidates.sort((a, b) => a.time - b.time || a.index - b.index);
  const target = candidates[0].index;
  const name = slotName(target);

  const now = new Date().toISOString();
  await writeFileAtomic(slotPath(target), configs.join("\n") + "\n");

  const previous = state.files[name] || {};
  state.files[name] = {
    firstUpdated: previous.firstUpdated || now,
    lastUpdated: now,
    configCount: configs.length
  };
  state.lastFile = name;
  state.lastUpdated = now;
  await writeJsonAtomic(STATE_FILE, state);

  return {
    file: name,
    url: `https://raw.githubusercontent.com/${repository}/HEAD/${SUB_DIR}/${name}`,
    firstUpdated: state.files[name].firstUpdated,
    lastUpdated: now
  };
}
