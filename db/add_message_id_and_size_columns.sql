-- ============================================
-- Migration: إضافة telegram_message_id لجدول contributions
-- وتحديث content بـ file_size_bytes و mime_type
-- ============================================
-- الهدف:
--   1. contributions.telegram_message_id: تخزين message_id من قناة التخزين عند الرفع
--      (لتفعيل forwardMessage السريع بدل sendDocument البطيء)
--   2. content.file_size_bytes: حجم دقيق بالبايت (بدل file_size_mb التقريبي)
--   3. content.mime_type: نوع MIME للملف (للفحص المتقدم)
--
-- التاريخ: 2025-07-31
-- ============================================

-- 1. إضافة telegram_message_id لجدول contributions
-- (nullable — المساهمات القديمة لن تحتوي عليه)
ALTER TABLE contributions
  ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;

-- فهرس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_contributions_message
  ON contributions(telegram_message_id)
  WHERE telegram_message_id IS NOT NULL;

-- 2. إضافة file_size_bytes و mime_type لجدول content
ALTER TABLE content
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;

ALTER TABLE content
  ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- 3. تعليق توضيحي
COMMENT ON COLUMN contributions.telegram_message_id IS
  'message_id من قناة التخزين عند رفع الملف. يُستخدم لـ forwardMessage السريع بدل sendDocument';

COMMENT ON COLUMN content.file_size_bytes IS
  'الحجم الدقيق بالبايت (أدق من file_size_mb)';

COMMENT ON COLUMN content.mime_type IS
  'نوع MIME للملف (application/pdf, video/mp4, audio/mpeg, etc.)';

-- ============================================
-- ملاحظات للمسؤول:
--   - هذا الـ migration آمن للإنتاج (idempotent — يمكن تشغيله عدة مرات)
--   - لا يحذف أي بيانات
--   - الأعمدة الجديدة nullable — البيانات القديمة ستحتوي NULL
--   - تشغّل بعد seed_data.sql
-- ============================================
