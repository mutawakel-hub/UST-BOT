-- ============================================
-- 📋 Migration: الخطط الاسترشادية (academic plans)
-- ============================================
-- يضيف عمود plan_url لجدول specialties
-- المسؤول يرفع PDF الخطة لقناة تخزين الكلية ويُخزّن file_id هنا
-- الطالب يرى الرابط عند الضغط على "🗺 الخطة الاسترشادية"
-- ============================================

ALTER TABLE specialties ADD COLUMN IF NOT EXISTS plan_url TEXT;
ALTER TABLE specialties ADD COLUMN IF NOT EXISTS plan_updated_at TIMESTAMPTZ;
ALTER TABLE specialties ADD COLUMN IF NOT EXISTS plan_updated_by BIGINT;

COMMENT ON COLUMN specialties.plan_url IS 'رابط PDF الخطة الاسترشادية للتخصص (file_id أو URL)';
COMMENT ON COLUMN specialties.plan_updated_at IS 'توقيت آخر تحديث للخطة';
COMMENT ON COLUMN specialties.plan_updated_by IS 'telegram_id للمسؤول الذي حدّث الخطة';
