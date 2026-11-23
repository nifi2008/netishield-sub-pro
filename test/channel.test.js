import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChannelPost, escapeHtml, subscriptionUrl } from "../src/channel.js";

const repo = "owner/netishield-manager";

test("escapes HTML special characters", () => {
  assert.equal(escapeHtml("<a & b>"), "&lt;a &amp; b&gt;");
});

test("post shows only the updated subscription link", () => {
  const { text } = buildChannelPost({ repository: repo, updatedFile: "3.txt" });
  assert.ok(text.includes(subscriptionUrl(repo, 3)));
  for (const i of [1, 2, 4, 5, 6, 7]) {
    assert.ok(!text.includes(subscriptionUrl(repo, i)));
  }
});

test("keyboard is a single copy button with no number, emoji or shop link", () => {
  const { keyboard } = buildChannelPost({ repository: repo, updatedFile: "3.txt" });
  const buttons = keyboard.inline_keyboard.flat();
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].text, "کپی ساب");
  assert.equal(buttons[0].copy_text.text, subscriptionUrl(repo, 3));
  assert.ok(!buttons.some(b => b.url));
});

test("no keyboard is sent when nothing is published", () => {
  const { keyboard } = buildChannelPost({ repository: repo, updatedFile: null });
  assert.equal(keyboard, undefined);
});

test("post stays within Telegram limits", () => {
  const { text } = buildChannelPost({ repository: repo, updatedFile: "7.txt" });
  assert.ok(text.length <= 4096);
});
