// ============================================
// 🛡️ RBAC System - Role-Based Access Control
// ============================================
// نسخة الإنتاج: تستخدم Supabase عبر View `user_permissions`
// و Function `user_has_permission`، مع cache في KV.
//
// الفرق عن النسخة السابقة (mock):
//   - كل القراءات من DB (لا بيانات hardcoded)
//   - async (Supabase + KV async)
//   - cache للصلاحيات (TTL 5 دقائق — رصانة عالية)
//   - الكليات/التخصصات تُقرأ ديناميكياً (لا COLLEGES static array)
// ============================================

import { SupabaseClient } from "./db";
import { CacheStore, TTL } from "./session";

// ============================================
// الأنواع (تبقى كما هي — موافق للـ schema.sql)
// ============================================
export type PositionLevel = "central" | "college" | "level";

export interface Permission {
  id: string;
  name: string;
  description: string;
  min_level: PositionLevel;
}

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

// شكل البيانات في KV (Set لا يُسلسل مباشرة في JSON)
interface UserPermissionsCacheShape {
  positions: UserPosition[];
  permissions: string[];                    // Array بدل Set
  effective_scope: {
    colleges: number[];
    specialties: number[];
    levels: string[];
  };
  is_central: boolean;
}

// ============================================
// Cache + Clients (تُعرف عبر initRbac)
// ============================================
let cacheStore: CacheStore<UserPermissionsCacheShape>;
let supabaseClient: SupabaseClient;

/**
 * تهيئة طبقة RBAC — يجب استدعاؤها مرة واحدة عند إقلاع البوت.
 */
export function initRbac(supabase: SupabaseClient, cacheKv: KVNamespace): void {
  supabaseClient = supabase;
  cacheStore = new CacheStore<UserPermissionsCacheShape>(cacheKv, TTL.CACHE_PERMISSIONS);
}

// ============================================
// الحصول على كل صلاحيات المستخدم المدمجة
// ============================================
// يعتمد على View `user_permissions` في Supabase الذي يجمع:
//   position_holders JOIN positions JOIN position_level_permissions JOIN permissions
//
// مثال استعلام الـ View:
//   SELECT * FROM user_permissions WHERE user_telegram_id = 123456789;
//
// النتيجة: صف لكل (position, permission) — قد تحتوي على تكرارات لو
// المستخدم لديه عدة مناصب. نُجمّعها هنا في UserPermissions واحدة.
// ============================================
export async function getUserPermissions(telegramId: number): Promise<UserPermissions> {
  // 1. حاول قراءة من cache أولاً
  const cacheKey = `perms:${telegramId}`;
  const cached = await cacheStore.get(cacheKey);
  if (cached) {
    return deserializePermissions(cached);
  }

  // 2. اقرأ من Supabase عبر View `user_permissions`
  const rows = await supabaseClient.select<{
    position_id: string;
    position_level: PositionLevel;
    position_title: string;
    college_id: number | null;
    specialty_id: number | null;
    level_num: number | null;
    permission_id: string;
    permission_name: string;
  }>("user_permissions", {
    columns: "position_id,position_level,position_title,college_id,specialty_id,level_num,permission_id,permission_name",
    filter: `user_telegram_id=eq.${telegramId}`,
  });

  if (!Array.isArray(rows) || rows.length === 0) {
    return emptyPermissions();
  }

  // 3. اجمع الصلاحيات والمناصب (deduplicate)
  const permissions = new Set<string>();
  const positionsMap = new Map<string, UserPosition>();
  const colleges = new Set<number>();
  const specialties = new Set<number>();
  const levels = new Set<string>();
  let is_central = false;

  for (const row of rows) {
    permissions.add(row.permission_id);

    if (!positionsMap.has(row.position_id)) {
      positionsMap.set(row.position_id, {
        position_id: row.position_id,
        level: row.position_level,
        title: row.position_title,
        college_id: row.college_id || undefined,
        specialty_id: row.specialty_id || undefined,
        level_num: row.level_num || undefined,
      });
    }

    if (row.position_level === "central") {
      is_central = true;
      // المركزي يدير كل الكليات — سنُحمّلها لاحقاً عند الحاجة
    } else if (row.position_level === "college" && row.college_id) {
      colleges.add(row.college_id);
    } else if (row.position_level === "level" && row.college_id) {
      colleges.add(row.college_id);
      if (row.specialty_id) {
        specialties.add(row.specialty_id);
        if (row.level_num) {
          levels.add(`${row.specialty_id}-${row.level_num}`);
        }
      }
    }
  }

  // 4. لو مركزي، حمّل كل الكليات (تُخزّن في DB)
  if (is_central) {
    const collegesList = await supabaseClient.select<{ id: number }>("colleges", {
      columns: "id",
      filter: "is_active=eq.true",
    });
    if (Array.isArray(collegesList)) {
      collegesList.forEach((c) => colleges.add(c.id));
    }
  }

  const result: UserPermissions = {
    positions: Array.from(positionsMap.values()),
    permissions,
    effective_scope: { colleges, specialties, levels },
    is_central,
  };

  // 5. خزّن في cache (مسلسل بدون Set)
  await cacheStore.set(cacheKey, serializePermissions(result));

  return result;
}

