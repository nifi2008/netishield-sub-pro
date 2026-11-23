import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChannelPost, escapeHtml, subscriptionUrl, SHOP_URL } from "../src/channel.js";

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

test("keyboard has one copy button for the updated sub, then a green shop button", () => {
  const { keyboard } = buildChannelPost({ repository: repo, updatedFile: "3.txt" });
  const buttons = keyboard.inline_keyboard.flat();
  const copies = buttons.filter(b => b.copy_text);
  assert.equal(copies.length, 1);
  assert.equal(copies[0].copy_text.text, subscriptionUrl(repo, 3));
  const shop = buttons.at(-1);
  assert.equal(shop.url, SHOP_URL);
  assert.equal(shop.style, "success");
});

test("without a published sub, only the shop button is shown", () => {
  const { text, keyboard } = buildChannelPost({ repository: repo, updatedFile: null });
  assert.equal(keyboard.inline_keyboard.flat().length, 1);
  assert.ok(text.includes("هنوز"));
});

test("post stays within Telegram limits", () => {
  const { text } = buildChannelPost({ repository: repo, updatedFile: "7.txt" });
  assert.ok(text.length <= 4096);
});
