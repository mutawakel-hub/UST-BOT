-- ============================================
-- 📋 Migration: get_db_size RPC function
-- ============================================
-- يُرجع حجم قاعدة البيانات بصيغة مقروءة
-- ============================================

CREATE OR REPLACE FUNCTION get_db_size()
RETURNS TABLE (size_bytes BIGINT, size_pretty TEXT) AS $$
BEGIN
  RETURN QUERY SELECT pg_database_size(current_database()) AS size_bytes,
                      pg_size_pretty(pg_database_size(current_database())) AS size_pretty;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_db_size IS 'يُرجع حجم قاعدة البيانات الحالية';