// ============================================
// التحقق من صلاحية معينة
// ============================================
// نمطان:
//   1. للـ application logic (browser): استخدم getUserPermissions() + hasPermissionLocal()
//      — أسرع، لكن يعتمد على cache (قد يكون قديماً بـ 5 دقائق)
//   2. للـ RLS / العمليات الحساسة: استخدم hasPermission() الذي يستدعي DB function
//      — أبطأ، لكن دقيق 100%
// ============================================

/**
 * يتحقق من الصلاحية عبر RPC function `user_has_permission` في Supabase.
 * دقيق 100%، لكن يكلف طلب DB. استخدمه للعمليات الحساسة فقط.
 */
export async function hasPermission(
  telegramId: number,
  permission: string,
  scope?: { college_id?: number; specialty_id?: number; level?: number }
): Promise<boolean> {
  try {
    const result = await supabaseClient.rpc<boolean>("user_has_permission", {
      p_telegram_id: telegramId,
      p_permission_id: permission,
      p_college_id: scope?.college_id || null,
      p_specialty_id: scope?.specialty_id || null,
      p_level: scope?.level || null,
    });
    return Boolean(result);
  } catch (e) {
    console.error(`hasPermission(${telegramId}, ${permission}) error:`, e);
    // fail-closed للأمان: لو فشل التحقق، امنع العملية
    return false;
  }
}

/**
 * يتحقق محلياً (من cache). أسرع، لكن قد يكون قديماً.
 * استخدمه لتخصيص الأزرار في UI، وليس للقرارات الأمنية الحرجة.
 */
export async function hasPermissionLocal(
  telegramId: number,
  permission: string,
  scope?: { college_id?: number; specialty_id?: number; level?: number }
): Promise<boolean> {
  const userPerms = await getUserPermissions(telegramId);

  // 1. فحص وجود الصلاحية
  if (!userPerms.permissions.has(permission)) return false;

  // 2. لو المركزي → كل شيء مسموح
  if (userPerms.is_central) return true;

  // 3. فحص النطاق
  if (!scope) return true;

  if (scope.college_id && !userPerms.effective_scope.colleges.has(scope.college_id)) {
    return false;
  }

  if (scope.specialty_id && !userPerms.effective_scope.specialties.has(scope.specialty_id)) {
    return false;
  }

  if (scope.level && scope.specialty_id) {
    const key = `${scope.specialty_id}-${scope.level}`;
    if (!userPerms.effective_scope.levels.has(key)) {
      return false;
    }
  }

  return true;
}

