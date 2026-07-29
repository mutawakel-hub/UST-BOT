// ============================================
// 🛠️ Admin Helpers — دوال مساعدة مشتركة
// ============================================
// هذا الملف يحتوي على:
//   - buildDynamicDashboard (يبني لوحة الإدارة حسب الصلاحيات)
//   - Stub functions (تقرأ من DB بدل MOCK arrays)
//   - customTexts (in-memory Map مؤقت)
// ============================================

import { InlineKeyboard } from "grammy";
import { TEXTS, ADMIN_TEXTS } from "../shared/texts";
import { SupabaseClient, getBroadcastRecipients as dbGetBroadcastRecipients } from "../shared/db";
import { UserPermissions, UserPosition } from "../shared/rbac";

// ============================================
// buildDynamicDashboard — يبني لوحة الإدارة حسب الصلاحيات
// ============================================
export function buildDynamicDashboard(perms: UserPermissions, pendingCount: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  const p = perms.permissions;

  // صف 1: المساهمات (مخفية للمركزي مؤقتاً) + المحتوى
  if (p.has("approve_level_contributions") && !perms.is_central) {
    kb.text(ADMIN_TEXTS.dashboard.btn_pending(pendingCount), "pending");
  }
  if (p.has("manage_level_content")) {
    kb.text("📁 إدارة المحتوى", "content_mgmt");
  }
  kb.row();

  // صف 2: المواد + التعميم
  if (p.has("manage_subjects")) {
    kb.text("📖 إدارة المواد", "subjects_mgmt");
  }
  if (p.has("central_broadcast") || p.has("college_broadcast") || p.has("level_broadcast")) {
    kb.text("📢 تعميم", "broadcast");
  }
  kb.row();

  // صف 3: الإحصائيات + التخصيص
  if (p.has("view_level_stats") || p.has("view_central_stats")) {
    kb.text("📊 إحصائيات", "statistics");
  }
  if (p.has("system_settings")) {
    kb.text("⚙️ تخصيص النصوص", "customize_texts");
  }
  kb.row();

  // صف 4: المناصب + اللجان (للمركزي فقط)
  if (p.has("manage_admins")) {
    kb.text("👥 إدارة المناصب", "manage_admins");
  }
  if (p.has("manage_committee_channels")) {
    kb.text("📢 قنوات اللجان", "manage_channels");
  }
  kb.row();

  // صف 5: التكريم + إعادة ضبط النقاط (للمركزي فقط)
  if (p.has("manage_honors")) {
    kb.text("🏆 إدارة التكريم", "manage_honors");
  }
  if (p.has("reset_points")) {
    kb.text("🔄 إعادة ضبط النقاط", "manage_reset_points");
  }
  kb.row();

  // صف 6: لوحة الشرف (للمركزي فقط)
  if (perms.is_central) {
    kb.text("🏆 لوحة الشرف", "leaderboard_update").row();
  }

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
