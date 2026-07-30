// ============================================
// 🛠️ Admin Helpers — دوال مساعدة مشتركة
// ============================================
// هذا الملف يحتوي على:
//   - buildDynamicDashboard (يبني لوحة الإدارة حسب الصلاحيات)
//   - Stub functions (تقرأ من DB بدل MOCK arrays)
//   - customTexts (in-memory Map مؤقت)
// ============================================

import { InlineKeyboard, Bot } from "grammy";
import { TEXTS, ADMIN_TEXTS } from "../shared/texts";
import { SupabaseClient, getBroadcastRecipients as dbGetBroadcastRecipients } from "../shared/db";
import { UserPermissions, UserPosition } from "../shared/rbac";

// ============================================
// buildDynamicDashboard — يبني لوحة الإدارة حسب الصلاحيات
// ============================================
export function buildDynamicDashboard(perms: UserPermissions, pendingCount: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  const p = perms.permissions;

  // صف 1: إدارة الإحسان (للجميع الذين يملكون صلاحية مراجعة)
  if (p.has("approve_level_contributions") || perms.is_central) {
    kb.text(`🌟 إدارة الإحسان${pendingCount > 0 ? ` (${pendingCount})` : ""}`, "ihsan_management");
  }
  kb.row();

  // صف 2: المحتوى
  if (p.has("manage_level_content")) {
    kb.text("📁 إدارة المحتوى", "content_mgmt");
  }
  kb.row();

  // صف 3: المواد + التعميم
  if (p.has("manage_subjects")) {
    kb.text("📖 إدارة المواد", "subjects_mgmt");
  }
  if (p.has("central_broadcast") || p.has("college_broadcast") || p.has("level_broadcast")) {
    kb.text("📢 تعميم", "broadcast");
  }
  kb.row();

  // صف 4: الإحصائيات + التخصيص
  if (p.has("view_level_stats") || p.has("view_central_stats")) {
    kb.text("📊 إحصائيات", "statistics");
  }
  if (p.has("system_settings")) {
    kb.text("⚙️ تخصيص النصوص", "customize_texts");
  }
  kb.row();

  // صف 5: المناصب + اللجان
  if (p.has("manage_admins") || p.has("manage_level_reps")) {
    kb.text("👥 إدارة المناصب", "manage_admins");
  }
  if (p.has("manage_committee_channels")) {
    kb.text("📢 قنوات اللجان", "manage_channels");
  }
  kb.row();

  // صف 6: (فارغ — تم نقل كل شيء لإدارة الإحسان)

  return kb;
}

// ============================================
// عدّ المساهمات المعلقة من Supabase
// ============================================
export async function getPendingCount(supabase: SupabaseClient): Promise<number> {
  try {
    const pending = await supabase.select<{ id: number }>("contributions", {
      columns: "id",
      filter: "status=eq.pending",
      limit: 100,
    });
    return Array.isArray(pending) ? pending.length : 0;
  } catch (e) {
    console.error("Failed to count pending contributions:", e);
    return 0;
  }
}

// ============================================
// Stub functions — تقرأ من DB
// ============================================
export async function getStudentCountByScope(supabase: SupabaseClient, scope: {
  scope_type: "all" | "college" | "specialty" | "level";
  scope_college_id?: number;
  scope_specialty_id?: number;
  scope_level?: number;
}): Promise<number> {
  try {
    const recipients = await dbGetBroadcastRecipients(
      supabase, scope.scope_type, scope.scope_college_id,
      scope.scope_specialty_id, scope.scope_level
    );
    return recipients.length;
  } catch (e) {
    console.error("getStudentCountByScope error:", e);
    return 0;
  }
}

export async function getAdminUser(supabase: SupabaseClient, telegramId: number): Promise<any> {
  try {
    const result = await supabase.select("admin_users", {
      filter: `telegram_id=eq.${telegramId}`, single: true,
    });
    return Array.isArray(result) ? result[0] : result;
  } catch { return null; }
}

export async function getStatistics(supabase: SupabaseClient): Promise<any> {
  try {
    const [students, content, contributions, downloads] = await Promise.all([
      supabase.select("students", { columns: "id" }),
      supabase.select("content", { columns: "id", filter: "is_active=eq.true" }),
      supabase.select("contributions", { columns: "id", filter: "status=eq.pending" }),
      supabase.select("downloads", { columns: "id" }),
    ]);
    return {
      total_users: Array.isArray(students) ? students.length : 0,
      total_files: Array.isArray(content) ? content.length : 0,
      pending_contributions: Array.isArray(contributions) ? contributions.length : 0,
      total_downloads: Array.isArray(downloads) ? downloads.length : 0,
      total_contributions: 0, total_broadcasts: 0, active_today: 0, new_this_week: 0,
    };
  } catch (e) {
    console.error("getStatistics error:", e);
    return { total_users: 0, total_files: 0, pending_contributions: 0,
      total_downloads: 0, total_contributions: 0, total_broadcasts: 0,
      active_today: 0, new_this_week: 0 };
  }
}

