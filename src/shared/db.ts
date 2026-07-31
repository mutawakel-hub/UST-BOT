// ============================================
// 🗄️ Supabase Client for Cloudflare Workers
// ============================================
// عميل خفيف لـ Supabase REST API (PostgREST)
// يعمل في بيئة Cloudflare Workers بدون مكتبات إضافية
// ============================================

export interface SupabaseEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

// ============================================
// عميل Supabase الأساسي
// ============================================
export class SupabaseClient {
  private url: string;
  private key: string;

  constructor(env: SupabaseEnv) {
    this.url = env.SUPABASE_URL;
    this.key = env.SUPABASE_SERVICE_KEY;
  }

  // ============================================
  // استعلام SELECT
  // ============================================
  // ملاحظات:
  //   - الفلاتر يتم تمريرها كما هي (يجب أن تكون URL-encoded من caller)
  //     استخدم الدوال المساعدة eq/neq/inList أدناه—they تُرمّز تلقائياً
  //   - single: true → يضبط Accept: application/vnd.pgrst.object+json
  //     ويرجع كائناً واحداً (أو null لو لا نتائج بدل 406)
  //   - columns: لا تُرمّز (PostgREST يقبل الفواصل كما هي)
  // ============================================
  async select<T = any>(
    table: string,
    options: {
      columns?: string;
      filter?: string;
      order?: string;
      limit?: number;
      offset?: number;
      single?: boolean;
    } = {}
  ): Promise<T | T[]> {
    // PostgREST يقبل columns بفواصل عادية بدون encoding
    // encodeURIComponent يحوّل ',' إلى '%2C' مما يكسر بعض الاستعلامات
    const columns = options.columns || "*";
    let path = `/rest/v1/${table}?select=${columns}`;

    if (options.filter) path += `&${options.filter}`;
    if (options.order) path += `&order=${options.order}`;
    if (options.limit) path += `&limit=${options.limit}`;
    if (options.offset !== undefined) path += `&offset=${options.offset}`;
    if (options.single) path += `&limit=1`;

    const headers = this.getHeaders();
    if (options.single) {
      // PostgREST: يستخدم header Accept خاص لـ single-object mode
      headers["Accept"] = "application/vnd.pgrst.object+json";
      // Prefer: count=exact يضمن إرجاع 406 (وليس 200 فارغ) لو لا نتائج
      headers["Prefer"] = "count=exact";
    }

    // LOG: اطبع الـ URL الكامل للتشخيص
    const fullUrl = `${this.url}${path}`;
    console.log(`📤 [DB] SELECT ${table}: ${fullUrl.substring(0, 200)}`);

    const resp = await fetch(fullUrl, { headers });

    console.log(`📊 [DB] Response status: ${resp.status}`);

    // في single mode، 406 يعني "لا نتائج" — نُرجع null بدل رمي خطأ
    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`❌ [DB] SELECT error ${resp.status}: ${errText.substring(0, 300)}`);
      if (options.single && (resp.status === 406 || resp.status === 400)) {
        return null as T;
      }
      throw new Error(`Supabase SELECT error: ${errText}`);
    }

    // single mode: قد تُرجع body فارغ أو كائن واحد
    if (options.single) {
      const text = await resp.text();
      if (!text) return null as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        return null as T;
      }
    }

    const data = await resp.json();
    console.log(`✅ [DB] SELECT ${table} returned ${Array.isArray(data) ? data.length : 1} rows`);
    return data as T[];
  }

  // ============================================
  // إدراج INSERT
  // ============================================
  async insert<T = any>(table: string, data: any): Promise<T> {
    const resp = await fetch(`${this.url}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        ...this.getHeaders(),
        "Prefer": "return=representation",
      },
      body: JSON.stringify(data),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Supabase INSERT error: ${err}`);
    }

    const result = await resp.json();
    return (Array.isArray(result) ? result[0] : result) as T;
  }

  // ============================================
  // تحديث UPDATE
  // ============================================
  async update<T = any>(
    table: string,
    data: any,
    filter: string
  ): Promise<T[]> {
    const resp = await fetch(`${this.url}/rest/v1/${table}?${filter}`, {
      method: "PATCH",
      headers: {
        ...this.getHeaders(),
        "Prefer": "return=representation",
      },
      body: JSON.stringify(data),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Supabase UPDATE error: ${err}`);
    }

    return resp.json();
  }

  // ============================================
  // حذف DELETE
  // ============================================
  async delete(table: string, filter: string): Promise<void> {
    const resp = await fetch(`${this.url}/rest/v1/${table}?${filter}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Supabase DELETE error: ${err}`);
    }
  }

  // ============================================
  // استدعاء Function (RPC)
  // ============================================
  async rpc<T = any>(functionName: string, params: any): Promise<T> {
    const resp = await fetch(`${this.url}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      headers: {
        ...this.getHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Supabase RPC error: ${err}`);
    }

    return resp.json();
  }

  // ============================================
  // الـ Headers
  // ============================================
  private getHeaders(): Record<string, string> {
    return {
      "apikey": this.key,
      "Authorization": `Bearer ${this.key}`,
      "Content-Type": "application/json",
    };
  }
}

// ============================================
// دوال مساعدة: بناء الفلاتر (URL-encoded)
// ============================================
// ملاحظة مهمة: هذه الدوال تُرمّز القيم تلقائياً لـ URL
// لذا لا داعي لاستدعاء encodeURIComponent من caller.
// مثال: eq("name", "أحمد") → "name=eq.%D8%A3%D8%AD%D9%85%D8%AF"
// ============================================
export function eq(column: string, value: any): string {
  const v = typeof value === "string" ? value : JSON.stringify(value);
  return `${column}=eq.${encodeURIComponent(v)}`;
}

export function neq(column: string, value: any): string {
  const v = typeof value === "string" ? value : JSON.stringify(value);
  return `${column}=neq.${encodeURIComponent(v)}`;
}

export function inList(column: string, values: any[]): string {
  const formatted = values.map((v) => {
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return encodeURIComponent(`"${s}"`);
  }).join(",");
  return `${column}=in.(${formatted})`;
}

export function order(column: string, ascending = true): string {
  return `${column}.${ascending ? "asc" : "desc"}`;
}

// ============================================
// دوال خاصة بالتطبيق
// ============================================

// تسجيل طالب جديد (أو تحديث بياناته)
export async function registerStudent(
  client: SupabaseClient,
  telegramId: number,
  firstName: string,
  username: string | undefined,
  collegeId: number,
  specialtyId: number,
  level: number
): Promise<void> {
  await client.rpc("register_student", {
    p_telegram_id: telegramId,
    p_first_name: firstName,
    p_username: username || null,
    p_college_id: collegeId,
    p_specialty_id: specialtyId,
    p_level: level,
  });
}

// التحقق من تسجيل الطالب
export async function isStudentRegistered(
  client: SupabaseClient,
  telegramId: number
): Promise<boolean> {
  const result = await client.select<{ telegram_id: number }>("students", {
    columns: "telegram_id",
    filter: eq("telegram_id", telegramId),
    limit: 1,
  });
  return Array.isArray(result) && result.length > 0;
}

// الحصول على بيانات الطالب
export async function getStudent(
  client: SupabaseClient,
  telegramId: number
): Promise<any | null> {
  const result = await client.select("students", {
    filter: eq("telegram_id", telegramId),
    single: true,
  });
  return result || null;
}

// الحصول على مستلمي التعميم
// ============================================
// يستخدم RPC function `get_broadcast_recipients` أولاً
// لو فشل (أو أرجع 0)، يستخدم SELECT مباشر كـ fallback
// هذا يضمن عمل التعميم حتى لو كان هناك مشكلة في الـ RPC
// ============================================
export async function getBroadcastRecipients(
  client: SupabaseClient,
  scopeType: string,
  collegeId?: number,
  specialtyId?: number,
  level?: number
): Promise<number[]> {
  // === محاولة 1: RPC function ===
  try {
    const result = await client.rpc("get_broadcast_recipients", {
      p_scope_type: scopeType,
      p_college_id: collegeId || null,
      p_specialty_id: specialtyId || null,
      p_level: level || null,
    });

    // PostgREST قد يُرجع:
    //   - array مباشرة: [{telegram_id: 123}, ...]
    //   - object ملتف: {data: [...]}
    //   - string عند الخطأ
    let arr: any[] = [];
    if (Array.isArray(result)) {
      arr = result;
    } else if (result && Array.isArray((result as any).data)) {
      arr = (result as any).data;
    } else if (result && typeof result === "object") {
      // لو object واحد (وليس array)، حوله لـ array
      arr = [result];
    }

    const ids = arr
      .map((r: any) => r?.telegram_id || r?.id)
      .filter((id: any) => id != null);
    
    if (ids.length > 0) {
      return ids;
    }
    // لو 0 نتائج، نحاول fallback للتأكد
  } catch (e) {
    console.warn("⚠️ [getBroadcastRecipients] RPC failed, trying fallback:", e);
  }

  // === محاولة 2: SELECT مباشر (fallback) ===
  try {
    if (scopeType === "all") {
      // كل الطلاب غير المحظورين
      const result = await client.select<{ telegram_id: number }>("students", {
        columns: "telegram_id",
        filter: "is_blocked=eq.false",
        limit: 10000,
      });
      if (Array.isArray(result)) {
        return result.map((r: any) => r.telegram_id);
      }
    } else if (scopeType === "college" && collegeId) {
      // عبر student_subscriptions
      const result = await client.select<{ student_telegram_id: number }>("student_subscriptions", {
        columns: "student_telegram_id",
        filter: `scope_college_id=eq.${collegeId}&is_active=eq.true`,
        limit: 10000,
      });
      if (Array.isArray(result)) {
        return result.map((r: any) => r.student_telegram_id);
      }
    } else if (scopeType === "specialty" && collegeId && specialtyId) {
      const result = await client.select<{ student_telegram_id: number }>("student_subscriptions", {
        columns: "student_telegram_id",
        filter: `scope_college_id=eq.${collegeId}&scope_specialty_id=eq.${specialtyId}&is_active=eq.true`,
        limit: 10000,
      });
      if (Array.isArray(result)) {
        return result.map((r: any) => r.student_telegram_id);
      }
    } else if (scopeType === "level" && collegeId && specialtyId && level) {
      const result = await client.select<{ student_telegram_id: number }>("student_subscriptions", {
        columns: "student_telegram_id",
        filter: `scope_college_id=eq.${collegeId}&scope_specialty_id=eq.${specialtyId}&scope_level=eq.${level}&is_active=eq.true`,
        limit: 10000,
      });
      if (Array.isArray(result)) {
        return result.map((r: any) => r.student_telegram_id);
      }
    }
  } catch (e) {
    console.error("❌ [getBroadcastRecipients] Fallback also failed:", e);
  }

  return [];
}

// الحصول على عدد المساهمات المعلقة لمسؤول مستوى
// ============================================
// يستخدم RPC function `count_pending_for_scope` الذرّي
// Function معرّفة في db/schema.sql
// تستخدم JOIN داخلي بين contributions و subjects للفلترة بالنطاق
// ============================================
export async function getPendingContributionsCount(
  client: SupabaseClient,
  collegeId: number,
  specialtyId: number,
  level: number
): Promise<number> {
  try {
    const result = await client.rpc("count_pending_for_scope", {
      p_college_id: collegeId,
      p_specialty_id: specialtyId,
      p_level: level,
    });
    return Number(result) || 0;
  } catch (e) {
    console.error("getPendingContributionsCount RPC failed:", e);
    // Fallback: عدّ كامل المساهمات المعلقة (بدون فلترة بالنطاق)
    try {
      const all = await client.select<{ id: number }>("contributions", {
        columns: "id",
        filter: "status=eq.pending",
      });
      return Array.isArray(all) ? all.length : 0;
    } catch (e2) {
      console.error("Fallback also failed:", e2);
      return 0;
    }
  }
}

// ============================================
// دوال المحتوى (Content)
// ============================================

// الحصول على محتوى مادة حسب التصنيف
export async function getContentForSubject(
  client: SupabaseClient,
  subjectId: number,
  contentType: string
): Promise<any[]> {
  const result = await client.select("content", {
    columns: "id,title,file_name,file_size_mb,telegram_message_id,telegram_file_id,is_starred,download_count,added_at,added_by_telegram_id,academic_year",
    filter: `subject_id=eq.${subjectId}&content_type_id=eq.${contentType}&is_active=eq.true`,
    order: "is_starred.desc,download_count.desc",
  });
  return Array.isArray(result) ? result : [];
}

// الحصول على محتوى بالمعرف
export async function getContentById(
  client: SupabaseClient,
  contentId: number
): Promise<any | null> {
  const result = await client.select("content", {
    columns: "id,title,file_name,file_size_mb,telegram_message_id,telegram_file_id,content_type_id,subject_id,is_starred,download_count,added_at,added_by_telegram_id,academic_year,is_active",
    filter: `id=eq.${contentId}`,
    single: true,
  });
  return result || null;
}

// تحديث عدّاد التحميلات
// ============================================
// يستخدم RPC function `increment_download` الذرّي (atomic)
// يحل مشكلة race condition في SELECT-then-UPDATE
// Function معرّفة في db/schema.sql
// ============================================
export async function incrementDownloadCount(
  client: SupabaseClient,
  contentId: number
): Promise<void> {
  try {
    await client.rpc("increment_download", { p_content_id: contentId });
  } catch (e) {
    // تجاهل أخطاء عداد التحميل — لا يجب أن تفشل تجربة المستخدم بسببها
    console.error("incrementDownloadCount error (ignored):", e);
  }
}

// ============================================
// دوال قنوات اللجان (Committee Channels)
// ============================================

export async function getCommitteeChannelsFromDB(
  client: SupabaseClient,
  options?: {
    scope_type?: string;
    college_id?: number;
    specialty_id?: number;
    level_num?: number;
  }
): Promise<any[]> {
  let filter = "is_active=eq.true";
  if (options?.scope_type) filter += `&scope_type=eq.${options.scope_type}`;
  if (options?.college_id) filter += `&college_id=eq.${options.college_id}`;
  if (options?.specialty_id) filter += `&specialty_id=eq.${options.specialty_id}`;
  if (options?.level_num) filter += `&level_num=eq.${options.level_num}`;

  const result = await client.select("committee_channels", {
    columns: "id,scope_type,college_id,specialty_id,level_num,channel_url,display_name",
    filter,
  });
  return Array.isArray(result) ? result : [];
}

// ============================================
// دوال الإشعارات (Student Notifications)
// ============================================

export async function getStudentNotifications(
  client: SupabaseClient,
  telegramId: number,
  unreadOnly = false
): Promise<any[]> {
  let filter = `student_telegram_id=eq.${telegramId}`;
  if (unreadOnly) filter += "&is_read=eq.false";

  const result = await client.select("student_notifications", {
    columns: "id,notification_type,title,body,is_read,created_at",
    filter,
    order: "created_at.desc",
    limit: 20,
  });
  return Array.isArray(result) ? result : [];
}

export async function getUnreadNotificationsCount(
  client: SupabaseClient,
  telegramId: number
): Promise<number> {
  const result = await client.select("student_notifications", {
    columns: "id",
    filter: `student_telegram_id=eq.${telegramId}&is_read=eq.false`,
  });
  return Array.isArray(result) ? result.length : 0;
}

export async function markNotificationsRead(
  client: SupabaseClient,
  telegramId: number
): Promise<void> {
  await client.update("student_notifications", {
    is_read: true,
  }, `student_telegram_id=eq.${telegramId}&is_read=eq.false`);
}

// ============================================
// دوال لوحة الشرف (Leaderboard)
// ============================================

export async function getTopContributorsFromDB(
  client: SupabaseClient,
  limit = 10
): Promise<any[]> {
  const result = await client.select("students", {
    columns: "telegram_id,first_name,total_points_current_cycle,accepted_contributions,current_college_id,current_specialty_id,current_level",
    filter: "is_blocked=eq.false&total_points_current_cycle=gt.0",
    order: "total_points_current_cycle.desc",
    limit,
  });
  return Array.isArray(result) ? result : [];
}

// أعلى المحسنين في تخصص + مستوى محدد
// يستعلم من جدول students مع فلترة current_specialty_id + current_level
// (ملاحظة: دالة RPC get_top_contributors_specialty لا تدعم فلترة المستوى)
// ============================================
export async function getTopContributorsForLevel(
  client: SupabaseClient,
  specialtyId: number,
  level: number,
  limit = 3
): Promise<any[]> {
  const result = await client.select("students", {
    columns: "telegram_id,first_name,total_points_current_cycle,accepted_contributions",
    filter: `is_blocked=eq.false&current_specialty_id=eq.${specialtyId}&current_level=eq.${level}&total_points_current_cycle=gt.0`,
    order: "total_points_current_cycle.desc",
    limit,
  });
  return Array.isArray(result) ? result : [];
}

// ترتيب الطالب في مستواه (عدد الطلاب بنفس التخصص+المستوى ونقاط أكثر + 1)
// يُرجع 0 لو الطالب لا يملك نقاطاً (غير مُصنّف)
// ============================================
export async function getStudentRankInLevel(
  client: SupabaseClient,
  telegramId: number,
  specialtyId: number,
  level: number,
  currentPoints: number
): Promise<number> {
  if (!currentPoints || currentPoints <= 0) return 0;
  try {
    const result = await client.select<{ telegram_id: number }>("students", {
      columns: "telegram_id",
      filter: `is_blocked=eq.false&current_specialty_id=eq.${specialtyId}&current_level=eq.${level}&total_points_current_cycle=gt.${currentPoints}`,
    });
    const ahead = Array.isArray(result) ? result.length : 0;
    return ahead + 1;
  } catch (e) {
    console.error("getStudentRankInLevel error:", e);
    return 0;
  }
}

// ============================================
// دوال المساهمات (Contributions)
// ============================================

export async function getStudentContributions(
  client: SupabaseClient,
  telegramId: number
): Promise<any[]> {
  const result = await client.select("contributions", {
    columns: "id,title,description,file_name,subject_id,content_type_id,status,is_starred,points_awarded,reject_reason,created_at,reviewed_at",
    filter: `user_telegram_id=eq.${telegramId}`,
    order: "created_at.desc",
    limit: 20,
  });
  return Array.isArray(result) ? result : [];
}

// ============================================
// دوال التحميلات (Downloads)
// ============================================

export async function logDownload(
  client: SupabaseClient,
  studentTelegramId: number,
  contentId: number
): Promise<void> {
  try {
    await client.insert("downloads", {
      student_telegram_id: studentTelegramId,
      content_id: contentId,
    });
  } catch (e) {
    // تجاهل الأخطاء (قد لا يكون الطالب مسجلاً في students)
  }
}

export async function getRecentDownloads(
  client: SupabaseClient,
  telegramId: number,
  limit = 5
): Promise<any[]> {
  const result = await client.select("downloads", {
    columns: "id,content_id,downloaded_at",
    filter: `student_telegram_id=eq.${telegramId}`,
    order: "downloaded_at.desc",
    limit,
  });
  return Array.isArray(result) ? result : [];
}

// ============================================
// دوال التعميمات (Broadcasts)
// ============================================

export async function logBroadcast(
  client: SupabaseClient,
  data: {
    sender_telegram_id: number;
    sender_position_id?: string;
    scope_type: string;
    scope_college_id?: number;
    scope_specialty_id?: number;
    scope_level?: number;
    content_type: string;
    text_content?: string;
    media_file_id?: string;
    sent_count: number;
  }
): Promise<void> {
  try {
    await client.insert("broadcasts", {
      ...data,
      status: "completed",
    });
  } catch (e) {
    // تجاهل
  }
}

// ============================================
// دوال المواد (Subjects CRUD)
// ============================================

// قراءة مادة بالمعرف
export async function getSubjectByIdFromDB(
  client: SupabaseClient,
  subjectId: number
): Promise<any | null> {
  try {
    const result = await client.select("subjects", {
      columns: "id,specialty_id,level,semester,name,name_normalized,has_theory,has_practical,is_active,sort_order,code,credits,prerequisites,description,updated_at",
      filter: `id=eq.${subjectId}`,
      single: true,
    });
    return result || null;
  } catch (e) {
    console.error("getSubjectByIdFromDB error:", e);
    return null;
  }
}

// قراءة مواد تخصص/مستوى/فصل
export async function getSubjectsBySpecLevelSemesterFromDB(
  client: SupabaseClient,
  specialtyId: number,
  level: number,
  semester: number
): Promise<any[]> {
  try {
    const result = await client.select("subjects", {
      columns: "id,specialty_id,level,semester,name,has_theory,has_practical,is_active,sort_order,code,credits",
      filter: `specialty_id=eq.${specialtyId}&level=eq.${level}&semester=eq.${semester}&is_active=eq.true`,
      order: "sort_order.asc,name.asc",
    });
    return Array.isArray(result) ? result : [];
  } catch (e) {
    console.error("getSubjectsBySpecLevelSemesterFromDB error:", e);
    return [];
  }
}

// قراءة كل مواد تخصص (كل المستويات والفصول)
export async function getSubjectsBySpecialtyFromDB(
  client: SupabaseClient,
  specialtyId: number
): Promise<any[]> {
  try {
    const result = await client.select("subjects", {
      columns: "id,specialty_id,level,semester,name,has_theory,has_practical,is_active,sort_order,code,credits",
      filter: `specialty_id=eq.${specialtyId}&is_active=eq.true`,
      order: "level.asc,semester.asc,sort_order.asc,name.asc",
    });
    return Array.isArray(result) ? result : [];
  } catch (e) {
    console.error("getSubjectsBySpecialtyFromDB error:", e);
    return [];
  }
}

// إضافة مادة جديدة
export async function createSubject(
  client: SupabaseClient,
  data: {
    specialty_id: number;
    level: number;
    semester: number;
    name: string;
    name_normalized: string;
    has_theory: boolean;
    has_practical: boolean;
    code?: string | null;
    credits?: number | null;
    sort_order: number;
    is_active?: boolean;
  }
): Promise<number | null> {
  try {
    const result = await client.insert("subjects", {
      ...data,
      is_active: data.is_active ?? true,
    }) as any;
    return result?.id || null;
  } catch (e) {
    console.error("createSubject error:", e);
    return null;
  }
}

// تحديث مادة
export async function updateSubject(
  client: SupabaseClient,
  subjectId: number,
  patch: any
): Promise<boolean> {
  try {
    await client.update("subjects", patch, `id=eq.${subjectId}`);
    return true;
  } catch (e) {
    console.error("updateSubject error:", e);
    return false;
  }
}

// حذف مادة (soft delete)
export async function deleteSubject(
  client: SupabaseClient,
  subjectId: number
): Promise<boolean> {
  try {
    await client.update("subjects", {
      is_active: false,
    }, `id=eq.${subjectId}`);
    return true;
  } catch (e) {
    console.error("deleteSubject error:", e);
    return false;
  }
}

// تبديل ترتيب مادة (RPC)
export async function swapSubjectSortOrder(
  client: SupabaseClient,
  subjectId: number,
  direction: "up" | "down"
): Promise<boolean> {
  try {
    await client.rpc("swap_subject_sort_order", {
      p_subject_id: subjectId,
      p_direction: direction,
    });
    return true;
  } catch (e) {
    console.error("swapSubjectSortOrder error:", e);
    return false;
  }
}

// عدد المحتوى المرتبط بمادة
export async function getContentCountForSubject(
  client: SupabaseClient,
  subjectId: number
): Promise<number> {
  try {
    const result = await client.select("content", {
      columns: "id",
      filter: `subject_id=eq.${subjectId}&is_active=eq.true`,
      limit: 1000,
    });
    return Array.isArray(result) ? result.length : 0;
  } catch (e) {
    return 0;
  }
}

// كتابة سجل تدقيق للمادة
export async function writeSubjectAuditLog(
  client: SupabaseClient,
  data: {
    subject_id: number | null;
    action: "create" | "update" | "move_semester" | "move_level" | "reorder" | "delete" | "activate" | "deactivate";
    old_data?: any;
    new_data?: any;
    performed_by_position_id: string;
    performed_by_telegram_id: number;
  }
): Promise<void> {
  try {
    await client.insert("subject_audit_logs", {
      subject_id: data.subject_id,
      action: data.action,
      old_data: data.old_data || null,
      new_data: data.new_data || null,
      performed_by_position_id: data.performed_by_position_id,
      performed_by_telegram_id: data.performed_by_telegram_id,
    });
  } catch (e) {
    console.error("writeSubjectAuditLog error:", e);
  }
}

// ============================================
// دوال قنوات اللجان (Committee Channels CRUD)
// ============================================

// إضافة قناة جديدة
export async function createCommitteeChannel(
  client: SupabaseClient,
  data: {
    scope_type: "central" | "college" | "specialty_level";
    college_id?: number | null;
    specialty_id?: number | null;
    level_num?: number | null;
    channel_url: string;
    channel_id?: string | null;
    display_name: string;
    is_active?: boolean;
    updated_by_position_id?: string;
  }
): Promise<number | null> {
  try {
    const result = await client.insert("committee_channels", {
      scope_type: data.scope_type,
      college_id: data.college_id || null,
      specialty_id: data.specialty_id || null,
      level_num: data.level_num || null,
      channel_url: data.channel_url,
      channel_id: data.channel_id || null,
      display_name: data.display_name,
      is_active: data.is_active ?? true,
      updated_by_position_id: data.updated_by_position_id || null,
    }) as any;
    return result?.id || null;
  } catch (e) {
    console.error("createCommitteeChannel error:", e);
    return null;
  }
}

// تحديث قناة
export async function updateCommitteeChannel(
  client: SupabaseClient,
  channelId: number,
  patch: any
): Promise<boolean> {
  try {
    await client.update("committee_channels", patch, `id=eq.${channelId}`);
    return true;
  } catch (e) {
    console.error("updateCommitteeChannel error:", e);
    return false;
  }
}

// حذف قناة (soft delete)
export async function deleteCommitteeChannel(
  client: SupabaseClient,
  channelId: number
): Promise<boolean> {
  try {
    await client.update("committee_channels", {
      is_active: false,
    }, `id=eq.${channelId}`);
    return true;
  } catch (e) {
    console.error("deleteCommitteeChannel error:", e);
    return false;
  }
}

// تفعيل/تعطيل قناة
export async function toggleCommitteeChannel(
  client: SupabaseClient,
  channelId: number
): Promise<boolean> {
  try {
    // اقرأ الحالة الحالية
    const result = await client.select("committee_channels", {
      columns: "is_active",
      filter: `id=eq.${channelId}`,
      single: true,
    }) as any;
    const current = Array.isArray(result) ? result[0] : result;
    const newState = !(current?.is_active ?? true);
    await client.update("committee_channels", {
      is_active: newState,
    }, `id=eq.${channelId}`);
    return newState;
  } catch (e) {
    console.error("toggleCommitteeChannel error:", e);
    return false;
  }
}

// تطبيع اسم المادة (إزالة التشكيل + توحيد الهمزات)
export function normalizeSubjectName(name: string): string {
  return name
    .replace(/[\u064B-\u065F\u0670]/g, "")  // إزالة التشكيل
    .replace(/[أإآ]/g, "ا")                  // توحيد الهمزات
    .replace(/ى/g, "ي")                       // توحيد الألف المقصورة
    .replace(/ة/g, "ه")                       // توحيد التاء المربوطة
    .trim()
    .toLowerCase();
}
