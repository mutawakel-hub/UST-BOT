-- ============================================================================
-- 🗄️ UST Central Bot - Database Schema (Supabase / PostgreSQL)
-- ============================================================================
-- جامعة العلوم والتكنولوجيا - اليمن
-- الإصدار: 1.2
-- التاريخ: يوليو 2026
-- ============================================================================
-- النهج المعتمد:
--   1. RBAC (Role-Based Access Control) مع وراثة الصلاحيات
--   2. المناصب لا الأشخاص (Position-based Identity)
--   3. فصل إدارة المحتوى عن تخزينه (Bots manage, Channels store)
--   4. Audit Trail كامل (تتبّع كل عملية)
-- ============================================================================

-- ============================================
-- تفعيل الإضافات المطلوبة
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- البحث الضبابي العربي
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- التشفير

-- ============================================
-- 1. الكليات (7 صفوف ثابتة)
-- ============================================
CREATE TABLE colleges (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,                  -- للبحث
  short_name TEXT NOT NULL,
  emoji TEXT DEFAULT '🏛',
  committee_channel_url TEXT,                     -- رابط قناة لجنة الكلية
  storage_channel_id TEXT,                        -- معرّف قناة التخزين (Telegram)
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
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
  short_name TEXT NOT NULL,
  levels_count INT NOT NULL DEFAULT 4,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_specialties_college ON specialties(college_id);

-- ============================================
-- 3. المواد الدراسية
-- ============================================
CREATE TABLE subjects (
  id BIGSERIAL PRIMARY KEY,
  specialty_id INT NOT NULL REFERENCES specialties(id) ON DELETE CASCADE,
  level INT NOT NULL,
  semester INT NOT NULL CHECK (semester IN (1, 2)),
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  has_theory BOOLEAN DEFAULT TRUE,
  has_practical BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_subjects_specialty ON subjects(specialty_id, level, semester);
CREATE INDEX idx_subjects_search ON subjects USING GIN (name_normalized gin_trgm_ops);

-- ============================================
-- 4. أنواع المحتوى (6 أنواع)
-- ============================================
CREATE TABLE content_types (
  id TEXT PRIMARY KEY,                            -- 'book_theory', 'exam', ...
  name TEXT NOT NULL,                             -- الاسم العربي
  emoji TEXT NOT NULL,                            -- الإيموجي
  description TEXT,
  sort_order INT DEFAULT 0
);

INSERT INTO content_types (id, name, emoji, description, sort_order) VALUES
  ('book_theory',    'المقرر (نظري)',              '📘', 'الكتاب الأساسي النظري للمادة',           1),
  ('book_practical', 'المقرر (عملي)',              '📗', 'الدليل العملي للمادة',                   2),
  ('summary',        'ملخصات',                     '📄', 'ملخصات المادة وخرائط ذهنية',             3),
  ('exam',           'نماذج اختبارات',             '📝', 'نماذج الاختبارات السابقة وبنوك الأسئلة', 4),
  ('video',          'مرئيات وصوتيات',             '🎥', 'محاضرات مسجلة وشروحات وتسجيلات صوتية',   5),
  ('reference',      'مراجع',                      '📖', 'كتب وأبحاث ومصادر تعليمية موثوقة',       6),
  ('schedule',       'جداول دراسية واختبارات',     '📅', 'جداول المحاضرات والاختبارات النصفية والنهائية', 7);

-- ============================================
-- 5. المحتوى (مع ربط القناة)
-- ============================================
CREATE TABLE content (
  id BIGSERIAL PRIMARY KEY,
  subject_id INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  content_type_id TEXT NOT NULL REFERENCES content_types(id),
  title TEXT NOT NULL,                            -- عنوان يعرضه الطالب
  file_name TEXT,                                 -- اسم الملف الأصلي
  file_size_mb DECIMAL(10, 2),
  -- ربط القناة (الفصل بين الإدارة والتخزين)
  telegram_message_id BIGINT,                     -- معرف المنشور في قناة الكلية
  telegram_file_id TEXT,                          -- معرف الملف
  -- البيانات الوصفية
  added_by_position_id TEXT,                      -- المنصب الذي رفع المحتوى
  added_by_telegram_id BIGINT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  last_modified_at TIMESTAMPTZ,
  last_modified_by BIGINT,
  is_starred BOOLEAN DEFAULT FALSE,               -- محتوى مميز ⭐
  download_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  -- السنة/الفصل (للتنظيم)
  academic_year TEXT DEFAULT '2025-2026',
  CONSTRAINT chk_content_not_empty CHECK (title IS NOT NULL AND length(title) > 0)
);
CREATE INDEX idx_content_subject ON content(subject_id, content_type_id);
CREATE INDEX idx_content_channel ON content(telegram_message_id);
CREATE INDEX idx_content_starred ON content(is_starred) WHERE is_starred = TRUE;

-- ============================================
-- 6. المستخدمون (يمكن أن يكونوا مسؤولين أو طلاباً)
-- ============================================
CREATE TABLE admin_users (
  telegram_id BIGINT PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. المناصب (Positions) — ثابتة، لا تُحذف
-- ============================================
CREATE TABLE positions (
  id TEXT PRIMARY KEY,                            -- 'central_chair', 'college_admin_5', 'level_rep_16_2'
  level TEXT NOT NULL CHECK (level IN ('central', 'college', 'level')),
  title TEXT NOT NULL,                            -- "مسؤول كلية الحاسبات"
  description TEXT,
  -- النطاق (Scope)
  college_id INT REFERENCES colleges(id) ON DELETE CASCADE,
  specialty_id INT REFERENCES specialties(id) ON DELETE CASCADE,
  level_num INT,
  -- القيود على النطاق حسب المستوى
  CONSTRAINT chk_position_scope CHECK (
    (level = 'central' AND college_id IS NULL AND specialty_id IS NULL AND level_num IS NULL) OR
    (level = 'college' AND college_id IS NOT NULL AND specialty_id IS NULL AND level_num IS NULL) OR
    (level = 'level'   AND college_id IS NOT NULL AND specialty_id IS NOT NULL AND level_num IS NOT NULL)
  ),
  -- المسؤول المركزي لا يُحذف
  is_central BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_positions_level ON positions(level);
CREATE INDEX idx_positions_college ON positions(college_id);

-- ============================================
-- 8. ربط المناصب بالمستخدمين (Many-to-Many)
-- ============================================
CREATE TABLE position_holders (
  position_id TEXT NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  user_telegram_id BIGINT NOT NULL REFERENCES admin_users(telegram_id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by BIGINT REFERENCES admin_users(telegram_id),
  is_active BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (position_id, user_telegram_id)
);
CREATE INDEX idx_position_holders_user ON position_holders(user_telegram_id) WHERE is_active = TRUE;

-- ============================================
-- 9. الصلاحيات (Permissions)
-- ============================================
CREATE TABLE permissions (
  id TEXT PRIMARY KEY,                            -- 'manage_subjects', 'level_broadcast', ...
  name TEXT NOT NULL,
  description TEXT,
  -- المستوى الأدنى الذي يمتلك هذه الصلاحية أساساً
  min_level TEXT NOT NULL CHECK (min_level IN ('central', 'college', 'level'))
);

-- ============================================
-- 10. صلاحيات كل مستوى (مع الوراثة)
-- ============================================
CREATE TABLE position_level_permissions (
  position_level TEXT NOT NULL CHECK (position_level IN ('central', 'college', 'level')),
  permission_id TEXT NOT NULL REFERENCES permissions(id),
  PRIMARY KEY (position_level, permission_id)
);

-- ============================================
-- 11. المساهمات الطلابية (في انتظار المراجعة)
-- ============================================
CREATE TABLE contributions (
  id BIGSERIAL PRIMARY KEY,
  user_telegram_id BIGINT NOT NULL REFERENCES admin_users(telegram_id),
  subject_id INT NOT NULL REFERENCES subjects(id),
  content_type_id TEXT NOT NULL REFERENCES content_types(id),
  file_name TEXT NOT NULL,
  file_size_mb DECIMAL(10, 2),
  telegram_file_id TEXT,
  title TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'published', 'revision_requested')),
  is_starred BOOLEAN DEFAULT FALSE,
  points_awarded INT DEFAULT 0,
  reject_reason TEXT,
  reviewed_by_position_id TEXT,
  reviewed_by_telegram_id BIGINT,
  reviewed_at TIMESTAMPTZ,
  escalation_level INT DEFAULT 0,
  escalated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_contributions_status ON contributions(status, created_at);
CREATE INDEX idx_contributions_subject ON contributions(subject_id);
CREATE INDEX idx_contributions_user ON contributions(user_telegram_id, status);
CREATE INDEX idx_contributions_escalation ON contributions(escalation_level, created_at) WHERE status = 'pending';

-- ============================================
-- 12. التعميمات
-- ============================================
CREATE TABLE broadcasts (
  id BIGSERIAL PRIMARY KEY,
  sender_position_id TEXT REFERENCES positions(id),
  sender_telegram_id BIGINT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('all', 'college', 'specialty', 'level')),
  scope_college_id INT,
  scope_specialty_id INT,
  scope_level INT,
  content_type TEXT NOT NULL CHECK (content_type IN ('text', 'photo', 'document')),
  text_content TEXT,
  media_file_id TEXT,
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  status TEXT DEFAULT 'completed' CHECK (status IN ('queued', 'sending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_broadcasts_created ON broadcasts(created_at DESC);

-- ============================================
-- 13. سجل تغييرات المناصب (Audit)
-- ============================================
CREATE TABLE position_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  position_id TEXT NOT NULL REFERENCES positions(id),
  action TEXT NOT NULL CHECK (action IN ('assign', 'revoke', 'reactivate', 'deactivate')),
  old_holder_id BIGINT,
  new_holder_id BIGINT,
  performed_by BIGINT NOT NULL,
  performed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_position_audit_position ON position_audit_logs(position_id, performed_at DESC);

-- ============================================
-- 14. سجل عمليات المحتوى (Audit)
-- ============================================
CREATE TABLE content_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  content_id BIGINT,                              -- لا REFERENCES لأن المحتوى قد يُحذف
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'move', 'delete', 'star', 'unstar')),
  -- لقطة من البيانات قبل التغيير
  old_data JSONB,
  new_data JSONB,
  performed_by_position_id TEXT,
  performed_by_telegram_id BIGINT NOT NULL,
  performed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_content_audit_content ON content_audit_logs(content_id, performed_at DESC);
CREATE INDEX idx_content_audit_action ON content_audit_logs(action, performed_at DESC);

-- ============================================
-- 15. الطلاب (بوت الطالب)
-- ============================================
CREATE TABLE students (
  telegram_id BIGINT PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  current_college_id INT,
  current_specialty_id INT,
  current_level INT,
  total_downloads INT DEFAULT 0,
  accepted_contributions INT DEFAULT 0,
  total_points_all_time INT DEFAULT 0,
  total_points_current_cycle INT DEFAULT 0,
  is_blocked BOOLEAN DEFAULT FALSE,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_students_active ON students(last_activity DESC) WHERE is_blocked = FALSE;

-- ============================================
-- 16. سجل التحميلات (للإحصائيات + لوحة الشرف)
-- ============================================
CREATE TABLE downloads (
  id BIGSERIAL PRIMARY KEY,
  student_telegram_id BIGINT NOT NULL REFERENCES students(telegram_id) ON DELETE CASCADE,
  content_id BIGINT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_downloads_student ON downloads(student_telegram_id, downloaded_at DESC);
CREATE INDEX idx_downloads_content ON downloads(content_id);

-- ============================================
-- 17. لوحة الشرف (مخزّنة + يحدّثها المركزي)
-- ============================================
CREATE TABLE leaderboard (
  id BIGSERIAL PRIMARY KEY,
  student_telegram_id BIGINT NOT NULL REFERENCES students(telegram_id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'college', 'specialty')),
  scope_college_id INT,
  scope_specialty_id INT,
  rank INT NOT NULL,
  points INT NOT NULL,
  period_start DATE,
  period_end DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_telegram_id, scope_type, scope_college_id, scope_specialty_id, period_start)
);
CREATE INDEX idx_leaderboard_scope ON leaderboard(scope_type, scope_college_id, scope_specialty_id, rank);

-- ============================================
-- 18. النصوص المخصصة (Custom Texts)
-- ============================================
CREATE TABLE custom_texts (
  id SERIAL PRIMARY KEY,
  screen_key TEXT NOT NULL,                       -- 'main_menu', 'choose_college', ...
  text_key TEXT NOT NULL,                         -- 'welcome_message', 'btn_colleges'
  default_value TEXT NOT NULL,
  custom_value TEXT,
  scope_type TEXT NOT NULL DEFAULT 'global'
    CHECK (scope_type IN ('global', 'college')),
  scope_college_id INT,
  updated_by_position_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(screen_key, text_key, scope_type, scope_college_id)
);

-- ============================================
-- 19. قنوات اللجان العلمية (روابط)
-- ============================================
CREATE TABLE committee_channels (
  id BIGSERIAL PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('central', 'college', 'specialty_level')),
  -- للنطاق المركزي: الكل NULL
  -- للنطاق الكلية: college_id فقط
  -- للنطاق المستوى: college_id + specialty_id + level_num
  college_id INT REFERENCES colleges(id) ON DELETE CASCADE,
  specialty_id INT REFERENCES specialties(id) ON DELETE CASCADE,
  level_num INT,
  channel_url TEXT NOT NULL,                      -- رابط الانضمام
  channel_id TEXT,                                -- معرّف القناة (للإدارة)
  display_name TEXT NOT NULL,                     -- الاسم المعروض
  is_active BOOLEAN DEFAULT TRUE,
  updated_by_position_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_committee_scope CHECK (
    (scope_type = 'central'        AND college_id IS NULL AND specialty_id IS NULL AND level_num IS NULL) OR
    (scope_type = 'college'        AND college_id IS NOT NULL AND specialty_id IS NULL AND level_num IS NULL) OR
    (scope_type = 'specialty_level' AND college_id IS NOT NULL AND specialty_id IS NOT NULL AND level_num IS NOT NULL)
  )
);
CREATE INDEX idx_committee_scope ON committee_channels(scope_type);

-- ============================================
-- الإدراج الافتراضي (Seed Data)
-- ============================================

-- الكليات السبع (مع روابط placeholder)
INSERT INTO colleges (id, name, name_normalized, short_name, emoji, display_order) VALUES
  (1, 'كلية الطب والعلوم الصحية', 'كلية الطب والعلوم الصحية', 'الطب والعلوم الصحية', '🏥', 1),
  (2, 'كلية طب الأسنان', 'كلية طب الأسنان', 'طب الأسنان', '🦷', 2),
  (3, 'كلية الصيدلة', 'كلية الصيدلة', 'الصيدلة', '💊', 3),
  (4, 'كلية الهندسة', 'كلية الهندسة', 'الهندسة', '⚙️', 4),
  (5, 'كلية الحاسبات وتكنولوجيا المعلومات', 'كلية الحاسبات', 'الحاسبات وتكنولوجيا المعلومات', '💻', 5),
  (6, 'كلية العلوم الإدارية', 'كلية العلوم الإدارية', 'العلوم الإدارية', '📊', 6),
  (7, 'كلية العلوم الإنسانية والاجتماعية', 'كلية العلوم الإنسانية', 'العلوم الإنسانية والاجتماعية', '📚', 7);

-- تحديث قنوات التخزين الفعلية (للكليات التي تم إنشاء قنوات لها)
UPDATE colleges SET storage_channel_id = '-1004405014472' WHERE id = 1; -- كلية الطب
UPDATE colleges SET storage_channel_id = '-1004430087693' WHERE id = 2; -- كلية طب الأسنان
UPDATE colleges SET storage_channel_id = '-1003898559257' WHERE id = 3; -- كلية الصيدلة
UPDATE colleges SET storage_channel_id = '-1004401563263' WHERE id = 4; -- كلية الهندسة
UPDATE colleges SET storage_channel_id = '-1003727164402' WHERE id = 5; -- كلية الحاسبات
UPDATE colleges SET storage_channel_id = '-1004353505188' WHERE id = 6; -- كلية العلوم الإدارية
UPDATE colleges SET storage_channel_id = '-1004473489150' WHERE id = 7; -- كلية العلوم الإنسانية

-- التخصصات الـ 34
INSERT INTO specialties (id, college_id, name, name_normalized, short_name, levels_count) VALUES
  (1, 1, 'طب وجراحة', 'طب وجراحة', 'طب وجراحة', 6),
  (2, 1, 'تكنولوجيا الأشعة التشخيصية', 'الأشعة التشخيصية', 'الأشعة التشخيصية', 4),
  (3, 1, 'تغذية علاجية وحميات', 'التغذية العلاجية', 'التغذية العلاجية', 4),
  (4, 1, 'الطب المخبري', 'الطب المخبري', 'الطب المخبري', 4),
  (5, 2, 'طب وجراحة الفم والأسنان', 'طب الفم والأسنان', 'طب الفم والأسنان', 5),
  (6, 3, 'دكتور صيدلة', 'دكتور صيدلة', 'دكتور صيدلة', 6),
  (7, 3, 'صيدلة', 'صيدلة', 'صيدلة', 5),
  (8, 4, 'هندسة الميكاترونكس', 'الميكاترونكس', 'الميكاترونكس', 5),
  (9, 4, 'هندسة طبية حيوية', 'الهندسة الطبية الحيوية', 'الهندسة الطبية الحيوية', 5),
  (10, 4, 'هندسة مدنية', 'الهندسة المدنية', 'الهندسة المدنية', 5),
  (11, 4, 'هندسة معمارية - هندسة التصميم الداخلي', 'الهندسة المعمارية', 'الهندسة المعمارية', 5),
  (12, 4, 'هندسة الحاسوب والأنظمة الذكية', 'هندسة الحاسوب والأنظمة الذكية', 'هندسة الحاسوب والأنظمة الذكية', 5),
  (13, 4, 'هندسة الاتصالات والمعلوماتية', 'هندسة الاتصالات والمعلوماتية', 'هندسة الاتصالات والمعلوماتية', 5),
  (14, 4, 'هندسة الطاقة المتجددة والتحكم الآلي', 'هندسة الطاقة المتجددة', 'هندسة الطاقة المتجددة', 5),
  (15, 5, 'تقنية معلومات باللغة الإنجليزية (BIT)', 'تقنية معلومات BIT', 'تقنية معلومات (BIT)', 4),
  (16, 5, 'تقنية معلومات (IT)', 'تقنية معلومات IT', 'تقنية معلومات (IT)', 4),
  (17, 5, 'جرافكس وإعلام رقمي', 'الجرافكس والإعلام الرقمي', 'الجرافكس والإعلام الرقمي', 4),
  (18, 5, 'الذكاء الاصطناعي', 'الذكاء الاصطناعي', 'الذكاء الاصطناعي', 4),
  (19, 5, 'الأمن السيبراني والشبكات', 'الأمن السيبراني والشبكات', 'الأمن السيبراني والشبكات', 4),
  (20, 5, 'هندسة البرمجيات', 'هندسة البرمجيات', 'هندسة البرمجيات', 4),
  (21, 5, 'أعمال إلكترونية', 'الأعمال الإلكترونية', 'الأعمال الإلكترونية', 4),
  (22, 5, 'ذكاء الأعمال - نظم المعلومات الإدارية', 'ذكاء الأعمال MIS', 'ذكاء الأعمال (MIS)', 4),
  (23, 6, 'إدارة أعمال باللغة الإنجليزية', 'إدارة أعمال EN', 'إدارة أعمال (EN)', 4),
  (24, 6, 'إدارة أعمال دولية - إدارة أعمال', 'إدارة الأعمال الدولية', 'إدارة الأعمال الدولية', 4),
  (25, 6, 'التسويق الرقمي', 'التسويق الرقمي', 'التسويق الرقمي', 4),
  (26, 6, 'محاسبة - علوم مالية ومصرفية', 'المحاسبة والعلوم المالية', 'المحاسبة والعلوم المالية', 4),
  (27, 6, 'إدارة أعمال دولية باللغة الإنجليزية', 'إدارة أعمال دولية EN', 'إدارة أعمال دولية (EN)', 4),
  (28, 7, 'لغة إنجليزية - ترجمة', 'اللغة الإنجليزية ترجمة', 'اللغة الإنجليزية - ترجمة', 4),
  (29, 7, 'لغة إنجليزية - لغويات تطبيقية', 'اللغة الإنجليزية لغويات تطبيقية', 'اللغة الإنجليزية - لغويات تطبيقية', 4),
  (30, 7, 'العلاقات العامة والإعلان', 'العلاقات العامة والإعلان', 'العلاقات العامة والإعلان', 4),
  (31, 7, 'إذاعة وتلفزيون', 'الإذاعة والتلفزيون', 'الإذاعة والتلفزيون', 4),
  (32, 7, 'علم النفس', 'علم النفس', 'علم النفس', 4),
  (33, 7, 'شريعة وقانون', 'الشريعة والقانون', 'الشريعة والقانون', 4),
  (34, 7, 'دراسات إسلامية - لغة عربية - علوم قرآن', 'الدراسات الإسلامية واللغة العربية', 'الدراسات الإسلامية واللغة العربية', 4);

-- ============================================
-- الصلاحيات (Permissions) — هرم وراثي
-- ============================================
INSERT INTO permissions (id, name, description, min_level) VALUES
  -- صلاحيات مندوب المستوى (القاعدة)
  ('level_broadcast',              'نشر إعلانات المستوى',                  'السماح بنشر تعميمات على مستوى محدد', 'level'),
  ('approve_level_contributions',  'الموافقة/رفض مساهمات المستوى',         'مراجعة مساهمات الطلاب على مستوى محدد', 'level'),
  ('manage_level_content',         'إدارة محتوى المستوى',                  'رفع/تعديل/نقل/حذف محتوى مستوى محدد', 'level'),
  ('view_level_stats',             'عرض إحصائيات المستوى',                  'الاطلاع على إحصائيات مستوى محدد', 'level'),
  -- صلاحيات مسؤول الكلية (+ يرث المستوى)
  ('manage_subjects',              'إدارة المواد',                          'إضافة/تعديل/حذف/نقل المواد', 'college'),
  ('college_broadcast',            'نشر إعلانات الكلية',                    'تعميم على مستوى كلية محددة', 'college'),
  ('manage_level_reps',            'إدارة مندوبي المستويات',                'تعيين/إزالة مندوبي المستويات', 'college'),
  ('view_college_stats',           'عرض إحصائيات الكلية',                   'الاطلاع على إحصائيات كلية محددة', 'college'),
  -- صلاحيات رئيس اللجنة المركزي (+ يرث الكلية + المستوى)
  ('manage_admins',                'إدارة المناصب',                         'تعيين/إزالة شاغلي المناصب', 'central'),
  ('manage_colleges',              'إدارة الكليات',                         'إضافة/تعديل الكليات', 'central'),
  ('manage_specialties',           'إدارة التخصصات',                        'إضافة/تعديل التخصصات', 'central'),
  ('manage_committee_channels',    'إدارة روابط اللجان العلمية',            'تحديث روابط القنوات', 'central'),
  ('view_central_stats',           'عرض الإحصائيات الشاملة',                'الاطلاع على كل الإحصائيات', 'central'),
  ('view_reports',                 'عرض التقارير',                          'تقارير الأداء والنشاط', 'central'),
  ('system_settings',              'إعدادات النظام',                        'تخصيص النصوص والإعدادات', 'central'),
  ('central_broadcast',            'نشر تعميمات شاملة',                     'تعميم على كل الطلاب', 'central');

-- ============================================
-- ربط الصلاحيات بالمستويات (مع الوراثة)
-- ============================================
-- المستوى = يرث كل صلاحياته
-- الكلية = يرث كل صلاحيات المستوى + صلاحياته
-- المركزي = يرث كل صلاحيات الكلية + المستوى + صلاحياته

-- مندوب المستوى (المستوى الأدنى)
INSERT INTO position_level_permissions (position_level, permission_id) VALUES
  ('level', 'level_broadcast'),
  ('level', 'approve_level_contributions'),
  ('level', 'manage_level_content'),
  ('level', 'view_level_stats');

-- مسؤول الكلية (يرث المستوى + يضيف صلاحياته)
INSERT INTO position_level_permissions (position_level, permission_id) VALUES
  ('college', 'level_broadcast'),
  ('college', 'approve_level_contributions'),
  ('college', 'manage_level_content'),
  ('college', 'view_level_stats'),
  ('college', 'manage_subjects'),
  ('college', 'college_broadcast'),
  ('college', 'manage_level_reps'),
  ('college', 'view_college_stats');

-- رئيس اللجنة المركزي (يرث الكلية + المستوى + يضيف صلاحياته)
INSERT INTO position_level_permissions (position_level, permission_id) VALUES
  ('central', 'level_broadcast'),
  ('central', 'approve_level_contributions'),
  ('central', 'manage_level_content'),
  ('central', 'view_level_stats'),
  ('central', 'manage_subjects'),
  ('central', 'college_broadcast'),
  ('central', 'manage_level_reps'),
  ('central', 'view_college_stats'),
  ('central', 'manage_admins'),
  ('central', 'manage_colleges'),
  ('central', 'manage_specialties'),
  ('central', 'manage_committee_channels'),
  ('central', 'view_central_stats'),
  ('central', 'view_reports'),
  ('central', 'system_settings'),
  ('central', 'central_broadcast');

-- ============================================
-- المناصب الأساسية (8 مناصب)
-- ============================================
-- 1. رئيس اللجنة المركزي (لا يُحذف)
INSERT INTO positions (id, level, title, description, is_central)
VALUES ('central_chair', 'central', '🛡 رئيس اللجنة العلمية المركزية',
        'المسؤول الأعلى في النظام — يملك كل الصلاحيات', TRUE);

-- 2-8. مسؤولو الكليات السبع
INSERT INTO positions (id, level, title, description, college_id) VALUES
  ('college_admin_1', 'college', '🏛 مسؤول كلية الطب والعلوم الصحية',     'مسؤول كلية محددة', 1),
  ('college_admin_2', 'college', '🏛 مسؤول كلية طب الأسنان',              'مسؤول كلية محددة', 2),
  ('college_admin_3', 'college', '🏛 مسؤول كلية الصيدلة',                  'مسؤول كلية محددة', 3),
  ('college_admin_4', 'college', '🏛 مسؤول كلية الهندسة',                  'مسؤول كلية محددة', 4),
  ('college_admin_5', 'college', '🏛 مسؤول كلية الحاسبات',                 'مسؤول كلية محددة', 5),
  ('college_admin_6', 'college', '🏛 مسؤول كلية العلوم الإدارية',          'مسؤول كلية محددة', 6),
  ('college_admin_7', 'college', '🏛 مسؤول كلية العلوم الإنسانية',         'مسؤول كلية محددة', 7);

-- ============================================
-- Triggers: حماية المسؤول المركزي
-- ============================================
-- منع حذف منصب المسؤول المركزي
CREATE OR REPLACE FUNCTION prevent_central_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_central = TRUE THEN
    RAISE EXCEPTION 'لا يمكن حذف منصب المسؤول المركزي';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_central_position_deletion
  BEFORE DELETE ON positions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_central_deletion();

-- منع تعطيل آخر شاغل لمنصب المسؤول المركزي
CREATE OR REPLACE FUNCTION prevent_central_orphan()
RETURNS TRIGGER AS $$
DECLARE
  active_count INT;
BEGIN
  IF NEW.is_active = FALSE THEN
    SELECT COUNT(*) INTO active_count
    FROM position_holders
    WHERE position_id = 'central_chair' AND is_active = TRUE;
    IF active_count <= 1 THEN
      RAISE EXCEPTION 'لا يمكن تعطيل آخر شاغل لمنصب المسؤول المركزي';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_central_orphan
  BEFORE UPDATE OF is_active ON position_holders
  FOR EACH ROW
  WHEN (NEW.position_id = 'central_chair' AND NEW.is_active = FALSE)
  EXECUTE FUNCTION prevent_central_orphan();

-- ============================================
-- View: صلاحيات المستخدم (مدمجة من كل مناصبه)
-- ============================================
CREATE OR REPLACE VIEW user_permissions AS
SELECT
  ph.user_telegram_id,
  p.id AS position_id,
  p.level AS position_level,
  p.title AS position_title,
  p.college_id,
  p.specialty_id,
  p.level_num,
  perm.id AS permission_id,
  perm.name AS permission_name
FROM position_holders ph
JOIN positions p ON ph.position_id = p.id
JOIN position_level_permissions plp ON p.level = plp.position_level
JOIN permissions perm ON plp.permission_id = perm.id
WHERE ph.is_active = TRUE;

-- ============================================
-- Function: التحقق من صلاحية (للاستخدام في RLS)
-- ============================================
CREATE OR REPLACE FUNCTION user_has_permission(
  p_telegram_id BIGINT,
  p_permission_id TEXT,
  p_college_id INT DEFAULT NULL,
  p_specialty_id INT DEFAULT NULL,
  p_level INT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  has_perm BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM position_holders ph
    JOIN positions p ON ph.position_id = p.id
    JOIN position_level_permissions plp ON p.level = plp.position_level
    WHERE ph.user_telegram_id = p_telegram_id
      AND ph.is_active = TRUE
      AND plp.permission_id = p_permission_id
      -- فحص النطاق
      AND (
        p.level = 'central' OR                                    -- المركزي يفعل كل شيء
        (p.college_id = p_college_id) OR                          -- نفس الكلية
        (p.college_id = p_college_id AND p.specialty_id = p_specialty_id AND p.level_num = p_level)  -- نفس المستوى
      )
  ) INTO has_perm;
  RETURN has_perm;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

-- سياسات RLS تُطبّق في الإنتاج (تحتاج تهيئة auth.uid())

-- ============================================
-- 20. نقاط الطلاب (للمساهمات المقبولة)
-- ============================================
-- ملاحظة: جدول students يحتوي على total_points كعمود إجمالي
-- هذا الجدول لتتبّع تفصيلي لكل نقطة
ALTER TABLE students ADD COLUMN IF NOT EXISTS total_points INT DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_points_reset_at TIMESTAMPTZ;

CREATE TABLE student_points (
  id BIGSERIAL PRIMARY KEY,
  student_telegram_id BIGINT NOT NULL REFERENCES students(telegram_id) ON DELETE CASCADE,
  points INT NOT NULL,
  reason TEXT NOT NULL,                            -- 'contribution_approved', 'honor_bonus', 'manual'
  related_contribution_id BIGINT,                  -- ربط بالمساهمة (إن وجدت)
  awarded_by_position_id TEXT,
  awarded_by_telegram_id BIGINT,
  awarded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_student_points_student ON student_points(student_telegram_id, awarded_at DESC);

-- ============================================
-- 21. تكريم المساهمين المميزين (إدارة يدوية للمركزي)
-- ============================================
CREATE TABLE contribution_honors (
  id BIGSERIAL PRIMARY KEY,
  student_telegram_id BIGINT NOT NULL REFERENCES students(telegram_id) ON DELETE CASCADE,
  honor_type TEXT NOT NULL CHECK (honor_type IN ('top_contributor_specialty', 'top_contributor_college', 'top_contributor_global', 'manual')),
  -- نطاق التكريم
  scope_specialty_id INT REFERENCES specialties(id),
  scope_college_id INT REFERENCES colleges(id),
  -- بيانات التكريم
  honor_title TEXT NOT NULL,                       -- "أبرز مساهم في تخصص IT"
  honor_period TEXT,                               -- "الفصل الأول 2025-2026"
  points_at_honor INT,                             -- النقاط وقت التكريم
  bonus_points INT DEFAULT 0,                      -- نقاط إضافية للتكريم
  -- إدارة
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  nominated_by_telegram_id BIGINT,                 -- من رشّح (اختياري)
  approved_by_position_id TEXT,
  approved_by_telegram_id BIGINT REFERENCES admin_users(telegram_id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_honors_student ON contribution_honors(student_telegram_id);
CREATE INDEX idx_honors_status ON contribution_honors(status, created_at DESC);
CREATE INDEX idx_honors_scope ON contribution_honors(scope_college_id, scope_specialty_id);

-- ============================================
-- 22. سجل إعادة ضبط النقاط (Audit)
-- ============================================
CREATE TABLE points_reset_logs (
  id BIGSERIAL PRIMARY KEY,
  reset_scope TEXT NOT NULL CHECK (reset_scope IN ('global', 'college', 'specialty', 'student')),
  scope_college_id INT,
  scope_specialty_id INT,
  scope_student_telegram_id BIGINT,
  students_affected INT NOT NULL,
  total_points_reset INT NOT NULL,
  reset_reason TEXT,
  performed_by_position_id TEXT,
  performed_by_telegram_id BIGINT NOT NULL,
  performed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_points_reset_performed ON points_reset_logs(performed_at DESC);

-- ============================================
-- 23. إشعارات الطلاب (لإشعارهم بنتائج المراجعة)
-- ============================================
CREATE TABLE student_notifications (
  id BIGSERIAL PRIMARY KEY,
  student_telegram_id BIGINT NOT NULL REFERENCES students(telegram_id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL
    CHECK (notification_type IN ('contribution_approved', 'contribution_rejected', 'contribution_starred', 'honor_awarded', 'points_reset', 'broadcast', 'general')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  related_entity_type TEXT,                        -- 'contribution', 'honor', 'broadcast'
  related_entity_id BIGINT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_student_notifications_unread ON student_notifications(student_telegram_id, is_read, created_at DESC) WHERE is_read = FALSE;

-- ============================================
-- صلاحيات إضافية (للمسؤول المركزي فقط)
-- ============================================
INSERT INTO permissions (id, name, description, min_level) VALUES
  ('manage_honors',  'إدارة تكريم المساهمين', 'اعتماد/رفض ترشيحات التكريم + منح تكريم يدوي', 'central'),
  ('reset_points',   'إعادة ضبط النقاط',       'تصفير نقاط الطلاب (شهري/فصلي/سنوي)', 'central'),
  ('view_honors_log', 'عرض سجل التكريم',       'الاطلاع على التكريمات السابقة', 'central');

-- ربط الصلاحيات الجديدة بالمستوى المركزي فقط
INSERT INTO position_level_permissions (position_level, permission_id) VALUES
  ('central', 'manage_honors'),
  ('central', 'reset_points'),
  ('central', 'view_honors_log');

-- ============================================
-- Function: حساب أعلى المحسنين في تخصص ومستوى
-- ============================================
CREATE OR REPLACE FUNCTION get_top_contributors_specialty(
  p_specialty_id INT,
  p_limit INT DEFAULT 3
) RETURNS TABLE (
  student_telegram_id BIGINT,
  first_name TEXT,
  total_points INT,
  accepted_contributions INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT s.telegram_id, s.first_name, s.total_points_current_cycle,
         s.accepted_contributions
  FROM students s
  WHERE s.total_points_current_cycle > 0
    AND EXISTS (
      SELECT 1 FROM contributions c
      WHERE c.user_telegram_id = s.telegram_id
        AND c.subject_id IN (SELECT id FROM subjects WHERE specialty_id = p_specialty_id)
        AND c.status IN ('approved', 'published')
    )
  ORDER BY s.total_points_current_cycle DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function: منح نقاط للطالب (عند اعتماد إحسان)
-- ============================================
CREATE OR REPLACE FUNCTION award_contribution_points(
  p_student_telegram_id BIGINT,
  p_contribution_id BIGINT,
  p_awarded_by_telegram_id BIGINT,
  p_awarded_by_position_id TEXT,
  p_points INT DEFAULT 10
) RETURNS VOID AS $$
BEGIN
  -- إضافة سجل النقاط
  INSERT INTO student_points (student_telegram_id, points, reason, related_contribution_id, awarded_by_position_id, awarded_by_telegram_id)
  VALUES (p_student_telegram_id, p_points, 'ihsan_approved', p_contribution_id, p_awarded_by_position_id, p_awarded_by_telegram_id);

  -- تحديث نقاط الطالب (الحالية + التاريخية)
  UPDATE students
  SET total_points_all_time = total_points_all_time + p_points,
      total_points_current_cycle = total_points_current_cycle + p_points,
      accepted_contributions = accepted_contributions + 1
  WHERE telegram_id = p_student_telegram_id;

  -- تسجيل النقاط في جدول الإحسانات
  UPDATE contributions
  SET points_awarded = p_points
  WHERE id = p_contribution_id;

  -- إنشاء إشعار للطالب
  INSERT INTO student_notifications (student_telegram_id, notification_type, title, body, related_entity_type, related_entity_id)
  VALUES (
    p_student_telegram_id,
    'contribution_approved',
    '✅ تم اعتماد إحسانك!',
    'تمت الموافقة على إحسانك ومنحك ' || p_points || ' نقطة. شكراً لإثرائك المحتوى!',
    'contribution',
    p_contribution_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function: إشعار الطالب برفض مساهمة
-- ============================================
CREATE OR REPLACE FUNCTION notify_contribution_rejected(
  p_student_telegram_id BIGINT,
  p_contribution_id BIGINT,
  p_reject_reason TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO student_notifications (student_telegram_id, notification_type, title, body, related_entity_type, related_entity_id)
  VALUES (
    p_student_telegram_id,
    'contribution_rejected',
    '❌ تم رفض مساهمتك',
    'للأسف لم يتم اعتماد مساهمتك. السبب: ' || COALESCE(p_reject_reason, 'غير محدد') || '. يمكنك المحاولة مرة أخرى بمحتوى أفضل.',
    'contribution',
    p_contribution_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- تحديث الأوصاف: "مندوب المستوى" → "مسؤول الدفعة"
-- ============================================
UPDATE permissions
SET name = REPLACE(name, 'مندوبي المستويات', 'مسؤولي الدفع'),
    description = REPLACE(description, 'مندوبي المستويات', 'مسؤولي الدفع'),
    name = REPLACE(name, 'مندوب المستوى', 'مسؤول الدفعة'),
    description = REPLACE(description, 'مندوب المستوى', 'مسؤول الدفعة');

UPDATE positions
SET title = REPLACE(title, 'مندوب', 'مسؤول'),
    description = REPLACE(description, 'مندوب', 'مسؤول')
WHERE level = 'level';

-- ============================================
-- نهاية الـ Schema
-- ============================================
-- ============================================
-- 24. اشتراكات الطلاب في النطاقات (للتعاميم)
-- ============================================
-- التسجيل الصريح: عند أول /start، الطالب يختار كليته + تخصصه + مستواه
-- هذه البيانات تُستخدم لاستهداف التعاميم بدقة
CREATE TABLE student_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  student_telegram_id BIGINT NOT NULL REFERENCES students(telegram_id) ON DELETE CASCADE,
  -- النطاق: الطالب يسجّل دائماً على مستوى (level) محدد
  scope_type TEXT NOT NULL DEFAULT 'level' CHECK (scope_type IN ('college', 'specialty', 'level')),
  scope_college_id INT NOT NULL REFERENCES colleges(id),
  scope_specialty_id INT REFERENCES specialties(id),
  scope_level INT,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  -- القيود
  CONSTRAINT chk_subscription_scope CHECK (
    (scope_type = 'college'   AND scope_specialty_id IS NULL AND scope_level IS NULL) OR
    (scope_type = 'specialty' AND scope_specialty_id IS NOT NULL AND scope_level IS NULL) OR
    (scope_type = 'level'     AND scope_specialty_id IS NOT NULL AND scope_level IS NOT NULL)
  ),
  -- كل طالب له اشتراك واحد فقط (نقطة التسجيل)
  UNIQUE(student_telegram_id)
);
CREATE INDEX idx_subscriptions_scope ON student_subscriptions(scope_type, scope_college_id, scope_specialty_id, scope_level) WHERE is_active = TRUE;
CREATE INDEX idx_subscriptions_college ON student_subscriptions(scope_college_id) WHERE is_active = TRUE;
CREATE INDEX idx_subscriptions_specialty ON student_subscriptions(scope_college_id, scope_specialty_id) WHERE is_active = TRUE;

-- ============================================
-- Function: الحصول على مستلمي التعميم
-- ============================================
-- ملاحظة: المعاملات بدون default تأتي أولاً (p_scope_type إلزامي)
CREATE OR REPLACE FUNCTION get_broadcast_recipients(
  p_scope_type TEXT,
  p_college_id INT DEFAULT NULL,
  p_specialty_id INT DEFAULT NULL,
  p_level INT DEFAULT NULL
) RETURNS TABLE (telegram_id BIGINT) AS $$
BEGIN
  IF p_scope_type = 'all' THEN
    RETURN QUERY SELECT telegram_id FROM students WHERE is_blocked = FALSE;
  ELSIF p_scope_type = 'college' THEN
    RETURN QUERY
    SELECT s.telegram_id FROM students s
    JOIN student_subscriptions sub ON s.telegram_id = sub.student_telegram_id
    WHERE sub.is_active = TRUE
      AND sub.scope_college_id = p_college_id
      AND s.is_blocked = FALSE;
  ELSIF p_scope_type = 'specialty' THEN
    RETURN QUERY
    SELECT s.telegram_id FROM students s
    JOIN student_subscriptions sub ON s.telegram_id = sub.student_telegram_id
    WHERE sub.is_active = TRUE
      AND sub.scope_college_id = p_college_id
      AND sub.scope_specialty_id = p_specialty_id
      AND s.is_blocked = FALSE;
  ELSIF p_scope_type = 'level' THEN
    RETURN QUERY
    SELECT s.telegram_id FROM students s
    JOIN student_subscriptions sub ON s.telegram_id = sub.student_telegram_id
    WHERE sub.is_active = TRUE
      AND sub.scope_college_id = p_college_id
      AND sub.scope_specialty_id = p_specialty_id
      AND sub.scope_level = p_level
      AND s.is_blocked = FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function: تسجيل طالب جديد (التسجيل الصريح)
-- ============================================
CREATE OR REPLACE FUNCTION register_student(
  p_telegram_id BIGINT,
  p_first_name TEXT,
  p_username TEXT,
  p_college_id INT,
  p_specialty_id INT,
  p_level INT
) RETURNS VOID AS $$
BEGIN
  -- إدراج/تحديث بيانات الطالب
  INSERT INTO students (telegram_id, first_name, username, current_college_id, current_specialty_id, current_level)
  VALUES (p_telegram_id, p_first_name, p_username, p_college_id, p_specialty_id, p_level)
  ON CONFLICT (telegram_id) DO UPDATE
  SET first_name = EXCLUDED.first_name,
      username = EXCLUDED.username,
      current_college_id = EXCLUDED.current_college_id,
      current_specialty_id = EXCLUDED.current_specialty_id,
      current_level = EXCLUDED.current_level,
      last_activity = NOW();

  -- إدراج/تحديث الاشتراك (نطاق المستوى)
  INSERT INTO student_subscriptions (student_telegram_id, scope_type, scope_college_id, scope_specialty_id, scope_level)
  VALUES (p_telegram_id, 'level', p_college_id, p_specialty_id, p_level)
  ON CONFLICT (student_telegram_id) DO UPDATE
  SET scope_college_id = EXCLUDED.scope_college_id,
      scope_specialty_id = EXCLUDED.scope_specialty_id,
      scope_level = EXCLUDED.scope_level,
      is_active = TRUE,
      subscribed_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- تحديث جدول broadcasts ليدعم نطاقات أوسع
-- ============================================
-- ملاحظة: الجدول موجود مسبقاً، نضيف فقط أعمدة جديدة لو لزم
-- scope_type موجود بالفعل: 'all', 'college', 'specialty', 'level'
-- العمود scope_specialty_id موجود بالفعل

-- ============================================
-- Function: زيادة عدّاد التحميلات بشكل ذرّي (atomic)
-- ============================================
-- تحل مشكلة race condition في SELECT-then-UPDATE
-- تستخدم: SELECT increment_download(123);
-- ============================================
CREATE OR REPLACE FUNCTION increment_download(p_content_id BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE content
  SET download_count = download_count + 1
  WHERE id = p_content_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function: عدّ المساهمات المعلقة لنطاق محدد
-- ============================================
-- تستخدم: SELECT count_pending_for_scope(5, 16, 1);
-- حيث 5=college_id, 16=specialty_id, 1=level
-- ============================================
CREATE OR REPLACE FUNCTION count_pending_for_scope(
  p_college_id INT,
  p_specialty_id INT,
  p_level INT
) RETURNS INT AS $$
DECLARE
  cnt INT;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM contributions c
  JOIN subjects s ON c.subject_id = s.id
  WHERE c.status = 'pending'
    AND s.specialty_id = p_specialty_id
    AND s.level = p_level;
  RETURN cnt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 25. إعدادات نظام إحسان علمي
-- ============================================
CREATE TABLE ihsan_settings (
  id INT PRIMARY KEY DEFAULT 1,
  -- نقاط الأنواع (min-max)
  book_theory_min INT DEFAULT 20, book_theory_max INT DEFAULT 50,
  book_practical_min INT DEFAULT 20, book_practical_max INT DEFAULT 50,
  summary_min INT DEFAULT 10, summary_max INT DEFAULT 30,
  exam_min INT DEFAULT 15, exam_max INT DEFAULT 40,
  video_min INT DEFAULT 30, video_max INT DEFAULT 100,
  reference_min INT DEFAULT 15, reference_max INT DEFAULT 50,
  schedule_min INT DEFAULT 10, schedule_max INT DEFAULT 30,
  -- إعدادات التصعيد
  escalation_hours_1 INT DEFAULT 24,  -- تذكير مسؤول المستوى
  escalation_hours_2 INT DEFAULT 48,  -- تنبيه مسؤول الكلية
  escalation_hours_3 INT DEFAULT 72,  -- تنبيه المركزي
  -- عدد المتصدرين
  leaderboard_top_n INT DEFAULT 3,
  -- قناة الأرشيف
  archive_channel_id TEXT DEFAULT '-1004342924841',
  -- الدورة الحالية
  current_cycle_name TEXT DEFAULT 'الفصل الأول 2026',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- صف إعدادات افتراضي
INSERT INTO ihsan_settings (id) VALUES (1);

-- ============================================
-- 26. أرشيف دورات الإحسان
-- ============================================
CREATE TABLE ihsan_archive (
  id BIGSERIAL PRIMARY KEY,
  cycle_name TEXT NOT NULL,
  telegram_message_id BIGINT NOT NULL,
  archived_by BIGINT NOT NULL,
  archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- نهاية الـ Schema
-- ============================================
-- إجمالي الجداول: 26 (مع ihsan_settings + ihsan_archive)
-- إجمالي المناصب: 9 (1 مركزي + 7 كليات + 1 دفعة)
-- إجمالي الصلاحيات: 19 صلاحية
-- إجمالي أنواع المحتوى: 7
-- Functions: 8 + 3 جديدة قيد الإضافة
-- ============================================
