import { readJson, writeJsonAtomic } from "./state.js";

export const SHOP_URL = "https://t.me/netishieldconnectixbot";
const ROTATION_FILE = "state/rotation.json";
const CHANNEL_STATE_FILE = "state/channel.json";
const SUB_DIR = "subscriptions";
const SLOT_COUNT = 7;
const MAX_POST_CHARS = 4096;
const KEYCAPS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣"];

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

/** Plain Persian date. Used in the rich post and as fallback text inside <tg-time>. */
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

/** Bot API 9.5 date_time entity, used only in the simple (fallback) post. */
function timeTag(value, format = "wDT") {
  const date = value ? new Date(value) : null;
  const fallback = formatTime(value);
  if (!date || Number.isNaN(date.getTime())) return fallback;
  const unix = Math.floor(date.getTime() / 1000);
  return `<tg-time unix="${unix}" format="${format}">${fallback}</tg-time>`;
}

function protocolsText(counts) {
  return (
    Object.entries(counts || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => `${escapeHtml(name)}: ${count}`)
      .join(" • ") || "—"
  );
}

/** Copy buttons are blue (primary), the purchase button is green (success). */
export function buildKeyboard(repository) {
  const copyButtons = Array.from({ length: SLOT_COUNT }, (_, i) => ({
    text: `📋 کپی ساب ${i + 1}`,
    copy_text: { text: subscriptionUrl(repository, i + 1) },
    style: "primary"
  }));

  const rows = [];
  for (let i = 0; i < copyButtons.length; i += 2) {
    rows.push(copyButtons.slice(i, i + 2));
  }
  rows.push([{ text: "🛒 خرید اشتراک", url: SHOP_URL, style: "success" }]);
  return { inline_keyboard: rows };
}

/** Rich Message (Bot API 10.1): headings, tables and a collapsible block. */
export function buildRichPost({ state, updatedFile, totalConfigs, counts, runAt }) {
  const updatedIndex = updatedFile ? Number.parseInt(updatedFile, 10) : null;

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
    "<p>📋 برای کپی هر ساب، دکمه‌ی همان شماره را بزنید.</p>",
    "<details>",
    "<summary>⚠️ راهنمای افزودن ساب‌لینک</summary>",
    "<p>ساب‌لینک را از بخش <b>Subscription</b> کلاینت اضافه کنید، نه مثل کانفیگ عادی.</p>",
    "<p>اگر قبلاً اضافه کرده‌اید، فقط ساب قبلی را آپدیت کنید.</p>",
    "</details>",
    "<p>#تحریم #v2box #فیلتر #vpn</p>"
  ].join("\n");

  return { html };
}

/** Simple HTML post. Used when Rich Messages cannot be sent. */
export function buildChannelPost({ repository, state, updatedFile, totalConfigs, counts, runAt }) {
  const updatedIndex = updatedFile ? Number.parseInt(updatedFile, 10) : null;

  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => {
    const index = i + 1;
    const entry = state.files?.[`${index}.txt`];
    const mark = index === updatedIndex ? " 🔄" : "";
    return `${KEYCAPS[i]} ساب ${index} · ${entry?.configCount ?? 0} کانفیگ · ${timeTag(entry?.lastUpdated)}${mark}`;
  });

  const text = [
    "🏴‍☠️ <b>NETISHIELD | ساب‌لینک V2Ray</b> 🏴‍☠️",
    "",
    "<blockquote>🌍 لوکیشن‌های متنوع • اتصال پایدار • سرعت بالا</blockquote>",
    "",
    "📊 <b>خلاصه‌ی آخرین آپدیت</b>",
    `├ 🔄 ساب فعال: ${updatedIndex ? `ساب ${updatedIndex}` : "هنوز ثبت نشده"}`,
    `├ 🧩 کانفیگ‌های نهایی: ${totalConfigs ?? 0}`,
    `└ 🛰 پروتکل‌ها: ${protocolsText(counts)}`,
    "",
    "📦 <b>وضعیت ساب‌ها</b>",
    `<blockquote>${slots.join("\n")}</blockquote>`,
    "",
    `🕒 آخرین بررسی ربات: ${timeTag(runAt, "r")}`,
    "",
    "⚠️ ساب‌لینک را از بخش <b>Subscription</b> کلاینت اضافه کنید، نه مثل کانفیگ عادی. اگر قبلاً اضافه کرده‌اید، فقط ساب قبلی را آپدیت کنید.",
    "",
    "#تحریم #v2box #فیلتر #vpn"
  ].join("\n");

  if (text.length > MAX_POST_CHARS) {
    throw new Error("متن پست کانال از حد مجاز تلگرام بیشتر است");
  }

  return { text, keyboard: buildKeyboard(repository) };
}

async function sendNew(telegram, { channelId, rich, classic, keyboard }) {
  try {
    const sent = await telegram.call("sendRichMessage", {
      chat_id: channelId,
      rich_message: { html: rich.html },
      reply_markup: keyboard
    });
    return { messageId: sent.message_id, mode: "rich", fallbackReason: null };
  } catch (error) {
    console.error("sendRichMessage failed, sending simple post:", error.message);
    const sent = await telegram.sendPost(channelId, classic.text, keyboard);
    return { messageId: sent.message_id, mode: "classic", fallbackReason: error.message };
  }
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
 * Called on every run. Sends the post once, then edits that same message.
 * Older saved state without a `mode` is treated as a new post, so the first run
 * after an upgrade sends the Rich version.
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
  const classic = buildChannelPost({ repository, state, runAt, ...summary });
  const keyboard = classic.keyboard;

  if (sameChannel && saved.messageId && saved.mode) {
    const messageId = saved.messageId;
    const mode = saved.mode;
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
