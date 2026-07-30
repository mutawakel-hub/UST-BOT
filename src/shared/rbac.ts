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
  // 0. تحقق من cache أولاً (مدة 5 دقائق)
  // ملاحظة: DIAGNOSTIC MODE السابق كان يحذف cache دائماً — عطّلناه للأداء
  const cacheKey = `perms:${telegramId}`;
  try {
    const cached = await cacheStore.get(cacheKey);
    if (cached) {
      return deserializePermissions(cached);
    }
  } catch (e) {
    console.warn(`⚠️ [RBAC] Cache read failed:`, e);
  }

  // 1. محاولة أولى: استخدم View `user_permissions` (الأسرع لو يعمل)
  let rows: any[] = [];
  let viewSuccess = false;
  try {
    console.log(`📡 [RBAC] Attempt 1: Querying user_permissions view for ${telegramId}...`);
    const result = await supabaseClient.select<{
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
    rows = Array.isArray(result) ? result : [];
    viewSuccess = true;
    console.log(`📊 [RBAC] View query returned ${rows.length} rows`);
    if (rows.length > 0) {
      console.log(`   First row:`, JSON.stringify(rows[0]));
    }
  } catch (e: any) {
    const errMsg = String(e?.message || e);
    console.warn(`⚠️ [RBAC] View query failed: ${errMsg.substring(0, 200)}`);
    console.warn(`   → Will try fallback method (direct queries)`);
    // لا نرجع هنا — نحاول fallback
  }

  // 2. محاولة ثانية (fallback): استعلامات مباشرة عبر 3 tables
  // تستخدم لو View غير متاح في PostgREST schema cache
  if (!viewSuccess || rows.length === 0) {
    console.log(`🔄 [RBAC] Attempt 2: Falling back to direct queries...`);
    rows = await fetchPermissionsDirectly(telegramId);
    console.log(`📊 [RBAC] Direct query returned ${rows.length} rows`);
    if (rows.length > 0) {
      console.log(`   First row:`, JSON.stringify(rows[0]));
    }
  }

  if (rows.length === 0) {
    console.error(`❌ [RBAC] Both methods returned 0 rows for user ${telegramId}`);
    // تحقق إضافي: هل المستخدم موجود في admin_users أصلاً؟
    try {
      const adminUser = await supabaseClient.select("admin_users", {
        columns: "telegram_id",
        filter: `telegram_id=eq.${telegramId}`,
        limit: 1,
      });
      if (!Array.isArray(adminUser) || adminUser.length === 0) {
        console.error(`❌ User ${telegramId} not found in admin_users table`);
      } else {
        console.log(`✅ User ${telegramId} found in admin_users`);
        const holder = await supabaseClient.select("position_holders", {
          columns: "position_id,is_active",
          filter: `user_telegram_id=eq.${telegramId}`,
        });
        console.log(`   position_holders:`, JSON.stringify(holder));
      }
    } catch (e) {
      console.error(`Diagnostic query also failed:`, e);
    }
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

  // 4. لو مركزي، حمّل كل الكليات
  if (is_central) {
    try {
      const collegesList = await supabaseClient.select<{ id: number }>("colleges", {
        columns: "id",
        filter: "is_active=eq.true",
      });
      if (Array.isArray(collegesList)) {
        collegesList.forEach((c) => colleges.add(c.id));
      }
    } catch (e) {
      console.warn(`⚠️ Failed to load colleges for central admin:`, e);
    }
  }

  const result: UserPermissions = {
    positions: Array.from(positionsMap.values()),
    permissions,
    effective_scope: { colleges, specialties, levels },
    is_central,
  };

  // 5. خزّن في cache
  await cacheStore.set(cacheKey, serializePermissions(result));
  console.log(`✅ [RBAC] Built permissions: ${permissions.size} perms, ${positionsMap.size} positions, is_central=${is_central}`);

  return result;
}

// ============================================
// Fallback: استعلام مباشر عبر 3 tables
// ============================================
// يستخدم لو View `user_permissions` غير متاح في PostgREST schema cache
// ينفذ 3 استعلامات منفصلة ويجمعها client-side
// ============================================
async function fetchPermissionsDirectly(telegramId: number): Promise<any[]> {
  // 1. اقرأ position_holders للمستخدم (المناصب النشطة فقط)
  let holders: any[] = [];
  try {
    const result = await supabaseClient.select("position_holders", {
      columns: "position_id",
      filter: `user_telegram_id=eq.${telegramId}&is_active=eq.true`,
    });
    holders = Array.isArray(result) ? result : [];
    console.log(`   [Direct] position_holders: ${holders.length} rows`);
  } catch (e) {
    console.error(`   [Direct] position_holders query failed:`, e);
    return [];
  }

  if (holders.length === 0) {
    console.warn(`   [Direct] No active positions for user ${telegramId}`);
    return [];
  }

  // 2. اقرأ تفاصيل المناصب
  const positionIds = holders.map((h) => h.position_id);
  let positions: any[] = [];
  try {
    // PostgREST in.() filter: position_id=in.("id1","id2","id3")
    const inFilter = `id=in.(${positionIds.map((id) => `"${id}"`).join(",")})`;
    const result = await supabaseClient.select("positions", {
      columns: "id,level,title,college_id,specialty_id,level_num,is_central",
      filter: inFilter,
    });
    positions = Array.isArray(result) ? result : [];
    console.log(`   [Direct] positions: ${positions.length} rows`);
  } catch (e) {
    console.error(`   [Direct] positions query failed:`, e);
    return [];
  }

  // 3. اقرأ position_level_permissions لكل مستوى
  const levels = [...new Set(positions.map((p) => p.level))];
  let levelPerms: any[] = [];
  try {
    const inFilter = `position_level=in.(${levels.map((l) => `"${l}"`).join(",")})`;
    const result = await supabaseClient.select("position_level_permissions", {
      columns: "position_level,permission_id",
      filter: inFilter,
    });
    levelPerms = Array.isArray(result) ? result : [];
    console.log(`   [Direct] position_level_permissions: ${levelPerms.length} rows`);
  } catch (e) {
    console.error(`   [Direct] position_level_permissions query failed:`, e);
    return [];
  }

  // 4. اقرأ permission names (اختياري - للـ logging فقط)
  const permIds = [...new Set(levelPerms.map((lp) => lp.permission_id))];
  let permNames: Map<string, string> = new Map();
  try {
    const inFilter = `id=in.(${permIds.map((id) => `"${id}"`).join(",")})`;
    const result = await supabaseClient.select("permissions", {
      columns: "id,name",
      filter: inFilter,
    });
    if (Array.isArray(result)) {
      result.forEach((p: any) => permNames.set(p.id, p.name));
    }
  } catch (e) {
    // تجاهل - الـ names اختيارية
  }

  // 5. اجمع كل شيء في نفس شكل الـ View
  const rows: any[] = [];
  for (const pos of positions) {
    for (const lp of levelPerms) {
      if (lp.position_level === pos.level) {
        rows.push({
          position_id: pos.id,
          position_level: pos.level,
          position_title: pos.title,
          college_id: pos.college_id,
          specialty_id: pos.specialty_id,
          level_num: pos.level_num,
          permission_id: lp.permission_id,
          permission_name: permNames.get(lp.permission_id) || lp.permission_id,
        });
      }
    }
  }

  return rows;
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
// مسؤول كلية: مناصب "level" في كليته فقط (تُقرأ عبر specialty_id)
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
    // مسؤول كلية — اقرأ التخصصات في كلياته أولاً، ثم اختر مناصب "level"
    // المرتبطة بهذه التخصصات عبر specialty_id
    return await fetchLevelPositionsForColleges(
      Array.from(userPerms.effective_scope.colleges)
    );
  }

  return [];
}

