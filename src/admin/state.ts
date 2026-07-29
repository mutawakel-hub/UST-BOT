// ============================================
// 🗃️ Admin State — الجلسات والأنواع المشتركة
// ============================================
// هذا الملف يحتوي على:
//   - AdminSession interface
//   - SessionStore instance (يُهيّأ في createAdminBot)
//   - getOrCreateSession / saveSession helpers
// ============================================

import { SessionStore, TTL } from "../shared/session";

// ============================================
// AdminSession — حالة جلسة المسؤول
// ============================================
export interface AdminSession {
  telegram_id: number;
  first_name: string;
  // حالات الانتظار
  awaiting_broadcast_text?: boolean;
  awaiting_broadcast_scope?: string;
  awaiting_subject_add?: boolean;
  awaiting_text_edit?: string;
  awaiting_text_value?: boolean;
  awaiting_upload_step?: string;
  upload_context?: any;
  awaiting_content_edit?: number; // content_id
  awaiting_content_delete?: number; // content_id
  awaiting_position_assign?: { step: "name" | "telegram_id"; position_id: string; name?: string };
  awaiting_position_revoke?: { position_id: string };
  awaiting_channel_edit?: number; // channel_id
  // تكريم
  awaiting_honor_reject?: number; // honor_id
  awaiting_honor_new_step?: "student_id" | "title" | "bonus";
  awaiting_honor_new_data?: { student_id?: number; title?: string };
  // فلتر استعراض المحتوى
  content_filter?: { college_id?: number; specialty_id?: number; subject_id?: number; content_type?: string };
  // سياق التعميم الحالي
  broadcast_context?: { scope_type: string; scope_college_id?: number; scope_specialty_id?: number; scope_level?: number; scope_label: string; count: number };
  // نص التعميم المؤقت
  pending_broadcast_text?: string;
}

// ============================================
// SessionStore — يُهيّأ في createAdminBot
// ============================================
let sessionStore: SessionStore<AdminSession>;

/**
 * تهيئة SessionStore — يُستدعى مرة واحدة في createAdminBot
 */
export function initSessionStore(sessionsKv: KVNamespace): void {
  sessionStore = new SessionStore<AdminSession>(sessionsKv, "admin", TTL.SESSION_DEFAULT);
}

// ============================================
// Helpers للجلسات
// ============================================
export async function getOrCreateSession(telegramId: number, firstName?: string): Promise<AdminSession> {
  let session = await sessionStore.get(telegramId);
  if (!session) {
    session = { telegram_id: telegramId, first_name: firstName || "مسؤول" };
    await sessionStore.set(telegramId, session, TTL.SESSION_DEFAULT);
  } else if (firstName && session.first_name !== firstName) {
    session.first_name = firstName;
    await sessionStore.set(telegramId, session, TTL.SESSION_DEFAULT);
  }
  return session;
}

export async function saveSession(session: AdminSession): Promise<void> {
  await sessionStore.set(session.telegram_id, session, TTL.SESSION_DEFAULT);
}

/**
 * إعادة ضبط كل حالات الانتظار في الجلسة
 */
export function resetSessionAwaitingStates(session: AdminSession): void {
  session.awaiting_broadcast_text = undefined;
  session.awaiting_broadcast_scope = undefined;
  session.broadcast_context = undefined;
  session.pending_broadcast_text = undefined;
  session.awaiting_subject_add = undefined;
  session.awaiting_text_edit = undefined;
  session.awaiting_text_value = undefined;
  session.awaiting_upload_step = undefined;
  session.upload_context = undefined;
  session.awaiting_content_edit = undefined;
  session.awaiting_content_delete = undefined;
  session.awaiting_position_assign = undefined;
  session.awaiting_position_revoke = undefined;
  session.awaiting_channel_edit = undefined;
  session.awaiting_honor_reject = undefined;
  session.awaiting_honor_new_step = undefined;
  session.awaiting_honor_new_data = undefined;
  session.content_filter = undefined;
}
