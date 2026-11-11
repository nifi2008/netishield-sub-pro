import { readJson, writeJsonAtomic } from "./state.js";

export const SHOP_URL = "https://t.me/netishieldconnectixbot";
const ROTATION_FILE = "state/rotation.json";
const CHANNEL_STATE_FILE = "state/channel.json";
const SUB_DIR = "subscriptions";
const SLOT_COUNT = 7;
const MAX_POST_CHARS = 4096;
const KEYCAPS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣"];

// Telegram errors that mean the saved message is gone or cannot be edited.
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

function slotLine(index, state, updatedIndex) {
  const entry = state.files?.[`${index}.txt`];
  const mark = index === updatedIndex ? " 🔄" : "";
  const count = entry?.configCount ?? 0;
  return `${KEYCAPS[index - 1]} ساب ${index} • ${count} کانفیگ • ${formatTime(entry?.lastUpdated)}${mark}`;
}

/**
 * Builds the channel post text and its inline keyboard.
 * Copy buttons use copy_text; the purchase button is green (style "success").
 */
export function buildChannelPost({ repository, state, updatedFile, totalConfigs, counts, runAt }) {
  const updatedIndex = updatedFile ? Number.parseInt(updatedFile, 10) : null;
  const protocols =
    Object.entries(counts || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => `${escapeHtml(name)}: ${count}`)
      .join(" • ") || "—";

  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => slotLine(i + 1, state, updatedIndex));

  const text = [
    "🏴‍☠️ <b>NETISHIELD | ساب‌لینک V2Ray</b> 🏴‍☠️",
    "",
    `🔄 <b>آخرین آپدیت کانفیگ:</b> ${updatedIndex ? `ساب ${updatedIndex}` : "هنوز ثبت نشده"}`,
    `🧩 <b>تعداد کانفیگ:</b> ${totalConfigs ?? 0}`,
    `🛰 <b>پروتکل‌ها:</b> ${protocols}`,
    `🕒 <b>آخرین بررسی ربات:</b> ${formatTime(runAt)}`,
    "",
    "📦 <b>وضعیت ساب‌ها:</b>",
    ...slots,
    "",
    "🌍 <b>لوکیشن‌های متنوع، اتصال پایدار و سریع</b>",
    "📋 برای کپی هر ساب، دکمه‌ی همان شماره را بزنید.",
    "⚠️ ساب‌لینک را از بخش <b>Subscription</b> کلاینت اضافه کنید، نه مثل کانفیگ عادی. اگر قبلاً اضافه کرده‌اید، فقط ساب قبلی را آپدیت کنید.",
    "",
    "#تحریم #v2box #فیلتر #vpn"
  ].join("\n");

  if (text.length > MAX_POST_CHARS) {
    throw new Error("متن پست کانال از حد مجاز تلگرام بیشتر است");
  }

  const copyButtons = Array.from({ length: SLOT_COUNT }, (_, i) => ({
    text: `📋 کپی ساب ${i + 1}`,
    copy_text: { text: subscriptionUrl(repository, i + 1) }
  }));

  const rows = [];
  for (let i = 0; i < copyButtons.length; i += 2) {
    rows.push(copyButtons.slice(i, i + 2));
  }
  rows.push([{ text: "🛒 خرید اشتراک", url: SHOP_URL, style: "success" }]);

  return { text, keyboard: { inline_keyboard: rows } };
}

/**
 * Called on every run. Sends the channel post the first time, then edits that same message.
 * When `publication` is null (no new configs), the last known summary is kept and only
 * the status and run time are refreshed.
 * @returns {Promise<"sent" | "edited">}
 */
export async function publishChannelPost(telegram, { channelId, repository, publication = null, result = null }) {
  const saved = await readJson(CHANNEL_STATE_FILE, null);
  const sameChannel = Boolean(saved) && String(saved.chatId) === String(channelId);
  const previous = sameChannel ? saved.summary : null;

  const summary = publication
    ? { updatedFile: publication.file, totalConfigs: result.total, counts: result.counts }
    : previous || { updatedFile: null, totalConfigs: 0, counts: {} };

  const state = await readJson(ROTATION_FILE, { files: {} });
  const { text, keyboard } = buildChannelPost({
    repository,
    state,
    runAt: new Date().toISOString(),
    ...summary
  });

  if (sameChannel && saved.messageId) {
    try {
      await telegram.call("editMessageText", {
        chat_id: channelId,
        message_id: saved.messageId,
        text,
        parse_mode: "HTML",
        reply_markup: keyboard,
        link_preview_options: { is_disabled: true }
      });
      await saveChannelState(channelId, saved.messageId, summary);
      return "edited";
    } catch (error) {
      if (NOT_MODIFIED_RE.test(error.message)) {
        await saveChannelState(channelId, saved.messageId, summary);
        return "edited";
      }
      if (!MISSING_MESSAGE_RE.test(error.message)) throw error;
      // The post was deleted or is no longer editable; a new one is sent below.
    }
  }

  const sent = await telegram.sendPost(channelId, text, keyboard);
  await saveChannelState(channelId, sent.message_id, summary);
  return "sent";
}

async function saveChannelState(channelId, messageId, summary) {
  await writeJsonAtomic(CHANNEL_STATE_FILE, {
    chatId: String(channelId),
    messageId,
    summary,
    updatedAt: new Date().toISOString()
  });
}
