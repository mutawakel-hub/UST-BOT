-- ============================================
-- 📋 Migration: نظام دعوات المسؤولين (admin_invitations)
-- ============================================
-- يستبدل إدخال Telegram ID اليدوي بنظام دعوات عبر deep linking
-- ============================================

CREATE TABLE IF NOT EXISTS admin_invitations (
  id BIGSERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,                     -- token عشوائي آمن (32 hex)
  role TEXT NOT NULL CHECK (role IN ('central', 'college', 'level')),
  custom_name TEXT,                                -- اسم المسؤول المقترح
  college_id INT REFERENCES colleges(id) ON DELETE CASCADE,
  specialty_id INT REFERENCES specialties(id) ON DELETE CASCADE,
  level_num INT,
  position_id TEXT,                                -- معرّف المنصب المُنشأ مسبقاً (لو وُجد)
  invited_by_telegram_id BIGINT NOT NULL,
  invited_by_position_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  accepted_by_telegram_id BIGINT,                  -- يُملأ عند القبول
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,                 -- تنتهي خلال 7 أيام
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON admin_invitations(token) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_invitations_status ON admin_invitations(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON admin_invitations(invited_by_telegram_id);

COMMENT ON TABLE admin_invitations IS
  'دعوات المسؤولين: token → role → scope. تنتهي خلال 7 أيام. تُستخدم مرة واحدة.';
