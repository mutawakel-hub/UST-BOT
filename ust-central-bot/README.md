# 🎓 UST Central Bot — v3.0 (Student) / v3.3 (Admin)

> **البوت العلمي المركزي لجامعة العلوم والتكنولوجيا - اليمن**
> مبني على Cloudflare Workers + Supabase + Telegram Webhooks (مجاني 100%)

---

## 📚 التوثيق

| الملف | الوصف |
|---|---|
| 📖 **[README.md](README.md)** | هذا الملف — نظرة عامة ودليل سريع |
| 🚀 **[DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md)** | دليل النشر والانتقال للإنتاج (Cloudflare + Supabase + GitHub Actions) |
| 🏗 **[ARCHITECTURE.md](ARCHITECTURE.md)** | شرح البنية التقنية (Workers + Supabase + RBAC) |
| 🗄️ **[SCHEMA-GUIDE.md](SCHEMA-GUIDE.md)** | شرح قاعدة البيانات (24 جدول + 6 Functions) |
| 📋 **[CHANGELOG.md](CHANGELOG.md)** | سجل التغييرات بين الإصدارات |

---

## 📱 البوتين المباشرين

| البوت | الرابط | الـ Worker URL |
|---|---|---|
| 🎓 **بوت الطالب (v3.0)** | [@usttesterbot](https://t.me/usttesterbot) | https://ust-student-bot.atow73768.workers.dev |
| 🛡 **بوت الإدارة (v3.3)** | [@usttesteradminbot](https://t.me/usttesteradminbot) | https://ust-admin-bot.atow73768.workers.dev |

> ✅ **بوت الطالب متكامل بالكامل مع Supabase** — لا توجد بيانات وهمية.
> ⚠️ **بوت الإدارة مدمج جزئياً** — المساهمات والتعميمات تعمل على Supabase، البقية تنتقل تدريجياً.

---

## 🏗️ البنية الحالية

```
                  ┌──────────────────────────────┐
                  │     Telegram Messenger       │
                  │   (Students + Admins)        │
                  └────────────┬─────────────────┘
                               │ HTTPS Webhooks
                               ▼
   ┌──────────────────────────────────────────────────────────┐
   │              Cloudflare Workers (Free Tier)               │
   │                                                            │
   │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────┐ │
   │  │ ust-student-bot │  │  ust-admin-bot  │  │ust-pdf-srv │ │
   │  │     (v3.0)      │  │     (v3.3)      │  │            │ │
   │  └────────┬────────┘  └────────┬────────┘  └────────────┘ │
   │           └─────────┬──────────┘                            │
   │                     │                                       │
   └─────────────────────┼───────────────────────────────────────┘
                         │ HTTPS REST (PostgREST)
                         ▼
   ┌──────────────────────────────────────────────────────────┐
   │                Supabase (PostgreSQL)                       │
   │  24 Tables · 6 Functions · 1 View · 2 Triggers             │
   │  Schema v1.2                                               │
   └──────────────────────────────────────────────────────────┘
                         ▲
                         │ file_id (message_id)
   ┌──────────────────────────────────────────────────────────┐
   │           Telegram Storage Channels (real)                │
   │  • Medicine  (-1004405014472) — كلية الطب                 │
   │  • Computers (-1003727164402) — كلية الحاسبات             │
   └──────────────────────────────────────────────────────────┘
```

### 🤖 النشر التلقائي (GitHub Actions)

```
git push origin main
        │
        ▼
GitHub Actions (2 workflows بالتوازي)
        │
        ├─ 🚀 deploy.yml
        │   ├─ 🔍 فحص TypeScript
        │   ├─ 🎓 نشر Student Bot
        │   ├─ 🛡 نشر Admin Bot
        │   └─ 📄 نشر PDF Server
        │
        └─ 🗄️ supabase-sync.yml (عند تعديل db/schema.sql)
            └─ 📦 تطبيق الـ Schema على Supabase
        │
        ▼
البوت وقاعدة البيانات يتحدّثان خلال 60 ثانية ✅
```

---

## 📋 المميزات

### 🎓 بوت الطالب v3.0 (Production-Ready)

- ✅ **تكامل كامل مع Supabase** — لا بيانات وهمية، كل شيء من قاعدة البيانات
- ✅ **نظام تسجيل صريح** عند أول `/start` (الكلية، التخصص، المستوى)
- ✅ 7 كليات + 34 تخصص (تغطية كاملة لجامعة UST)
- ✅ استرجاع المواد والمحتوى من Supabase حسب نطاق الطالب
- ✅ Breadcrumb في كل شاشة (مسار التنقّل)
- ✅ عدّاد ملفات لكل تصنيف (استعلامات حقيقية على `content`)
- ✅ **شاشة معاينة الملف** قبل التحميل (اسم، حجم، تاريخ، رافع، عدّاد)
- ✅ **إرسال الملف الفعلي** من قنوات التخزين عبر `telegram_file_id`
- ✅ بحث شامل في المواد والملفات (باستخدام `pg_trgm`)
- ✅ لوحة الشرف من جدول `students` (ترتيب حسب `total_points`)
- ✅ حسابي: إحصائيات + مساهماتي + تحميلاتي + إشعاراتي
- ✅ نظام النقاط (`student_points` + `contribution_honors`)
- ✅ Pagination في القوائم الطويلة (8 عناصر/صفحة)
- ✅ مساهمة الطلاب برفع الملفات (تُسجَّل في `contributions`)
- ✅ تسجيل التحميلات في `downloads` للإحصائيات
- ✅ إشعارات الطالب (`student_notifications`)

### 🛡 بوت الإدارة v3.3

- ✅ نظام تسجيل دخول بأربعة أدوار هرمية
- ✅ **نظام RBAC كامل** — 19 صلاحية موزّعة على 9 مناصب (مع الوراثة)
- ✅ لوحة إدارة ديناميكية (تتغير حسب صلاحيات المستخدم من Supabase)
- ✅ **مراجعة المساهمات من Supabase** (اعتماد / اعتماد مميز / رفض مع سبب)
- ✅ **التعميمات تُسجَّل في `broadcasts`** — تُرسَل للمستلمين حسب RBAC
- ✅ **تعميمات ديناميكية بنطاقات**: الكل / كلية / تخصص / مستوى (معاينة قبل الإرسال)
- ✅ معالج رفع ملفات كامل (6 خطوات + شريط تقدّم)
- ✅ استعراض الملفات مع فلاتر
- ✅ إدارة المواد (إضافة/تعديل/قائمة)
- ✅ إدارة المسؤولين (إضافة فعلي + قائمة)
- ✅ إحصائيات شاملة (استعلامات Supabase)
- ✅ تخصيص النصوص (`custom_texts`)
- ✅ تحديث لوحة الشرف (`leaderboard` + `contribution_honors`)
- ✅ نظام تكريم المساهمين (`manage_honors` permission)
- ✅ إعادة ضبط النقاط (`reset_points` + `points_reset_logs`)
- ✅ تسجيل الخروج

---

## 🗄️ قاعدة البيانات (Supabase)

### الإحصائيات

| البند | القيمة |
|---|---|
| إصدار الـ Schema | v1.2 |
| عدد الجداول | **24** |
| عدد الـ Functions (RPC) | 6 |
| عدد الـ Triggers | 2 |
| عدد الـ Views | 1 (`user_permissions`) |
| عدد المناصب | 9 (1 مركزي + 7 كليات + مندوب مستوى) |
| عدد الصلاحيات | **19** |
| أنواع المحتوى | 6 (كتاب نظري/عملي، اختبارات، ملخصات، مرئيات، مراجع) |

### الجداول الـ 24

**الهيكل الأكاديمي (3):** `colleges` · `specialties` · `subjects`
**المحتوى (2):** `content_types` · `content`
**نظام RBAC (5):** `admin_users` · `positions` · `position_holders` · `permissions` · `position_level_permissions`
**المساهمات والمراجعة (2):** `contributions` · `broadcasts`
**سجلات التدقيق (2):** `position_audit_logs` · `content_audit_logs`
**الطلاب والتفاعل (5):** `students` · `downloads` · `leaderboard` · `student_subscriptions` · `student_notifications`
**النقاط والتكريم (3):** `student_points` · `contribution_honors` · `points_reset_logs`
**التخصيص والقنوات (2):** `custom_texts` · `committee_channels`

### الـ Functions الست

| Function | الوصف |
|---|---|
| `register_student(...)` | تسجيل/تحديث بيانات الطالب عند `/start` |
| `user_has_permission(...)` | التحقق من صلاحية لمستخدم في نطاق محدد |
| `get_broadcast_recipients(...)` | إرجاع مستلمي التعميم حسب النطاق (الكل/كلية/تخصص/مستوى) |
| `get_top_contributors_specialty(...)` | أعلى المساهمين في تخصص محدد (للوحة الشرف) |
| `award_contribution_points(...)` | منح النقاط للطالب عند اعتماد مساهمته |
| `notify_contribution_rejected(...)` | إنشاء إشعار تلقائي عند رفض مساهمة |

---

## 📦 قنوات التخزين (Storage Channels)

قنوات تلغرام حقيقية تُستخدم لتخزين الملفات (يفصل بين الإدارة والتخزين):

| الكلية | معرّف القناة | الحالة |
|---|---|---|
| 🏥 كلية الطب والعلوم الصحية | `-1004405014472` | ✅ فعّالة |
| 💻 كلية الحاسبات وتكنولوجيا المعلومات | `-1003727164402` | ✅ فعّالة |
| 🦷 كلية طب الأسنان | — | ⏳ قيد الإنشاء |
| 💊 كلية الصيدلة | — | ⏳ قيد الإنشاء |
| ⚙️ كلية الهندسة | — | ⏳ قيد الإنشاء |
| 📊 كلية العلوم الإدارية | — | ⏳ قيد الإنشاء |
| 📚 كلية العلوم الإنسانية | — | ⏳ قيد الإنشاء |

> يُخزَّن `storage_channel_id` في جدول `colleges`، ويُربط كل محتوى بـ `telegram_message_id` + `telegram_file_id`.

---

## 🏗 بنية المشروع

```
ust-central-bot/
├── package.json                  # Dependencies + scripts
├── tsconfig.json                 # TypeScript config
├── wrangler.student.toml         # إعداد بوت الطالب
├── wrangler.admin.toml           # إعداد بوت الإدارة
├── .env.example                  # مثال على متغيرات البيئة
├── .dev.vars.example             # مثال على متغيرات التطوير المحلي
├── .gitignore
├── README.md                     # هذا الملف
│
├── .github/workflows/
│   ├── deploy.yml                # نشر البوتات + PDF Server على Cloudflare
│   └── supabase-sync.yml         # مزامنة db/schema.sql مع Supabase
│
├── db/
│   ├── schema.sql                # الـ Schema الكامل (24 جدول + 6 Functions)
│   └── cleanup.sql               # سكريبت التنظيف (للتراجع)
│
├── src/
│   ├── shared/                   # الكود المشترك
│   │   ├── data/
│   │   │   ├── colleges.ts       # 7 كليات + 34 تخصص + storage_channel_id
│   │   │   ├── subjects.ts       # بيانات المواد (تُستخدم للبذرة الأولية)
│   │   │   ├── leaderboard.ts    # بيانات البذرة للوحة الشرف
│   │   │   └── admins.ts         # بيانات البذرة للمسؤولين
│   │   ├── keyboards.ts          # جميع الـ Keyboards
│   │   ├── texts.ts              # كل النصوص (عربي فصحى مبسّطة)
│   │   ├── db.ts                 # عميل Supabase + كل الاستعلامات
│   │   └── rbac.ts               # التحقق من الصلاحيات
│   │
│   ├── student/
│   │   └── index.ts              # بوت الطالب v3.0 (متكامل مع Supabase)
│   │
│   └── admin/
│       └── index.ts              # بوت الإدارة v3.3 (جزئي مع Supabase)
│
├── pdf-server/                   # خدمة PDF احتياطية
│   ├── index.ts
│   └── wrangler.toml
│
└── scripts/
    ├── setup.js                  # سكريبت الإعداد الكامل
    ├── set-secrets.js            # تعيين Bot Tokens كأسرار
    ├── set-webhooks.js           # تسجيل Webhooks
    ├── webhook-manager.js        # فحص/تنظيف/إعادة تسجيل الـ webhooks
    ├── load-env.js               # تحميل .env
    ├── generate_mock_pdf.py      # توليد PDF تجريبي
    └── mockup_sample.pdf         # ملف PDF التجريبي
```

---

## 🚀 خطوات التثبيت والنشر

### المتطلبات المسبقة

1. **Node.js 18+** — [تحميل](https://nodejs.org/)
2. **حساب Cloudflare** مجاني — [التسجيل](https://dash.cloudflare.com/sign-up)
3. **حساب Supabase** مجاني — [التسجيل](https://supabase.com)
4. **Bot Tokens** من [@BotFather](https://t.me/BotFather) (بوتان)

### الإعداد السريع

```bash
# 1. استنساخ المشروع
git clone https://github.com/mutawakel-hub/UST-BOT.git
cd UST-BOT

# 2. تثبيت الـ dependencies
npm install

# 3. نسخ ملف المتغيرات وتعبئته
cp .env.example .env
# (حرّر .env وأضف: CLOUDFLARE_API_TOKEN، CLOUDFLARE_ACCOUNT_ID،
#  WORKERS_SUBDOMAIN، STUDENT_BOT_TOKEN، ADMIN_BOT_TOKEN،
#  SUPABASE_URL، SUPABASE_SERVICE_KEY)

# 4. تطبيق الـ Schema على Supabase (من SQL Editor يدوياً)
#    أو ارفع db/schema.sql في مستودعك وسيُطبَّق تلقائياً عبر supabase-sync.yml

# 5. تعيين Bot Tokens كـ Cloudflare Secrets
echo "STUDENT_TOKEN_HERE" | npx wrangler secret put BOT_TOKEN --config wrangler.student.toml
echo "ADMIN_TOKEN_HERE"   | npx wrangler secret put BOT_TOKEN --config wrangler.admin.toml

# 6. تعيين Supabase Secret
echo "SUPABASE_SERVICE_KEY_HERE" | npx wrangler secret put SUPABASE_SERVICE_KEY --config wrangler.student.toml
echo "SUPABASE_SERVICE_KEY_HERE" | npx wrangler secret put SUPABASE_SERVICE_KEY --config wrangler.admin.toml

# 7. نشر الـ Workers
npm run deploy:all

# 8. تسجيل الـ Webhooks
npm run webhook:reset
```

> 📖 التفاصيل الكاملة في **[DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md)**.

---

## ⚙️ متغيرات البيئة (.env)

| المتغير | الوصف | مطلوب؟ |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Token بصلاحيات Workers | ✅ |
| `CLOUDFLARE_ACCOUNT_ID` | معرّف الحساب | ✅ |
| `WORKERS_SUBDOMAIN` | Subdomain من workers.dev | ✅ |
| `STUDENT_BOT_TOKEN` | Token بوت الطالب | ✅ |
| `ADMIN_BOT_TOKEN` | Token بوت الإدارة | ✅ |
| `STUDENT_BOT_USERNAME` | username بوت الطالب (بدون @) | ✅ |
| `ADMIN_BOT_USERNAME` | username بوت الإدارة (بدون @) | ✅ |
| `SUPABASE_URL` | Project URL من Supabase | ✅ |
| `SUPABASE_SERVICE_KEY` | service_role key (⚠️ سري) | ✅ |
| `PDF_SERVER_URL` | URL لـ PDF Server (اختياري) | ❌ |
| `ENVIRONMENT` | development / production | ❌ |

> ⚠️ `SUPABASE_SERVICE_KEY` يجب أن تكون **Cloudflare Secret** وليست `var` عادي.

---

## 🛠 أوامر التشغيل

```bash
# الإعداد الكامل (مرة واحدة)
npm run setup

# النشر
npm run deploy:student         # نشر بوت الطالب فقط
npm run deploy:admin           # نشر بوت الإدارة فقط
npm run deploy:all             # نشر البوتين + PDF Server

# إدارة الـ Webhooks
npm run webhook:status         # فحص حالة الـ webhooks
npm run webhook:clear          # تنظيف التحديثات المعلّقة
npm run webhook:reset          # إعادة تسجيل الـ webhooks

# التطوير المحلي
npm run dev:student            # تشغيل بوت الطالب محلياً
npm run dev:admin              # تشغيل بوت الإدارة محلياً

# الفحص
npm run typecheck              # فحص TypeScript
```

---

## 🛡️ نظام الصلاحيات (RBAC)

### هرم الوراثة (9 مناصب)

```
🛡 رئيس اللجنة المركزية (central_chair) — 1 منصب
   │ + 8 صلاحيات خاصة به
   │
   ▼ يرث ↓
🏛 مسؤول كلية (college_admin_1..7) — 7 مناصب
   │ + 4 صلاحيات لكل كلية
   │
   ▼ يرث ↓
📊 مندوب مستوى (level_rep_<spec>_<lvl>) — قوالب ديناميكية
     4 صلاحيات أساسية
```

### الصلاحيات الـ 19

- **مستوى (4):** `level_broadcast` · `approve_level_contributions` · `manage_level_content` · `view_level_stats`
- **كلية (+4):** `manage_subjects` · `college_broadcast` · `manage_level_reps` · `view_college_stats`
- **مركزي (+8):** `manage_admins` · `manage_colleges` · `manage_specialties` · `manage_committee_channels` · `view_central_stats` · `view_reports` · `system_settings` · `central_broadcast`
- **مركزي — التكريم والنقاط (+3):** `manage_honors` · `reset_points` · `view_honors_log`

> الصلاحيات تُفحَص عبر Function `user_has_permission(...)` مع الوراثة التلقائية.

---

## 🧪 سيناريوهات التجربة

### 🎓 بوت الطالب — التسجيل لأول مرة

```
/start
↓ 👋 مرحباً! لاستخدام البوت، نحتاج بياناتك
↓ 🏛 اختر كليتك
↓ 💻 الحاسبات وتكنولوجيا المعلومات
↓ تقنية معلومات (IT)
↓ المستوى 1
↓ ✅ تم تسجيلك في Supabase!
↓ 🏠 القائمة الرئيسية
```

### 🎓 بوت الطالب — تحميل ملف

```
/start
↓ 🏛 الكليات → الحاسبات → IT → المستوى 1 → الفصل الأول
↓ برمجة حاسوب (1) - Python
↓ 📘 المقرر (نظري) — 2
↓ اختر ملفاً ⭐
↓ 📄 معاينة الملف (اسم، حجم، تاريخ، رافع، عدّاد)
↓ ⬇️ تحميل الملف
✅ يصلك الملف الفعلي من قناة التخزين!
```

### 🛡 بوت الإدارة — تعميم ديناميكي

```
/start
↓ أدخل معرّف المسؤول
↓ 📢 التعميمات
↓ ✍️ إنشاء تعميم جديد
↓ اختر النطاق (الكل/كلية/تخصص/مستوى)
↓ معاينة قبل الإرسال
↓ ✅ تأكيد
✅ يُرسَل لكل المستلمين + يُسجَّل في جدول broadcasts
```

---

## 📊 إحصائيات المشروع

| البند | القيمة |
|---|---|
| إصدار بوت الطالب | **v3.0** |
| إصدار بوت الإدارة | **v3.3** |
| إصدار قاعدة البيانات | **v1.2** |
| عدد الكليات | 7 |
| عدد التخصصات | 34 |
| جداول قاعدة البيانات | 24 |
| صلاحيات RBAC | 19 |
| مناصب RBAC | 9 |
| Functions (RPC) | 6 |
| قنوات التخزين الفعلية | 2 (الطب + الحاسبات) |
| Workers منشورة | 3 (student + admin + pdf-server) |
| Workflows (GitHub Actions) | 2 (deploy + supabase-sync) |
| إجمالي سطور الكود (الأساسية) | ~7,000 |
| التكلفة الشهرية | $0 (Cloudflare + Supabase Free Tiers) |

---

## 🔐 الأمان

- ✅ Bot Tokens مُخزّنة كـ **Cloudflare Secrets** (مشفّرة)
- ✅ `SUPABASE_SERVICE_KEY` مُخزّنة كـ **Cloudflare Secrets** (وليس كـ var)
- ✅ لا توجد بيانات حساسة في الكود
- ✅ معالجة أخطاء شاملة (لا أخطاء 500 للـ Telegram)
- ✅ تجاهل أخطاء "query is too old" و "message not modified"
- ✅ **Triggers** تمنع حذف المسؤول المركزي (`prevent_central_deletion`, `prevent_central_orphan`)
- ✅ **Audit Trail** كامل لكل تغييرات المناصب والمحتوى
- ⏳ Rate Limiting (KV + Durable Objects) — مرحلة قادمة
- ⏳ HMAC signing على callback_data — مرحلة قادمة

---

## 🐛 استكشاف الأخطاء

### البوت لا يستجيب

```bash
# 1. فحص حالة الـ Webhook
npm run webhook:status

# 2. إن وجدت أخطاء، نظّف التحديثات المعلّقة
npm run webhook:clear

# 3. أعد تسجيل الـ Webhook
npm run webhook:reset

# 4. أرسل /start من جديد في البوت
```

### فشل اتصال Supabase

```bash
# تتبّع سجلات بوت الطالب
npx wrangler tail --config wrangler.student.toml

# ابحث عن رسائل "Supabase SELECT error" أو "Supabase INSERT error"
# الأسباب الشائعة:
# - SUPABASE_SERVICE_KEY غير صحيحة في Cloudflare Secrets
# - SUPABASE_URL غير صحيح في wrangler.toml
# - الـ Schema لم يُطبَّق بعد على Supabase
```

### فحص صحة الـ Workers

```bash
curl https://ust-student-bot.atow73768.workers.dev/health
curl https://ust-admin-bot.atow73768.workers.dev/health
```

---

## 🌍 معلومات النشر الحالي

- **GitHub Repo:** https://github.com/mutawakel-hub/UST-BOT (خاص)
- **Workers.dev Subdomain:** `atow73768`
- **بيئة التشغيل:** Cloudflare Workers (مجاني 100%)
- **قاعدة البيانات:** Supabase (Free Tier)
- **Workers منشورة:**
  - `ust-student-bot` — بوت الطالب v3.0
  - `ust-admin-bot` — بوت الإدارة v3.3
  - `ust-pdf-server` — خدمة PDF احتياطية
- **GitHub Actions:**
  - `deploy.yml` — نشر البوتات عند كل push على main
  - `supabase-sync.yml` — مزامنة الـ Schema عند تعديل `db/schema.sql`

---

## 🎯 خريطة الطريق للمراحل القادمة

### المرحلة القادمة: استكمال تكامل بوت الإدارة

- [ ] ربط إدارة المواد بـ Supabase (CRUD كامل)
- [ ] ربط استعراض الملفات بـ Supabase
- [ ] ربط إحصائيات الإدارة بـ Supabase
- [ ] ربط إدارة المسؤولين بـ `position_holders`

### المرحلة 4: قنوات التخزين المتبقية

- [ ] إنشاء 5 قنوات تخزين للكليات المتبقية (طب أسنان، صيدلة، هندسة، علوم إدارية، علوم إنسانية)
- [ ] رفع الملفات للقنوات
- [ ] ربط كل كلية بـ `storage_channel_id` الخاص بها

### المرحلة 5: ميزات متقدمة

- [ ] Rate Limiting (KV + Durable Objects)
- [ ] Audit Log شامل عبر Admin UI
- [ ] توقيع callback_data بـ HMAC
- [ ] فحص الملفات (Magic Bytes)
- [ ] تنبيهات أمان للمسؤول المركزي

---

## 📞 الدعم

- **GitHub Issues:** https://github.com/mutawakel-hub/UST-BOT/issues
- **المشرف:** UST Central Bot Team
- **البريد:** support@ust.edu.ye
- **تيليجرام:** @ust_support

---

## 📜 الترخيص

© 2026 University of Science and Technology - Yemen. All rights reserved.
