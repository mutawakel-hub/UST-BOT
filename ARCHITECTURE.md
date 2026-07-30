# 🏗 ARCHITECTURE — UST Central Bot

> شرح البنية التقنية للمشروع: Cloudflare Workers + Supabase + Telegram + RBAC.

---

## 📐 نظرة عامة على البنية

```
                  ┌──────────────────────────────┐
                  │     Telegram Messenger       │
                  │   (Students + Admins)        │
                  └────────────┬─────────────────┘
                               │ HTTPS Webhooks (POST /webhook)
                               ▼
   ┌──────────────────────────────────────────────────────────────┐
   │              Cloudflare Workers (Free Tier)                   │
   │              Subdomain: atow73768.workers.dev                 │
   │                                                                │
   │  ┌───────────────────┐  ┌───────────────────┐  ┌───────────┐  │
   │  │  ust-student-bot  │  │   ust-admin-bot   │  │ust-pdf-srv│  │
   │  │      (v3.0)       │  │      (v3.3)       │  │           │  │
   │  │  src/student/     │  │   src/admin/      │  │ pdf-server│  │
   │  │     index.ts      │  │     index.ts      │  │ /index.ts │  │
   │  └─────────┬─────────┘  └─────────┬─────────┘  └───────────┘  │
   │            │                       │                            │
   │            └───────────┬───────────┘                            │
   │                        │                                        │
   │            ┌───────────▼───────────┐                            │
   │            │  src/shared/          │                            │
   │            │  ├── db.ts            │ ← عميل Supabase (PostgREST) │
   │            │  ├── rbac.ts          │ ← التحقق من الصلاحيات       │
   │            │  ├── keyboards.ts     │                            │
   │            │  ├── texts.ts         │                            │
   │            │  └── data/            │ ← بيانات البذرة            │
   │            └───────────┬───────────┘                            │
   └────────────────────────┼─────────────────────────────────────────┘
                            │ HTTPS REST (PostgREST API)
                            ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                Supabase (PostgreSQL on Free Tier)              │
   │                                                                │
   │   24 Tables · 6 Functions (RPC) · 1 View · 2 Triggers          │
   │   Schema v1.2                                                  │
   │                                                                │
   │   ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │
   │   │  colleges    │  │  specialties │  │     subjects     │    │
   │   └──────┬───────┘  └──────┬───────┘  └─────────┬────────┘    │
   │          └────────────────┬┴───────────────────┬┘              │
   │                           ▼                    ▼               │
   │                  ┌────────────────┐  ┌─────────────────┐       │
   │                  │    content     │  │  contributions  │       │
   │                  └────────┬───────┘  └────────┬────────┘       │
   │                           │                   │                │
   │   ┌──────────────────┐    │                   │                │
   │   │   students       │◄───┘                   │                │
   │   │ student_points   │                        │                │
   │   │ student_subs     │                        │                │
   │   │ student_notifs   │                        │                │
   │   │ downloads        │                        │                │
   │   │ leaderboard      │                        │                │
   │   │ contribution_honors                     ◄─┘                │
   │   │ points_reset_logs                                        │
   │   └──────────────────┘                                        │
   │                                                                │
   │   ┌──────────────────────────────────────────────────────┐    │
   │   │  RBAC: admin_users, positions, position_holders,      │    │
   │   │  permissions, position_level_permissions              │    │
   │   │  + View: user_permissions                              │    │
   │   │  + Function: user_has_permission(...)                  │    │
   │   └──────────────────────────────────────────────────────┘    │
   │                                                                │
   │   ┌──────────────────────────────────────────────────────┐    │
   │   │  Audit: position_audit_logs, content_audit_logs       │    │
   │   │  Misc: broadcasts, custom_texts, committee_channels   │    │
   │   └──────────────────────────────────────────────────────┘    │
   └──────────────────────────────────────────────────────────────┘
                            ▲
                            │ file_id / message_id
   ┌──────────────────────────────────────────────────────────────┐
   │        Telegram Storage Channels (real, in Telegram)           │
   │                                                                │
   │   🏥 Medicine:  -1004405014472  (كلية الطب)                    │
   │   💻 Computers: -1003727164402  (كلية الحاسبات)                │
   └──────────────────────────────────────────────────────────────┘
```

---

## 🎯 المبادئ التصميمية

