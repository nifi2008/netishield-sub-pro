import { Telegram } from "./telegram.js";
import { processConfigs } from "./processor.js";
import { publishRotation } from "./github.js";
import { readJson, writeJsonAtomic } from "./state.js";
import { collectAdminInputs } from "./collect.js";
import { buildReport, HELP_TEXT, NO_INPUT_TEXT } from "./report.js";

const OFFSET_FILE = "state/telegram-offset.json";

function loadConfig(env) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const adminId = String(env.TELEGRAM_ADMIN_ID || "");
  if (!token || !adminId) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_ID secret.");
  }
  if (!env.GITHUB_REPOSITORY) {
    throw new Error("GITHUB_REPOSITORY is not set. Run this through GitHub Actions.");
  }
  const parsed = Number(env.POLL_SECONDS ?? 5);
  const pollSeconds = Number.isFinite(parsed) ? Math.min(30, Math.max(0, parsed)) : 5;
  return { token, adminId, pollSeconds };
}

async function main() {
  const config = loadConfig(process.env);
  const telegram = new Telegram(config.token);
  const saved = await readJson(OFFSET_FILE, { offset: 0 });
  const offset = Number(saved.offset) || 0;

  const { inputs, nextOffset } = await collectAdminInputs(telegram, {
    adminId: config.adminId,
    offset,
    pollSeconds: config.pollSeconds,
    onHelp: () => telegram.send(config.adminId, HELP_TEXT)
  });

  if (!inputs.length) {
    await writeJsonAtomic(OFFSET_FILE, { offset: nextOffset, updatedAt: new Date().toISOString() });
    await telegram.send(config.adminId, NO_INPUT_TEXT);
    return;
  }

  const result = processConfigs(inputs);
  const publication = result.total > 0 ? await publishRotation(result.configs) : null;

  // Saved only after publishing succeeded, so a failed run can be retried without losing messages.
  await writeJsonAtomic(OFFSET_FILE, { offset: nextOffset, updatedAt: new Date().toISOString() });
  await telegram.send(config.adminId, buildReport(result, publication));
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
  try {
    const adminId = String(process.env.TELEGRAM_ADMIN_ID || "");
    if (process.env.TELEGRAM_BOT_TOKEN && adminId) {
      await new Telegram(process.env.TELEGRAM_BOT_TOKEN).send(
        adminId,
        `خطا در اجرای NetiShield Manager:\n${error.message || error}\nفایل‌ها را پیش از انتشار بررسی کنید.`
      );
    }
  } catch (sendError) {
    console.error("Could not send Telegram error report:", sendError.message);
  }
}
