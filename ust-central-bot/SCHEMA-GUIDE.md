# 🗄️ دليل قاعدة البيانات — UST Central Bot

> شرح كامل لـ `db/schema.sql` — كيفية تطبيقه على Supabase وترحيل البيانات.

---

## 📋 نظرة عامة

| البند | القيمة |
|---|---|
| عدد الجداول | 19 جدول |
| عدد المناصب الأساسية | 8 (1 مركزي + 7 كليات) |
| عدد الصلاحيات | 16 صلاحية |
| أنواع المحتوى | 6 أنواع |
| الـ Triggers | 2 (حماية المسؤول المركزي) |
| الـ Views | 1 (user_permissions) |
| الـ Functions | 1 (user_has_permission) |

---

## 🏗️ مخطط العلاقات (ERD)

```
┌──────────────────┐
│   colleges (7)   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│ specialties (34) │────▶│   subjects (؟)   │
└──────────────────┘     └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ content (محتوى)  │
                         │ + telegram_msg_id│
                         └──────────────────┘

┌──────────────────┐     ┌──────────────────────┐
│  admin_users     │◀───▶│  position_holders    │
└──────────────────┘     └────────┬─────────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │   positions (8)  │
                         │ - central_chair  │
                         │ - college_admin_X│
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌─────────────────────────────┐
                         │ position_level_permissions  │
                         │ (ربط المستويات بالصلاحيات) │
                         └─────────────────────────────┘

┌──────────────────────┐
│ committee_channels   │
│ - central            │
│ - college (7)        │
│ - specialty_level    │
└──────────────────────┘
```

---

## 🎯 شرح الجداول

### 1-3. الهيكل الأكاديمي

| الجدول | الوصف |
|---|---|
| `colleges` | 7 كليات ثابتة |
| `specialties` | 34 تخصص موزّع على الكليات |
| `subjects` | المواد الدراسية (تُملأ من ملف Excel) |

### 4-5. المحتوى

| الجدول | الوصف |
|---|---|
| `content_types` | 6 أنواع: book_theory, book_practical, exam, summary, video, reference |
| `content` | المحتوى الفعلي + ربط القناة (telegram_message_id, telegram_file_id) |

### 6-10. نظام RBAC

| الجدول | الوصف |
|---|---|
| `admin_users` | المستخدمون الذين يمكن أن يكونوا مسؤولين (Telegram ID) |
| `positions` | المناصب (ثابتة، لا تُحذف) |
| `position_holders` | ربط Many-to-Many بين المناصب والمستخدمين |
| `permissions` | 16 صلاحية محددة |
| `position_level_permissions` | ربط المستويات بالصلاحيات (مع الوراثة) |

### 11-14. المساهمات + Audit

| الجدول | الوصف |
|---|---|
| `contributions` | مساهمات الطلاب المعلقة |
| `broadcasts` | التعميمات المُرسلة |
| `position_audit_logs` | سجل تغييرات المناصب (تعيين/إزالة) |
| `content_audit_logs` | سجل عمليات المحتوى (create/update/move/delete) |

### 15-19. بوت الطالب + اللجان

| الجدول | الوصف |
|---|---|
| `students` | بيانات الطلاب |
| `downloads` | سجل التحميلات (للإحصائيات) |
| `leaderboard` | لوحة الشرف |
| `custom_texts` | النصوص المخصصة |
| `committee_channels` | روابط قنوات اللجان (مركزية + كليات + مستويات) |

---

## 🛡️ نظام الصلاحيات (RBAC)

### هرم الوراثة

```
🛡 رئيس اللجنة المركزية (central)
   │ + كل صلاحياته الخاصة (8 صلاحيات)
   │
   ▼ يرث ↓
🏛 مسؤول الكلية (college)
   │ + صلاحياته الخاصة (4 صلاحيات)
   │
   ▼ يرث ↓
📊 مندوب المستوى (level)
     صلاحياته الأساسية (4 صلاحيات)
```

### الصلاحيات الـ 16

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

### منع حذف المسؤول المركزي