### 1. Stateless Workers
- كل Worker لا يحتفظ بحالة بين الطلبات
- حالة المستخدم (UserState) تُخزَّن في `Map` داخل الـ Worker لجلسة قصيرة
- كل البيانات الدائمة تُخزَّن في **Supabase** (لا اعتماد على KV بعد)
- كل طلب webhook مستقل

### 2. Webhook-First (لا Long Polling)
- Telegram يُرسل التحديثات إلى Worker عبر HTTPS POST
- الاستجابة بـ 200 دائماً (حتى عند الأخطاء) لمنع إعادة المحاولة
- `drop_pending_updates: true` عند التسجيل
- `max_connections: 40` لتوازي أعلى

### 3. Error Resilience
- `bot.catch` شامل يلتقط كل الأخطاء
- الأخطاء "القابلة للتجاهل" (query too old, message not modified) → تجاهل صامت
- الأخطاء الأخرى → محاولة إرسال رسالة للمستخدم + سجل
- أخطاء Supabase → رسالة احتياطية للمستخدم (لا تعطّل البوت)

### 4. Separation of Concerns (فصل المسؤوليات)
- **Workers**: منطق الأعمال + واجهة Telegram
- **Supabase**: تخزين البيانات + الصلاحيات + الـ Functions
- **Telegram Channels**: تخزين الملفات (يفصل بين الإدارة والتخزين)
- **GitHub Actions**: النشر + المزامنة

### 5. Shared Code (الكود المشترك)
- `src/shared/db.ts` — عميل Supabase + كل الاستعلامات
- `src/shared/rbac.ts` — التحقق من الصلاحيات
- `src/shared/keyboards.ts` — كل الـ keyboards
- `src/shared/texts.ts` — كل النصوص (عربي)
- `src/shared/data/` — بيانات البذرة (colleges, specialties, subjects, ...)

---

## 📦 التقنيات

| الطبقة | التقنية | السبب |
|---|---|---|
| Runtime | **Cloudflare Workers** | 100k طلب/يوم مجاناً + انتشار عالمي |
| اللغة | **TypeScript** | أمان الأنواع + إنتاجية أعلى |
| مكتبة TG | **grammY** | مصممة لـ Serverless |
| النشر | **Wrangler 4** | CLI رسمي من CF |
| قاعدة البيانات | **Supabase (PostgreSQL)** | Free Tier 500MB + PostgREST + RLS |
| CI/CD | **GitHub Actions** | workflows للنشر + المزامنة |
| التخزين | **Telegram Channels** | مجاني + سريع + `file_id` دائم |

---

## 🔄 دورة حياة الطلب

### مثال: طالب يضغط زر "تخصص IT"

```
1. المستخدم يضغط زراً في تلغرام
2. Telegram يُرسل POST إلى Worker /webhook
3. Worker يستلم الـ Update (callback_query)
4. grammY يوزّعه على الـ handler المناسب
5. الـ handler يحدّث UserState (التخصص = IT)
6. الـ handler يستدعي SupabaseClient:
     client.select("subjects", {
       filter: eq("specialty_id", 5) + "&level=eq." + level
     })
7. Supabase يُرجع المواد
8. الـ handler يبني الـ keyboard + النص
9. Worker يُرسل editMessageText عبر Telegram API
10. Worker يُرجع 200 OK
11. Telegram يُسجّل الـ update كمعالَج
```

### مثال: مسؤول يُرسل تعميم على كلية

```
1. المسؤول يضغط "تعميم على كلية الحاسبات"
2. Worker يفحص الصلاحية: user_has_permission(...) → college_broadcast
3. إن سُمِح:
   a. يستدعي Function: get_broadcast_recipients(p_scope_type='college', p_college_id=5)
   b. يُرجع array من telegram_id
   c. يرسل sendMessage لكل مستلم (في حلقة)
   d. يُدرج سجل في جدول broadcasts (sent_count, status='completed')
4. Worker يُرجع 200 OK
```

---

## 🛡️ نظام الصلاحيات (RBAC)

### هرم المناصب (9)

```
🛡 رئيس اللجنة المركزية (central_chair)         ← 1 منصب
   │  + 8 صلاحيات خاصة (manage_admins, ...)
   ▼
🏛 مسؤول كلية (college_admin_1..7)              ← 7 مناصب
   │  + 4 صلاحيات (manage_subjects, college_broadcast, ...)
   ▼
📊 مندوب مستوى (level_rep_<spec>_<lvl>)         ← قوالب ديناميكية
      4 صلاحيات (level_broadcast, approve_level_contributions, ...)
```

