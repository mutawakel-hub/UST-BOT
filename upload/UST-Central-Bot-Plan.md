# 📐 خطة تنفيذ البوت العلمي المركزي
## جامعة العلوم والتكنولوجيا (UST Central Bot)

> **الإصدار:** 1.0 — الخطة الشاملة
> **التاريخ:** يوليو 2026
> **الحالة:** جاهزة للتنفيذ بعد موافقة العميل

---

## 📑 فهرس المحتويات

1. [نظرة عامة على المشروع](#1-نظرة-عامة-على-المشروع)
2. [التقنيات المؤكدة](#2-التقنيات-المؤكدة)
3. [القرارات التشغيلية النهائية](#3-القرارات-التشغيلية-النهائية)
4. [الجرد الكامل للشاشات](#4-الجرد-الكامل-للشاشات)
5. [تصميم قاعدة البيانات](#5-تصميم-قاعدة-البيانات)
6. [هيكلة المشروع البرمجية](#6-هيكلة-المشروع-البرمجية)
7. [خطة التنفيذ على مراحل](#7-خطة-التنفيذ-على-مراحل)
8. [استراتيجية الـ Mockup](#8-استراتيجية-الـ-mockup)
9. [الأمان والأداء](#9-الأمان-والأداء)
10. [ما يحتاج العميل تجهيزه](#10-ما-يحتاج-العميل-تجهيزه)
11. [الخطوات التالية](#11-الخطوات-التالية)

---

## 1. نظرة عامة على المشروع

### 1.1 الهدف
بناء نظام بوت تلغرام مركزي لجامعة العلوم والتكنولوجيا، يخدم آلاف الطلاب للوصول إلى المحتوى الأكاديمي (مقررات، نماذج، ملخصات)، مع نظام مساهمات طلابي ولوحة إدارة هرمية من 4 مستويات.

### 1.2 المكوّنات الرئيسية

| المكوّن | الوصف |
|---|---|
| 🎓 **بوت الطالب** | 12 شاشة أساسية لتصفح المحتوى والمساهمة والاشتراكات |
| 🛡 **بوت الإدارة** | 15 شاشة إدارية مع 4 أدوار هرمية |
| 🗄 **قاعدة البيانات** | Supabase (PostgreSQL) — 10 جداول أساسية |
| 📦 **التخزين** | 7 قنوات تلغرام خاصة (قناة لكل كلية) |
| ⚡ **الـ Runtime** | Cloudflare Workers (مجاني 100%) |

### 1.3 المبادئ التصميمية

- **صفر تكلفة:** جميع الخدمات ضمن الباقات المجانية
- **أداء عالٍ:** استجابة < 500ms لكل طلب
- **أمان مزدوج:** فحص الصلاحية في الواجهة والباك إند
- **تخصيص كامل:** جميع النصوص والأزرار قابلة للتعديل من الإدارة
- **بساطة الطالب:** تدفق مباشر من 6 خطوات للوصول لأي ملف

---

## 2. التقنيات المؤكدة

| الطبقة | التقنية | السبب |
|---|---|---|
| Runtime | **Cloudflare Workers** | 100k طلب/يوم مجاناً + استجابة فورية |
| لغة البرمجة | **TypeScript** | أمان الأنواع + إنتاجية عالية |
| مكتبة تلغرام | **grammY** | مصممة لـ Serverless + دعم Webhooks |
| قاعدة البيانات | **Supabase (PostgreSQL)** | 500MB مجاناً + REST API + PgBouncer |
| التخزين المؤقت | **Cloudflare KV** | للجلسات و Rate Limiting |
| طوابير الإرسال | **Cloudflare Queues** | للتعميمات الجماعية |
| تخزين الملفات | **7 قنوات تلغرام** | مجاني وغير محدود |
| إدارة الحزم | **pnpm** | سريع وفعال |
| CI/CD | **GitHub Actions** | نشر تلقائي على Cloudflare |

**التكلفة الشهرية المتوقعة: 0$** ✅

---

## 3. القرارات التشغيلية النهائية

تم تأكيد القرارات التالية مع العميل:

| البند | القرار |
|---|---|
| التحقق من هوية الطلاب | ❌ غير مطلوب — البوت مفتوح للجميع |
| تخزين الملفات | ✅ قناة منفصلة لكل كلية (7 قنوات) |
| الشارات (Badges) | ❌ ملغاة |
| استرداد الحساب | ❌ ملغى |
| النسخ الاحتياطي | ❌ ملغى مؤقتاً |
| اللغة | 🇸🇦 عربي فقط (RTL) |
| لوحة ويب للإدارة | ❌ يكفي بوت الإدارة |
| تخصيص النصوص | ⚡ فوري + مركزي + كلية فقط |
| لوحة الشرف | 🔄 يحدّثها المسؤول المركزي |
| التعميمات | 📢 كل الأنواع (نص + صورة + ملف) حسب الصلاحية |
| الأدوار الإدارية | 👥 4 مستويات هرمية |

### 3.1 حدود الملفات

| النوع | الحجم الأقصى |
|---|---|
| PDF / DOCX | 50 MB |
| صور (JPG/PNG) | 10 MB |
| فيديو تعليمي (MP4) | 200 MB |
| **ممنوع:** | EXE, BAT, ZIP, RAR, APK |

### 3.2 حدود الاستخدام (Rate Limiting)

| الإجراء | الحد |
|---|---|
| تصفح القوائم | 30/دقيقة |
| تحميل ملف | 20/ساعة |
| بحث | 10/دقيقة |
| مساهمة | 3/يوم |
| إجراء إداري | 60/ساعة |

---

## 4. الجرد الكامل للشاشات

### 4.1 بوت الطالب — 12 شاشة

| # | اسم الشاشة | مُعرّف التنقل | الوصول |
|---|---|---|---|
| S1 | MainMenu | `/start` | مباشر |
| S2 | ChooseCollege | `menu_colleges` | من S1 |
| S3 | ChooseMajor | `col_{id}` | من S2 |
| S4 | ChooseLevel | `major_{id}` | من S3 |
| S5 | ChooseSemester | `level_{n}` | من S4 |
| S6 | ChooseSubject | `sem_{1\|2}` | من S5 |
| S7 | SubjectMenu | `subj_{id}` | من S6 |
| S8 | BookType (نظري/عملي) | `type_book_{id}` | من S7 |
| S9 | Contribution Mode | `contribute_{id}` | من S7 |
| S10 | Search Mode | `menu_search` | من S1 |
| S11 | Leaderboard | `menu_leaderboard` | من S1 |
| S12 | Profile | `menu_profile` | من S1 |

### 4.2 بوت الإدارة — 15 شاشة

| # | اسم الشاشة | مُعرّف التنقل | الصلاحية |
|---|---|---|---|
| A1 | AdminLogin | `/start` | جميع المسؤولين |
| A2 | AdminDashboard | بعد التحقق | جميع المسؤولين |
| A3 | PendingList | `pending` | الجميع (ضمن النطاق) |
| A4 | ReviewContribution | `review_{id}` | الجميع |
| A4b | RejectReason | `reject_{id}` | الجميع |
| A5 | FilesMgmt | `files_mgmt` | الجميع |
| A5a | UploadWizard | `upload_file` | الجميع |
| A5b | BrowseFiles | `browse_files` | الجميع |
| A6 | SubjectsMgmt | `subjects_mgmt` | مركزي + كلية |
| A7 | Broadcast | `broadcast` | الجميع (حسب النطاق) |
| A8 | ManageAdmins | `manage_admins` | مركزي + كلية + تخصص |
| A9 | Statistics | `statistics` | الجميع |
| A10 | CustomizeTexts | `customize_texts` | مركزي + كلية |
| A10a | CustomizeScreenItems | `custom_screen_{key}` | مركزي + كلية |
| A11 | LeaderboardUpdate | `leaderboard_update` | مركزي فقط |

### 4.3 خريطة التنقل الكاملة

```
بوت الطالب:
                                ┌─────────────┐
                                │  S1: /start │
                                └──────┬──────┘
        ┌───────────┬───────────┬─────┴──────┬──────────┬──────────┐
        ▼           ▼           ▼            ▼          ▼          ▼
   S2: الكليات  S10: بحث  S11: لوحة الشرف  S12: حسابي  قناة اللجنة  تواصل
        │
        ▼
   S3: التخصص
        │
        ▼
   S4: المستوى ───> 🗺 الخطة الاسترشادية (ملف)
        │
        ▼
   S5: الفصل
        │
        ▼
   S6: المادة
        │
        ▼
   S7: تصنيفات المادة
        │
   ┌────┼────┬──────────┬─────────┐
   ▼    ▼    ▼          ▼         ▼
 S8:   📝   📑         💡 مساهمة  🔔 اشتراك
 مقرر  نماذج ملخصات      S9
  │
  ▼
 نظري/عملي → إرسال الملفات
```

```
بوت الإدارة:
                                ┌─────────────┐
                                │ A1: /start  │
                                └──────┬──────┘
                                       ▼
                                ┌─────────────┐
                                │ A2: Dashboard│
                                └──────┬──────┘
       ┌──────┬──────┬──────────┬─────┴──────┬──────────┬─────────┬─────────┐
       ▼      ▼      ▼          ▼            ▼          ▼         ▼         ▼
     A3    A5    A6         A7           A8         A9        A10       A11
   مساهمة ملفات  مواد      تعميم        مسؤولين    إحصائيات  تخصيص    لوحة الشرف
     │                                                          │
     ▼                                                          ▼
   A4: تفاصيل                                              A10a: عناصر
     │
     ├─→ ✅ اعتماد
     ├─→ ⭐ اعتماد مميز
     └─→ ❌ رفض → A4b (سبب الرفض)
```

### 4.4 جدول الـ callback_data الكامل

تم توحيد مُعرّفات التنقل لضمان一致性:

```typescript
// بوت الطالب
'menu_colleges'              // الانتقال لاختيار الكلية
'menu_search'                // وضع البحث
'menu_leaderboard'           // لوحة الشرف
'menu_profile'               // حسابي
'col_{collegeId}'            // اختيار كلية
'major_{majorId}'            // اختيار تخصص
'level_{n}'                  // اختيار مستوى
'plan_{majorId}'             // الخطة الاسترشادية
'sem_{1|2}'                  // اختيار فصل
'subj_{subjectId}'           // اختيار مادة
'type_book_{subjectId}'      // المقرر الدراسي
'type_exams_{subjectId}'     // نماذج اختبارات
'type_summaries_{subjectId}' // ملخصات
'contribute_{subjectId}'     // وضع المساهمة
'subscribe_{subjectId}'      // اشتراك
'unsubscribe_{subjectId}'    // إلغاء اشتراك
'book_theory_{subjectId}'    // مقرر نظري
'book_practical_{subjectId}' // مقرر عملي
'search_result_{fileId}'     // نتيجة بحث
'search_next_{page}'         // صفحة بحث تالية
'leader_colleges'            // تصفية لوحة الشرف بالكلية
'leader_majors'              // تصفية بالتخصص
'leader_refresh'             // تحديث اللوحة
'my_contributions'           // مساهماتي
'my_downloads'               // آخر تحميلاتي
'change_major'               // تغيير التخصص
'cancel_contribute'          // إلغاء المساهمة
'back_to_main'               // رجوع للرئيسية
'back_to_colleges'           // رجوع للكليات
'back_to_majors'             // رجوع للتخصصات
'back_to_levels'             // رجوع للمستويات
'back_to_semesters'          // رجوع للفصول
'back_to_subjects'           // رجوع للمواد
'back_to_subject_menu'       // رجوع لقائمة المادة

// بوت الإدارة
'pending'                    // قائمة المساهمات المعلقة
'review_{contributionId}'    // مراجعة مساهمة
'approve_{id}'               // اعتماد
'approve_star_{id}'          // اعتماد مميز
'reject_{id}'                // رفض
'reject_reason_dup_{id}'     // سبب: مكرر
'reject_reason_bad_{id}'     // سبب: غير واضح
'reject_reason_irrelevant_{id}' // سبب: لا يتعلق بالمادة
'reject_reason_incomplete_{id}' // سبب: غير مكتمل
'reject_reason_skip_{id}'    // تخطي السبب
'files_mgmt'                 // إدارة الملفات
'upload_file'                // رفع ملف
'browse_files'               // استعراض الملفات
'upload_col_{id}'            // خطوة رفع: كلية
'upload_major_{id}'          // خطوة رفع: تخصص
'upload_level_{n}'           // خطوة رفع: مستوى
'upload_sem_{n|0}'           // خطوة رفع: فصل
'upload_subj_{id}'           // خطوة رفع: مادة
'upload_type_{type}'         // خطوة رفع: تصنيف
'confirm_upload'             // تأكيد الرفع
'file_{fileId}'              // ملف للمعاينة/الحذف
'subjects_mgmt'              // إدارة المواد
'add_subject'                // إضافة مادة
'edit_subject'               // تعديل/حذف مادة
'broadcast'                  // تعميم
'broadcast_all'              // تعميم للكل
'broadcast_college'          // تعميم لكلية
'broadcast_major'            // تعميم لتخصص
'broadcast_level'            // تعميم لمستوى
'manage_admins'              // إدارة المسؤولين
'add_admin'                  // إضافة مسؤول
'list_admins'                // قائمة المسؤولين
'statistics'                 // إحصائيات
'stats_refresh'              // تحديث الإحصائيات
'customize_texts'            // تخصيص النصوص
'custom_screen_{key}'        // اختيار شاشة للتخصيص
'edit_text_{key}'            // تعديل نص
'reset_default'              // استعادة الافتراضي
'leaderboard_update'         // تحديث لوحة الشرف
'back_to_dashboard'          // رجوع للوحة الإدارة
'back_to_pending'            // رجوع للمساهمات
'back_to_review'             // رجوع للمراجعة
```

---

## 5. تصميم قاعدة البيانات

### 5.1 المخطط الكامل (10 جداول)

```sql
-- ============================================
-- 1. الكليات (7 صفوف ثابتة)
-- ============================================
CREATE TABLE colleges (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,  -- للبحث
  channel_id TEXT,                -- معرّف قناة تخزين الكلية
  committee_channel_url TEXT,     -- رابط قناة اللجنة العلمية
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_colleges_normalized ON colleges(name_normalized);

-- ============================================
-- 2. التخصصات
-- ============================================
CREATE TABLE specialties (
  id SERIAL PRIMARY KEY,
  college_id INT NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  levels_count INT NOT NULL DEFAULT 4,  -- عدد المستويات
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_specialties_college ON specialties(college_id);

-- ============================================
-- 3. المستويات (محسوبة ديناميكياً، لا جدول مستقل)
-- (يتم توليدها من specialties.levels_count)
-- ============================================

-- ============================================
-- 4. المواد الدراسية
-- ============================================
CREATE TABLE subjects (
  id SERIAL PRIMARY KEY,
  specialty_id INT NOT NULL REFERENCES specialties(id) ON DELETE CASCADE,
  level INT NOT NULL,                    -- 1..6 حسب التخصص
  semester INT NOT NULL CHECK (semester IN (1, 2)),
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_subjects_specialty ON subjects(specialty_id, level, semester);
CREATE INDEX idx_subjects_search ON subjects USING GIN (name_normalized gin_trgm_ops);

-- ============================================
-- 5. الملفات (المحتوى الفعلي)
-- ============================================
CREATE TABLE files (
  id BIGSERIAL PRIMARY KEY,
  subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('book_theory', 'book_practical', 'exam', 'summary')),
  file_name TEXT NOT NULL,
  file_id TEXT NOT NULL,                 -- معرّف تلغرام
  file_unique_id TEXT NOT NULL,          -- معرّف فريد تلغرام
  file_hash VARCHAR(64) UNIQUE NOT NULL, -- منع التكرار (SHA-256)
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by_admin_id INT,              -- NULL يعني مساهمة طالب
  contribution_id BIGINT,                -- ربط بالمساهمة إن وجدت
  is_starred BOOLEAN DEFAULT false,      -- محتوى مميز
  download_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_files_subject ON files(subject_id, category);
CREATE INDEX idx_files_hash ON files(file_hash);

-- ============================================
-- 6. المستخدمون (الطلاب)
-- ============================================
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  current_college_id INT,        -- للاستخدام في "حسابي"
  current_specialty_id INT,
  current_level INT,
  total_downloads INT DEFAULT 0,
  accepted_contributions INT DEFAULT 0,
  is_blocked BOOLEAN DEFAULT false,
  last_activity TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_users_telegram ON users(telegram_id);

-- ============================================
-- 7. المساهمات (في انتظار المراجعة)
-- ============================================
CREATE TABLE contributions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INT NOT NULL REFERENCES subjects(id),
  category TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_id TEXT NOT NULL,
  file_hash VARCHAR(64) NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  is_starred BOOLEAN DEFAULT false,
  reject_reason TEXT,
  reviewed_by_admin_id INT,
  reviewed_at TIMESTAMP,
  escalation_level INT DEFAULT 0,  -- 0, 1 (24h), 2 (48h)
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_contributions_status ON contributions(status, created_at);
CREATE INDEX idx_contributions_subject_hash ON contributions(subject_id, file_hash);

-- ============================================
-- 8. المسؤولون (4 أدوار هرمية)
-- ============================================
CREATE TABLE admins (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('central', 'college', 'specialty', 'level')),
  college_id INT REFERENCES colleges(id),         -- لـ college/specialty/level
  specialty_id INT REFERENCES specialties(id),    -- لـ specialty/level
  level INT,                                       -- لـ level فقط
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  -- ضمان النطاق حسب الدور
  CONSTRAINT chk_admin_scope CHECK (
    (role = 'central' AND college_id IS NULL AND specialty_id IS NULL AND level IS NULL) OR
    (role = 'college' AND college_id IS NOT NULL AND specialty_id IS NULL AND level IS NULL) OR
    (role = 'specialty' AND college_id IS NOT NULL AND specialty_id IS NOT NULL AND level IS NULL) OR
    (role = 'level' AND college_id IS NOT NULL AND specialty_id IS NOT NULL AND level IS NOT NULL)
  )
);
CREATE INDEX idx_admins_telegram ON admins(telegram_id);

-- ============================================
-- 9. اشتراكات الطلاب في المواد
-- ============================================
CREATE TABLE subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, subject_id)
);
CREATE INDEX idx_subscriptions_subject ON subscriptions(subject_id);

-- ============================================
-- 10. النصوص والأزرار القابلة للتخصيص
-- ============================================
CREATE TABLE custom_texts (
  id SERIAL PRIMARY KEY,
  screen_key TEXT NOT NULL,           -- مثل 'main_menu', 'choose_college'
  text_key TEXT NOT NULL,             -- مثل 'welcome_message', 'btn_colleges'
  default_value TEXT NOT NULL,
  custom_value TEXT,                  -- NULL يعني استخدم الافتراضي
  scope_type TEXT NOT NULL DEFAULT 'global'
    CHECK (scope_type IN ('global', 'college')),
  scope_college_id INT,               -- NULL للنطاق العام
  updated_by_admin_id INT,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(screen_key, text_key, scope_type, scope_college_id)
);

-- ============================================
-- 11. سجل العمليات الإدارية (Audit Log)
-- ============================================
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  admin_id INT NOT NULL REFERENCES admins(id),
  action TEXT NOT NULL,               -- 'approve', 'reject', 'upload', 'delete', 'broadcast'...
  entity_type TEXT,                   -- 'file', 'contribution', 'admin', 'subject'...
  entity_id BIGINT,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_audit_admin ON audit_logs(admin_id, created_at);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at);

-- ============================================
-- 12. التحميلات (لسجل الطالب + الإحصائيات)
-- ============================================
CREATE TABLE downloads (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_id BIGINT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_downloads_user ON downloads(user_id, created_at DESC);
CREATE INDEX idx_downloads_file ON downloads(file_id);

-- ============================================
-- 13. التعميمات (للسجل + منع التكرار)
-- ============================================
CREATE TABLE broadcasts (
  id BIGSERIAL PRIMARY KEY,
  admin_id INT NOT NULL REFERENCES admins(id),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('all', 'college', 'specialty', 'level')),
  scope_college_id INT,
  scope_specialty_id INT,
  scope_level INT,
  content_type TEXT NOT NULL CHECK (content_type IN ('text', 'photo', 'document')),
  text_content TEXT,
  media_file_id TEXT,
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'completed', 'failed')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 14. لوحة الشرف (مخزّنة + يحدّثها المركزي)
-- ============================================
CREATE TABLE leaderboard (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'college', 'specialty')),
  scope_college_id INT,
  scope_specialty_id INT,
  rank INT NOT NULL,
  points INT NOT NULL,
  period_start DATE,
  period_end DATE,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, scope_type, scope_college_id, scope_specialty_id, period_start)
);
CREATE INDEX idx_leaderboard_scope ON leaderboard(scope_type, scope_college_id, scope_specialty_id, rank);
```

### 5.2 الإضافات المطلوبة في Supabase

```sql
-- تفعيل pg_trgm للبحث الضبابي العربي
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- تفعيل pgcrypto لتشفير كلمات المرور (لو لزم)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### 5.3 البيانات الأولية (Seed)

- 7 كليات (مُحدّدة في التصميم الأصلي)
- 28 تخصصاً موزّعة على الكليات
- المواد: تُحمَّل من ملف CSV يُجهّزه العميل

---

## 6. هيكلة المشروع البرمجية

```
ust-central-bot/
├── src/
│   ├── bots/
│   │   ├── student/
│   │   │   ├── index.ts                 # نقطة دخول بوت الطالب
│   │   │   ├── handlers/
│   │   │   │   ├── main-menu.handler.ts        # S1: MainMenu
│   │   │   │   ├── colleges.handler.ts         # S2: ChooseCollege
│   │   │   │   ├── majors.handler.ts           # S3: ChooseMajor
│   │   │   │   ├── levels.handler.ts           # S4: ChooseLevel
│   │   │   │   ├── semesters.handler.ts        # S5: ChooseSemester
│   │   │   │   ├── subjects.handler.ts         # S6: ChooseSubject
│   │   │   │   ├── subject-menu.handler.ts     # S7: SubjectMenu
│   │   │   │   ├── book-type.handler.ts        # S8: BookType
│   │   │   │   ├── contribution.handler.ts     # S9: Contribution
│   │   │   │   ├── search.handler.ts           # S10: Search
│   │   │   │   ├── leaderboard.handler.ts      # S11: Leaderboard
│   │   │   │   └── profile.handler.ts          # S12: Profile
│   │   │   └── keyboards/
│   │   │       └── student.keyboards.ts
│   │   │
│   │   ├── admin/
│   │   │   ├── index.ts
│   │   │   ├── handlers/
│   │   │   │   ├── login.handler.ts            # A1: AdminLogin
│   │   │   │   ├── dashboard.handler.ts        # A2: AdminDashboard
│   │   │   │   ├── pending.handler.ts          # A3: PendingList
│   │   │   │   ├── review.handler.ts           # A4: ReviewContribution
│   │   │   │   ├── reject.handler.ts           # A4b: RejectReason
│   │   │   │   ├── files-mgmt.handler.ts       # A5: FilesMgmt
│   │   │   │   ├── upload-wizard.handler.ts    # A5a: UploadWizard
│   │   │   │   ├── browse-files.handler.ts     # A5b: BrowseFiles
│   │   │   │   ├── subjects-mgmt.handler.ts    # A6: SubjectsMgmt
│   │   │   │   ├── broadcast.handler.ts        # A7: Broadcast
│   │   │   │   ├── manage-admins.handler.ts    # A8: ManageAdmins
│   │   │   │   ├── statistics.handler.ts       # A9: Statistics
│   │   │   │   ├── customize.handler.ts        # A10: CustomizeTexts
│   │   │   │   └── leaderboard-update.handler.ts # A11
│   │   │   └── middleware/
│   │   │       ├── admin-auth.ts               # التحقق من الصلاحية
│   │   │       ├── scope-check.ts              # فحص النطاق
│   │   │       └── audit-log.ts
│   │   │
│   │   └── shared/
│   │       ├── keyboards.ts                    # دوال مساعدة للأزرار
│   │       ├── pagination.ts                   # تقسيم القوائم
│   │       └── texts.ts                        # تحميل النصوص المخصصة
│   │
│   ├── db/
│   │   ├── schema.sql                          # المخطط الكامل
│   │   ├── client.ts                           # عميل Supabase + PgBouncer
│   │   └── repositories/
│   │       ├── colleges.repo.ts
│   │       ├── specialties.repo.ts
│   │       ├── subjects.repo.ts
│   │       ├── files.repo.ts
│   │       ├── users.repo.ts
│   │       ├── contributions.repo.ts
│   │       ├── admins.repo.ts
│   │       ├── subscriptions.repo.ts
│   │       ├── custom-texts.repo.ts
│   │       ├── audit-logs.repo.ts
│   │       ├── downloads.repo.ts
│   │       ├── broadcasts.repo.ts
│   │       └── leaderboard.repo.ts
│   │
│   ├── storage/
│   │   ├── telegram-storage.ts                 # رفع/تنزيل للقنوات
│   │   └── file-scanner.ts                     # فحص الفيروسات + Magic Bytes
│   │
│   ├── lib/
│   │   ├── auth.ts                             # مصادقة المسؤولين
│   │   ├── rate-limit.ts                       # Durable Object للحد
│   │   ├── queue.ts                            # Cloudflare Queues
│   │   ├── search.ts                           # البحث الذكي
│   │   ├── arabic-utils.ts                     # تطبيع النص العربي
│   │   ├── hash.ts                             # SHA-256 للملفات
│   │   └── callback-encoder.ts                 # تشفير callback_data
│   │
│   ├── workers/
│   │   ├── student-bot.worker.ts               # Worker للبوت الطلابي
│   │   ├── admin-bot.worker.ts                 # Worker للبوت الإداري
│   │   ├── cron.worker.ts                      # مهام مجدولة (تصعيد، صيانة)
│   │   └── queue-consumer.worker.ts            # معالجة طوابير التعميم
│   │
│   └── types/
│       ├── telegram.d.ts
│       ├── db.d.ts
│       └── callbacks.d.ts
│
├── mockups/
│   ├── student-bot.mockup.ts                   # بوت طالب ببيانات وهمية
│   ├── admin-bot.mockup.ts                     # بوت إدارة ببيانات وهمية
│   └── README.md                               # تعليمات التشغيل المحلي
│
├── scripts/
│   ├── seed-colleges.ts                        # بذور الكليات والتخصصات
│   ├── seed-subjects.ts                        # بذور المواد من CSV
│   ├── seed-admins.ts                          # بذور المسؤولين الأوليين
│   └── seed-default-texts.ts                   # النصوص الافتراضية
│
├── tests/
│   ├── unit/
│   │   ├── arabic-utils.test.ts
│   │   ├── callback-encoder.test.ts
│   │   └── rate-limit.test.ts
│   └── e2e/
│       ├── student-flow.test.ts
│       └── admin-flow.test.ts
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   ├── ADMIN-GUIDE.md
│   └── API.md
│
├── wrangler.toml                               # إعداد Cloudflare Workers
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

---

## 7. خطة التنفيذ على مراحل

### 📅 الجدول الزمني (10 أيام عمل)

| اليوم | المرحلة | المخرجات |
|---|---|---|
| **1-2** | المرحلة 1: Mockup UI | `mockups/student-bot.mockup.ts` + `mockups/admin-bot.mockup.ts` + README |
| **3** | المرحلة 2: قاعدة البيانات | `schema.sql` + سكريبتات البذور + اختبار الاتصال |
| **4** | المرحلة 3a: بوت الطالب (الجزء 1) | الشاشات S1-S7 (القائمة الرئيسية + التدفق الأكاديمي) |
| **5** | المرحلة 3b: بوت الطالب (الجزء 2) | الشاشات S8-S12 (المحتوى + المساهمة + البحث + لوحة الشرف + الحساب) |
| **6** | المرحلة 4a: بوت الإدارة (الجزء 1) | الشاشات A1-A4b (المصادقة + المساهمات المعلقة) |
| **7** | المرحلة 4b: بوت الإدارة (الجزء 2) | الشاشات A5-A8 (الملفات + المواد + التعميم + المسؤولون) |
| **8** | المرحلة 4c: بوت الإدارة (الجزء 3) | الشاشات A9-A11 (الإحصائيات + التخصيص + لوحة الشرف) |
| **9** | المرحلة 5: الربط والاختبار | Queues + Cron + اختبارات E2E + إصلاح الأخطاء |
| **10** | المرحلة 6: النشر والتوثيق | نشر Cloudflare + Webhook + README + دليل الإدارة |

### 🎯 نقاط المراجعة (Checkpoints)

```
اليوم 2 ──── ✅ نقطة مراجعة 1: تجربة الـ Mockup في تلغرام
                  ↓ موافقة العميل على التدفق
اليوم 5 ──── ✅ نقطة مراجعة 2: تجربة بوت الطالب الكامل
                  ↓ موافقة العميل على التجربة
اليوم 8 ──── ✅ نقطة مراجعة 3: تجربة بوت الإدارة الكامل
                  ↓ موافقة العميل على التجربة
اليوم 10 ─── 🚀 التسليم النهائي + النشر للإنتاج
```

---

## 8. استراتيجية الـ Mockup

### 8.1 الهدف

بناء نسخة **قابلة للتشغيل محلياً** من البوتين، تستخدم بيانات وهمية (لا قاعدة بيانات، لا Supabase)، لاختبار تدفق المستخدم فعلياً في تلغرام.

### 8.2 المميزات

- ✅ تشغيل عبر **Long Polling** (بدون Webhook)
- ✅ بيانات وهمية ثابتة في الكود (7 كليات + تخصصات + مواد + ملفات)
- ✅ جميع التنقلات تعمل (`callback_data` حقيقي)
- ✅ إرسال ملفات وهمية حقيقية من قناة اختبار
- ✅ لا يحتاج أي مفاتيح سرية سوى Test Bot Token

### 8.3 خطوات التشغيل (للعميل)

```bash
# 1. إنشاء بوت تجريبي عبر @BotFather
#    والحصول على Test Token

# 2. استنساخ المشروع
git clone <repo-url>
cd ust-central-bot

# 3. تثبيت الحزم
pnpm install

# 4. إعداد المتغيرات
cp .env.example .env
# عدّل .env وأضف TEST_STUDENT_BOT_TOKEN و TEST_ADMIN_BOT_TOKEN

# 5. تشغيل الـ Mockup للطالب
pnpm mockup:student

# 6. في نافذة أخرى: تشغيل الـ Mockup للإدارة
pnpm mockup:admin

# 7. افتح البوتين في تلغرام وجرب التدفقات!
```

### 8.4 التغطية

| التدفق | التغطية في الـ Mockup |
|---|---|
| الطالب: S1 → S8 (وصول لملف) | ✅ كامل |
| الطالب: S1 → S9 (مساهمة) | ✅ كامل |
| الطالب: S1 → S10 (بحث) | ✅ كامل (نتائج وهمية) |
| الطالب: S1 → S11 (لوحة الشرف) | ✅ كامل |
| الطالب: S1 → S12 (حسابي) | ✅ كامل |
| الإدارة: A1 → A4 (مراجعة مساهمة) | ✅ كامل |
| الإدارة: A5 (رفع ملف) | ⚠️ جزئي (الخطوات بدون رفع فعلي) |
| الإدارة: A10 (تخصيص نصوص) | ⚠️ جزئي (يحفظ في الذاكرة فقط) |

---

## 9. الأمان والأداء

### 9.1 الأمان

| الإجراء | التطبيق |
|---|---|
| ✅ التحقق المزدوج من الصلاحية | Frontend (إخفاء الأزرار) + Backend (فحص فعلي) |
| ✅ Rate Limiting ثلاثي الطبقات | Durable Object + KV + IP |
| ✅ Audit Log شامل | جدول `audit_logs` لكل عملية إدارية |
| ✅ منع الملفات المكررة | `file_hash` UNIQUE constraint |
| ✅ فحص نوع الملف (Magic Bytes) | لا الاعتماد على الامتداد فقط |
| ✅ فحص VirusTotal | API عام مجاني للملفات المشبوهة |
| ✅ توقيع callback_data | HMAC قصير لمنع التلاعب |
| ✅ قائمة سوداء للمستخدمين | `is_blocked` في جدول `users` |

### 9.2 الأداء

| التحسين | التأثير |
|---|---|
| ✅ فهارس B-Tree + GIN | استعلامات < 10ms |
| ✅ PgBouncer transaction mode | اتصالات متعددة من Workers |
| ✅ Workers Cache API | تخزين مؤقت 60s للقراءات |
| ✅ Cloudflare Queues | توزيع التعميمات على دفعات |
| ✅ تطبيع النصوص مسبقاً | لا حساب عند البحث |
| ✅ Pagination 8 أزرار/صفحة | استجابة سريعة + تجربة مستخدم جيدة |

### 9.3 حدود Cloudflare Workers (مُدارة)

| المورد | الحد المجاني | الاستراتيجية |
|---|---|---|
| الطلبات اليومية | 100,000 | كافٍ لـ 5000 طالب نشط |
| CPU time per request | 10ms | تجنب العمليات الثقيلة (إرسالها لـ Queue) |
| KV reads | 100,000/يوم | استخدام Cache API كطبقة أولى |
| KV writes | 1,000/يوم | تقييد الكتابة للحالات الضرورية فقط |
| Queues operations | 10M/شهر | كافٍ للتعميمات اليومية |

### 9.4 Cron Jobs المجدولة

| الجدولة | المهمة |
|---|---|
| كل دقيقة | فحص صحة Webhook + Fallback Polling |
| كل ساعة | تنبيهات تصعيد المساهمات (24h, 48h) |
| يومياً 3:00 ص | إعادة تفعيل Supabase (منع الإيقاف) |
| يومياً 4:00 ص | تنظيف الجلسات المنتهية في KV |

---

## 10. ما يحتاج العميل تجهيزه

### 10.1 مفاتيح وبيانات سرية (للمرحلة 3+)

| # | العنصر | كيفية الحصول عليه | مطلوب في |
|---|---|---|---|
| 1 | **Bot Token للطالب** | `@BotFather` → `/newbot` | المرحلة 1 (Mockup) |
| 2 | **Bot Token للإدارة** | `@BotFather` → `/newbot` | المرحلة 1 (Mockup) |
| 3 | **Supabase URL** | Supabase Dashboard | المرحلة 2 |
| 4 | **Supabase Service Role Key** | Supabase Dashboard → Settings → API | المرحلة 2 |
| 5 | **Cloudflare Account ID** | Cloudflare Dashboard | المرحلة 5 |
| 6 | **Cloudflare API Token** | Cloudflare → My Profile → API Tokens | المرحلة 5 |
| 7 | **7 Channel IDs للتخزين** | إنشاء قنوات + إضافة `@userinfobot` | المرحلة 2 |
| 8 | **GitHub Personal Access Token** | GitHub → Settings → Developer settings | المرحلة 5 |

### 10.2 بيانات أكاديمية (للمرحلة 2)

- [ ] ملف Excel/CSV بالكليات والتخصصات والمستويات
  - التنسيق: `college_name, specialty_name, levels_count`
- [ ] ملف Excel/CSV بالمواد الدراسية لكل تخصص/مستوى/فصل
  - التنسيق: `specialty_name, level, semester, subject_name`
- [ ] قائمة بأسماء وروابط:
  - قناة اللجنة المركزية
  - 7 قنوات للكليات السبع
- [ ] قائمة المسؤولين الأوليين
  - التنسيق: `telegram_id, name, role, college_id, specialty_id, level`

### 10.3 قرارات نهائية (مؤكدة بالفعل ✅)

تم تأكيد جميع القرارات التشغيلية مع العميل في الرسائل السابقة. لا حاجة لمزيد من الإيضاح.

---

## 11. الخطوات التالية

### 11.1 خطوة البدء الفورية

بمجرد موافقة العميل على هذه الخطة، سأبدأ بـ:

```
✅ إنشاء هيكل المشروع الكامل في /home/z/my-project/ust-central-bot/
✅ بناء mockups/student-bot.mockup.ts (12 شاشة ببيانات وهمية)
✅ بناء mockups/admin-bot.mockup.ts (15 شاشة ببيانات وهمية)
✅ كتابة mockups/README.md بتعليمات التشغيل
```

### 11.2 ما يحتاجه العميل لبدء المرحلة 1 فقط

- ✅ إنشاء بوتين تجريبيين عبر `@BotFather` (للطالب + الإدارة)
- ✅ إرسال الـ Tokens إليّ (أو تشغيل الـ Mockup محلياً بنفسه)

> ⚠️ **لا يحتاج أي مفاتيح Supabase أو Cloudflare في هذه المرحلة.**

### 11.3 معايير قبول المرحلة 1 (Definition of Done)

- [ ] يمكن تشغيل `pnpm mockup:student` و `pnpm mockup:admin` بنجاح
- [ ] بوت الطالب: التنقل من `/start` حتى استلام ملف وهمي يعمل
- [ ] بوت الطالب: شاشات البحث + لوحة الشرف + حسابي تعرض بيانات وهمية
- [ ] بوت الإدارة: تسجيل الدخول + قائمة المساهمات المعلقة + اعتماد/رفض يعمل
- [ ] جميع التنقلات (`back_to_*`) تعمل بشكل صحيح
- [ ] Pagination يعمل في القوائم الطويلة
- [ ] النصوص العربية تظهر بشكل صحيح (RTL)

### 11.4 بعد المرحلة 1

```
العميل يجرب الـ Mockup
       │
       ├─→ موافقة → نبدأ المرحلة 2 (قاعدة البيانات)
       │             ↓
       │             العميل يُجهّز مفاتيح Supabase + قنوات التخزين
       │             ↓
       │             نبدأ التنفيذ الفعلي للباك إند
       │
       └─→ تعديلات → نعدّل الـ Mockup ثم نعيد التجربة
```

---

## 📊 ملخص تنفيذي

| البند | القيمة |
|---|---|
| **التكلفة الشهرية** | 0$ |
| **زمن التنفيذ** | 10 أيام عمل |
| **عدد الشاشات** | 27 شاشة (12 طالب + 15 إدارة) |
| **عدد الجداول** | 14 جدول |
| **التقنيات** | 100% مجانية مفتوحة المصدر |
| **اللغة** | عربي فقط |
| **نقاط المراجعة** | 3 نقاط مع العميل |
| **المخرجات النهائية** | بوتين منشورين + توثيق + دليل إدارة |

---

## ✅ التأكيد النهائي

هذه الخطة:
- ✅ تستوعب **جميع الشاشات** الموثّقة في طلب العميل
- ✅ تطبق **جميع القرارات** المؤكدة في الرسائل السابقة
- ✅ تحل **جميع الثغرات** التقنية المُناقَشة
- ✅ تقدم **جدولاً زمنياً** واقعياً مع نقاط مراجعة
- ✅ تُحدّد **بوضوح** ما يحتاجه العميل في كل مرحلة

**النظام جاهز للتنفيذ. بانتظار الإشارة للبدء بالمرحلة 1 (الـ Mockup).** 🚀