// ============================================
// الحصول على المناصب التي يمكن للمستخدم إدارتها
// ============================================
// المركزي: كل المناصب ما عدا central_chair (لا يمكنه تعديل نفسه)
// مسؤول كلية: مناصب "level" في كليته فقط
// مسؤول مستوى: لا يدير أي مناصب
export async function getManageablePositions(telegramId: number): Promise<UserPosition[]> {
  const userPerms = await getUserPermissions(telegramId);

  if (userPerms.is_central) {
    // اقرأ كل المناصب من DB (ما عدا central_chair)
    const result = await supabaseClient.select<{
      id: string;
      level: PositionLevel;
      title: string;
      college_id: number | null;
      specialty_id: number | null;
      level_num: number | null;
    }>("positions", {
      columns: "id,level,title,college_id,specialty_id,level_num",
      filter: "is_central=eq.false",
      order: "level.asc,title.asc",
    });
    if (!Array.isArray(result)) return [];
    return result.map((p) => ({
      position_id: p.id,
      level: p.level,
      title: p.title,
      college_id: p.college_id || undefined,
      specialty_id: p.specialty_id || undefined,
      level_num: p.level_num || undefined,
    }));
  }

  if (userPerms.permissions.has("manage_level_reps")) {
    // مسؤول كلية — مناصب "level" في كليته فقط
    const collegeIds = Array.from(userPerms.effective_scope.colleges);
    if (collegeIds.length === 0) return [];

    // PostgREST: level=eq.level&college_id=in.(1,2,3)
    const filter = `level=eq.level&college_id=in.(${collegeIds.join(",")})`;
    const result = await supabaseClient.select<{
      id: string;
      level: PositionLevel;
      title: string;
      college_id: number | null;
      specialty_id: number | null;
      level_num: number | null;
    }>("positions", {
      columns: "id,level,title,college_id,specialty_id,level_num",
      filter,
      order: "title.asc",
    });
    if (!Array.isArray(result)) return [];
    return result.map((p) => ({
      position_id: p.id,
      level: p.level,
      title: p.title,
      college_id: p.college_id || undefined,
      specialty_id: p.specialty_id || undefined,
      level_num: p.level_num || undefined,
    }));
  }

  return [];
}

// ============================================
// الحصول على المحتوى الذي يمكن للمستخدم إدارته
// ============================================
// يستخدم Supabase مع PostgREST filters.
// لو مركزي: كل المحتوى النشط.
// لو مسؤول كلية/مستوى: المحتوى في كلياته فقط.
export async function getManageableContent(
  telegramId: number,
  filters?: {
    college_id?: number;
    specialty_id?: number;
    subject_id?: number;
    content_type?: string;
  }
): Promise<any[]> {
  const userPerms = await getUserPermissions(telegramId);

  // بناء الفلتر
  const filterParts: string[] = ["is_active=eq.true"];

  if (!userPerms.is_central) {
    const collegeIds = Array.from(userPerms.effective_scope.colleges);
    if (collegeIds.length === 0) return [];
    filterParts.push(`college_id=in.(${collegeIds.join(",")})`);
  }

  if (filters?.college_id) filterParts.push(`college_id=eq.${filters.college_id}`);
  if (filters?.specialty_id) filterParts.push(`specialty_id=eq.${filters.specialty_id}`);
  if (filters?.subject_id) filterParts.push(`subject_id=eq.${filters.subject_id}`);
  if (filters?.content_type) filterParts.push(`content_type_id=eq.${filters.content_type}`);

  const result = await supabaseClient.select("content", {
    columns: "id,title,file_name,file_size_mb,college_id,specialty_id,subject_id,content_type_id,level,semester,is_starred,download_count,added_at,academic_year",
    filter: filterParts.join("&"),
    order: "is_starred.desc,added_at.desc",
    limit: 50,
  });

  return Array.isArray(result) ? result : [];
}

// ============================================
// الحصول على روابط قنوات اللجان
// ============================================
export async function getCommitteeChannels(options?: {
  scope_type?: "central" | "college" | "specialty_level";
  college_id?: number;
  specialty_id?: number;
  level_num?: number;
}): Promise<any[]> {
  const filterParts: string[] = ["is_active=eq.true"];
  if (options?.scope_type) filterParts.push(`scope_type=eq.${options.scope_type}`);
  if (options?.college_id) filterParts.push(`college_id=eq.${options.college_id}`);
  if (options?.specialty_id) filterParts.push(`specialty_id=eq.${options.specialty_id}`);
  if (options?.level_num) filterParts.push(`level_num=eq.${options.level_num}`);

  const result = await supabaseClient.select("committee_channels", {
    columns: "id,scope_type,college_id,specialty_id,level_num,channel_url,display_name,is_active",
    filter: filterParts.join("&"),
    order: "scope_type.asc,display_name.asc",
  });
  return Array.isArray(result) ? result : [];
}