### الصلاحيات الـ 19

| المستوى | الصلاحيات |
|---|---|
| **مستوى (4)** | `level_broadcast` · `approve_level_contributions` · `manage_level_content` · `view_level_stats` |
| **كلية (+4)** | `manage_subjects` · `college_broadcast` · `manage_level_reps` · `view_college_stats` |
| **مركزي (+8)** | `manage_admins` · `manage_colleges` · `manage_specialties` · `manage_committee_channels` · `view_central_stats` · `view_reports` · `system_settings` · `central_broadcast` |
| **مركزي — التكريم (+3)** | `manage_honors` · `reset_points` · `view_honors_log` |

### التحقق في الكود

```ts
// src/shared/rbac.ts
const canBroadcast = await client.rpc("user_has_permission", {
  p_user_telegram_id: adminId,
  p_permission: "central_broadcast",
  p_college_id: null,    // null = نطاق مركزي
  p_specialty_id: null,
  p_level: null,
});
```

### الحماية المركزية (Triggers)

- `prevent_central_deletion()` — يمنع حذف منصب `central_chair`
- `prevent_central_orphan()` — يمنع تعطيل آخر شاغل نشط للمنصب المركزي

---

## 🗄️ التكامل مع Supabase

### عميل PostgREST (`src/shared/db.ts`)

عميل خفيف بدون مكتبات إضافية (يعمل في بيئة Workers):

```ts
const client = new SupabaseClient(env);

// SELECT مع فلتر وترتيب
const subjects = await client.select("subjects", {
  columns: "id,name",
  filter: eq("specialty_id", 5),
  order: "name.asc",
});

// INSERT
await client.insert("downloads", {
  student_telegram_id: 123,
  content_id: 456,
});

// UPDATE
await client.update("contributions",
  { status: "approved" },
  "id=eq.789"
);

// RPC (Function)
await client.rpc("register_student", {
  p_telegram_id: 123,
  p_first_name: "أحمد",
  p_college_id: 5,
  p_specialty_id: 16,
  p_level: 1,
});
```

### مستوى التكامل الحالي

| المكوّن | بوت الطالب v3.0 | بوت الإدارة v3.3 |
|---|---|---|
| تسجيل المستخدمين | ✅ كامل | ✅ (تسجيل دخول المسؤول) |
| استرجاع الكليات/التخصصات | ✅ كامل | ✅ كامل |
| استرجاع المواد | ✅ كامل | ✅ كامل |
| استرجاع المحتوى | ✅ كامل | ✅ كامل |
| إدارة المواد | — | ⏳ قيد الانتقال |
| المساهمات | ✅ كامل (إرسال) | ✅ كامل (مراجعة) |
| التعميمات | ✅ (استلام) | ✅ كامل (إرسال + تسجيل) |
| لوحة الشرف | ✅ كامل | ✅ كامل |
| الإحصائيات | ✅ كامل | ⏳ قيد الانتقال |
| الإشعارات | ✅ كامل | — |
| النقاط والتكريم | ✅ (عرض) | ⏳ قيد الانتقال |

---

## 🔐 الأمان

- ✅ Bot Tokens في **Cloudflare Secrets** (مشفّرة)
- ✅ `SUPABASE_SERVICE_KEY` في **Cloudflare Secrets** (وليس var)
- ✅ لا credentials في الكود
- ✅ معالجة أخطاء شاملة
- ✅ **Triggers** تمنع حذف المسؤول المركزي
- ✅ **Audit Trail** كامل (`position_audit_logs`, `content_audit_logs`)
- ⏳ Rate Limiting (KV + Durable Objects) — مرحلة قادمة
- ⏳ HMAC signing على callback_data — مرحلة قادمة
- ⏳ فحص الملفات (Magic Bytes) — مرحلة قادمة

---

## 🚀 النشر التلقائي (GitHub Actions)

### Workflow 1: `deploy.yml`
يُشغَّل عند كل `git push` على `main`:
1. فحص TypeScript (`npx tsc --noEmit`)
2. نشر `ust-student-bot`
3. نشر `ust-admin-bot`
4. نشر `ust-pdf-server`
5. ملخص النشر

