-- ============================================
-- Migration: تحديث CHECK constraint لـ content_audit_logs
-- ============================================
-- الهدف:
--   إضافة 'copy' و 'import' لقائمة الـ actions المسموح بها
--   لدعم ميزات "نسخ المحتوى" و "الاستيراد المتتابع" القادمة في المرحلة 2 و 3
--
-- ملاحظة:
--   - آمن للإنتاج (idempotent)
--   - لا يحذف أي بيانات
--   - الـ constraint القديم يُحذف ثم يُعاد إنشاؤه بالشكل الجديد
--
-- التاريخ: 2025-07-31
-- ============================================

-- 1. حذف الـ constraint القديم
ALTER TABLE content_audit_logs
  DROP CONSTRAINT IF EXISTS content_audit_logs_action_check;

-- 2. إضافة الـ constraint الجديد (يشمل copy و import)
ALTER TABLE content_audit_logs
  ADD CONSTRAINT content_audit_logs_action_check
  CHECK (action IN ('create', 'update', 'move', 'delete', 'copy', 'import', 'star', 'unstar'));

-- 3. تعليق توضيحي
COMMENT ON TABLE content_audit_logs IS
  'سجل عمليات المحتوى: create/update/move/delete/copy/import/star/unstar';

-- ============================================
-- ملاحظات للمسؤول:
--   - شغّل هذا الـ migration قبل تفعيل ميزات النسخ والاستيراد
--   - الـ constraint الجديد متوافق مع الـ schema.sql المحدّث
-- ============================================
