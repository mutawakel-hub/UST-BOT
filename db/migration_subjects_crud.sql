-- ============================================
-- 📋 Migration: Subjects CRUD + Audit Logs + RPC
-- ============================================
-- هذا الـ migration يضيف:
--   1. أعمدة جديدة لجدول subjects (sort_order, code, credits, prerequisites, description, updated_at, updated_by_*)
--   2. تعبئة sort_order للمواد الموجودة (ترتيب أبجدي ابتدائي)
--   3. trigger لتحديث updated_at تلقائياً
--   4. جدول subject_audit_logs (سجل عمليات المواد)
--   5. RPC function swap_subject_sort_order (للترتيب الذري)
--
-- التاريخ: 2025-07-31
-- آمن للإنتاج (idempotent — يمكن تشغيله عدة مرات)
-- ============================================

-- ============================================
-- 1. أعمدة جديدة لجدول subjects
-- ============================================

ALTER TABLE subjects ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS credits INT;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS prerequisites JSONB DEFAULT '[]'::jsonb;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS updated_by_position_id TEXT;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS updated_by_telegram_id BIGINT;

-- تعليقات توضيحية
COMMENT ON COLUMN subjects.sort_order IS 'ترتيب المادة داخل (specialty_id, level, semester) — لتحريكها لأعلى/أسفل';
COMMENT ON COLUMN subjects.code IS 'كود المادة (CS101, MATH201) — اختياري';
COMMENT ON COLUMN subjects.credits IS 'الساعات المعتمدة — اختياري';
COMMENT ON COLUMN subjects.prerequisites IS 'قائمة IDs المواد المتطلبة (JSONB array) — اختياري';
COMMENT ON COLUMN subjects.description IS 'وصف المادة — اختياري';
COMMENT ON COLUMN subjects.updated_at IS 'توقيت آخر تعديل (يُحدّث تلقائياً عبر trigger)';
COMMENT ON COLUMN subjects.updated_by_position_id IS 'منصب المسؤول الذي عدّل المادة آخر مرة';
COMMENT ON COLUMN subjects.updated_by_telegram_id IS 'telegram_id للمسؤول الذي عدّل المادة آخر مرة';

-- ============================================
-- 2. فهارس جديدة
-- ============================================

-- فهرس مركّب للترتيب (يسرّع قراءة المواد المرتبة)
CREATE INDEX IF NOT EXISTS idx_subjects_sort
  ON subjects(specialty_id, level, semester, sort_order)
  WHERE is_active = TRUE;

-- فهرس على code (للبحث بالكود)
CREATE INDEX IF NOT EXISTS idx_subjects_code
  ON subjects(code)
  WHERE code IS NOT NULL;

-- ============================================
-- 3. تعبئة sort_order للمواد الموجودة
--    (ترتيب أبجدي ابتدائي ضمن كل specialty+level+semester)
-- ============================================

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY specialty_id, level, semester
    ORDER BY name
  ) AS new_sort
  FROM subjects
  WHERE sort_order = 0 OR sort_order IS NULL
)
UPDATE subjects s SET sort_order = n.new_sort
  FROM numbered n
  WHERE s.id = n.id;

-- ============================================
-- 4. Trigger لتحديث updated_at تلقائياً
-- ============================================

CREATE OR REPLACE FUNCTION update_subjects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subjects_updated_at ON subjects;
CREATE TRIGGER trg_subjects_updated_at
  BEFORE UPDATE ON subjects
  FOR EACH ROW
  EXECUTE FUNCTION update_subjects_updated_at();

-- ============================================
-- 5. جدول subject_audit_logs (سجل عمليات المواد)
-- ============================================

CREATE TABLE IF NOT EXISTS subject_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  subject_id BIGINT,                              -- لا REFERENCES لأن المادة قد تُحذف فعلياً
  action TEXT NOT NULL CHECK (action IN (
    'create', 'update', 'move_semester', 'move_level',
    'reorder', 'delete', 'activate', 'deactivate'
  )),
  old_data JSONB,
  new_data JSONB,
  performed_by_position_id TEXT,
  performed_by_telegram_id BIGINT NOT NULL,
  performed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subject_audit_subject
  ON subject_audit_logs(subject_id, performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_subject_audit_action
  ON subject_audit_logs(action, performed_at DESC);

COMMENT ON TABLE subject_audit_logs IS
  'سجل عمليات المواد: create/update/move_semester/move_level/reorder/delete/activate/deactivate';

-- ============================================
-- 6. RPC Function: swap_subject_sort_order
--    لتبديل ترتيب مادتين بشكل ذري (atomic)
--    يُستخدم عند تحريك مادة لأعلى/أسفل
-- ============================================

CREATE OR REPLACE FUNCTION swap_subject_sort_order(
  p_subject_id BIGINT,
  p_direction TEXT                                -- 'up' أو 'down'
) RETURNS VOID AS $$
DECLARE
  v_current_sort INT;
  v_current_spec INT;
  v_current_level INT;
  v_current_semester INT;
  v_other_id BIGINT;
  v_other_sort INT;
BEGIN
  -- اقرأ المادة الحالية
  SELECT sort_order, specialty_id, level, semester
    INTO v_current_sort, v_current_spec, v_current_level, v_current_semester
  FROM subjects
  WHERE id = p_subject_id AND is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subject not found or inactive (id=%)', p_subject_id;
  END IF;

  -- ابحث عن المادة المجاورة
  IF p_direction = 'up' THEN
    SELECT id, sort_order INTO v_other_id, v_other_sort
    FROM subjects
    WHERE specialty_id = v_current_spec
      AND level = v_current_level
      AND semester = v_current_semester
      AND is_active = TRUE
      AND sort_order < v_current_sort
    ORDER BY sort_order DESC
    LIMIT 1;
  ELSIF p_direction = 'down' THEN
    SELECT id, sort_order INTO v_other_id, v_other_sort
    FROM subjects
    WHERE specialty_id = v_current_spec
      AND level = v_current_level
      AND semester = v_current_semester
      AND is_active = TRUE
      AND sort_order > v_current_sort
    ORDER BY sort_order ASC
    LIMIT 1;
  ELSE
    RAISE EXCEPTION 'Invalid direction (use ''up'' or ''down'')';
  END IF;

  -- لو لا توجد مادة مجاورة، لا تفعل شيئاً
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- بدّل sort_order (atomic — ضمن نفس المعاملة)
  UPDATE subjects SET sort_order = v_other_sort WHERE id = p_subject_id;
  UPDATE subjects SET sort_order = v_current_sort WHERE id = v_other_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION swap_subject_sort_order IS
  'تبديل ترتيب مادة مع مجاورتها (up/down) — ذري';

-- ============================================
-- 7. التحقق النهائي
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration complete.';
  RAISE NOTICE '   - subjects: added sort_order, code, credits, prerequisites, description, updated_at, updated_by_*';
  RAISE NOTICE '   - subjects: sort_order populated for existing rows (alphabetical)';
  RAISE NOTICE '   - subjects: trigger trg_subjects_updated_at created';
  RAISE NOTICE '   - subject_audit_logs table created';
  RAISE NOTICE '   - swap_subject_sort_order() RPC function created';
END
$$;
