// ============================================
// سكريبت تعيين Bot Tokens كأسرار في Cloudflare
// لا تُخزّن الأسرار في الكود - تستخدم wrangler secret put
// ============================================

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// قراءة الـ Tokens من متغيرات البيئة
const STUDENT_TOKEN = process.env.STUDENT_BOT_TOKEN;
const ADMIN_TOKEN = process.env.ADMIN_BOT_TOKEN;

if (!STUDENT_TOKEN || !ADMIN_TOKEN) {
  console.error("❌ يجب تعيين المتغيرات البيئية أولاً:");
  console.error("   export STUDENT_BOT_TOKEN='...'");
  console.error("   export ADMIN_BOT_TOKEN='...'");
  process.exit(1);
}

const projectRoot = path.resolve(__dirname, "..");

console.log("🔐 تعيين BOT_TOKEN كـ Secret للبوتين...\n");

try {
  // تعيين secret لبوت الطالب
  console.log("📝 تعيين secret للبوت الطالب...");
  execSync(
    `echo "${STUDENT_TOKEN}" | npx wrangler secret put BOT_TOKEN --config wrangler.student.toml`,
    {
      cwd: projectRoot,
      stdio: "inherit",
      env: { ...process.env, CLOUDFLARE_API_TOKEN: process.env.CF_API_TOKEN },
    }
  );

  // تعيين secret لبوت الإدارة
  console.log("\n📝 تعيين secret لبوت الإدارة...");
  execSync(
    `echo "${ADMIN_TOKEN}" | npx wrangler secret put BOT_TOKEN --config wrangler.admin.toml`,
    {
      cwd: projectRoot,
      stdio: "inherit",
      env: { ...process.env, CLOUDFLARE_API_TOKEN: process.env.CF_API_TOKEN },
    }
  );

  console.log("\n✅ تم تعيين الأسرار بنجاح!");
} catch (error) {
  console.error("\n❌ فشل تعيين الأسرار:", error.message);
  process.exit(1);
}
