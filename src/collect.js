/**
 * Long-polls Telegram for a short window and gathers admin-only text and TXT input.
 * Telegram offset is only returned, not saved; the caller saves it after success.
 */
export async function collectAdminInputs(telegram, { adminId, offset, pollSeconds, onHelp }) {
  await telegram.call("deleteWebhook", { drop_pending_updates: false });

  const inputs = [];
  let nextOffset = offset;
  const deadline = Date.now() + pollSeconds * 1000;

  while (true) {
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const updates = await telegram.getUpdates(nextOffset, remaining);
    if (!updates.length) break;

    for (const update of updates) {
      nextOffset = Math.max(nextOffset, update.update_id + 1);
      const message = update.message || update.edited_message;
      if (!message || !isAdmin(message, adminId)) continue;
      await handleMessage(telegram, message, adminId, inputs, onHelp);
    }
    if (Date.now() >= deadline) break;
  }
  return { inputs, nextOffset };
}

function isAdmin(message, adminId) {
  return String(message.chat?.id) === adminId && String(message.from?.id) === adminId;
}

async function handleMessage(telegram, message, adminId, inputs, onHelp) {
  if (message.text) {
    const text = message.text.trim();
    if (text.startsWith("/start") || text.startsWith("/help")) {
      await onHelp();
      return;
    }
    if (!text.startsWith("/")) inputs.push(text);
  }

  if (message.document) {
    const name = message.document.file_name || "";
    if (!name.toLowerCase().endsWith(".txt")) {
      await telegram.send(
        adminId,
        `فایل ${name || "ارسالی"} نادیده گرفته شد؛ فقط فایل TXT پذیرفته می‌شود.`
      );
      return;
    }
    inputs.push(await telegram.getDocumentText(message.document.file_id));
  }
}
