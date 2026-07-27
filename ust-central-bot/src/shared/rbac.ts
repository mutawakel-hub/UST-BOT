// ============================================
// 🛡️ RBAC System - Role-Based Access Control
// ============================================
// محاكاة كاملة لنظام الصلاحيات قبل الربط بقاعدة البيانات.
// في الإنتاج، سيتم استبدال هذه الدوال باستعلامات Supabase.
// ============================================

import {
  COLLEGES,
  getCollegeById,
  getSpecialtyById,
} from "./data/colleges";
import {
  MOCK_POSITIONS,
  MOCK_POSITION_HOLDERS,
  MOCK_PERMISSIONS,
  MOCK_POSITION_LEVEL_PERMISSIONS,
  MOCK_CONTENT,
  MOCK_COMMITTEE_CHANNELS,
  type MockPosition,
  type PositionLevel,
  type Permission,
} from "./data/admins";

// ============================================
// الأنواع
// ============================================
export type { PositionLevel, Permission } from "./data/admins";

export interface UserPosition {
  position_id: string;
  level: PositionLevel;
  title: string;
  college_id?: number;
  specialty_id?: number;
  level_num?: number;
}

export interface UserPermissions {
  positions: UserPosition[];
  permissions: Set<string>;
  // النطاق الفعّال (الأوسع)
  effective_scope: {
    colleges: Set<number>;        // الكليات التي يديرها
    specialties: Set<number>;     // التخصصات التي يديرها
    levels: Set<string>;          // "specId-levelNum" التي يديرها
  };
  is_central: boolean;
}

// ============================================
// الحصول على المناصب النشطة لمستخدم
// ============================================
export function getUserPositions(telegramId: number): UserPosition[] {
  const holders = MOCK_POSITION_HOLDERS.filter(
    (h) => h.user_telegram_id === telegramId && h.is_active
  );

  return holders
    .map((h) => {
      const pos = MOCK_POSITIONS.find((p) => p.id === h.position_id);
      if (!pos) return null;
      return {
        position_id: pos.id,
        level: pos.level,
        title: pos.title,
        college_id: pos.college_id,
        specialty_id: pos.specialty_id,
        level_num: pos.level_num,
      } as UserPosition;
    })
    .filter(Boolean) as UserPosition[];
}

// ============================================
// الحصول على كل الصلاحيات المدمجة لمستخدم
// ============================================
export function getUserPermissions(telegramId: number): UserPermissions {
  const positions = getUserPositions(telegramId);

  // جمع الصلاحيات من كل المناصب (مع الوراثة التلقائية عبر position_level_permissions)
  const permissions = new Set<string>();
  const colleges = new Set<number>();
  const specialties = new Set<number>();
  const levels = new Set<string>();

  let is_central = false;

  for (const pos of positions) {
    // الصلاحيات
    const levelPerms = MOCK_POSITION_LEVEL_PERMISSIONS.filter(
      (lp) => lp.position_level === pos.level
    );
    levelPerms.forEach((lp) => permissions.add(lp.permission_id));

    // النطاق
    if (pos.level === "central") {
      is_central = true;
      // المركزي يفعل كل شيء — كل الكليات
      COLLEGES.forEach((c) => colleges.add(c.id));
    } else if (pos.level === "college") {
      if (pos.college_id) colleges.add(pos.college_id);
    } else if (pos.level === "level") {
      if (pos.college_id) colleges.add(pos.college_id);
      if (pos.specialty_id) specialties.add(pos.specialty_id);
      if (pos.specialty_id && pos.level_num) {
        levels.add(`${pos.specialty_id}-${pos.level_num}`);
      }
    }
  }

  return {
    positions,
    permissions,
    effective_scope: { colleges, specialties, levels },
    is_central,
  };
}

// ============================================
// التحقق من صلاحية معينة
// ============================================
export function hasPermission(
  telegramId: number,
  permission: string,
  scope?: { college_id?: number; specialty_id?: number; level?: number }
): boolean {
  const userPerms = getUserPermissions(telegramId);

  // 1. فحص وجود الصلاحية
  if (!userPerms.permissions.has(permission)) return false;

  // 2. لو المركزي → كل شيء مسموح
  if (userPerms.is_central) return true;

  // 3. فحص النطاق
  if (!scope) return true; // لا نطاق محدد → مسموح ضمن نطاقه

  if (scope.college_id) {
    if (!userPerms.effective_scope.colleges.has(scope.college_id)) return false;
  }

  if (scope.specialty_id) {
    if (!userPerms.effective_scope.specialties.has(scope.specialty_id)) return false;
  }

  if (scope.level && scope.specialty_id) {
    const key = `${scope.specialty_id}-${scope.level}`;
    if (!userPerms.effective_scope.levels.has(key)) return false;
  }

  return true;
}

