import { readJson, writeJsonAtomic } from "./state.js";

export const SHOP_URL = "https://t.me/netishieldconnectixbot";
const ROTATION_FILE = "state/rotation.json";
const CHANNEL_STATE_FILE = "state/channel.json";
const SUB_DIR = "subscriptions";
const SLOT_COUNT = 7;
const MAX_POST_CHARS = 4096;
const KEYCAPS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣"];
const CLIENTS = ["V2Box", "v2rayNG", "Streisand", "Hiddify", "NekoBox"];

// Rich Messages are off. Set to true to try them; the classic post is used if Telegram refuses.
const USE_RICH = false;

const MISSING_MESSAGE_RE = /message to edit not found|message can't be edited|MESSAGE_ID_INVALID/i;
const NOT_MODIFIED_RE = /message is not modified/i;

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function subscriptionUrl(repository, index) {
  return `https://raw.githubusercontent.com/${repository}/HEAD/${SUB_DIR}/${index}.txt`;
}

/** Index of the updated subscription (1 to 7), or null if nothing has been published yet. */
function slotIndex(updatedFile) {
  const index = updatedFile ? Number.parseInt(updatedFile, 10) : null;
  return index && index >= 1 && index <= SLOT_COUNT ? index : null;
}

/** Plain Persian date, used in the Rich post. */
function formatTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function protocolsText(counts) {
  return (
    Object.entries(counts || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => `${escapeHtml(name)}: ${count}`)
      .join(" • ") || "—"
  );
}

/**
 * Copy button for the updated subscription (blue), then the purchase button (green).
 * Without a published subscription, only the purchase button is shown.
 */
export function buildKeyboard(repository, updatedIndex) {
  const rows = [];
  if (updatedIndex) {
    rows.push([
      {
        text: `📋 کپی ساب ${updatedIndex}`,
        copy_text: { text: subscriptionUrl(repository, updatedIndex) },
        style: "primary"
      }
    ]);
  }
  rows.push([{ text: "🛒 خرید اشتراک", url: SHOP_URL, style: "success" }]);
  return { inline_keyboard: rows };
}

/** Rich Message (Bot API 10.1). Used only when USE_RICH is true. */
export function buildRichPost({ state, updatedFile, totalConfigs, counts, runAt }) {
  const updatedIndex = slotIndex(updatedFile);

  const slotRows = Array.from({ length: SLOT_COUNT }, (_, i) => {
    const index = i + 1;
    const entry = state.files?.[`${index}.txt`];
    const mark = index === updatedIndex ? " 🔄" : "";
    return `<tr><td>${KEYCAPS[i]} ساب ${index}${mark}</td><td>${entry?.configCount ?? 0}</td><td>${formatTime(entry?.lastUpdated)}</td></tr>`;
  }).join("\n");

  const html = [
    "<h2>🏴‍☠️ NETISHIELD | ساب‌لینک V2Ray 🏴‍☠️</h2>",
    "<p>🌍 لوکیشن‌های متنوع • اتصال پایدار • سرعت بالا</p>",
    "<h3>📊 خلاصه‌ی آخرین آپدیت</h3>",
    "<table>",
    "<tr><th>مورد</th><th>وضعیت</th></tr>",
    `<tr><td>🔄 ساب فعال</td><td>${updatedIndex ? `ساب ${updatedIndex}` : "هنوز ثبت نشده"}</td></tr>`,
    `<tr><td>🧩 کانفیگ‌های نهایی</td><td>${totalConfigs ?? 0}</td></tr>`,
    `<tr><td>🛰 پروتکل‌ها</td><td>${protocolsText(counts)}</td></tr>`,
    `<tr><td>🕒 آخرین بررسی ربات</td><td>${formatTime(runAt)}</td></tr>`,
    "</table>",
    "<h3>📦 وضعیت ساب‌ها</h3>",
    "<table>",
    "<tr><th>ساب</th><th>کانفیگ</th><th>آخرین آپدیت</th></tr>",
    slotRows,
    "</table>",
    "<details>",
    "<summary>⚠️ راهنمای افزودن ساب‌لینک</summary>",
    "<p>ساب‌لینک را از بخش <b>Subscription</b> کلاینت اضافه کنید، نه مثل کانفیگ عادی.</p>",
    "<p>اگر قبلاً اضافه کرده‌اید، فقط ساب قبلی را آپدیت کنید.</p>",
    "</details>",
    "<p>#تحریم #v2box #فیلتر #vpn</p>"
  ].join("\n");

  return { html };
}

/**
 * Classic post, in the approved template. Only the updated subscription link is shown,
 * inside a code block so one tap copies it.
 */
