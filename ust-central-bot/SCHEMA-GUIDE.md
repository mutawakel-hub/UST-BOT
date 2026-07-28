# 🗄️ دليل قاعدة البيانات — UST Central Bot

> شرح كامل لـ `db/schema.sql` (الإصدار v1.2) — 24 جدول + 6 Functions + 1 View + 2 Triggers.

---

## 📋 نظرة عامة

| البند | القيمة |
|---|---|
| إصدار الـ Schema | **v1.2** |
| عدد الجداول | **24** |
| عدد الـ Functions (RPC) | 6 |
| عدد الـ Triggers | 2 |
| عدد الـ Views | 1 (`user_permissions`) |
| عدد المناصب | 9 (1 مركزي + 7 كليات + مندوب مستوى) |
| عدد الصلاحيات | **19** |
| أنواع المحتوى | 6 |
| الإضافات المُفعَّلة | `pg_trgm` (بحث ضبابي عربي) + `pgcrypto` |

---

## 🏗️ مخطط العلاقات (ERD)

```
┌──────────────────┐
│   colleges (7)   │  ← storage_channel_id لقنوات التخزين
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│ specialties (34) │────▶│   subjects (?)   │
└──────────────────┘     └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ content_types(6) │
                         │       ▲          │
                         │       │          │
                         │  ┌────┴───────┐  │
                         │  │  content   │  │ ← telegram_message_id + telegram_file_id
                         │  └────────────┘  │
                         └──────────────────┘

┌────────────────────┐     ┌──────────────────────────┐
│  admin_users       │◀───▶│   position_holders       │
└────────────────────┘     └────────────┬─────────────┘
                                        │
                                        ▼
                              ┌──────────────────┐
                              │ positions (9)    │
                              │ - central_chair  │
                              │ - college_admin_X│
                              │ - level_rep_*    │
                              └────────┬─────────┘
                                       │
                                       ▼
                              ┌─────────────────────────────┐
                              │ position_level_permissions  │
                              │ (ربط المستويات بالصلاحيات) │
                              └─────────────┬───────────────┘
                                            │
                                            ▼
                              ┌──────────────────┐
                              │ permissions (19) │
                              └──────────────────┘

┌────────────────────┐     ┌──────────────────────┐     ┌────────────────────┐
│   students         │     │   contributions      │────▶│ contribution_honors│
│   ▲                │     └──────────────────────┘     └────────────────────┘
│   │                │                │
│   │                │                ▼
│   │                │     ┌──────────────────────┐
│   │                │     │    broadcasts        │
│   │                │     └──────────────────────┘
│   │                │
│   │  ┌─────────────┼─────────────────────────────┐
│   │  │             │                             │
│   │  ▼             ▼                             ▼
│ student_points   downloads                student_notifications
│   │                                             ▲
│   │                                             │
│   ▼                                             │
│ points_reset_logs                    (تُنشأ تلقائياً عند رفض مساهمة)
│
└─ student_subscriptions (اشتراكات في المواد)

┌─────────────────────────────┐    ┌─────────────────────┐
│ position_audit_logs         │    │ committee_channels  │
│ content_audit_logs          │    │ custom_texts        │
│ leaderboard                 │    │                     │
└─────────────────────────────┘    └─────────────────────┘
```

---

## 🎯 شرح الجداول الـ 24

### 📚 الهيكل الأكاديمي (3 جداول)

| # | الجدول | الوصف |
|---|---|---|
| 1 | `colleges` | 7 كليات ثابتة + `storage_channel_id` لكل كلية |
| 2 | `specialties` | 34 تخصص موزّع على الكليات |
| 3 | `subjects` | المواد الدراسية (level + semester) |

### 📦 المحتوى (2 جداول)

| # | الجدول | الوصف |
|---|---|---|
| 4 | `content_types` | 6 أنواع: `book_theory`, `book_practical`, `exam`, `summary`, `video`, `reference` |
| 5 | `content` | المحتوى الفعلي + ربط القناة (`telegram_message_id`, `telegram_file_id`) |

### 🛡️ نظام RBAC (5 جداول)

| # | الجدول | الوصف |
|---|---|---|
| 6 | `admin_users` | المستخدمون الذين يمكن أن يكونوا مسؤولين (Telegram ID) |
| 7 | `positions` | 9 مناصب (ثابتة + قوالب مندوبي المستويات) |
| 8 | `position_holders` | ربط Many-to-Many بين المناصب والمستخدمين |
| 9 | `permissions` | **19 صلاحية** محددة |
| 10 | `position_level_permissions` | ربط مستويات المناصب بالصلاحيات (مع الوراثة) |

