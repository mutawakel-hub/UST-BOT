-- ============================================
-- 📋 Migration Master: كل migrations محتوى المراحل 1-4
-- ============================================
-- هذا الملف يجمع كل الـ migrations اللازمة لميزات إدارة المحتوى الجديدة
-- شغّله مرة واحدة على Supabase الإنتاج (idempotent — آمن للتكرار)
--
-- التاريخ: 2025-07-31
-- ============================================

-- ============================================
-- 1. إضافة telegram_message_id لجدول contributions
--    (لتخزين message_id من قناة التخزين عند رفع الملف)
-- ============================================
ALTER TABLE contributions
  ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_contributions_message
  ON contributions(telegram_message_id)
  WHERE telegram_message_id IS NOT NULL;

COMMENT ON COLUMN contributions.telegram_message_id IS
  'message_id من قناة التخزين عند رفع الملف. يُستخدم لـ forwardMessage السريع بدل sendDocument';

-- ============================================
-- 2. إضافة file_size_bytes و mime_type لجدول content
--    (للتخزين الدقيق + الفحص المتقدم)
-- ============================================
ALTER TABLE content
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;

ALTER TABLE content
  ADD COLUMN IF NOT EXISTS mime_type TEXT;

COMMENT ON COLUMN content.file_size_bytes IS
  'الحجم الدقيق بالبايت (أدق من file_size_mb)';

COMMENT ON COLUMN content.mime_type IS
  'نوع MIME للملف (application/pdf, video/mp4, audio/mpeg, etc.)';

-- ============================================
-- 3. تحديث CHECK constraint لـ content_audit_logs
--    (إضافة copy و import لدعم النسخ والاستيراد المتتابع)
-- ============================================
ALTER TABLE content_audit_logs
  DROP CONSTRAINT IF EXISTS content_audit_logs_action_check;

ALTER TABLE content_audit_logs
  ADD CONSTRAINT content_audit_logs_action_check
  CHECK (action IN ('create', 'update', 'move', 'delete', 'copy', 'import', 'star', 'unstar'));

COMMENT ON TABLE content_audit_logs IS
  'سجل عمليات المحتوى: create/update/move/delete/copy/import/star/unstar';

-- ============================================
-- 4. فهارس إضافية لتحسين الأداء
-- ============================================

-- فهرس على content_audit_logs(performed_by_telegram_id) — لجلب عمليات مسؤول معين
CREATE INDEX IF NOT EXISTS idx_content_audit_performer
  ON content_audit_logs(performed_by_telegram_id, performed_at DESC);

-- فهرس على content(is_active, subject_id) — لتسريع استعلامات الإحصائيات
CREATE INDEX IF NOT EXISTS idx_content_active_subject
  ON content(subject_id, is_active);

-- فهرس على content(content_type_id, is_active) — لتسريع توزيع الأنواع في الإحصائيات
CREATE INDEX IF NOT EXISTS idx_content_active_type
  ON content(content_type_id, is_active)
  WHERE is_active = TRUE;

-- ============================================
-- 5. التحقق من اكتمال المخطط
-- ============================================
-- (للعرض فقط — لا يُنفّذ شيء)
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration complete.';
  RAISE NOTICE '   - contributions.telegram_message_id: added';
  RAISE NOTICE '   - content.file_size_bytes: added';
  RAISE NOTICE '   - content.mime_type: added';
  RAISE NOTICE '   - content_audit_logs CHECK: updated (includes copy, import)';
  RAISE NOTICE '   - Performance indexes: created';
END
$$;
