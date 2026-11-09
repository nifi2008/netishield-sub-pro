const HELP_TEXT =
  "NetiShield Manager آماده است. متن کانفیگ‌ها یا فایل TXT را ارسال کنید، سپس Workflow را اجرا کنید.";

export const NO_INPUT_TEXT =
  "هیچ کانفیگی یافت نشد.\nهیچ‌کدام از ۷ فایل تغییر نکردند.\nپایان عملیات؛ ربات خاموش می‌شود.";

export { HELP_TEXT };

export function buildReport(result, publication) {
  const protocolLines = Object.entries(result.counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => `• ${name}: ${count}`);
  const labels = protocolLines.length
    ? protocolLines.join("\n")
    : "• هیچ پروتکل پشتیبانی‌شده‌ای یافت نشد";

  const lines = [
    "NetiShield Manager",
    "",
    result.total ? "وضعیت: انتشار موفق" : "وضعیت: کانفیگ قابل انتشار یافت نشد",
    `تعداد نهایی: ${result.total}`,
    `VMess حذف‌شده: ${result.vmessRemoved}`,
    `تکراری حذف‌شده: ${result.duplicateCount}`,
    `نامعتبر/پشتیبانی‌نشده: ${result.unsupported}`,
    "",
    "دسته‌بندی پروتکل‌ها:",
    labels,
    ""
  ];

  if (publication) {
    lines.push(
      `فایل آپدیت‌شده: ${publication.file}`,
      `لینک ساب:\n${publication.url}`,
      `اولین آپدیت این فایل: ${publication.firstUpdated}`,
      `آخرین آپدیت: ${publication.lastUpdated}`
    );
  } else {
    lines.push("فایل‌ها: بدون تغییر");
  }

  lines.push("", "پایان عملیات؛ ربات اکنون خاموش می‌شود.");
  return lines.join("\n");
}