// ============================================
// أسماء الصلاحيات (للعرض في UI)
// ============================================
// يقرأ من DB بدون cache (نادراً ما يُستخدم)
export async function getPermissionLabel(permissionId: string): Promise<string> {
  try {
    const result = await supabaseClient.select<{ name: string }>("permissions", {
      columns: "name",
      filter: `id=eq.${permissionId}`,
      single: true,
    });
    const perm = Array.isArray(result) ? result[0] : result;
    return perm?.name || permissionId;
  } catch {
    return permissionId;
  }
}

// ============================================
// تسميات المناصب
// ============================================
export async function getPositionTitle(positionId: string): Promise<string> {
  try {
    const result = await supabaseClient.select<{ title: string }>("positions", {
      columns: "title",
      filter: `id=eq.${positionId}`,
      single: true,
    });
    const pos = Array.isArray(result) ? result[0] : result;
    return pos?.title || positionId;
  } catch {
    return positionId;
  }
}

// ============================================
// تسمية المستوى (نصية ثابتة — لا تحتاج DB)
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
export async function getPositionScopeText(position: UserPosition): Promise<string> {
  switch (position.level) {
    case "central":
      return "🌍 جميع الكليات";
    case "college": {
      const result = await supabaseClient.select<{ name: string }>("colleges", {
        columns: "name",
        filter: `id=eq.${position.college_id}`,
        single: true,
      });
      const college = Array.isArray(result) ? result[0] : result;
      return `🏛 ${college?.name || "كلية"}`;
    }
    case "level": {
      const result = await supabaseClient.select<{ short_name: string }>("specialties", {
        columns: "short_name",
        filter: `id=eq.${position.specialty_id}`,
        single: true,
      });
      const spec = Array.isArray(result) ? result[0] : result;
      return `📊 ${spec?.short_name || "تخصص"} - مستوى ${position.level_num}`;
    }
  }
}

// ============================================
// تسهيلات: هل المستخدم مسؤول؟ (للوصول للبوت)
// ============================================
export async function isUserAdmin(telegramId: number): Promise<boolean> {
  try {
    const result = await supabaseClient.select<{ position_id: string }>("position_holders", {
      columns: "position_id",
      filter: `user_telegram_id=eq.${telegramId}&is_active=eq.true`,
      limit: 1,
    });
    return Array.isArray(result) && result.length > 0;
  } catch (e) {
    console.error(`isUserAdmin(${telegramId}) error:`, e);
    return false;
  }
}

// ============================================
// مساعدات تسلسل/إلغاء تسلسل (Set ↔ Array لـ JSON)
// ============================================
function serializePermissions(perms: UserPermissions): UserPermissionsCacheShape {
  return {
    positions: perms.positions,
    permissions: Array.from(perms.permissions),
    effective_scope: {
      colleges: Array.from(perms.effective_scope.colleges),
      specialties: Array.from(perms.effective_scope.specialties),
      levels: Array.from(perms.effective_scope.levels),
    },
    is_central: perms.is_central,
  };
}

function deserializePermissions(cached: UserPermissionsCacheShape): UserPermissions {
  return {
    positions: cached.positions,
    permissions: new Set(cached.permissions),
    effective_scope: {
      colleges: new Set(cached.effective_scope.colleges),
      specialties: new Set(cached.effective_scope.specialties),
      levels: new Set(cached.effective_scope.levels),
    },
    is_central: cached.is_central,
  };
}

function emptyPermissions(): UserPermissions {
  return {
    positions: [],
    permissions: new Set(),
    effective_scope: {
      colleges: new Set(),
      specialties: new Set(),
      levels: new Set(),
    },
    is_central: false,
  };
}

// ============================================
// إبطال cache لصلاحيات مستخدم (عند تعديل منصبه)
// ============================================
// استدعِ هذه الدالة بعد أي تغيير على position_holders للمستخدم:
//   - تعيين منصب جديد
//   - إلغاء منصب
//   - تعطيل منصب
// ============================================
export async function invalidateUserPermissions(telegramId: number): Promise<void> {
  await cacheStore.delete(`perms:${telegramId}`);
}
