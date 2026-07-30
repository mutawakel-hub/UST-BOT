# 🎓 UST Central Bot — نظام البوت العلمي المركزي

> **البوت العلمي المركزي لجامعة العلوم والتكنولوجيا - اليمن**
> منشور على Cloudflare Workers + Telegram Webhooks + Supabase (مجاني 100%)

[![Deploy Status](https://github.com/mutawakel-hub/UST-BOT/actions/workflows/deploy.yml/badge.svg)](https://github.com/mutawakel-hub/UST-BOT/actions)
[![Tests](https://img.shields.io/badge/tests-83%2F83-brightgreen)](tests/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6%2B-blue)](tsconfig.json)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## 📖 جدول المحتويات

- [نظرة عامة](#نظرة-عامة)
- [المميزات](#المميزات)
- [التقنيات المستخدمة](#التقنيات-المستخدمة)
- [بنية المشروع](#بنية-المشروع)
- [نظام 🌟 إحسان علمي](#نظام--إحسان-علمي)
- [قاعدة البيانات](#قاعدة-البيانات)
- [الأمان](#الأمان)
- [التثبيت والنشر](#التثبيت-والنشر)
- [الاختبارات](#الاختبارات)
- [CI/CD](#cicd)
- [استكشاف الأخطاء](#استكشاف-الأخطاء)

---

## نظرة عامة

نظام متكامل من بوتين تلغرام لإدارة المحتوى العلمي لجامعة العلوم والتكنولوجيا:

| البوت | الرابط | الوظيفة |
|---|---|---|
| 🎓 **بوت الطالب** | [@usttesterbot](https://t.me/usttesterbot) | تصفّح الكليات والتخصصات والمواد، تحميل الملفات، تقديم إحسان علمي، روّاد الإحسان |
| 🛡 **بوت الإدارة** | [@usttesteradminbot](https://t.me/usttesteradminbot) | إدارة الإحسان، المراجعة والاعتماد، التعميمات، إدارة المسؤولين، الإحصائيات |

### إحصائيات المشروع

| البند | القيمة |
|---|---|
| الإصدار | v3.3 (الإدارة) / v3.0 (الطالب) |
| عدد الكليات | 7 (جميعها بقنوات تخزين فعّالة) |
| عدد التخصصات | 34 |
| عدد المواد | 25+ (قابلة للتوسيع) |
| جداول قاعدة البيانات | 26 |
| دوال PostgreSQL | 10 |
| أنواع المحتوى | 7 |
| الصلاحيات (RBAC) | 19 |
| المناصب | 9 (1 مركزي + 7 كليات + ديناميكية للمستويات) |
| قنوات التخزين | 7 (واحدة لكل كلية) + قناة أرشيف |
| اختبارات وحدة | 83 (4 ملفات) |
| سطور الكود | ~13,186 سطر TypeScript |
| التكلفة الشهرية | $0 |

---

## المميزات

### 🎓 بوت الطالب

- ✅ **7 كليات + 34 تخصص** بتغطية كاملة لجامعة UST
- ✅ **تسجيل صريح** عند أول `/start` (كلية → تخصص → مستوى)
- ✅ **تصفّح هرمي**: كليات → تخصصات → مستويات → فصول → مواد
- ✅ **7 أنواع محتوى** لكل مادة (نظري، عملي، ملخصات، اختبارات، مرئيات، مراجع، جداول)
- ✅ **🌟 إحسان علمي**: تقديم محتوى علمي للمساهمة في بناء المكتبة
- ✅ **🏆 روّاد الإحسان**: عرض أفضل 3 محسنين لكل مستوى + أرشيف الدورات السابقة
- ✅ **👤 حسابي**: إحصائيات، إحساناتي (حالة كل إحسان)، إشعارات
- ✅ **بحث شامل** في المواد والملفات
- ✅ **Breadcrumb** (مسار التنقّل) في كل شاشة
- ✅ **تسليم الملفات** عبر `forwardMessage` مع fallback إلى `sendDocument`

### 🛡 بوت الإدارة

- ✅ **نظام RBAC هرمي** (مركزي → كلية → مستوى) مع وراثة الصلاحيات
- ✅ **🌟 إدارة الإحسان**: مراجعة، اعتماد بنقاط متغيرة، رفض، تمييز، معاينة قبل الاعتماد
- ✅ **⏰ تصعيد تلقائي**: تنبيهات متدرّجة (24س → 48س → 72س) عبر Cron Trigger
- ✅ **👥 إدارة المسؤولين**: تعيين/استبدال/إزالة بـ 5 خطوات + هيكل إداري + سجل تعيينات
- ✅ **📢 تعميمات ديناميكية** حسب الصلاحية (الكل/كلية/تخصص/مستوى)
- ✅ **📊 إحصائيات وتقارير** حسب النطاق
- ✅ **⚙️ إعدادات النظام**: نقاط الأنواع، مدة التصعيد، عدد المتصدرين
- ✅ **🔄 إنهاء الدورة**: أرشفة في قناة + تصفير النقاط الحالية + حفظ التاريخ
- ✅ **📊 أداء المسؤولين**: متوسط زمن المراجعة، الحالات المتأخرة، معدل الاعتماد
- ✅ **إشعارات تلقائية** للمسؤولين الجدد/المُزالين

---

## التقنيات المستخدمة

| الطبقة | التقنية | السبب |
|---|---|---|
| Runtime | **Cloudflare Workers** | 100k طلب/يوم مجاناً |
| اللغة | **TypeScript 5.6+** (strict) | أمان الأنواع |
| مكتبة TG | **grammY ^1.30** | مصممة لـ Serverless |
| النشر | **Wrangler 4** | CLI رسمي من Cloudflare |
| قاعدة البيانات | **Supabase** (PostgreSQL) | مجاني 500MB + PostgREST |
| الجلسات والـ Cache | **Cloudflare KV** | مجاني 100k قراءة/يوم |
| تخزين الملفات | **Telegram Channels** | مجاني غير محدود |
| CI/CD | **GitHub Actions** | مجاني للمستودعات العامة |
| الاختبارات | **Vitest ^1.6** | سريع + coverage |
| امتدادات PG | `pg_trgm` + `pgcrypto` | بحث ضبابي عربي + تشفير |

---

## بنية المشروع

```
UST-BOT/
├── package.json                  # 14 سكريبت + dependencies
├── tsconfig.json                 # strict mode (بدون strictNullChecks)
├── vitest.config.ts              # إعدادات الاختبارات
├── wrangler.student.toml         # إعداد بوت الطالب (KV × 2)
├── wrangler.admin.toml           # إعداد بوت الإدارة (KV × 2 + Cron)
│
├── db/
│   ├── schema.sql                # 26 جدول + 10 دوال + 7 أنواع محتوى
│   ├── cleanup.sql               # حذف كل الجداول
│   ├── seed_data.sql             # بيانات أولية (مواد + مسؤولين)
│   └── update_storage_channels.sql # تحديث قنوات التخزين
│
├── src/
│   ├── shared/                   # الكود المشترك (8 ملفات + 4 بيانات)
│   │   ├── db.ts                 # عميل Supabase + 23 دالة
│   │   ├── rbac.ts               # نظام الصلاحيات (786 سطر)
│   │   ├── session.ts            # SessionStore + CacheStore + RateLimiter
│   │   ├── storage.ts            # رفع/تسليم/حذف الملفات
│   │   ├── callback-signing.ts   # توقيع HMAC-SHA256
│   │   ├── keyboards.ts          # 30+ لوحة مفاتيح
│   │   ├── texts.ts              # كل النصوص (914 سطر)
│   │   └── data/
│   │       ├── colleges.ts       # 7 كليات + 34 تخصص
│   │       ├── subjects.ts       # 25 مادة + دوال مساعدة
│   │       ├── admins.ts         # أنواع المحتوى + بيانات RBAC
│   │       └── leaderboard.ts    # بيانات لوحة الشرف
│   │
│   ├── admin/                    # بوت الإدارة
│   │   ├── index.ts              # Orchestrator + Cron handler
│   │   ├── state.ts              # AdminSession
│   │   ├── helpers.ts            # 15 دالة مساعدة
│   │   └── handlers/             # 13 ملف handler
│   │       ├── dashboard.ts      # /start + لوحة الإدارة
│   │       ├── contributions.ts  # مراجعة + اعتماد + رفض + معاينة
│   │       ├── content.ts        # إدارة المحتوى
│   │       ├── subjects.ts       # إدارة المواد
│   │       ├── broadcast.ts      # التعميمات
│   │       ├── statistics.ts     # الإحصائيات
│   │       ├── texts.ts          # تخصيص النصوص
│   │       ├── positions.ts      # إدارة المسؤولين (1,457 سطر)
│   │       ├── channels.ts       # قنوات اللجان
│   │       ├── honors.ts         # التكريم
│   │       ├── messages.ts       # :text + :document + :photo
│   │       ├── escalation.ts     # التصعيد التلقائي (Cron)
│   │       └── ihsan_management.ts # إدارة الإحسان الشاملة
│   │
│   └── student/                  # بوت الطالب
│       ├── index.ts              # Orchestrator + debug endpoints
│       ├── state.ts              # UserState
│       └── handlers/             # 9 ملفات handler
│           ├── start.ts          # /start + التسجيل
│           ├── navigation.ts     # التنقل + Breadcrumb
│           ├── files.ts          # عرض + تحميل الملفات
│           ├── contribution.ts   # تقديم الإحسان (5 خطوات)
│           ├── search.ts         # البحث
│           ├── leaderboard.ts    # روّاد الإحسان
│           ├── profile.ts        # حسابي + إحساناتي
│           ├── committee.ts      # قنوات اللجان
│           └── messages.ts       # :text + :document
│
├── tests/                        # 4 ملفات اختبار
│   ├── db.test.ts                # URL encoding (18 اختبار)
│   ├── session.test.ts           # KV stores + RateLimiter (24 اختبار)
│   ├── callback-signing.test.ts  # HMAC + timing attacks (25 اختبار)
│   └── storage.test.ts           # تحويلات الأحجام (16 اختبار)
│
├── pdf-server/                   # Worker منفصل لملف PDF تجريبي
├── scripts/                      # 11 سكريبت إعداد وإدارة
└── .github/workflows/            # 2 workflow (deploy + supabase-sync)
```

---

## نظام 🌟 إحسان علمي

نظام متكامل لإشراك الطلاب في بناء المحتوى العلمي عبر تقديم الملفات وكسب النقاط.

### أنواع المحتوى (7 أنواع)

| النوع | الإيموجي | النقاط (min-max) |
|---|---|---|
| المقرر (نظري) | 📘 | 20 - 50 |
| المقرر (عملي) | 📗 | 20 - 50 |
| ملخصات | 📄 | 10 - 30 |
| نماذج اختبارات | 📝 | 15 - 40 |
| مرئيات وصوتيات | 🎥 | 30 - 100 |
| مراجع | 📖 | 15 - 50 |
| جداول دراسية واختبارات | 📅 | 10 - 30 |

> ⭐ المحتوى المميّز يحصل على +50% فوق الحد الأقصى

### دورة حياة الإحسان

```
الطالب يقدّم إحساناً
    ↓
🟡 قيد المراجعة (pending)
    ↓
المسؤول يراجع (مع معاينة الملف)
    ↓
┌────────────────┬────────────────┐
│ ✅ معتمد        │ ❌ مرفوض        │
│ (نقاط متغيرة)  │ (مع سبب)        │
└────────┬───────┴────────────────┘
         ↓
📤 نشر للطلاب (بدون اسم صاحبه)
    ↓
💎 منح النقاط (current_cycle + all_time)
    ↓
🏆 تحديث ترتيب روّاد الإحسان
```

### التصعيد التلقائي

| الوقت | الإجراء | المستلم |
|---|---|---|
| 24 ساعة | ⏰ تذكير | مسؤول المستوى |
| 48 ساعة | ⚠️ تنبيه | مسؤول الكلية |
| 72 ساعة | 🚨 تنبيه عاجل | المسؤول المركزي |

> يعمل عبر Cron Trigger كل ساعة على بوت الإدارة

### إنهاء الدورة

عند انتهاء الفصل الدراسي، المسؤول المركزي يضغط "🔄 إنهاء الدورة":

1. يجمع ترتيب روّاد الإحسان (أفضل 3 لكل مستوى)
2. يُرسل رسالة منسّقة لقناة الأرشيف `@ust_ihsan_archive`
3. يُصفّر `total_points_current_cycle` للجميع
4. يحتفظ بـ `total_points_all_time` (النقاط التاريخية)
5. يُحدّث اسم الدورة للفصل القادم

---

## قاعدة البيانات

### 26 جدول

| المجموعة | الجداول |
|---|---|
| الهيكل الأكاديمي | `colleges`, `specialties`, `subjects` |
| المحتوى | `content_types`, `content` |
| RBAC | `admin_users`, `positions`, `position_holders`, `permissions`, `position_level_permissions` |
| الإحسان والتعميمات | `contributions`, `broadcasts` |
| سجلات التدقيق | `position_audit_logs`, `content_audit_logs` |
| الطلاب | `students`, `downloads`, `leaderboard`, `student_subscriptions`, `student_notifications` |
| النقاط والتكريم | `student_points`, `contribution_honors`, `points_reset_logs` |
| التخصيص والقنوات | `custom_texts`, `committee_channels` |
| نظام الإحسان | `ihsan_settings`, `ihsan_archive` |

### 10 دوال PostgreSQL

| الدالة | الوظيفة |
|---|---|
| `user_has_permission()` | التحقق من الصلاحية مع وراثة |
| `get_broadcast_recipients()` | مستلمو التعميم حسب النطاق |
| `register_student()` | تسجيل/تحديث طالب |
| `get_top_contributors_specialty()` | أفضل المحسنين في تخصص |
| `award_contribution_points()` | منح النقاط + إشعار الطالب |
| `notify_contribution_rejected()` | إشعار الرفض |
| `increment_download()` | زيادة عدّاد التحميل (atomic) |
| `count_pending_for_scope()` | عدّ الإحسانات المعلقة في نطاق |
| `prevent_central_deletion()` | منع حذف المنصب المركزي (trigger) |
| `prevent_central_orphan()` | منع تعطيل آخر مركزي (trigger) |

---

## الأمان

| الميزة | الحالة |
|---|---|
| Bot Tokens كـ Cloudflare Secrets | ✅ |
| Supabase Service Key كـ Secret | ✅ |
| HMAC-SHA256 لتوقيع callback_data | ✅ |
| RBAC هرمي مع وراثة | ✅ |
| Postgres Triggers لحماية المنصب المركزي | ✅ |
| Audit Trail (سجلات التدقيق) | ✅ |
| Rate Limiter (عبر KV) | ✅ متاح |
| KV-based Sessions (TTL) | ✅ |
| Webhook يُرجع 200 دائماً | ✅ |
| `drop_pending_updates` عند التسجيل | ✅ |
| عرض المحتوى بدون اسم صاحبه | ✅ |
| منع التعيين الذاتي للمناصب | ✅ |

---

## التثبيت والنشر

### المتطلبات المسبقة

1. **Node.js 18+** — [تحميل](https://nodejs.org/)
2. **حساب Cloudflare** مجاني
3. **حساب Supabase** مجاني
4. **Bot Tokens** من [@BotFather](https://t.me/BotFather) (بوتان)

### الخطوات

```bash
# 1. استنساخ المشروع
git clone https://github.com/mutawakel-hub/UST-BOT.git
cd UST-BOT

# 2. تثبيت الـ dependencies
npm install --legacy-peer-deps

# 3. إنشاء KV namespaces
npx wrangler kv namespace create SESSIONS --config wrangler.student.toml
npx wrangler kv namespace create CACHE --config wrangler.student.toml
npx wrangler kv namespace create SESSIONS --config wrangler.admin.toml
npx wrangler kv namespace create CACHE --config wrangler.admin.toml

# 4. تحديث KV IDs في wrangler.*.toml

# 5. إضافة Cloudflare Secrets
echo "TOKEN" | npx wrangler secret put BOT_TOKEN --config wrangler.student.toml
echo "https://xxx.supabase.co" | npx wrangler secret put SUPABASE_URL --config wrangler.student.toml
echo "eyJhbGc..." | npx wrangler secret put SUPABASE_SERVICE_KEY --config wrangler.student.toml
echo "SECRET" | npx wrangler secret put CALLBACK_SECRET --config wrangler.student.toml
# كرّر لبوت الإدارة

# 6. تطبيق قاعدة البيانات
# في Supabase SQL Editor:
#   1. شغّل db/cleanup.sql (لو توجد جداول سابقة)
#   2. شغّل db/schema.sql
#   3. شغّل db/seed_data.sql
#   4. شغّل db/update_storage_channels.sql

# 7. النشر
npm run deploy:all

# 8. تسجيل Webhooks
npm run set-webhooks
```

### متغيرات البيئة المطلوبة

| المتغير | الوصف | مطلوب؟ |
|---|---|---|
| `BOT_TOKEN` | Token البوت من BotFather | ✅ |
| `SUPABASE_URL` | Project URL من Supabase | ✅ |
| `SUPABASE_SERVICE_KEY` | service_role key من Supabase | ✅ |
| `CALLBACK_SECRET` | سرّ HMAC (مشترك بين البوتين) | ✅ |
| `CLOUDFLARE_API_TOKEN` | للـ CI/CD | ✅ (GitHub Secret) |
| `CLOUDFLARE_ACCOUNT_ID` | معرّف حساب Cloudflare | ✅ (GitHub Secret) |
| `SUPABASE_DB_URL` | connection string للمزامنة | اختياري |

---

## الاختبارات

```bash
# تشغيل كل الاختبارات
npm test

# مع coverage
npm run test:coverage

# مراقبة مستمرة
npm run test:watch
```

| الملف | عدد الاختبارات | التغطية |
|---|---|---|
| `db.test.ts` | 18 | URL encoding للعربية والمسافات والرموز |
| `session.test.ts` | 24 | SessionStore + CacheStore + RateLimiter |
| `callback-signing.test.ts` | 25 | HMAC + مقاومة timing attacks |
| `storage.test.ts` | 16 | تحويلات الأحجام |
| **الإجمالي** | **83** | |

---

## CI/CD

### `deploy.yml` — النشر التلقائي

```
git push origin main
    ↓
🧪 Tests (Vitest) → 🔍 TypeCheck → 🚀 Deploy (student + admin + pdf)
```

### `supabase-sync.yml` — مزامنة قاعدة البيانات

عند تعديل `db/schema.sql`:
```
git push (يعدّل db/schema.sql)
    ↓
psql $SUPABASE_DB_URL -f db/schema.sql
    ↓
✅ تم تحديث قاعدة البيانات
```

---

## استكشاف الأخطاء

### البوت لا يستجيب

```bash
# 1. فحص حالة الـ Webhook
npm run webhook:status

# 2. تنظيف التحديثات المعلّقة
npm run webhook:clear

# 3. إعادة تسجيل الـ Webhook
npm run webhook:reset
```

### فحص الصحة

```bash
# بوت الطالب
curl https://ust-student-bot.atow73768.workers.dev/health

# بوت الإدارة
curl https://ust-admin-bot.atow73768.workers.dev/health
```

### Endpoints تشخيصية

```bash
# فحص صلاحيات مستخدم (الإدارة)
curl https://ust-admin-bot.atow73768.workers.dev/debug/rbac/1330666633

# فحص إدراج الإحسان (الطالب)
curl https://ust-student-bot.atow73768.workers.dev/debug/contribution

# فحص محتوى مادة (الطالب)
curl https://ust-student-bot.atow73768.workers.dev/debug/content/101
```

### سجلات Cloudflare

```bash
npx wrangler tail --config wrangler.student.toml
npx wrangler tail --config wrangler.admin.toml
```

---

## 📞 الدعم

- **GitHub Issues:** https://github.com/mutawakel-hub/UST-BOT/issues
- **البريد:** support@ust.edu.ye
- **تيليجرام:** @ust_support

---

## 📜 الترخيص

© 2026 University of Science and Technology - Yemen. All rights reserved.