export async function getPositionById(supabase: SupabaseClient, positionId: string): Promise<any> {
  try {
    const result = await supabase.select("positions", {
      filter: `id=eq.${positionId}`, single: true,
    });
    return Array.isArray(result) ? result[0] : result;
  } catch { return null; }
}

export async function getPositionHolder(supabase: SupabaseClient, positionId: string): Promise<any> {
  try {
    const result = await supabase.select("position_holders", {
      filter: `position_id=eq.${positionId}&is_active=eq.true`, single: true,
    });
    return Array.isArray(result) ? result[0] : result;
  } catch { return null; }
}

export async function getHonors(supabase: SupabaseClient, status?: string): Promise<any[]> {
  try {
    const filter = status ? `status=eq.${status}` : undefined;
    const result = await supabase.select("contribution_honors", {
      filter, order: "created_at.desc", limit: 20,
    });
    return Array.isArray(result) ? result : [];
  } catch { return []; }
}

export async function getChannelById(supabase: SupabaseClient, channelId: number): Promise<any> {
  try {
    const result = await supabase.select("committee_channels", {
      filter: `id=eq.${channelId}`, single: true,
    });
    return Array.isArray(result) ? result[0] : result;
  } catch { return null; }
}

export async function getChannelsByScope(supabase: SupabaseClient, scopeType?: string): Promise<any[]> {
  try {
    const filter = scopeType ? `is_active=eq.true&scope_type=eq.${scopeType}` : "is_active=eq.true";
    const result = await supabase.select("committee_channels", {
      filter, order: "display_name.asc",
    });
    return Array.isArray(result) ? result : [];
  } catch { return []; }
}

// In-memory cache للنصوص المخصصة (مؤقت — يجب أن يُقرأ من DB)
export const customTexts = {
  _cache: new Map<string, string>(),
  get(key: string): string | undefined { return this._cache.get(key); },
  set(key: string, value: string): void { this._cache.set(key, value); },
  delete(key: string): boolean { return this._cache.delete(key); },
  has(key: string): boolean { return this._cache.has(key); },
};

// Helper: بناء roleLabel من الصلاحيات
export function getRoleLabel(perms: UserPermissions): string {
  if (perms.is_central) return "🛡 مسؤول مركزي";
  if (perms.positions.length > 0) {
    const pos = perms.positions[0];
    const levelLabel = pos.level === "central" ? "🛡" : pos.level === "college" ? "🏛" : "📊";
    return `${levelLabel} ${pos.title}`;
  }
  return "مسؤول";
}

// ============================================
// ensureLevelRepPosition — إنشاء منصب مندوب مستوى ديناميكياً
// ============================================
// مناصب مندوبي المستويات لا تُنشأ مسبقاً (قد تصل إلى 34×6 = 200+ منصب).
// بدلاً من ذلك، ننشئ المنصب عند أول تعيين لمندوب مستوى معيّن.
//
// معرّف المنصب: `level_rep_{specId}_{levelNum}`
// مثال: level_rep_16_2 = مندوب المستوى 2 في تخصص IT (id=16)
//
// الخطوات:
//   1. تحقق من وجود المنصب بـ SELECT
//   2. لو غير موجود: اقرأ specialty للحصول على college_id و levels_count
//      ثم أدرج المنصب في جدول positions
//   3. أرجع الـ position_id
// ============================================
export async function ensureLevelRepPosition(
  supabase: SupabaseClient,
  collegeId: number,
  specialtyId: number,
  levelNum: number
): Promise<string> {
  const positionId = `level_rep_${specialtyId}_${levelNum}`;

  // 1. تحقق من وجود المنصب
  try {
    const existing = await supabase.select<{ id: string }>("positions", {
      columns: "id",
      filter: `id=eq.${positionId}`,
      single: true,
    });
    if (existing) {
      return positionId;
    }
  } catch (e) {
    console.warn(`⚠️ [ensureLevelRepPosition] Check failed for ${positionId}:`, e);
    // استمر — حاول INSERT على أي حال
  }

  // 2. اقرأ بيانات التخصص للاسم والوصف
  let specName = `تخصص ${specialtyId}`;
  try {
    const specResult = await supabase.select<{ short_name: string }>("specialties", {
      columns: "short_name",
      filter: `id=eq.${specialtyId}`,
      single: true,
    });
    const spec = Array.isArray(specResult) ? specResult[0] : specResult;
    if (spec?.short_name) specName = spec.short_name;
  } catch (e) {
    console.warn(`⚠️ [ensureLevelRepPosition] Failed to read specialty ${specialtyId}:`, e);
  }

  // 3. أدرج المنصب الجديد
  try {
    await supabase.insert("positions", {
      id: positionId,
      level: "level",
      title: `📊 مندوب ${specName} - مستوى ${levelNum}`,
      description: `مندوب المستوى ${levelNum} في تخصص ${specName}`,
      college_id: collegeId,
      specialty_id: specialtyId,
      level_num: levelNum,
      is_central: false,
    });
  } catch (e: any) {
    // قد يكون المنصب قد أُنشئ بـ race condition — تحقق من جديد
    const errMsg = String(e?.message || e);
    if (errMsg.includes("duplicate") || errMsg.includes("23505")) {
      //race: أُنشئ بواسطة طلب آخر — هذا جيد
      return positionId;
    }
    console.error(`❌ [ensureLevelRepPosition] Failed to create ${positionId}:`, e);
    throw e;
  }

  console.log(`✅ [ensureLevelRepPosition] Created new position: ${positionId}`);
  return positionId;
}

