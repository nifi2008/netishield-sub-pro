import { test } from "node:test";
import assert from "node:assert/strict";
import { processConfigs, decodeBase64Maybe } from "../src/processor.js";

const VLESS = "vless://uuid@1.2.3.4:443?security=tls&type=ws#old-name";
const TROJAN = "trojan://pass@example.com:443#x";

test("keeps supported proxy URIs and renames them sequentially", () => {
  const r = processConfigs([`${VLESS}\n${TROJAN}`]);
  assert.equal(r.total, 2);
  assert.match(r.configs[0], /#%40netishield-1$/);
  assert.match(r.configs[1], /#%40netishield-2$/);
  assert.deepEqual(r.counts, { vless: 1, trojan: 1 });
});

test("does not publish ordinary web links (regression)", () => {
  const r = processConfigs(["https://example.com/page", "http://example.org", VLESS]);
  assert.equal(r.total, 1);
  assert.equal(r.unsupported, 2);
});

test("removes VMess and counts it", () => {
  const r = processConfigs(["vmess://eyJhIjoxfQ==", VLESS]);
  assert.equal(r.vmessRemoved, 1);
  assert.equal(r.total, 1);
});

test("deduplicates ignoring remark names", () => {
  const r = processConfigs([`${VLESS}\nvless://uuid@1.2.3.4:443?security=tls&type=ws#another`]);
  assert.equal(r.total, 1);
  assert.equal(r.duplicateCount, 1);
});

test("skips comments silently and counts unknown text", () => {
  const r = processConfigs(["# a comment\n// another\nhello world"]);
  assert.equal(r.total, 0);
  assert.equal(r.unsupported, 1);
});

test("expands base64 subscriptions", () => {
  const blob = Buffer.from(`${VLESS}\n${TROJAN}`).toString("base64");
  const r = processConfigs([blob]);
  assert.equal(r.total, 2);
});

test("decodeBase64Maybe rejects plain text and URIs", () => {
  assert.equal(decodeBase64Maybe(VLESS), null);
  assert.equal(decodeBase64Maybe("hello"), null);
});

test("handles CRLF input and empty input", () => {
  assert.equal(processConfigs([`${VLESS}\r\n${TROJAN}\r\n`]).total, 2);
  assert.equal(processConfigs([]).total, 0);
  assert.equal(processConfigs([""]).total, 0);
});