// ============================================
// الحصول على مناصب مسؤولي الكليات (college_admin_*)
// ============================================
// يستخدم في شاشة "إدارة مسؤولي الكليات" للمركزي فقط.
// المركزي: كل مناصب college_admin_* السبعة
// مسؤول كلية: لا يُرجع شيئاً (لا يملك صلاحية manage_admins)
export async function getCollegeAdminPositions(telegramId: number): Promise<UserPosition[]> {
  const userPerms = await getUserPermissions(telegramId);

  // فقط المركزي يمكنه إدارة مسؤولي الكليات
  if (!userPerms.permissions.has("manage_admins")) return [];

  const result = await supabaseClient.select<{
    id: string;
    level: PositionLevel;
    title: string;
    college_id: number | null;
    specialty_id: number | null;
    level_num: number | null;
  }>("positions", {
    columns: "id,level,title,college_id,specialty_id,level_num",
    filter: "level=eq.college",
    order: "college_id.asc",
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

// ============================================
// الحصول على مناصب مندوبي المستويات (level_rep_*)
// ============================================
// يستخدم في شاشة "إدارة مندوبي المستويات" للمركزي ومسؤول الكلية.
// المركزي: كل مناصب level_rep_* عبر كل الكليات
// مسؤول كلية: مناصب level_rep_* في كلياته فقط (عبر specialty_id)
export async function getLevelRepPositions(telegramId: number): Promise<UserPosition[]> {
  const userPerms = await getUserPermissions(telegramId);

  if (userPerms.is_central) {
    // كل مناصب المستوى عبر كل الكليات
    const result = await supabaseClient.select<{
      id: string;
      level: PositionLevel;
      title: string;
      college_id: number | null;
      specialty_id: number | null;
      level_num: number | null;
    }>("positions", {
      columns: "id,level,title,college_id,specialty_id,level_num",
      filter: "level=eq.level",
      order: "college_id.asc,specialty_id.asc,level_num.asc",
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
    return await fetchLevelPositionsForColleges(
      Array.from(userPerms.effective_scope.colleges)
    );
  }

  return [];
}

// ============================================
// مساعد داخلي: جلب مناصب level عبر specialty_id لكليات محددة
// ============================================
// 1. اقرأ specialties في الكليات المحددة
// 2. فلتر positions بـ specialty_id=in.(...)
async function fetchLevelPositionsForColleges(collegeIds: number[]): Promise<UserPosition[]> {
  if (collegeIds.length === 0) return [];

  // 1. اقرأ specialty_ids للكليات المحددة
  let specialtyIds: number[] = [];
  try {
    const specFilter = `college_id=in.(${collegeIds.join(",")})`;
    const specs = await supabaseClient.select<{ id: number }>("specialties", {
      columns: "id",
      filter: specFilter,
    });
    if (Array.isArray(specs)) {
      specialtyIds = specs.map((s) => s.id);
    }
  } catch (e) {
    console.warn(`⚠️ [RBAC] Failed to load specialties for colleges ${collegeIds}:`, e);
    return [];
  }

  if (specialtyIds.length === 0) return [];

  // 2. فلتر positions بـ specialty_id=in.(...)
  const filter = `level=eq.level&specialty_id=in.(${specialtyIds.join(",")})`;
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
    order: "specialty_id.asc,level_num.asc",
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

// ============================================
// الحصول على المحتوى الذي يمكن للمستخدم إدارته
// ============================================
// يستخدم Supabase مع PostgREST filters.
// لو مركزي: كل المحتوى النشط.
// لو مسؤول كلية/مستوى: المحتوى في كلياته فقط.
//
// ملاحظة معمارية: جدول content لا يحتوي على college_id/specialty_id/level/semester.
// العلاقة: content.subject_id → subjects.id → subjects.specialty_id → specialties.id → specialties.college_id
// لذا نطبّق فلتر النطاق عبر JOIN منطقي: نجلب subject_ids للكليات أولاً ثم نفلتر content.
export async function getManageableContent(
  telegramId: number,
  filters?: {
    college_id?: number;
    specialty_id?: number;
    subject_id?: number;
    content_type?: string;
  }
): Promise<any[]> {
  try {
    const userPerms = await getUserPermissions(telegramId);

    // بناء الفلتر الأساسي
    const filterParts: string[] = ["is_active=eq.true"];

    // فلتر النطاق حسب الصلاحية
    if (!userPerms.is_central) {
      const collegeIds = Array.from(userPerms.effective_scope.colleges || []);
      if (collegeIds.length === 0) return [];

      // اجلب specialty_ids للكليات
      let specIds: number[] = [];
      try {
        const specs = await supabaseClient.select("specialties", {
          columns: "id",
          filter: `college_id=in.(${collegeIds.join(",")})`,
          limit: 200,
        });
        specIds = (Array.isArray(specs) ? specs : []).map((s: any) => s.id);
      } catch (e) {
        console.error("getManageableContent: specialties fetch error:", e);
        return [];
      }
      if (specIds.length === 0) return [];

      // اجلب subject_ids للتخصصات
      let subjectIds: number[] = [];
      try {
        const subjects = await supabaseClient.select("subjects", {
          columns: "id",
          filter: `specialty_id=in.(${specIds.join(",")})`,
          limit: 1000,
        });
        subjectIds = (Array.isArray(subjects) ? subjects : []).map((s: any) => s.id);
      } catch (e) {
        console.error("getManageableContent: subjects fetch error:", e);
        return [];
      }
      if (subjectIds.length === 0) return [];

      filterParts.push(`subject_id=in.(${subjectIds.join(",")})`);
    }

    // فلاتر اختيارية إضافية
    if (filters?.subject_id) filterParts.push(`subject_id=eq.${filters.subject_id}`);
    if (filters?.content_type) filterParts.push(`content_type_id=eq.${filters.content_type}`);

    // لو فلتر college_id أو specialty_id محدد — نطبّقه عبر subject_ids
    if (filters?.college_id || filters?.specialty_id) {
      let specFilter = "";
      if (filters?.specialty_id) {
        specFilter = `specialty_id=eq.${filters.specialty_id}`;
      } else if (filters?.college_id) {
        const specs = await supabaseClient.select("specialties", {
          columns: "id",
          filter: `college_id=eq.${filters.college_id}`,
          limit: 200,
        });
        const specIds = (Array.isArray(specs) ? specs : []).map((s: any) => s.id);
        if (specIds.length === 0) return [];
        specFilter = `specialty_id=in.(${specIds.join(",")})`;
      }
      const subjects = await supabaseClient.select("subjects", {
        columns: "id",
        filter: specFilter,
        limit: 1000,
      });
      const subjectIds = (Array.isArray(subjects) ? subjects : []).map((s: any) => s.id);
      if (subjectIds.length === 0) return [];
      filterParts.push(`subject_id=in.(${subjectIds.join(",")})`);
    }

    const result = await supabaseClient.select("content", {
      columns: "id,title,file_name,file_size_mb,file_size_bytes,mime_type,subject_id,content_type_id,telegram_message_id,telegram_file_id,is_starred,download_count,added_at,academic_year,added_by_telegram_id,added_by_position_id",
      filter: filterParts.join("&"),
      order: "is_starred.desc,added_at.desc",
      limit: 50,
    });

    return Array.isArray(result) ? result : [];
  } catch (e) {
    console.error("getManageableContent error:", e);
    return [];
  }
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