// ============================================
// writePositionAuditLog — كتابة سجل تدقيق لتغييرات المناصب
// ============================================
// يُستدعى بعد كل عملية تعيين (assign) أو إزالة (revoke) لمنصب.
// يكتب في جدول position_audit_logs:
//   - position_id: المنصب المتأثر
//   - action: 'assign' أو 'revoke'
//   - old_holder_id: الشاغل القديم (لو كان موجوداً)
//   - new_holder_id: الشاغل الجديد (لو was assigned)
//   - performed_by: من نفّذ العملية (telegram_id للمسؤول الحالي)
// ============================================
export async function writePositionAuditLog(
  supabase: SupabaseClient,
  data: {
    position_id: string;
    action: "assign" | "revoke";
    old_holder_id?: number | null;
    new_holder_id?: number | null;
    performed_by: number;
  }
): Promise<void> {
  try {
    await supabase.insert("position_audit_logs", {
      position_id: data.position_id,
      action: data.action,
      old_holder_id: data.old_holder_id ?? null,
      new_holder_id: data.new_holder_id ?? null,
      performed_by: data.performed_by,
    });
  } catch (e) {
    // لا نفشل العملية بسبب فشل التدقيق — نسجّل فقط
    console.error("❌ [writePositionAuditLog] Failed to write audit log:", e);
  }
}

// ============================================
// notifyNewAdmin — إشعار المسؤول الجديد بتعيينه
// ============================================
// يرسل رسالة Telegram للمستخدم المعيّن حديثاً تخبره بمنصبه الجديد
// وترشده للدخول لبوت الإدارة.
// ملاحظة: نتجاهل الأخطاء (قد يكون المستخدم حظر البوت)
// ============================================
export async function notifyNewAdmin(
  bot: Bot,
  telegramId: number,
  positionTitle: string,
  assignedByName: string
): Promise<void> {
  try {
    await bot.api.sendMessage(
      telegramId,
      ADMIN_TEXTS.positions.notification_assigned(positionTitle, assignedByName),
      { parse_mode: "Markdown" }
    );
  } catch (e: any) {
    // المستخدم قد يكون حظر البوت أو لم يبدأه بعد — لا نفشل العملية
    const msg = String(e?.message || e);
    if (msg.includes("bot was blocked") || msg.includes("chat not found")) {
      console.warn(`⚠️ [notifyNewAdmin] Could not notify ${telegramId} (blocked or not started)`);
    } else {
      console.error(`❌ [notifyNewAdmin] Failed to notify ${telegramId}:`, e);
    }
  }
}

// ============================================
// notifyRevokedAdmin — إشعار المسؤول المُزال من منصبه
// ============================================
// يرسل رسالة Telegram للمستخدم المُزال إعلاماً بفقدانه الصلاحيات.
// ملاحظة: نتجاهل الأخطاء (نفس أسباب notifyNewAdmin)
// ============================================
export async function notifyRevokedAdmin(
  bot: Bot,
  telegramId: number,
  positionTitle: string,
  revokedByName: string
): Promise<void> {
  try {
    await bot.api.sendMessage(
      telegramId,
      ADMIN_TEXTS.positions.notification_revoked(positionTitle, revokedByName),
      { parse_mode: "Markdown" }
    );
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("bot was blocked") || msg.includes("chat not found")) {
      console.warn(`⚠️ [notifyRevokedAdmin] Could not notify ${telegramId} (blocked or not started)`);
    } else {
      console.error(`❌ [notifyRevokedAdmin] Failed to notify ${telegramId}:`, e);
    }
  }
}
