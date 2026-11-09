/**
 * Parses raw admin input (plain text, base64 subscriptions, TXT files) into
 * a deduplicated, renamed list of supported proxy URIs.
 */

// Only real proxy URI schemes. Web links such as https:// must never be published.
const SUPPORTED = new Set([
  "vless", "trojan", "ss", "shadowsocks", "socks", "socks5", "hysteria2", "hy2", "tuic"
]);
const VMESS = "vmess";
const REMARK_PREFIX = "@netishield-";

const SCHEME_RE = /^([a-z][a-z0-9+.-]*):\/\//i;
const BASE64_RE = /^[A-Za-z0-9+/=_-]+$/;
const PROXY_IN_TEXT_RE = /\b(?:vless|vmess|trojan|ss|shadowsocks|socks5?|hysteria2|hy2|tuic):\/\//i;

/** Returns the decoded text when `value` is a base64 subscription blob, otherwise null. */
export function decodeBase64Maybe(value) {
  const compact = value.replace(/\s+/g, "");
  if (compact.length < 8 || !BASE64_RE.test(compact)) return null;
  try {
    const normalized = compact.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(normalized, "base64").toString("utf8");
    return PROXY_IN_TEXT_RE.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

export function extractLines(input) {
  const lines = String(input ?? "")
    .split(/\r\n|\r|\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const expanded = [];
  for (const line of lines) {
    const decoded = decodeBase64Maybe(line);
    if (decoded) {
      expanded.push(...decoded.split(/\r\n|\r|\n/).map(x => x.trim()).filter(Boolean));
    } else {
      expanded.push(line);
    }
  }
  return expanded;
}

function schemeOf(line) {
  const match = line.match(SCHEME_RE);
  return match ? match[1].toLowerCase() : null;
}

/** Removes the display name (#fragment) so it can be replaced by a sequential name. */
function withoutRemark(line) {
  return line.split("#")[0].trim();
}

function isComment(line) {
  return line.startsWith("#") || line.startsWith("//");
}

/**
 * @param {string[]} inputs raw texts received from Telegram
 * @returns {{configs: string[], total: number, counts: Record<string, number>,
 *            vmessRemoved: number, duplicateCount: number, unsupported: number}}
 */
export function processConfigs(inputs) {
  const lines = inputs.flatMap(extractLines);

  const seen = new Set();
  const unique = [];
  let vmessRemoved = 0;
  let unsupported = 0;
  let duplicateCount = 0;

  for (const line of lines) {
    if (isComment(line)) continue;

    const protocol = schemeOf(line);
    if (!protocol) {
      unsupported++;
      continue;
    }
    if (protocol === VMESS) {
      vmessRemoved++;
      continue;
    }
    if (!SUPPORTED.has(protocol)) {
      unsupported++;
      continue;
    }

    const body = withoutRemark(line);
    if (seen.has(body)) {
      duplicateCount++;
      continue;
    }
    seen.add(body);
    unique.push({ body, protocol });
  }

  const counts = {};
  const configs = unique.map((item, index) => {
    counts[item.protocol] = (counts[item.protocol] || 0) + 1;
    return `${item.body}#${encodeURIComponent(`${REMARK_PREFIX}${index + 1}`)}`;
  });

  return {
    configs,
    total: configs.length,
    counts,
    vmessRemoved,
    duplicateCount,
    unsupported
  };
}
