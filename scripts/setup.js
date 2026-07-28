#!/usr/bin/env node
// ============================================
// سكريبت الإعداد والنشر الكامل لـ UST Central Bot
// ============================================
// الاستخدام:
//   1. انسخ .env.example إلى .env واملأ القيم
//   2. شغّل: node scripts/setup.js
//   3. سيقوم السكريبت بكل شيء تلقائياً
// ============================================

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ============================================
// تحميل متغيرات البيئة من .env
// ============================================
function loadEnv() {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) {
    console.error("❌ ملف .env غير موجود!");
    console.error("   انسخ .env.example إلى .env واملأ القيم أولاً:");
    console.error("   cp .env.example .env");
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, "utf8");
  const env = {};
  content.split("\n").forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith("#")) return;
    const [key, ...rest] = line.split("=");
    if (key) env[key.trim()] = rest.join("=").trim();
  });
  return env;
}

const env = loadEnv();
const projectRoot = path.resolve(__dirname, "..");

// ============================================
// التحقق من المتغيرات المطلوبة
// ============================================
const required = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "WORKERS_SUBDOMAIN",
  "STUDENT_BOT_TOKEN",
  "ADMIN_BOT_TOKEN",
  "STUDENT_BOT_USERNAME",
  "ADMIN_BOT_USERNAME",
];
const missing = required.filter((k) => !env[k]);
if (missing.length > 0) {
  console.error("❌ متغيرات مفقودة في .env:");
  missing.forEach((k) => console.error(`   - ${k}`));
  process.exit(1);
}

console.log("🎓 UST Central Bot - Setup & Deploy Script");
console.log("=".repeat(60));
console.log(`📍 Cloudflare Account: ${env.CLOUDFLARE_ACCOUNT_ID}`);
console.log(`🌐 Workers Subdomain: ${env.WORKERS_SUBDOMAIN}`);
console.log(`🤖 Student Bot: @${env.STUDENT_BOT_USERNAME}`);
console.log(`🛡  Admin Bot: @${env.ADMIN_BOT_USERNAME}`);
console.log("=".repeat(60));
console.log();

// ============================================
// الخطوة 1: تثبيت الـ dependencies
// ============================================
function step1_install() {
  console.log("📦 [1/5] تثبيت الـ dependencies...");
  try {
    execSync("npm install", { cwd: projectRoot, stdio: "inherit" });
    console.log("   ✅ تم التثبيت بنجاح\n");
  } catch (e) {
    console.error("   ❌ فشل التثبيت:", e.message);
    process.exit(1);
  }
}

// ============================================
// الخطوة 2: نشر PDF Server (للملفات التجريبية)
// ============================================
function step2_pdfServer() {
  console.log("📄 [2/5] نشر PDF Server...");
  // PDF server موجود داخل المشروع في مجلد pdf-server/
  const pdfDir = path.join(projectRoot, "pdf-server");
  if (!fs.existsSync(pdfDir)) {
    console.log("   ⚠️ مجلد pdf-server غير موجود، تخطّي");
    return;
  }
  try {
    execSync("npx wrangler deploy --config wrangler.toml", {
      cwd: pdfDir,
      stdio: "inherit",
      env: { ...process.env, CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID },
    });
    console.log("   ✅ تم نشر PDF Server\n");
  } catch (e) {
    console.error("   ❌ فشل النشر:", e.message);
  }
}

// ============================================
// الخطوة 3: تعيين الـ Bot Tokens كأسرار
// ============================================
function step3_secrets() {
  console.log("🔐 [3/5] تعيين Bot Tokens كأسرار...");

  // Student Bot
  try {
    execSync(`echo "${env.STUDENT_BOT_TOKEN}" | npx wrangler secret put BOT_TOKEN --config wrangler.student.toml`, {
      cwd: projectRoot,
      stdio: "inherit",
      env: { ...process.env, CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID },
    });
    console.log("   ✅ Student Bot Token تم تعيينه");
  } catch (e) {
    console.error("   ❌ فشل تعيين Student Token:", e.message);
  }

  // Admin Bot
  try {
    execSync(`echo "${env.ADMIN_BOT_TOKEN}" | npx wrangler secret put BOT_TOKEN --config wrangler.admin.toml`, {
      cwd: projectRoot,
      stdio: "inherit",
      env: { ...process.env, CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID },
    });
    console.log("   ✅ Admin Bot Token تم تعيينه\n");
  } catch (e) {
    console.error("   ❌ فشل تعيين Admin Token:", e.message);
  }
}

