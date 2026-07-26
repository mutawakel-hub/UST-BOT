// ============================================
// تحميل متغيرات البيئة من .env
// ============================================
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) {
    console.error("❌ ملف .env غير موجود. انسخ .env.example إلى .env أولاً.");
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

module.exports = loadEnv();
