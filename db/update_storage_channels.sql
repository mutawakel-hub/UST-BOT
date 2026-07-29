-- ============================================
-- 🔄 تحديث قنوات التخزين لكل الكليات السبع
-- ============================================
-- شغّل هذا السكريبت بعد إضافة القنوات الجديدة في تلغرام
-- والربط بين البوت والقنوات (إضافة البوت كـ admin في كل قناة)
-- ============================================

UPDATE colleges SET storage_channel_id = '-1004405014472' WHERE id = 1; -- كلية الطب والعلوم الصحية
UPDATE colleges SET storage_channel_id = '-1004430087693' WHERE id = 2; -- كلية طب الأسنان
UPDATE colleges SET storage_channel_id = '-1003898559257' WHERE id = 3; -- كلية الصيدلة
UPDATE colleges SET storage_channel_id = '-1004401563263' WHERE id = 4; -- كلية الهندسة
UPDATE colleges SET storage_channel_id = '-1003727164402' WHERE id = 5; -- كلية الحاسبات وتكنولوجيا المعلومات
UPDATE colleges SET storage_channel_id = '-1004353505188' WHERE id = 6; -- كلية العلوم الإدارية
UPDATE colleges SET storage_channel_id = '-1004473489150' WHERE id = 7; -- كلية العلوم الإنسانية والاجتماعية

-- التحقق
SELECT id, name, short_name, storage_channel_id FROM colleges ORDER BY display_order;