### 📥 المساهمات والتعميمات (2 جداول)

| # | الجدول | الوصف |
|---|---|---|
| 11 | `contributions` | مساهمات الطلاب (status: pending/approved/rejected/featured) |
| 12 | `broadcasts` | التعميمات المُرسلة + `sent_count` + `status` |

### 📜 سجلات التدقيق (2 جداول)

| # | الجدول | الوصف |
|---|---|---|
| 13 | `position_audit_logs` | سجل تغييرات المناصب (تعيين/إزالة) |
| 14 | `content_audit_logs` | سجل عمليات المحتوى (create/update/move/delete) |

### 🎓 الطلاب والتفاعل (5 جداول)

| # | الجدول | الوصف |
|---|---|---|
| 15 | `students` | بيانات الطلاب المسجَّلين + `total_points` + `accepted_contributions` |
| 16 | `downloads` | سجل تحميلات الطلاب (للإحصائيات) |
| 17 | `leaderboard` | لوحة الشرف (متجددة) |
| 18 | `student_subscriptions` | اشتراكات الطلاب في المواد |
| 19 | `student_notifications` | إشعارات الطلاب (تنشأ تلقائياً عند رفض مساهمة) |

### 🏆 النقاط والتكريم (3 جداول)

| # | الجدول | الوصف |
|---|---|---|
| 20 | `student_points` | سجل نقاط الطلاب (مع السبب + القيمة) |
| 21 | `contribution_honors` | تكريمات المساهمات المميَّزة |
| 22 | `points_reset_logs` | سجل عمليات تصفير النقاط (شهري/فصلي/سنوي) |

### ⚙️ التخصيص والقنوات (2 جداول)

| # | الجدول | الوصف |
|---|---|---|
| 23 | `custom_texts` | النصوص المخصصة (عناوين، رسائل ترحيب، ...) |
| 24 | `committee_channels` | روابط قنوات اللجان (مركزية + كليات + مستويات) |

---

## 🛡️ نظام الصلاحيات (RBAC)

### هرم الوراثة (9 مناصب)

```
🛡 رئيس اللجنة المركزية (central_chair)              ← 1 منصب
   │ + كل صلاحياته الخاصة (8 + 3 = 11 صلاحية)
   │
   ▼ يرث ↓
🏛 مسؤول الكلية (college_admin_1..7)                 ← 7 مناصب
   │ + صلاحياته الخاصة (4 صلاحيات)
   │
   ▼ يرث ↓
📊 مندوب المستوى (level_rep_<spec>_<lvl>)            ← قوالب ديناميكية
     صلاحياته الأساسية (4 صلاحيات)
```

### الصلاحيات الـ 19

#### مندوب المستوى (4):
- `level_broadcast` — نشر إعلانات المستوى
- `approve_level_contributions` — مراجعة مساهمات المستوى
- `manage_level_content` — إدارة محتوى المستوى
- `view_level_stats` — عرض إحصائيات المستوى

#### مسؤول الكلية (+4):
- `manage_subjects` — إدارة المواد
- `college_broadcast` — تعميم على الكلية
- `manage_level_reps` — إدارة مندوبي المستويات
- `view_college_stats` — إحصائيات الكلية

#### مركزي (+8):
- `manage_admins` — إدارة المناصب
- `manage_colleges` — إدارة الكليات
- `manage_specialties` — إدارة التخصصات
- `manage_committee_channels` — إدارة روابط اللجان
- `view_central_stats` — الإحصائيات الشاملة
- `view_reports` — التقارير
- `system_settings` — إعدادات النظام
- `central_broadcast` — تعميم شامل

#### مركزي — التكريم والنقاط (+3):
- `manage_honors` — اعتماد/رفض ترشيحات التكريم + منح تكريم يدوي
- `reset_points` — تصفير نقاط الطلاب (شهري/فصلي/سنوي)
- `view_honors_log` — الاطلاع على التكريمات السابقة

### منع حذف المسؤول المركزي (Triggers)

الـ Triggers:
1. `prevent_central_deletion()` — يمنع `DELETE FROM positions WHERE id = 'central_chair'`
2. `prevent_central_orphan()` — يمنع تعطيل آخر شاغل نشط للمنصب المركزي

---

## ⚙️ الـ Functions الست (RPC)