### Workflow 2: `supabase-sync.yml`
يُشغَّل عند تعديل `db/schema.sql` أو `db/cleanup.sql`:
1. قراءة ملف الـ schema
2. تطبيقه على Supabase عبر REST API
3. التحقق من النتيجة

> 📖 تفاصيل الإعداد في [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md).

---

## 📢 نظام التعميمات (Broadcast System)

### 🏗️ البنية المعمارية

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│ بوت الإدارة  │ ──POST──► /broadcast-push ──►  │ بوت الطالب   │
│ (admin bot) │         │   endpoint    │         │(student bot)│
└─────────────┘         └──────────────┘         └─────────────┘
       │                                                │
       │ 2. INSERT notification في student_notifications│
       │                                                │
       └──────────► Supabase ◄──────────────────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │   الطالب      │
                   │  (يستقبل:     │
                   │  1. رسالة     │
                   │     مباشرة    │
                   │  2. إشعار     │
                   │     في البوت) │
                   └──────────────┘
```

### 📨 آلية الوصول المزدوجة

عند إرسال تعميم، يصل للطالب بطريقتين متزامنتين:

| الطريقة | متى يصل | الضمان |
|---------|---------|--------|
| 📨 **رسالة Telegram مباشرة** | فوراً (push notification) | لو الطالب بدأ بوت الطالب سابقاً |
| 🔔 **إشعار في واجهة الإشعارات** | عند فتح بوت الطالب | 100% (مخزّن في DB) |

### 🔒 الأمان: Header Token الداخلي

بوت الإدارة يُرسل طلب HTTP POST لـ endpoint `/broadcast-push` في بوت الطالب. الأمان يعتمد على:

| العنصر | الموقع | الوصف |
|--------|--------|-------|
| `BROADCAST_INTERNAL_TOKEN` | `wrangler.student.toml` + `wrangler.admin.toml` | قيمة ثابتة مشتركة (var، ليس secret) |
| `x-internal-token` header | في كل طلب HTTP | بوت الإدارة يُرسله، بوت الطالب يتحقق منه |

**لماذا var وليس secret؟**
- الـ URL الخاص بـ `/broadcast-push` غير منشور علناً
- الـ token يحمي من الاستخدام العرضي لو تسرّب URL
- لتغييره: حدّث القيمة في كلا الملفين + أعد النشر

**لتغيير الـ token:**
1. افتح `wrangler.student.toml` و `wrangler.admin.toml`
2. غيّر قيمة `BROADCAST_INTERNAL_TOKEN` لنفس القيمة الجديدة في كلا الملفين
3. اضغط push → GitHub Actions سينشر البوتين تلقائياً

### 📊 تدفق التعميم (Sequence)

```
1. المسؤول يضغط "📢 تعميم"
   ↓
2. يختار النطاق (all / college / specialty / level)
   ↓
3. getBroadcastRecipients() → قائمة telegram_ids
   ↓
4. يدخل نص التعميم → معاينة → تأكيد
   ↓
5. confirm_broadcast handler:
   a. INSERT notification في student_notifications لكل طالب
   b. POST /broadcast-push لكل طالب (مع x-internal-token header)
   c. بوت الطالب يُرسل bot.api.sendMessage للطالب
   d. INSERT سجل في broadcasts table
   ↓
6. عرض تقرير: العدد + المباشر + المحظور + الإشعارات
```

### 🛠️ Endpoint: /broadcast-push

**الموقع:** بوت الطالب (`src/student/index.ts`)

**Request:**
```http
POST /broadcast-push
Content-Type: application/json
x-internal-token: ust_internal_broadcast_2025_z7y4k9

{
  "telegram_id": 1330666633,
  "text": "📢 تعميم جديد\n\n...",
  "parse_mode": "Markdown"
}
```

**Response:**
| الحالة | HTTP Status | Body |
|--------|-------------|------|
| نجاح | 200 | `{"ok": true, "delivered": true}` |
| token خاطئ | 401 | `{"ok": false, "error": "unauthorized"}` |
| بيانات ناقصة | 400 | `{"ok": false, "error": "missing telegram_id or text"}` |
| الطالب حظر البوت | 404 | `{"ok": false, "error": "blocked_or_not_started"}` |
| خطأ داخلي | 500 | `{"ok": false, "error": "..."}` |
