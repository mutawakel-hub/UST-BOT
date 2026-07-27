// ============================================
// سكريبت تسجيل Webhook مع Telegram لكل بوت
// ============================================

const STUDENT_TOKEN = process.env.STUDENT_BOT_TOKEN;
const ADMIN_TOKEN = process.env.ADMIN_BOT_TOKEN;
const WORKERS_SUBDOMAIN = process.env.WORKERS_SUBDOMAIN || "atow73768";

if (!STUDENT_TOKEN || !ADMIN_TOKEN) {
  console.error("❌ يجب تعيين المتغيرات البيئية أولاً:");
  console.error("   export STUDENT_BOT_TOKEN='...'");
  console.error("   export ADMIN_BOT_TOKEN='...'");
  process.exit(1);
}

async function setWebhook(token, botName) {
  const webhookUrl = `https://${botName}.${WORKERS_SUBDOMAIN}.workers.dev/webhook`;
  console.log(`\n🔗 تسجيل Webhook لـ ${botName}:`);
  console.log(`   URL: ${webhookUrl}`);

  // تسجيل الـ Webhook
  const setResp = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        max_connections: 40,
        allowed_updates: [
          "message",
          "callback_query",
          "edited_message",
          "channel_post",
        ],
        drop_pending_updates: true,
      }),
    }
  );
  const setResult = await setResp.json();
  if (!setResult.ok) {
    console.error(`   ❌ فشل: ${setResult.description}`);
    return false;
  }
  console.log(`   ✅ تم التسجيل بنجاح`);

  // التحقق
  const infoResp = await fetch(
    `https://api.telegram.org/bot${token}/getWebhookInfo`
  );
  const info = await infoResp.json();
  console.log(`   ℹ️ الحالة: ${info.result.url ? "✓ مفعّل" : "✗ غير مفعّل"}`);
  if (info.result.last_error_message) {
    console.error(`   ⚠️ آخر خطأ: ${info.result.last_error_message}`);
  }
  return true;
}

(async () => {
  console.log("🚀 بدء تسجيل الـ Webhooks مع Telegram...\n");

  const studentOk = await setWebhook(STUDENT_TOKEN, "ust-student-bot");
  const adminOk = await setWebhook(ADMIN_TOKEN, "ust-admin-bot");

  console.log("\n" + "=".repeat(60));
  if (studentOk && adminOk) {
    console.log("✅ تم تسجيل الـ Webhooks بنجاح للبوتين!");
    console.log("\n📱 روابط البوتين في تيليجرام:");
    console.log("   الطالب: https://t.me/usttesterbot");
    console.log("   الإدارة: https://t.me/usttesteradminbot");
    console.log("\n💡 جرّب الآن إرسال /start لأي بوت للتحقق من الاستجابة!");
  } else {
    console.log("⚠️ بعض الـ Webhooks لم تُسجّل بنجاح. تحقق من الأخطاء أعلاه.");
    process.exit(1);
  }
})();