export function buildChannelPost({ repository, updatedFile }) {
  const updatedIndex = slotIndex(updatedFile);
  const link = updatedIndex ? escapeHtml(subscriptionUrl(repository, updatedIndex)) : null;

  const linkBlock = link
    ? `<blockquote><code>${link}</code></blockquote>`
    : "<blockquote>هنوز ساب‌لینکی منتشر نشده است.</blockquote>";

  const clientsBlock = `<blockquote>${CLIENTS.map(name => `🔐 ${name}`).join("\n")}</blockquote>`;

  const text = [
    "NETISHIELD | ساب‌لینک V2Ray",
    "",
    "▬ لوکیشن‌های متنوع، اتصال پایدار و سریع",
    "",
    "📌 برای کپی ساب‌لینک، روی لینک زیر بزنید:",
    linkBlock,
    "",
    "📞 کلاینت‌های پشتیبانی‌شده:",
    clientsBlock,
    "",
    "🔷 نکته مهم:",
    "ساب‌لینک را از بخش Subscription کلاینت اضافه کنید.",
    "",
    "🔷 اگر ساب لینک اضافه نشد VPN کمکی را روشن کنید.",
    "",
    "💎 اگر مفید بود، ری‌اکشن بزنید رفیق 💎",
    "",
    "#تحریم #v2box #فیلتر #vpn",
    "",
    "<blockquote>NETISHIELD</blockquote>"
  ].join("\n");

  if (text.length > MAX_POST_CHARS) {
    throw new Error("متن پست کانال از حد مجاز تلگرام بیشتر است");
  }

  return { text, keyboard: buildKeyboard(repository, updatedIndex) };
}

async function sendNew(telegram, { channelId, rich, classic, keyboard }) {
  let fallbackReason = null;
  if (USE_RICH) {
    try {
      const sent = await telegram.call("sendRichMessage", {
        chat_id: channelId,
        rich_message: { html: rich.html },
        reply_markup: keyboard
      });
      return { messageId: sent.message_id, mode: "rich", fallbackReason: null };
    } catch (error) {
      console.error("sendRichMessage failed, sending classic post:", error.message);
      fallbackReason = error.message;
    }
  }
  const sent = await telegram.sendPost(channelId, classic.text, keyboard);
  return { messageId: sent.message_id, mode: "classic", fallbackReason };
}

function editExisting(telegram, { channelId, messageId, mode, rich, classic, keyboard }) {
  if (mode === "rich") {
    return telegram.call("editMessageText", {
      chat_id: channelId,
      message_id: messageId,
      rich_message: { html: rich.html },
      reply_markup: keyboard
    });
  }
  return telegram.call("editMessageText", {
    chat_id: channelId,
    message_id: messageId,
    text: classic.text,
    parse_mode: "HTML",
    reply_markup: keyboard,
    link_preview_options: { is_disabled: true }
  });
}

/**
 * Called on every run. Edits the saved post when it uses the current mode,
 * otherwise sends a new one. Old posts in the channel are not removed automatically.
 * @returns {Promise<{action: "sent" | "edited", mode: "rich" | "classic", fallbackReason: string | null}>}
 */
export async function publishChannelPost(telegram, { channelId, repository, publication = null, result = null }) {
  const saved = await readJson(CHANNEL_STATE_FILE, null);
  const sameChannel = Boolean(saved) && String(saved.chatId) === String(channelId);
  const previous = sameChannel ? saved.summary : null;

  const summary = publication
    ? { updatedFile: publication.file, totalConfigs: result.total, counts: result.counts }
    : previous || { updatedFile: null, totalConfigs: 0, counts: {} };

  const state = await readJson(ROTATION_FILE, { files: {} });
  const runAt = new Date().toISOString();
  const rich = buildRichPost({ state, runAt, ...summary });
  const classic = buildChannelPost({ repository, updatedFile: summary.updatedFile });
  const keyboard = classic.keyboard;
  const mode = USE_RICH ? "rich" : "classic";

  if (sameChannel && saved.messageId && saved.mode === mode) {
    const messageId = saved.messageId;
    let stillExists = true;
    try {
      await editExisting(telegram, { channelId, messageId, mode, rich, classic, keyboard });
    } catch (error) {
      if (MISSING_MESSAGE_RE.test(error.message)) {
        stillExists = false;
      } else if (!NOT_MODIFIED_RE.test(error.message)) {
        throw error;
      }
    }
    if (stillExists) {
      await saveChannelState(channelId, messageId, summary, mode);
      return { action: "edited", mode, fallbackReason: null };
    }
  }

  const sent = await sendNew(telegram, { channelId, rich, classic, keyboard });
  await saveChannelState(channelId, sent.messageId, summary, sent.mode);
  return { action: "sent", mode: sent.mode, fallbackReason: sent.fallbackReason };
}

async function saveChannelState(channelId, messageId, summary, mode) {
  await writeJsonAtomic(CHANNEL_STATE_FILE, {
    chatId: String(channelId),
    messageId,
    mode,
    summary,
    updatedAt: new Date().toISOString()
  });
}