// ============================================
// الحصول على المناصب التي يمكن للمستخدم إدارتها
// ============================================
export function getManageablePositions(telegramId: number): MockPosition[] {
  const userPerms = getUserPermissions(telegramId);

  if (userPerms.is_central) {
    // المركزي يدير كل المناصب
    return MOCK_POSITIONS.filter((p) => !p.is_central); // ما عدا نفسه
  }

  if (userPerms.permissions.has("manage_level_reps")) {
    // مسؤول كلية يدير مندوبي مستويات كلّيته فقط
    return MOCK_POSITIONS.filter(
      (p) =>
        p.level === "level" &&
        p.college_id &&
        userPerms.effective_scope.colleges.has(p.college_id)
    );
  }

  return [];
}

// ============================================
// الحصول على المحتوى الذي يمكن للمستخدم إدارته
// ============================================
export function getManageableContent(telegramId: number, filters?: {
  college_id?: number;
  specialty_id?: number;
  subject_id?: number;
  content_type?: string;
}) {
  const userPerms = getUserPermissions(telegramId);

  return MOCK_CONTENT.filter((c) => {
    // فحص النطاق
    if (!userPerms.is_central) {
      if (!userPerms.effective_scope.colleges.has(c.college_id)) return false;
    }

    // فحص الفلاتر
    if (filters?.college_id && c.college_id !== filters.college_id) return false;
    if (filters?.specialty_id && c.specialty_id !== filters.specialty_id) return false;
    if (filters?.subject_id && c.subject_id !== filters.subject_id) return false;
    if (filters?.content_type && c.content_type !== filters.content_type) return false;

    return true;
  });
}

// ============================================
// الحصول على روابط قنوات اللجان
// ============================================
export function getCommitteeChannels(options?: {
  scope_type?: "central" | "college" | "specialty_level";
  college_id?: number;
  specialty_id?: number;
  level_num?: number;
}) {
  return MOCK_COMMITTEE_CHANNELS.filter((c) => {
    if (options?.scope_type && c.scope_type !== options.scope_type) return false;
    if (options?.college_id && c.college_id !== options.college_id) return false;
    if (options?.specialty_id && c.specialty_id !== options.specialty_id) return false;
    if (options?.level_num && c.level_num !== options.level_num) return false;
    return c.is_active;
  });
}

// ============================================
// أسماء الصلاحيات (للعرض في UI)
// ============================================
export function getPermissionLabel(permissionId: string): string {
  const perm = MOCK_PERMISSIONS.find((p) => p.id === permissionId);
  return perm?.name || permissionId;
}

// ============================================
// تسميات المناصب
// ============================================
export function getPositionTitle(positionId: string): string {
  const pos = MOCK_POSITIONS.find((p) => p.id === positionId);
  return pos?.title || positionId;
}

// ============================================
// تسمية المستوى
// ============================================
export function getPositionLevelLabel(level: PositionLevel): string {
  const labels: Record<PositionLevel, string> = {
    central: "🛡 مركزي",
    college: "🏛 كلية",
    level: "📊 مستوى",
  };
  return labels[level];
}

// ============================================
// عرض نطاق المنصب بشكل نصّي
// ============================================
export function getPositionScopeText(position: MockPosition): string {
  switch (position.level) {
    case "central":
      return "🌍 جميع الكليات";
    case "college":
      return `🏛 ${getCollegeById(position.college_id!)?.name || "كلية"}`;
    case "level":
      const spec = getSpecialtyById(position.specialty_id!);
      return `📊 ${spec?.short_name || "تخصص"} - مستوى ${position.level_num}`;
  }
}

// ============================================
// تسهيلات: هل المستخدم مسؤول؟ (للوصول للبوت)
// ============================================
export function isUserAdmin(telegramId: number): boolean {
  const positions = getUserPositions(telegramId);
  return positions.length > 0;
}
