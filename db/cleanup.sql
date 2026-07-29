-- ============================================
-- 🧹 سكريبت التنظيف - احذف كل الجداول والـ Functions
-- ============================================
-- شغّل هذا السكريبت أولاً قبل إعادة تطبيق schema.sql
-- ============================================

-- حذف الـ Triggers
DROP TRIGGER IF EXISTS trg_prevent_central_position_deletion ON positions;
DROP TRIGGER IF EXISTS trg_prevent_central_orphan ON position_holders;

-- حذف الـ Functions
DROP FUNCTION IF EXISTS prevent_central_deletion() CASCADE;
DROP FUNCTION IF EXISTS prevent_central_orphan() CASCADE;
DROP FUNCTION IF EXISTS user_has_permission(BIGINT, TEXT, INT, INT, INT) CASCADE;
DROP FUNCTION IF EXISTS get_top_contributors_specialty(INT, INT) CASCADE;
DROP FUNCTION IF EXISTS award_contribution_points(BIGINT, BIGINT, BIGINT, TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS notify_contribution_rejected(BIGINT, BIGINT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_broadcast_recipients(TEXT, INT, INT, INT) CASCADE;
DROP FUNCTION IF EXISTS register_student(BIGINT, TEXT, TEXT, INT, INT, INT) CASCADE;

-- حذف الـ Views
DROP VIEW IF EXISTS user_permissions CASCADE;

-- حذف الجداول (بالترتيب العكسي للتبعيات)
DROP TABLE IF EXISTS student_notifications CASCADE;
DROP TABLE IF EXISTS points_reset_logs CASCADE;
DROP TABLE IF EXISTS contribution_honors CASCADE;
DROP TABLE IF EXISTS student_points CASCADE;
DROP TABLE IF EXISTS student_subscriptions CASCADE;
DROP TABLE IF EXISTS committee_channels CASCADE;
DROP TABLE IF EXISTS custom_texts CASCADE;
DROP TABLE IF EXISTS leaderboard CASCADE;
DROP TABLE IF EXISTS downloads CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS content_audit_logs CASCADE;
DROP TABLE IF EXISTS position_audit_logs CASCADE;
DROP TABLE IF EXISTS broadcasts CASCADE;
DROP TABLE IF EXISTS contributions CASCADE;
DROP TABLE IF EXISTS position_level_permissions CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS position_holders CASCADE;
DROP TABLE IF EXISTS positions CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS content CASCADE;
DROP TABLE IF EXISTS content_types CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS specialties CASCADE;
DROP TABLE IF EXISTS colleges CASCADE;

-- حذف الإضافات (Extensions)
-- DROP EXTENSION IF EXISTS pg_trgm;
-- DROP EXTENSION IF EXISTS pgcrypto;

SELECT '✅ تم تنظيف قاعدة البيانات بنجاح!' AS message;
