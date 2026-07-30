-- ============================================
-- 🌱 Seed Data: المواد الدراسية + إضافة المستخدم الحالي
-- ============================================
-- شغّل هذا السكريبت في Supabase SQL Editor بعد schema.sql
-- ============================================

-- ============================================
-- 1. إضافة المستخدم الحالي في admin_users
-- ============================================
INSERT INTO admin_users (telegram_id, first_name, is_active)
VALUES (8796334849, 'أحمد', true)
ON CONFLICT (telegram_id) DO UPDATE
SET first_name = 'أحمد', is_active = true;

-- ============================================
-- 2. إضافة المستخدم في students (لو ليس طالباً)
-- ============================================
INSERT INTO students (telegram_id, first_name, is_blocked)
VALUES (8796334849, 'أحمد', false)
ON CONFLICT (telegram_id) DO NOTHING;

-- ============================================
-- 3. تعيينه كمسؤول مركزي
-- ============================================
INSERT INTO position_holders (position_id, user_telegram_id, assigned_by, is_active)
VALUES ('central_chair', 8796334849, 8796334849, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. إضافة المواد الدراسية (من src/shared/data/subjects.ts)
-- ============================================
-- تخصص تقنية معلومات (IT) - specialty_id=16

INSERT INTO subjects (id, specialty_id, level, semester, name, name_normalized, has_theory, has_practical, is_active) VALUES
  -- المستوى الأول - الفصل الأول
  (101, 16, 1, 1, 'مقدمة في تقنية المعلومات', 'مقدمة في تقنية المعلومات', true, true, true),
  (102, 16, 1, 1, 'برمجة حاسوب (1) - Python', 'برمجة حاسوب 1 Python', true, true, true),
  (103, 16, 1, 1, 'الرياضيات المتقطعة', 'الرياضيات المتقطعة', true, false, true),
  (104, 16, 1, 1, 'مهارات التعلم والاتصال', 'مهارات التعلم والاتصال', true, false, true),
  (105, 16, 1, 1, 'اللغة الإنجليزية (1)', 'اللغة الإنجليزية 1', true, false, true),
  -- المستوى الأول - الفصل الثاني
  (106, 16, 1, 2, 'برمجة حاسوب (2) - Java', 'برمجة حاسوب 2 Java', true, true, true),
  (107, 16, 1, 2, 'تراكيب البيانات', 'تراكيب البيانات', true, true, true),
  (108, 16, 1, 2, 'قواعد البيانات (1)', 'قواعد البيانات 1', true, true, true),
  (109, 16, 1, 2, 'نظم التشغيل (1)', 'نظم التشغيل 1', true, false, true),
  (110, 16, 1, 2, 'اللغة الإنجليزية (2)', 'اللغة الإنجليزية 2', true, false, true),
  -- المستوى الثاني - الفصل الأول
  (201, 16, 2, 1, 'البرمجة الكائنية (OOP)', 'البرمجة الكائنية OOP', true, true, true),
  (202, 16, 2, 1, 'هياكل البيانات المتقدمة', 'هياكل البيانات المتقدمة', true, true, true),
  (203, 16, 2, 1, 'قواعد البيانات (2)', 'قواعد البيانات 2', true, true, true),
  (204, 16, 2, 1, 'شبكات الحاسوب (1)', 'شبكات الحاسوب 1', true, true, true),
  (205, 16, 2, 1, 'اللغة الإنجليزية (3)', 'اللغة الإنجليزية 3', true, false, true),
  -- المستوى الثاني - الفصل الثاني
  (206, 16, 2, 2, 'هندسة البرمجيات', 'هندسة البرمجيات', true, false, true),
  (207, 16, 2, 2, 'تطوير الويب (Frontend)', 'تطوير الويب Frontend', true, true, true),
  (208, 16, 2, 2, 'الخوارزميات', 'الخوارزميات', true, true, true),
  (209, 16, 2, 2, 'أمن المعلومات', 'أمن المعلومات', true, false, true),
  (210, 16, 2, 2, 'اللغة الإنجليزية (4)', 'اللغة الإنجليزية 4', true, false, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 5. إضافة مواد طب وجراحة (specialty_id=1) - المستوى الأول
-- ============================================
INSERT INTO subjects (id, specialty_id, level, semester, name, name_normalized, has_theory, has_practical, is_active) VALUES
  (301, 1, 1, 1, 'مقدمة في الطب', 'مقدمة في الطب', true, true, true),
  (302, 1, 1, 1, 'التشريح البشري', 'التشريح البشري', true, true, true),
  (303, 1, 1, 1, 'الكيمياء الحيوية', 'الكيمياء الحيوية', true, false, true),
  (304, 1, 1, 1, 'علم الأنسجة', 'علم الأنسجة', true, false, true),
  (305, 1, 1, 1, 'اللغة الإنجليزية الطبية', 'اللغة الإنجليزية الطبية', true, false, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- التحقق
-- ============================================
SELECT 'admin_users' as table_name, COUNT(*) as count FROM admin_users
UNION ALL
SELECT 'subjects', COUNT(*) FROM subjects
UNION ALL
SELECT 'position_holders', COUNT(*) FROM position_holders WHERE is_active = true
UNION ALL
SELECT 'content_types', COUNT(*) FROM content_types;