| Function | المعطيات | الاستخدام |
|---|---|---|
| `register_student(...)` | `p_telegram_id, p_first_name, p_username, p_college_id, p_specialty_id, p_level` | تسجيل/تحديث بيانات الطالب عند أول `/start` (ON CONFLICT DO UPDATE) |
| `user_has_permission(...)` | `p_user_telegram_id, p_permission, p_college_id, p_specialty_id, p_level` | التحقق من صلاحية لمستخدم في نطاق محدد (مع الوراثة) |
| `get_broadcast_recipients(...)` | `p_scope_type, p_college_id, p_specialty_id, p_level` | إرجاع مستلمي التعميم حسب النطاق |
| `get_top_contributors_specialty(...)` | `p_specialty_id, p_limit` | أعلى المساهمين في تخصص محدد (للوحة الشرف) |
| `award_contribution_points(...)` | `p_student_telegram_id, p_contribution_id, p_points, p_reason` | منح النقاط للطالب عند اعتماد مساهمته |
| `notify_contribution_rejected(...)` | `p_contribution_id, p_reason` | إنشاء إشعار تلقائي في `student_notifications` عند رفض مساهمة |

### أمثلة الاستخدام

```sql
-- تسجيل طالب جديد
SELECT register_student(
  123456789,                -- telegram_id
  'أحمد محمد',              -- first_name
  'ahmed_ust',              -- username
  5,                        -- college_id (الحاسبات)
  16,                       -- specialty_id (IT)
  1                         -- level
);

-- فحص صلاحية
SELECT user_has_permission(
  123456789,
  'college_broadcast',
  5,      -- college_id
  NULL,   -- specialty_id
  NULL    -- level
);

-- الحصول على مستلمي تعميم على كلية الحاسبات
SELECT * FROM get_broadcast_recipients('college', 5, NULL, NULL);

-- أعلى 5 مساهمين في IT
SELECT * FROM get_top_contributors_specialty(16, 5);
```

---

## 👁️ الـ View: `user_permissions`

يجمع كل صلاحيات المستخدم من كل مناصبه (مع تفاصيل المنصب والنطاق):

```sql
SELECT * FROM user_permissions WHERE user_telegram_id = 123456789;
```

النتيجة: قائمة بكل صلاحيات المستخدم مع تفاصيل:
- `position_id` — المنصب
- `permission_id` — الصلاحية
- `college_id`, `specialty_id`, `level_num` — النطاق

---

## 🚀 كيفية التطبيق على Supabase

### الخطوة 1: إنشاء مشروع Supabase

1. اذهب إلى https://supabase.com → New Project
2. الاسم: `ust-central-bot`
3. Region: Frankfurt (eu-central-1)
4. خذ نسخة من كلمة مرور قاعدة البيانات

### الخطوة 2: تطبيق الـ Schema

#### الطريقة اليدوية (أول مرة):
1. في Dashboard → SQL Editor
2. انسخ كامل محتوى `db/schema.sql`
3. الصقه في المحرر
4. اضغط **Run**

#### الطريقة التلقائية (دائمة):
أي تعديل على `db/schema.sql` يُطبَّق تلقائياً عبر `supabase-sync.yml` عند `git push`.

### الخطوة 3: التحقق

```sql
-- التحقق من إنشاء الـ 24 جدول
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
-- يجب أن يُرجع 24 صفاً

-- التحقق من المناصب (9)
SELECT id, level, title FROM positions ORDER BY level;

-- التحقق من الصلاحيات (19)
SELECT id, name, min_level FROM permissions ORDER BY min_level, id;

-- التحقق من الكليات + قنوات التخزين
SELECT id, name, storage_channel_id FROM colleges ORDER BY display_order;
-- يجب أن يُرجع:
--   1 | كلية الطب   | -1004405014472
--   5 | كلية الحاسبات | -1003727164402
--   (والبقية NULL — لم تُنشأ قنواتها بعد)

-- التحقق من الـ Functions الست
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';
```

### الخطوة 4: الحصول على الـ Keys

من Dashboard → Settings → API:
- `Project URL`
- `anon public key`
- `service_role key` ⚠️ (سري — يُستخدم في Workers)

### الخطوة 5: إدراج المسؤول الأول

```sql
-- إدراج المسؤول المركزي الأول
INSERT INTO admin_users (telegram_id, first_name, username) VALUES
  (YOUR_TELEGRAM_ID, 'اسمك', 'your_username');

-- تعيينه في منصب central_chair
INSERT INTO position_holders (position_id, user_telegram_id, assigned_by)
VALUES ('central_chair', YOUR_TELEGRAM_ID, YOUR_TELEGRAM_ID);
```

---

## 📡 قنوات التخزين (Storage Channels)

قنوات تلغرام حقيقية تُستخدم لتخزين الملفات:

| الكلية | معرّف القناة | الحالة |
|---|---|---|
| 🏥 كلية الطب (id=1) | `-1004405014472` | ✅ فعّالة |
| 💻 كلية الحاسبات (id=5) | `-1003727164402` | ✅ فعّالة |
| باقي الكليات | NULL | ⏳ قيد الإنشاء |

### ربط قناة تخزين جديدة بكلية

```sql
UPDATE colleges
SET storage_channel_id = '-100XXXXXXXXXX'
WHERE id = X;  -- id الكلية
```

### ربط ملف بـ file_id من القناة

عند رفع ملف عبر بوت الإدارة، يُخزَّن:
- `telegram_message_id` — معرّف الرسالة في قناة التخزين
- `telegram_file_id` — معرّف الملف (دائم عبر البوت)

ثم يُرسَل الملف للطالب عبر:
```ts
await ctx.api.copyMessage(chatId, storageChannelId, telegramMessageId);
// أو
await ctx.api.sendDocument(chatId, telegramFileId);
```

---

## 🔐 سياسات RLS (Row Level Security)

الـ schema يُفعّل RLS على عدة جداول حسّاسة:
- `content`
- `contributions`
- `broadcasts`
- `students`

في الإنتاج، أضف سياسات مثل:

```sql
-- الطلاب يرون فقط المحتوى النشط
CREATE POLICY "students_view_active_content" ON content
  FOR SELECT USING (is_active = TRUE);

-- المسؤولون يديرون المحتوى ضمن نطاقهم
CREATE POLICY "admins_manage_scope_content" ON content
  FOR ALL USING (
    user_has_permission(auth.uid()::bigint, 'manage_level_content', college_id)
  );
```

> **ملاحظة تطبيقية**: في Workers نستخدم `service_role key` التي تتجاوز RLS،
> لأن كل التحقق يحدث في الكود عبر `user_has_permission(...)`.
> RLS مفيدة لو أردت الوصول المباشر للـ DB من تطبيقات أخرى.

---

## 📊 جدول البذرة (Seed Data)

عند تطبيق `db/schema.sql`، تُدرَج تلقائياً:

| الجدول | العدد |
|---|---|
| `colleges` | 7 |
| `specialties` | 34 |
| `content_types` | 6 |
| `positions` | 8 (1 مركزي + 7 كليات) — مندوبو المستويات تُنشأ ديناميكياً |
| `permissions` | 19 |
| `position_level_permissions` | ربط الصلاحيات بالمستويات |

### البيانات التي تُضاف يدوياً بعد الـ Schema:

1. **قنوات التخزين** — `UPDATE colleges SET storage_channel_id = ...`
2. **المواد الدراسية** — عبر سكريبت استيراد من Excel (قيد التطوير) أو يدوياً
3. **المسؤول الأول** — `INSERT INTO admin_users ...`
4. **روابط قنوات اللجان** — `INSERT INTO committee_channels ...`

---

## 🔄 تحديثات الـ Schema (Migrations)

### النهج المعتمد

أي تعديل على الـ Schema:
1. عدّل `db/schema.sql` محلياً (أضف `CREATE TABLE`, `ALTER TABLE`, ...)
2. `git commit` + `git push`
3. `supabase-sync.yml` يُشغَّل تلقائياً ويطبّق التعديلات
4. تحقق من Supabase Dashboard

### للاستعادة (Rollback)

```sql
-- في SQL Editor، الصق محتوى db/cleanup.sql
-- هذا يحذف كل الجداول ويعيد الإنشاء من الصفر
-- ⚠️ سيُحذف كل البيانات!
```

### النهج المُوصى به للإنتاج

استخدم Supabase CLI للت migrations الرسمية:

```bash
# تثبيت Supabase CLI
npm install -g supabase

# إنشاء migration جديدة
supabase migration new add_new_table

# تطبيق
supabase db push
```

---

## 🎯 الخطوات التالية

بعد تطبيق الـ schema:

1. ✅ **(منجز)** ربط بوت الطالب بـ Supabase (v3.0)
2. ✅ **(منجز)** ربط المساهمات والتعميمات في بوت الإدارة (v3.3)
3. ⏳ استكمال ربط باقي ميزات بوت الإدارة بـ Supabase
4. ⏳ إنشاء قنوات التخزين للكليات المتبقية (5 كليات)
5. ⏳ استيراد المواد من Excel
6. ⏳ إضافة سياسات RLS كاملة

---

## 📞 الدعم

لأي استفسار حول الـ schema، اطرح Issue على:
https://github.com/mutawakel-hub/UST-BOT/issues