الـ Triggers:
1. `prevent_central_deletion()` — يمنع `DELETE FROM positions WHERE id = 'central_chair'`
2. `prevent_central_orphan()` — يمنع تعطيل آخر شاغل نشط للمنصب المركزي

---

## 🚀 كيفية التطبيق على Supabase

### الخطوة 1: إنشاء مشروع Supabase

1. اذهب إلى https://supabase.com → New Project
2. الاسم: `ust-central-bot`
3. Region: Frankfurt (eu-central-1)
4. خذ نسخة من كلمة مرور قاعدة البيانات

### الخطوة 2: تطبيق الـ Schema

1. في Dashboard → SQL Editor
2. انسخ كامل محتوى `db/schema.sql`
3. الصقه في المحرر
4. اضغط **Run**

### الخطوة 3: التحقق

```sql
-- التحقق من إنشاء الجداول
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

-- التحقق من المناصب
SELECT id, level, title FROM positions ORDER BY level;

-- التحقق من الصلاحيات
SELECT id, name, min_level FROM permissions ORDER BY min_level, id;

-- التحقق من الكليات
SELECT id, name, emoji FROM colleges ORDER BY display_order;
```

### الخطوة 4: الحصول على الـ Keys

من Dashboard → Settings → API:
- `Project URL`
- `anon public key`
- `service_role key` ⚠️ (سري!)

---

## 🔄 ترحيل البيانات من الـ Mockup

بعد تطبيق الـ schema، انسخ البيانات من ملفات `src/shared/data/`:

```sql
-- 1. الكليات: تم إدراجها تلقائياً في schema.sql
-- 2. التخصصات: تم إدراجها تلقائياً في schema.sql
-- 3. المواد: استخدم سكريبت الاستيراد من Excel (سيُبنى لاحقاً)
-- 4. المناصب: تم إدراجها تلقائياً في schema.sql
-- 5. الصلاحيات: تم إدراجها تلقائياً في schema.sql
-- 6. المسؤولون الأوليون:
INSERT INTO admin_users (telegram_id, first_name, username) VALUES
  (YOUR_TELEGRAM_ID, 'اسمك', 'username');
INSERT INTO position_holders (position_id, user_telegram_id, assigned_by)
VALUES ('central_chair', YOUR_TELEGRAM_ID, YOUR_TELEGRAM_ID);
```

---

## 🔐 سياسات RLS (Row Level Security)

الـ schema يفعّل RLS على:
- `content`
- `contributions`
- `broadcasts`

في الإنتاج، أضف سياسات مثل:

```sql
-- الطلاب يرون فقط المحتوى النشط
CREATE POLICY "students_view_active_content" ON content
  FOR SELECT USING (is_active = TRUE);

-- المسؤولون يرون كل المحتوى ضمن نطاقهم
CREATE POLICY "admins_manage_scope_content" ON content
  FOR ALL USING (
    user_has_permission(auth.uid()::bigint, 'manage_level_content', college_id)
  );
```

> ملاحظة: يحتاج Supabase Auth لربط `auth.uid()` مع `admin_users.telegram_id`.

---

## 📊 View جاهز: `user_permissions`

يوفّر View يدمج كل صلاحيات المستخدم من كل مناصبه:

```sql
SELECT * FROM user_permissions WHERE user_telegram_id = 123456789;
```

النتيجة: كل صلاحيات المستخدم مع تفاصيل المنصب والنطاق.

---

## 🎯 الخطوة التالية

بعد تطبيق الـ schema:
1. ✅ نُجهّز سكريبت استيراد المواد من Excel
2. ✅ نربط البوتين بـ Supabase (إضافة SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY كـ Cloudflare Secrets)
3. ✅ نُحدّث `src/shared/rbac.ts` لاستبدال المحاكاة باستعلامات Supabase حقيقية
4. ✅ نختبر التدفق الكامل

---

## 📞 الدعم

لأي استفسار حول الـ schema، اطرح Issue على:
https://github.com/mutawakel-hub/UST-BOT/issues
