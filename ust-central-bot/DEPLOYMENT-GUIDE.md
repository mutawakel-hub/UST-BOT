# 📦 دليل النشر والانتقال للإنتاج — UST Central Bot

> هذا الدليل يشرح: (1) كيفية الانتقال للبوتين الرسميين، (2) تغيير حساب Cloudflare، (3) تغيير Supabase.

---

## 📋 جدول المحتويات

1. [الانتقال للبوتين الرسميين](#1-الانتقال-للبوتين-الرسميين)
2. [تغيير حساب Cloudflare](#2-تغيير-حساب-cloudflare)
3. [تغيير Supabase (للمرحلة 2+)](#3-تغيير-supabase)
4. [التحديث التلقائي عبر GitHub Actions](#4-التحديث-التلقائي-عبر-github-actions)
5. [استكشاف الأخطاء](#5-استكشاف-الأخطاء)

---

## 1️⃣ الانتقال للبوتين الرسميين

> **متى تحتاج هذا؟** عند الانتقال من البوتين التجريبيين (`@usttesterbot`, `@usttesteradminbot`) إلى بوتين رسميين باسم الجامعة.

### الخطوة 1: إنشاء البوتين الرسميين

1. افتح تلغرام بحسابك الرسمي (الذي تملكه الجامعة)
2. ابحث عن **@BotFather** وأرسل `/newbot`
3. أنشئ البوت الأول:
   - **الاسم المعروض**: `البوت العلمي المركزي - جامعة UST`
   - **username**: `ust_central_bot` (أو أي اسم متاح)
   - **انسخ الـ Token**
4. كرّر نفس الخطوات لإنشاء بوت الإدارة:
   - **الاسم المعروض**: `بوت الإدارة - جامعة UST`
   - **username**: `ust_admin_bot` (أو أي اسم متاح)
   - **انسخ الـ Token**

### الخطوة 2: تحديث الـ Tokens في Cloudflare

```bash
# في مجلد المشروع (بعد git clone):

# تثبيت Wrangler
npm install

# تعيين Student Bot Token الجديد
echo "STUDENT_TOKEN_NEW_HERE" | npx wrangler secret put BOT_TOKEN --config wrangler.student.toml
# ⚠️ سيطلب CLOUDFLARE_API_TOKEN — أدخل القيمة من UST-Cloud-Credentials.md

# تعيين Admin Bot Token الجديد
echo "ADMIN_TOKEN_NEW_HERE" | npx wrangler secret put BOT_TOKEN --config wrangler.admin.toml
```

### الخطوة 3: تحديث أسماء البوتات في wrangler.toml

عدّل ملفي `wrangler.student.toml` و `wrangler.admin.toml`:

```toml
# wrangler.student.toml
[vars]
BOT_USERNAME = "ust_central_bot"   # ← الـ username الجديد (بدون @)
ENVIRONMENT = "production"          # ← غيّر من mockup إلى production
WORKERS_SUBDOMAIN = "your-subdomain"

# wrangler.admin.toml
[vars]
BOT_USERNAME = "ust_admin_bot"     # ← الـ username الجديد
ENVIRONMENT = "production"          # ← غيّر من mockup إلى production
WORKERS_SUBDOMAIN = "your-subdomain"
```

### الخطوة 4: إعادة تسجيل الـ Webhooks

```bash
# احصل على الـ subdomain من Cloudflare Dashboard
# ثم نفّذ:

curl -X POST "https://api.telegram.org/bot<NEW_STUDENT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://ust-student-bot.<subdomain>.workers.dev/webhook",
    "max_connections": 40,
    "allowed_updates": ["message", "callback_query", "edited_message"],
    "drop_pending_updates": true
  }'

curl -X POST "https://api.telegram.org/bot<NEW_ADMIN_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://ust-admin-bot.<subdomain>.workers.dev/webhook",
    "max_connections": 40,
    "allowed_updates": ["message", "callback_query", "edited_message"],
    "drop_pending_updates": true
  }'
```

### الخطوة 5: تحديث الـ Tokens في UST-Cloud-Credentials.md

⚠️ **مهم**: حدّث ملف `UST-Cloud-Credentials.md` محلياً (لا ترفعه على GitHub) بالـ Tokens الجديدة.

### الخطوة 6: نشر التحديثات

```bash
git add .
git commit -m "🚀 Production: Switch to official bots"
git push
# → GitHub Actions سينشر التحديثات تلقائياً
```

---

## 2️⃣ تغيير حساب Cloudflare

> **متى تحتاج هذا؟** عند نقل المشروع لحساب Cloudflare آخر (مثلاً: حساب رسمي للجامعة بدل الحساب الشخصي).

### الخطوة 1: إنشاء حساب Cloudflare جديد

1. اذهب إلى https://dash.cloudflare.com/sign-up
2. أنشئ حساباً جديداً ببريد رسمي للجامعة
3. فعّل Workers: اذهب لـ Workers & Pages → ابدأ مجاناً
4. عرّف الـ workers.dev subdomain (مثلاً: `ust-yemen`)

### الخطوة 2: الحصول على Account ID + API Token

```bash
# Account ID: من Dashboard → Workers & Pages (في الشريط الجانبي الأيمن)

# API Token:
# 1. اذهب إلى https://dash.cloudflare.com/profile/api-tokens
# 2. Create Token → "Edit Cloudflare Workers" template
# 3. انسخ الـ Token (يبدأ بـ cfut_...)
```

### الخطوة 3: تحديث GitHub Secrets

في المستودع على GitHub:
1. Settings → Secrets and variables → Actions
2. حدّث القيم:
   - `CLOUDFLARE_API_TOKEN` = الـ Token الجديد
   - `CLOUDFLARE_ACCOUNT_ID` = الـ ID الجديد

### الخطوة 4: تحديث wrangler.toml

عدّل جميع ملفات wrangler.toml الثلاثة:

```toml
# في كل من:
# - wrangler.student.toml
# - wrangler.admin.toml
# - pdf-server/wrangler.toml

[vars]
WORKERS_SUBDOMAIN = "ust-yemen"   # ← الـ subdomain الجديد
```

### الخطوة 5: إعادة تعيين الـ Bot Tokens في Cloudflare الجديد

```bash
# تعيين الـ tokens في الحساب الجديد
export CLOUDFLARE_API_TOKEN="new_cfut_token_here"
export CLOUDFLARE_ACCOUNT_ID="new_account_id_here"

echo "STUDENT_BOT_TOKEN" | npx wrangler secret put BOT_TOKEN --config wrangler.student.toml
echo "ADMIN_BOT_TOKEN"   | npx wrangler secret put BOT_TOKEN --config wrangler.admin.toml
```

### الخطوة 6: نشر + إعادة تسجيل Webhooks

```bash
# نشر المشروع على الحساب الجديد
npm run deploy:all

# إعادة تسجيل الـ webhooks بالروابط الجديدة
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://ust-student-bot.<new-subdomain>.workers.dev/webhook", "drop_pending_updates": true}'
# (كرّر لكل بوت)
```

### الخطوة 7: حذف الـ Workers من الحساب القديم

⚠️ **مهم**: بعد التأكد من عمل البوتين على الحساب الجديد:

1. اذهب لحساب Cloudflare القديم
2. Workers & Pages
3. احذف: `ust-student-bot`, `ust-admin-bot`, `ust-pdf-server`

---

## 3️⃣ تغيير Supabase

> **متى تحتاج هذا؟** عند الانتقال من Supabase تجريبي إلى Supabase رسمي، أو نقل قاعدة البيانات لحساب آخر.

> ⚠️ **ملاحظة**: هذه الخطوة تطبَّق في المرحلة 2+ (بعد ربط Supabase بالمشروع).

### الخطوة 1: إنشاء مشروع Supabase جديد

1. اذهب إلى https://supabase.com
2. إنشاء مشروع جديد (New Project)
3. اختر:
   - **Name**: `ust-central-bot-production`
   - **Database Password**: كلمة مرور قوية (احفظها!)
   - **Region**: الأقرب لليمن (Frankfurt - eu-central-1)
   - **Plan**: Free

### الخطوة 2: الحصول على الـ Keys

من Supabase Dashboard → Settings → API:

```
Project URL:           https://xxxxx.supabase.co
anon public key:       eyJhbGc...
service_role key:      eyJhbGc...  (⚠️ سري - لا يُستخدم في الكلاينت!)
```

### الخطوة 3: تطبيق الـ Schema

```bash
# في Supabase Dashboard → SQL Editor
# انسخ والصق محتوى ملف src/db/schema.sql (سيُضاف في المرحلة 2)
# ثم Run
```

### الخطوة 4: تحديث GitHub Secrets

في المستودع على GitHub → Settings → Secrets:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_ANON_KEY=eyJhbGc...
```

### الخطوة 5: تحديث wrangler.toml

```toml
# في كل من wrangler.student.toml و wrangler.admin.toml
[vars]
SUPABASE_URL = "https://xxxxx.supabase.co"
# ملاحظة: SUPABASE_SERVICE_ROLE_KEY يجب أن تكون secret وليست var

# إضافة كـ secret:
# echo "eyJhbGc..." | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.student.toml
```

### الخطوة 6: ترحيل البيانات (إن وجدت)

```bash
# من Supabase القديم:
# 1. Export كل جدول كـ CSV
# 2. في Supabase الجديد:
#    Table Editor → Import → ارفع الـ CSV

# أو استخدم سكريبت الترحيل (سيُضاف لاحقاً):
# node scripts/migrate-supabase.js
```

### الخطوة 7: تحديث روابط Webhooks (لو احتمل تغيير)

عادة لا تتغيّر، لكن تأكد:

```bash
npm run webhook:status
# إن كانت هناك مشاكل:
npm run webhook:reset
```

---

## 4️⃣ التحديث التلقائي عبر GitHub Actions

### كيف يعمل؟

```
git push → GitHub Actions → npm install → tsc check → wrangler deploy
                                                              ↓
                                              البوت يتحدّث تلقائياً خلال 60 ثانية
```

### متى يُشغّل تلقائياً؟

- ✅ عند كل `git push` على فرع `main`
- ✅ يدوياً من GitHub UI (Actions tab → "Run workflow")

### كيف ترى حالة النشر؟

1. اذهب لـ: https://github.com/mutawakel-hub/UST-BOT/actions
2. سترى كل الـ deployments مع الحالة (✅/❌)
3. اضغط على أي deployment لرؤية الـ logs التفصيلية

### ماذا لو فشل النشر؟

1. اذهب لـ Actions tab
2. اضغط على الـ workflow الفاشل
3. اقرأ الـ logs لمعرفة السبب
4. الغالب: خطأ TypeScript أو مشكلة في الـ secrets
5. أصلح الكود → `git push` → سيعيد المحاولة تلقائياً

---

## 5️⃣ استكشاف الأخطاء

### المشكلة: البوت لا يستجيب بعد التحديث

```bash
# 1. تأكد أن الـ GitHub Actions نجحت
#    https://github.com/mutawakel-hub/UST-BOT/actions

# 2. فحص حالة Workers
curl https://ust-student-bot.atow73768.workers.dev/health
curl https://ust-admin-bot.atow73768.workers.dev/health

# 3. فحص الـ Webhooks
npm run webhook:status

# 4. لو فيه مشكلة، أعد التسجيل
npm run webhook:reset
```

### المشكلة: GitHub Actions فشل بـ "Unauthorized"

- الـ `CLOUDFLARE_API_TOKEN` أو `CLOUDFLARE_ACCOUNT_ID` غير صحيحة في GitHub Secrets
- حدّثها من: GitHub repo → Settings → Secrets and variables → Actions

### المشكلة: TypeScript check فشل

```bash
# محلياً، شغّل نفس الفحص:
cd ust-central-bot
npm install
npx tsc --noEmit

# أصلح الأخطاء ثم git push مرة أخرى
```

### المشكلة: البوت القديم لا يزال يعمل بعد التبديل

- تأكد من حذف الـ Workers من الحساب القديم
- تأكد من تحديث الـ Tokens في Cloudflare Secrets
- `npm run webhook:reset` لإعادة التسجيل

---

## 📞 الدعم

- **GitHub Issues**: https://github.com/mutawakel-hub/UST-BOT/issues
- **البريد**: support@ust.edu.ye
- **تيليجرام**: @ust_support

---

## ⚠️ قائمة مراجع قبل أي تغيير كبير

```
[ ] أخذ نسخة احتياطية من قاعدة البيانات (بعد ربط Supabase)
[ ] تحديث ملف UST-Cloud-Credentials.md محلياً
[ ] اختبار التغيير على بوت تجريبي أولاً
[ ] تأكيد أن GitHub Actions نجحت
[ ] اختبار البوت بعد التغيير
[ ] تحديث الـ Webhooks إن لزم
```
