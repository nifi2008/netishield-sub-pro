const API = "https://api.telegram.org";
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_MESSAGE_CHARS = 4000; // Telegram limit is 4096
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

/** Splits text into chunks that fit Telegram's limit, preferring line boundaries. */
export function chunkText(text, max = MAX_MESSAGE_CHARS) {
  const chunks = [];
  let current = "";
  for (const line of String(text).split("\n")) {
    let piece = line;
    while (piece.length > max) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      chunks.push(piece.slice(0, max));
      piece = piece.slice(max);
    }
    const candidate = current ? `${current}\n${piece}` : piece;
    if (candidate.length > max) {
      chunks.push(current);
      current = piece;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export class Telegram {
  constructor(token) {
    this.token = token;
    this.base = `${API}/bot${token}`;
  }

  async call(method, body = {}, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    let response;
    try {
      response = await fetch(`${this.base}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      // Never include the URL here: it contains the bot token.
      throw new Error(`Telegram ${method} request failed (${error.name})`);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Telegram ${method} returned a non-JSON response (HTTP ${response.status})`);
    }
    if (!response.ok || !data.ok) {
      throw new Error(`Telegram ${method} failed: ${data.description || response.status}`);
    }
    return data.result;
  }

  /** Long-polls for updates. `timeout` is in seconds. */
  getUpdates(offset, timeout = 0) {
    return this.call(
      "getUpdates",
      { offset, timeout, allowed_updates: ["message", "edited_message"] },
      { timeoutMs: (timeout + 10) * 1000 }
    );
  }

  async send(chatId, text) {
    for (const chunk of chunkText(text)) {
      await this.call("sendMessage", {
        chat_id: chatId,
        text: chunk,
        link_preview_options: { is_disabled: true }
      });
    }
  }

  /** Sends one HTML-formatted message with an inline keyboard (used for the channel post). */
  sendPost(chatId, html, keyboard) {
    return this.call("sendMessage", {
      chat_id: chatId,
      text: html,
      parse_mode: "HTML",
      reply_markup: keyboard,
      link_preview_options: { is_disabled: true }
    });
  }

  async getDocumentText(fileId) {
    const file = await this.call("getFile", { file_id: fileId });
    if (!file.file_path) throw new Error("Telegram did not return a file path");
    if (file.file_size && file.file_size > MAX_DOCUMENT_BYTES) {
      throw new Error("فایل TXT بزرگ‌تر از ۵ مگابایت است");
    }

    let response;
    try {
      response = await fetch(`${API}/file/bot${this.token}/${file.file_path}`, {
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
      });
    } catch (error) {
      throw new Error(`Could not download Telegram file (${error.name})`);
    }
    if (!response.ok) throw new Error(`Could not download Telegram file: HTTP ${response.status}`);
    return response.text();
  }
}
