# ============================================
# GitHub Setup Guide - UST Central Bot
# ============================================
# دليل رفع المشروع على GitHub (مستودع خاص)
# ============================================

## 1️⃣ إنشاء مستودع خاص على GitHub

1. اذهب إلى: https://github.com/new
2. أضف:
   - Repository name: `ust-central-bot`
   - Description: `UST Central Bot - Telegram bot for University of Science and Technology (Yemen)`
   - Visibility: **Private** ⚠️ (مهم: خاص وليس عام)
   - لا تختر "Add a README file" (المشروع يحتوي على README بالفعل)
   - لا تختر "Add .gitignore" (المشروع يحتوي على .gitignore بالفعل)
3. اضغط **Create repository**

## 2️⃣ إعداد المصادقة (Personal Access Token - Classic)

نظراً لأنك ستستخدم Classic Token:

1. اذهب إلى: https://github.com/settings/tokens
2. اضغط **Generate new token** → **Generate new token (classic)**
3. أضف:
   - Note: `ust-central-bot deployment`
   - Expiration: 90 days (أو حسب رغبتك)
   - Scopes (الحد الأدنى المطلوب):
     - ✅ `repo` (Full control of private repositories)
       - يتضمن: repo:status, repo_deployment, public_repo, security_events
4. اضغط **Generate token**
5. **انسخ الـ Token فوراً** (لن يظهر مرة أخرى):
   ```
   ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

## 3️⃣ رفع المشروع (من سطر الأوامر)

بعد فك ضغط `ust-central-bot-v2.2.zip`:

```bash
# 1. الدخول لمجلد المشروع
cd ust-central-bot

# 2. تهيئة Git
git init
git branch -M main

# 3. إضافة كل الملفات
git add .

# 4. أول commit
git commit -m "🚀 Initial commit: UST Central Bot v2.2

- Student Bot (12 screens + file preview)
- Admin Bot (15 screens + 4 roles)
- Cloudflare Workers deployment
- Mockup v2.2 - subscription feature removed"

# 5. ربط بالمستودع البعيد
# استبدل <USERNAME> باسم مستخدمك على GitHub
git remote add origin https://github.com/<USERNAME>/ust-central-bot.git

# 6. الرفع (سيطلب username + password)
# - Username: اسم مستخدم GitHub
# - Password: الصق الـ Token (وليس كلمة مرور GitHub!)
git push -u origin main
```

## 4️⃣ لتجنب إدخال الـ Token في كل مرة

```bash
# حفظ الـ Token مؤقتاً (ساعة واحدة)
git config --global credential.helper cache
git config --global credential.helper 'cache --timeout=3600'

# أو حفظ دائم (مع تشفير على macOS/Windows)
git config --global credential.helper store
```

## 5️⃣ إعداد Cloudflare Secrets (للـ CI/CD لاحقاً)

عند إعداد GitHub Actions لاحقاً، أضف Repository Secrets:

1. اذهب للمستودع → Settings → Secrets and variables → Actions
2. أضف:
   - `CLOUDFLARE_API_TOKEN` = `cfut_rUSX7nGmRjGyoOX3SRybHg2YWkqB4RTMWTlarcsL3ffee7df`
   - `CLOUDFLARE_ACCOUNT_ID` = `821ba2812d9ca15396ea53dcb8ecd8d5`
   - `STUDENT_BOT_TOKEN` = (Student Bot Token)
   - `ADMIN_BOT_TOKEN` = (Admin Bot Token)

## 6️⃣ ملفات مهمة في المشروع

| الملف | الوصف |
|---|---|
| `.gitignore` | يستثني node_modules, .env, .dev.vars, إلخ |
| `.env.example` | مثال على متغيرات البيئة (لا يحتوي قيم حقيقية) |
| `.dev.vars.example` | مثال على متغيرات التطوير المحلي |
| `README.md` | دليل شامل |
| `CHANGELOG.md` | سجل التغييرات |

## 7️⃣ ملاحظات أمنية مهمة

- ✅ الـ Bot Tokens و Cloudflare API Token **غير موجودة** في الكود
- ✅ الـ Secrets موجودة فقط في Cloudflare (كمتغيرات مشفّرة)
- ✅ `.env` و `.dev.vars` في `.gitignore` (لن يتم رفعهم)
- ⚠️ ملف `UST-Cloud-Credentials.md` (الموجود في download/) **لا ترفعه على GitHub** — احتفظ به محلياً فقط

## 8️⃣ بعد رفع المشروع

1. جرّب استنساخه على جهاز آخر للتأكد:
   ```bash
   git clone https://github.com/<USERNAME>/ust-central-bot.git
   cd ust-central-bot
   npm install
   # انسخ .env.example إلى .env واملأ القيم
   node scripts/setup.js
   ```

2. ابدأ العمل على المرحلة التالية (Supabase + قاعدة البيانات)
