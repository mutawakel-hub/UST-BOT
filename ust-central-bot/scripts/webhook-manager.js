#!/usr/bin/env node
// ============================================
// سكريبت إدارة Webhooks - فحص/تنظيف/إعادة تسجيل
// ============================================
// الاستخدام:
//   node scripts/webhook-manager.js status    # فحص الحالة
//   node scripts/webhook-manager.js clear     # تنظيف التحديثات المعلّقة
//   node/scripts/webhook-manager.js reset     # حذف وإعادة تسجيل الـ webhook
// ============================================

const env = require("./load-env");
const studentToken = env.STUDENT_BOT_TOKEN;
const adminToken = env.ADMIN_BOT_TOKEN;
const subdomain = env.WORKERS_SUBDOMAIN;

if (!studentToken || !adminToken || !subdomain) {
  console.error("❌ متغيرات مفقودة في .env");
  process.exit(1);
}

const bots = [
  { name: "Student", token: studentToken, url: `https://ust-student-bot.${subdomain}.workers.dev/webhook` },
  { name: "Admin", token: adminToken, url: `https://ust-admin-bot.${subdomain}.workers.dev/webhook` },
];

async function status() {
  console.log("📊 حالة الـ Webhooks:\n");
  for (const bot of bots) {
    const resp = await fetch(`https://api.telegram.org/bot${bot.token}/getWebhookInfo`);
    const data = await resp.json();
    const r = data.result;
    console.log(`🤖 ${bot.name} Bot:`);
    console.log(`   URL: ${r.url || "(غير مفعّل)"}`);
    console.log(`   Pending: ${r.pending_update_count}`);
    console.log(`   Last error: ${r.last_error_message || "None ✅"}`);
    console.log();
  }
}

async function clearPending() {
  console.log("🧹 تنظيف التحديثات المعلّقة:\n");
  for (const bot of bots) {
    const resp = await fetch(
      `https://api.telegram.org/bot${bot.token}/deleteWebhook?drop_pending_updates=true`
    );
    const data = await resp.json();
    console.log(`🤖 ${bot.name} Bot: ${data.ok ? "✅ تم" : "❌ " + data.description}`);
  }
  console.log("\n💡 الـ Webhook محذوف. أعد التسجيل عبر: node scripts/webhook-manager.js reset");
}

async function reset() {
  console.log("🔄 إعادة تسجيل الـ Webhooks:\n");
  for (const bot of bots) {
    // حذف أولاً
    await fetch(
      `https://api.telegram.org/bot${bot.token}/deleteWebhook?drop_pending_updates=true`
    );
    // إعادة التسجيل
    const resp = await fetch(`https://api.telegram.org/bot${bot.token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: bot.url,
        max_connections: 40,
        allowed_updates: ["message", "callback_query", "edited_message"],
        drop_pending_updates: true,
      }),
    });
    const data = await resp.json();
    console.log(`🤖 ${bot.name} Bot: ${data.ok ? "✅ " + bot.url : "❌ " + data.description}`);
  }
}

const cmd = process.argv[2];
switch (cmd) {
  case "status":
    status();
    break;
  case "clear":
    clearPending();
    break;
  case "reset":
    reset();
    break;
  default:
    console.log("الاستخدام: node scripts/webhook-manager.js [status|clear|reset]");
}
