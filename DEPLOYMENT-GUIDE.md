# 📦 دليل النشر والانتقال للإنتاج — UST Central Bot

> هذا الدليل يشرح: (1) إعداد Supabase، (2) إعداد Cloudflare، (3) إعداد GitHub Actions،
> (4) الانتقال للبوتين الرسميين، (5) تغيير الحسابات، (6) استكشاف الأخطاء.

---

## 📋 جدول المحتويات

1. [إعداد Supabase (المشروع + الـ Schema)](#1-إعداد-supabase)
2. [إعداد Cloudflare Workers + Secrets](#2-إعداد-cloudflare-workers)
3. [إعداد GitHub Actions (Secrets + Workflows)](#3-إعداد-github-actions)
4. [تسجيل الـ Webhooks مع Telegram](#4-تسجيل-الـ-webhooks)
5. [الانتقال للبوتين الرسميين](#5-الانتقال-للبوتين-الرسميين)
6. [تغيير حساب Cloudflare](#6-تغيير-حساب-cloudflare)
7. [تغيير Supabase](#7-تغيير-supabase)
8. [استكشاف الأخطاء](#8-استكشاف-الأخطاء)

---

## 1️⃣ إعداد Supabase

### الخطوة 1: إنشاء مشروع Supabase

1. اذهب إلى https://supabase.com → **New Project**
2. املأ:
   - **Name**: `ust-central-bot`
   - **Database Password**: كلمة مرور قوية (احفظها!)
   - **Region**: Frankfurt (eu-central-1) — الأقرب لليمن
   - **Plan**: Free (500MB + 50k MAU)

### الخطوة 2: تطبيق الـ Schema

#### الطريقة اليدوية (مرة واحدة):

1. في Supabase Dashboard → **SQL Editor** → **New Query**
2. انسخ كامل محتوى `db/schema.sql`
3. الصقه في المحرر
4. اضغط **Run**
5. يجب أن ترى رسائل `CREATE TABLE` و `INSERT 0 ...` ناجحة

#### الطريقة التلقائية (دائمة):

بعد أول تطبيق يدوي، أي تعديل على `db/schema.sql` سيُطبَّق تلقائياً عبر Workflow `supabase-sync.yml` عند `git push`.

### الخطوة 3: التحقق من الجداول

```sql
-- التحقق من إنشاء الـ 24 جدول
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
-- يجب أن يُرجع 24 صفاً

-- التحقق من المناصب
SELECT id, level, title FROM positions ORDER BY level;

-- التحقق من الصلاحيات
SELECT id, name, min_level FROM permissions ORDER BY min_level, id;

-- التحقق من الكليات (مع قنوات التخزين)
SELECT id, name, storage_channel_id FROM colleges ORDER BY display_order;

-- التحقق من الـ Functions
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';
```

### الخطوة 4: الحصول على الـ Keys

من Dashboard → **Settings** → **API**:

```
Project URL:           https://xxxxx.supabase.co
anon public key:       eyJhbGc...
service_role key:      eyJhbGc...   ← ⚠️ سري جداً (يستخدم في البوتات)
```

> **مهم**: استخدم `service_role key` فقط في Workers (لأنها تتجاوز RLS).
> لا تستخدمها أبداً في كود الواجهة (frontend) أو ترفعها على GitHub.

### الخطوة 5: إدراج المسؤول الأول

في SQL Editor:

```sql
-- إدراج المسؤول المركزي الأول
INSERT INTO admin_users (telegram_id, first_name, username) VALUES
  (YOUR_TELEGRAM_ID, 'اسمك', 'your_username');

-- تعيينه في منصب central_chair
INSERT INTO position_holders (position_id, user_telegram_id, assigned_by)
VALUES ('central_chair', YOUR_TELEGRAM_ID, YOUR_TELEGRAM_ID);
```

بعد ذلك يمكنك الدخول لبوت الإدارة بمعرّفك.

---

## 2️⃣ إعداد Cloudflare Workers

### الخطوة 1: إنشاء حساب Cloudflare

1. اذهب إلى https://dash.cloudflare.com/sign-up
2. فعّل Workers: Workers & Pages → ابدأ مجاناً
3. عرّف الـ workers.dev subdomain (مثلاً: `atow73768`)

### الخطوة 2: الحصول على Account ID + API Token

```bash
# Account ID: من Dashboard → Workers & Pages (في الشريط الجانبي الأيمن)

# API Token:
# 1. https://dash.cloudflare.com/profile/api-tokens
# 2. Create Token → "Edit Cloudflare Workers" template
# 3. انسخ الـ Token
```

### الخطوة 3: تعيين الـ Secrets

```bash
# في مجلد المشروع
npm install

# Bot Tokens
echo "STUDENT_TOKEN_HERE" | npx wrangler secret put BOT_TOKEN --config wrangler.student.toml
echo "ADMIN_TOKEN_HERE"   | npx wrangler secret put BOT_TOKEN --config wrangler.admin.toml

# Supabase Service Key (⚠️ سري — يجب أن يكون Secret وليس var)
echo "eyJhbGc..." | npx wrangler secret put SUPABASE_SERVICE_KEY --config wrangler.student.toml
echo "eyJhbGc..." | npx wrangler secret put SUPABASE_SERVICE_KEY --config wrangler.admin.toml
```

### الخطوة 4: تحديث wrangler.toml

عدّل `wrangler.student.toml` و `wrangler.admin.toml`:

```toml
name = "ust-student-bot"
main = "src/student/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

workers_dev = true

[vars]
BOT_USERNAME = "usttesterbot"
ENVIRONMENT = "production"
WORKERS_SUBDOMAIN = "atow73768"
SUPABASE_URL = "https://xxxxx.supabase.co"
```

> ⚠️ `SUPABASE_URL` يُضاف كـ `var` (ليس سرّي).
> ⚠️ `SUPABASE_SERVICE_KEY` يجب أن يكون **Secret** (لا تضعه في `[vars]`).

### الخطوة 5: النشر الأول (يدوي)

```bash
npm run deploy:all
```

يجب أن ترى 3 Workers منشورة بنجاح:
- `ust-student-bot`
- `ust-admin-bot`
- `ust-pdf-server`

---

## 3️⃣ إعداد GitHub Actions

### المتطلبات

المستودع الخاص: https://github.com/mutawakel-hub/UST-BOT

### الخطوة 1: إضافة GitHub Secrets

اذهب إلى: GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

أضف الـ Secrets التالية:

| Secret Name | القيمة | ملاحظة |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | `cfut_...` | من Cloudflare |
| `CLOUDFLARE_ACCOUNT_ID` | `821ba2812d9ca...` | من Cloudflare |
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | من Supabase |
| `SUPABASE_SERVICE_KEY` | `eyJhbGc...` | ⚠️ سري جداً |

> ملاحظة: `BOT_TOKEN` و `SUPABASE_SERVICE_KEY` الخاص بالـ Workers يُعدّان عبر `wrangler secret put` (انظر الخطوة 3 أعلاه).
> أما `SUPABASE_URL` و `SUPABASE_SERVICE_KEY` هنا فهي لاستخدام `supabase-sync.yml`.

### الخطوة 2: تفعيل الـ Workflows

الـ Workflows موجودان في `.github/workflows/`:

#### `deploy.yml`
يُشغَّل عند كل `git push` على `main`:
1. فحص TypeScript
2. نشر `ust-student-bot` (Cloudflare)
3. نشر `ust-admin-bot` (Cloudflare)
4. نشر `ust-pdf-server` (Cloudflare)

#### `supabase-sync.yml`
يُشغَّل عند تعديل `db/schema.sql` أو `db/cleanup.sql`:
1. يقرأ الملف
2. يطبّقه على Supabase عبر REST API
3. يتحقق من النتيجة

> كلا الـ Workflows يدعمان التشغيل اليدوي (`workflow_dispatch`).

### الخطوة 3: أول نشر عبر GitHub Actions

```bash
git add -A
git commit -m "🚀 Production: Supabase integration"
git push origin main
```

ثم تابع التنفيذ في: https://github.com/mutawakel-hub/UST-BOT/actions

---

## 4️⃣ تسجيل الـ Webhooks

### النشر الأول (يدوي):

```bash
# الحصول على الـ subdomain من Cloudflare Dashboard
# ثم:

curl -X POST "https://api.telegram.org/bot<STUDENT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://ust-student-bot.atow73768.workers.dev/webhook",
    "max_connections": 40,
    "allowed_updates": ["message", "callback_query", "edited_message"],
    "drop_pending_updates": true
  }'

curl -X POST "https://api.telegram.org/bot<ADMIN_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://ust-admin-bot.atow73768.workers.dev/webhook",
    "max_connections": 40,
    "allowed_updates": ["message", "callback_query", "edited_message"],
    "drop_pending_updates": true
  }'
```

### أو عبر السكريبت:

```bash
npm run webhook:reset
```

### التحقق:

```bash
npm run webhook:status
# أو:
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

---

## 5️⃣ الانتقال للبوتين الرسميين

> **متى تحتاج هذا؟** عند الانتقال من البوتين التجريبيين (`@usttesterbot`, `@usttesteradminbot`) إلى بوتين رسميين باسم الجامعة.

### الخطوة 1: إنشاء البوتين الرسميين

1. افتح تلغرام بحسابك الرسمي (الذي تملكه الجامعة)
2. ابحث عن **@BotFather** وأرسل `/newbot`
3. أنشئ البوت الأول (الطالب)
4. كرّر لإنشاء بوت الإدارة
5. انسخ الـ Tokens

### الخطوة 2: تحديث الـ Tokens في Cloudflare

```bash
# في مجلد المشروع
echo "STUDENT_TOKEN_NEW_HERE" | npx wrangler secret put BOT_TOKEN --config wrangler.student.toml
echo "ADMIN_TOKEN_NEW_HERE"   | npx wrangler secret put BOT_TOKEN --config wrangler.admin.toml
```

### الخطوة 3: تحديث أسماء البوتات في wrangler.toml

عدّل `wrangler.student.toml` و `wrangler.admin.toml`:

```toml
[vars]
BOT_USERNAME = "ust_central_bot"     # ← الـ username الجديد (بدون @)
ENVIRONMENT = "production"
WORKERS_SUBDOMAIN = "atow73768"
SUPABASE_URL = "https://xxxxx.supabase.co"
```

### الخطوة 4: إعادة تسجيل الـ Webhooks

```bash
curl -X POST "https://api.telegram.org/bot<NEW_STUDENT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://ust-student-bot.atow73768.workers.dev/webhook",
    "max_connections": 40,
    "allowed_updates": ["message", "callback_query", "edited_message"],
    "drop_pending_updates": true
  }'

curl -X POST "https://api.telegram.org/bot<NEW_ADMIN_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://ust-admin-bot.atow73768.workers.dev/webhook",
    "max_connections": 40,
    "allowed_updates": ["message", "callback_query", "edited_message"],
    "drop_pending_updates": true
  }'
```

### الخطوة 5: نشر التحديثات

```bash
git add -A
git commit -m "🚀 Production: Switch to official bots"
git push origin main
# → GitHub Actions سينشر التحديثات تلقائياً
```

---

## 6️⃣ تغيير حساب Cloudflare

> **متى تحتاج هذا؟** عند نقل المشروع لحساب Cloudflare آخر (مثلاً: حساب رسمي للجامعة).

### الخطوة 1: إنشاء حساب Cloudflare جديد

1. اذهب إلى https://dash.cloudflare.com/sign-up
2. أنشئ حساباً جديداً ببريد رسمي للجامعة
3. فعّل Workers: Workers & Pages → ابدأ مجاناً
4. عرّف الـ workers.dev subdomain (مثلاً: `ust-yemen`)

### الخطوة 2: الحصول على Account ID + API Token

```bash
# Account ID: من Dashboard → Workers & Pages (الشريط الجانبي)

# API Token: https://dash.cloudflare.com/profile/api-tokens
# Create Token → "Edit Cloudflare Workers" template
```

### الخطوة 3: تحديث GitHub Secrets

في المستودع على GitHub:
1. Settings → Secrets and variables → Actions
2. حدّث:
   - `CLOUDFLARE_API_TOKEN` = الـ Token الجديد
   - `CLOUDFLARE_ACCOUNT_ID` = الـ ID الجديد

### الخطوة 4: تحديث wrangler.toml

عدّل `wrangler.student.toml` و `wrangler.admin.toml` و `pdf-server/wrangler.toml`:

```toml
[vars]
WORKERS_SUBDOMAIN = "ust-yemen"   # ← الـ subdomain الجديد
```

### الخطوة 5: إعادة تعيين الـ Bot Tokens + Supabase Key في الحساب الجديد

```bash
export CLOUDFLARE_API_TOKEN="new_cfut_token_here"
export CLOUDFLARE_ACCOUNT_ID="new_account_id_here"

echo "STUDENT_BOT_TOKEN" | npx wrangler secret put BOT_TOKEN --config wrangler.student.toml
echo "ADMIN_BOT_TOKEN"   | npx wrangler secret put BOT_TOKEN --config wrangler.admin.toml

echo "eyJhbGc..." | npx wrangler secret put SUPABASE_SERVICE_KEY --config wrangler.student.toml
echo "eyJhbGc..." | npx wrangler secret put SUPABASE_SERVICE_KEY --config wrangler.admin.toml
```

### الخطوة 6: نشر + إعادة تسجيل Webhooks

```bash
npm run deploy:all

# إعادة تسجيل الـ webhooks بالروابط الجديدة
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://ust-student-bot.ust-yemen.workers.dev/webhook", "drop_pending_updates": true}'
# (كرّر لكل بوت)
```

### الخطوة 7: حذف الـ Workers من الحساب القديم

⚠️ **مهم**: بعد التأكد من عمل البوتين على الحساب الجديد:

1. اذهب لحساب Cloudflare القديم
2. Workers & Pages
3. احذف: `ust-student-bot`, `ust-admin-bot`, `ust-pdf-server`

---

## 7️⃣ تغيير Supabase

> **متى تحتاج هذا؟** عند الانتقال من Supabase تجريبي إلى Supabase رسمي، أو نقل قاعدة البيانات لحساب آخر.

### الخطوة 1: إنشاء مشروع Supabase جديد

1. اذهب إلى https://supabase.com → **New Project**
2. اختر:
   - **Name**: `ust-central-bot-production`
   - **Database Password**: كلمة مرور قوية (احفظها!)
   - **Region**: Frankfurt (eu-central-1)
   - **Plan**: Free أو Pro

### الخطوة 2: الحصول على الـ Keys الجديدة

من Dashboard → Settings → API:

```
Project URL:           https://yyyyy.supabase.co
anon public key:       eyJhbGc...
service_role key:      eyJhbGc...
```

### الخطوة 3: تطبيق الـ Schema على المشروع الجديد

```bash
# في Supabase Dashboard → SQL Editor للمشروع الجديد
# انسخ db/schema.sql بالكامل والصقه → Run
```

### الخطوة 4: تحديث GitHub Secrets

في المستودع على GitHub → Settings → Secrets:

```
SUPABASE_URL=https://yyyyy.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...   (الجديد)
```

### الخطوة 5: تحديث wrangler.toml

عدّل `wrangler.student.toml` و `wrangler.admin.toml`:

```toml
[vars]
SUPABASE_URL = "https://yyyyy.supabase.co"
# (ملاحظة: SUPABASE_SERVICE_KEY كـ Secret)
```

ثم حدّث الـ Secret في Cloudflare:

```bash
echo "NEW_SERVICE_KEY_HERE" | npx wrangler secret put SUPABASE_SERVICE_KEY --config wrangler.student.toml
echo "NEW_SERVICE_KEY_HERE" | npx wrangler secret put SUPABASE_SERVICE_KEY --config wrangler.admin.toml
```

### الخطوة 6: ترحيل البيانات (إن وجدت)

```bash
# من Supabase القديم:
# 1. Table Editor → لكل جدول → Export → CSV
# 2. في Supabase الجديد: Table Editor → Import → ارفع الـ CSV
#    (الترتيب مهم: colleges → specialties → subjects → content_types → content → ...)

# أو استخدم سكريبت الترحيل (اختياري):
# node scripts/migrate-supabase.js   (سيُبنى لاحقاً)
```

### الخطوة 7: التحقق من الـ Webhooks

عادة لا تتغيّر، لكن تأكد:

```bash
npm run webhook:status
# إن كانت هناك مشاكل:
npm run webhook:reset
```

### الخطوة 8: تعطيل/حذف المشروع القديم

في Supabase القديم:
1. Settings → General → Pause project (مؤقت) أو Delete project (دائم)
2. ⚠️ احتفظ بنسخة احتياطية قبل الحذف

---

## 8️⃣ استكشاف الأخطاء

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

### المشكلة: فشل اتصال Supabase

```bash
# تتبّع سجلات بوت الطالب
npx wrangler tail --config wrangler.student.toml

# ابحث عن رسائل "Supabase SELECT error" أو "Supabase INSERT error"

# الأسباب الشائعة:
# - SUPABASE_SERVICE_KEY غير صحيحة في Cloudflare Secrets
# - SUPABASE_URL غير صحيح في wrangler.toml
# - الـ Schema لم يُطبَّق بعد على Supabase
# - تجاوز حد طلبات Supabase (Free Tier)
```

### المشكلة: GitHub Actions فشل بـ "Unauthorized"

- الـ `CLOUDFLARE_API_TOKEN` أو `CLOUDFLARE_ACCOUNT_ID` غير صحيحة في GitHub Secrets
- حدّثها من: GitHub repo → Settings → Secrets and variables → Actions

### المشكلة: GitHub Actions فشل بـ "Supabase Sync"

- `SUPABASE_URL` أو `SUPABASE_SERVICE_KEY` غير صحيحة في GitHub Secrets
- أو Function `exec_sql` غير موجودة في Supabase (يحدث مع المشاريع الجديدة)
- في هذه الحالة، طبّق `db/schema.sql` يدوياً من SQL Editor

### المشكلة: TypeScript check فشل

```bash
# محلياً، شغّل نفس الفحص:
cd ust-central-bot
npm install --legacy-peer-deps
npx tsc --noEmit

# أصلح الأخطاء ثم git push مرة أخرى
```

### المشكلة: البوت القديم لا يزال يعمل بعد التبديل

- تأكد من حذف الـ Workers من الحساب القديم
- تأكد من تحديث الـ Tokens في Cloudflare Secrets
- `npm run webhook:reset` لإعادة التسجيل

### المشكلة: ملفات الـ PDF لا تُرسَل

- تأكد أن `storage_channel_id` مُعرَّف في `colleges` لكلية الطالب
- تأكد أن `telegram_file_id` مُعرَّف في `content`
- جرّب إعادة رفع الملف عبر بوت الإدارة

---

## 📞 الدعم

- **GitHub Issues:** https://github.com/mutawakel-hub/UST-BOT/issues
- **البريد:** support@ust.edu.ye
- **تيليجرام:** @ust_support

---

## ⚠️ قائمة مراجع قبل أي تغيير كبير

```
[ ] أخذ نسخة احتياطية من قاعدة البيانات (Supabase → Database → Backups)
[ ] تحديث ملف الـ Credentials محلياً (لا ترفعه على GitHub)
[ ] اختبار التغيير على بوت تجريبي أولاً
[ ] تأكيد أن GitHub Actions نجحت
[ ] اختبار البوت بعد التغيير (التسجيل + تحميل ملف)
[ ] تحديث الـ Webhooks إن لزم
[ ] مراجعة سجلات Workers (npx wrangler tail)
```