// ============================================
// الخطوة 4: نشر الـ Workers
// ============================================
function step4_deploy() {
  console.log("🚀 [4/5] نشر الـ Workers...");

  try {
    execSync("npx wrangler deploy --config wrangler.student.toml", {
      cwd: projectRoot,
      stdio: "inherit",
      env: { ...process.env, CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID },
    });
    console.log("   ✅ Student Bot منشور");
  } catch (e) {
    console.error("   ❌ فشل نشر Student Bot:", e.message);
  }

  try {
    execSync("npx wrangler deploy --config wrangler.admin.toml", {
      cwd: projectRoot,
      stdio: "inherit",
      env: { ...process.env, CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID },
    });
    console.log("   ✅ Admin Bot منشور\n");
  } catch (e) {
    console.error("   ❌ فشل نشر Admin Bot:", e.message);
  }
}

// ============================================
// الخطوة 5: تسجيل الـ Webhooks مع Telegram
// ============================================
async function step5_webhooks() {
  console.log("🔗 [5/5] تسجيل الـ Webhooks مع Telegram...");

  const studentWebhookUrl = `https://ust-student-bot.${env.WORKERS_SUBDOMAIN}.workers.dev/webhook`;
  const adminWebhookUrl = `https://ust-admin-bot.${env.WORKERS_SUBDOMAIN}.workers.dev/webhook`;

  // Student Bot
  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${env.STUDENT_BOT_TOKEN}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: studentWebhookUrl,
          max_connections: 40,
          allowed_updates: ["message", "callback_query", "edited_message"],
          drop_pending_updates: true,
        }),
      }
    );
    const data = await resp.json();
    if (data.ok) {
      console.log(`   ✅ Student Webhook: ${studentWebhookUrl}`);
    } else {
      console.error(`   ❌ Student Webhook فشل:`, data.description);
    }
  } catch (e) {
    console.error("   ❌ Student Webhook error:", e.message);
  }

  // Admin Bot
  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${env.ADMIN_BOT_TOKEN}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: adminWebhookUrl,
          max_connections: 40,
          allowed_updates: ["message", "callback_query", "edited_message"],
          drop_pending_updates: true,
        }),
      }
    );
    const data = await resp.json();
    if (data.ok) {
      console.log(`   ✅ Admin Webhook: ${adminWebhookUrl}\n`);
    } else {
      console.error(`   ❌ Admin Webhook فشل:`, data.description);
    }
  } catch (e) {
    console.error("   ❌ Admin Webhook error:", e.message);
  }
}

// ============================================
// تشغيل كل الخطوات
// ============================================
(async () => {
  step1_install();
  step2_pdfServer();
  step3_secrets();
  step4_deploy();
  await step5_webhooks();

  console.log("=".repeat(60));
  console.log("🎉 تم الإعداد والنشر بنجاح!");
  console.log("=".repeat(60));
  console.log();
  console.log("📱 روابط البوتين:");
  console.log(`   🎓 Student: https://t.me/${env.STUDENT_BOT_USERNAME}`);
  console.log(`   🛡  Admin:   https://t.me/${env.ADMIN_BOT_USERNAME}`);
  console.log();
  console.log("🩺 فحص الصحة:");
  console.log(`   https://ust-student-bot.${env.WORKERS_SUBDOMAIN}.workers.dev/health`);
  console.log(`   https://ust-admin-bot.${env.WORKERS_SUBDOMAIN}.workers.dev/health`);
  console.log();
  console.log("🧪 للاختبار: أرسل /start لأي بوت في تلغرام");
})();
