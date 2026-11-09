import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkText } from "../src/telegram.js";

test("short text is a single chunk", () => {
  assert.deepEqual(chunkText("hi"), ["hi"]);
});

test("chunks respect the limit and keep line boundaries", () => {
  const text = Array.from({ length: 50 }, (_, i) => "x".repeat(100) + i).join("\n");
  const chunks = chunkText(text, 1000);
  assert.ok(chunks.every(c => c.length <= 1000));
  assert.equal(chunks.join("\n"), text);
});

test("very long single lines are hard-split", () => {
  const chunks = chunkText("a".repeat(2500), 1000);
  assert.deepEqual(chunks.map(c => c.length), [1000, 1000, 500]);
});
